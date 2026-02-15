mod auth;
mod backup;
mod config;
mod db;
mod dhcp;
mod handlers;
mod jobs;
mod models;
mod netbox;
mod router;
mod services;
mod status;
mod utils;
mod ws;

use std::sync::Arc;
use tokio::signal;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use backup::BackupService;
use config::Config;
use db::Store;
use dhcp::{ConfigManager, LeaseWatcher};
use jobs::JobService;
use status::StatusChecker;
use ws::Hub;

/// Application state shared across handlers
pub struct AppState {
    pub store: Store,
    pub config: Config,
    pub config_manager: ConfigManager,
    pub ws_hub: Option<Arc<Hub>>,
    pub backup_service: Option<Arc<BackupService>>,
    pub job_service: Option<Arc<JobService>>,
    pub lease_watcher: Option<Arc<tokio::sync::RwLock<LeaseWatcher>>>,
}

impl AppState {
    /// Trigger a config reload
    pub async fn trigger_config_reload(&self) -> anyhow::Result<()> {
        self.config_manager.generate_config().await
    }
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Initialize tracing
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "forge_config=info,tower_http=debug".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    // Load configuration
    let mut cfg = Config::load();
    if cfg.jwt_secret.is_empty() {
        tracing::warn!("JWT_SECRET not set - generating random secret (tokens will be invalidated on restart)");
        cfg.jwt_secret = uuid::Uuid::new_v4().to_string();
    }
    tracing::info!("Starting ForgeConfig Server");
    tracing::info!("Database: {}", cfg.db_path);
    tracing::info!("TFTP Dir: {}", cfg.tftp_dir);
    tracing::info!("Listen: {}", cfg.listen_addr);

    // Initialize database
    let store = Store::with_pool_size(&cfg.db_path, cfg.db_max_connections).await?;
    tracing::info!("Database initialized (pool_size={})", cfg.db_max_connections);

    // Initialize DHCP config manager
    let config_manager = ConfigManager::new(
        store.clone(),
        cfg.dnsmasq_config.clone(),
        cfg.tftp_dir.clone(),
        cfg.templates_dir.clone(),
        cfg.dnsmasq_pid.clone(),
        cfg.dhcp_interface.clone(),
        cfg.lease_path.clone(),
    );

    // Initialize WebSocket hub
    let ws_hub = Arc::new(Hub::new());

    // Initialize backup service
    let backup_service = BackupService::new(store.clone(), cfg.backup_dir.clone());

    // Initialize job service
    let job_service = JobService::new(store.clone(), Some(ws_hub.clone()));

    // Start job template scheduler
    job_service.start_scheduler();

    // Initialize lease watcher
    let mut lease_watcher = LeaseWatcher::new(cfg.lease_path.clone());

    // Register lease callback — delegates to the lease_handler service
    let backup_svc_clone = backup_service.clone();
    let store_clone = store.clone();
    let ws_hub_clone = ws_hub.clone();

    lease_watcher.add_callback(Arc::new(move |lease| {
        services::lease_handler::on_lease_event(
            store_clone.clone(),
            backup_svc_clone.clone(),
            ws_hub_clone.clone(),
            lease.clone(),
        );
    }));

    lease_watcher.start();
    let lease_watcher = Arc::new(tokio::sync::RwLock::new(lease_watcher));

    // Initialize status checker
    let mut status_checker = StatusChecker::new(store.clone(), 60);
    status_checker.start();

    // Start discovery cleanup task (removes items not seen in 5 minutes)
    {
        let store_cleanup = store.clone();
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(std::time::Duration::from_secs(60));
            loop {
                interval.tick().await;
                match store_cleanup.cleanup_stale_discovered_devices().await {
                    Ok(count) if count > 0 => {
                        tracing::info!("Cleaned up {} stale discovered devices", count);
                    }
                    Err(e) => {
                        tracing::warn!("Discovery cleanup failed: {}", e);
                    }
                    _ => {}
                }
            }
        });
    }

    // Generate initial config
    if let Err(e) = config_manager.generate_config().await {
        tracing::warn!("Failed to generate initial config: {}", e);
    }

    // Start dnsmasq (if not already running)
    start_dnsmasq(&cfg.dnsmasq_config, &cfg.dnsmasq_pid).await;

    // Create app state
    let state = Arc::new(AppState {
        store: store.clone(),
        config: cfg.clone(),
        config_manager,
        ws_hub: Some(ws_hub.clone()),
        backup_service: Some(backup_service),
        job_service: Some(job_service),
        lease_watcher: Some(lease_watcher),
    });

    // Build router
    let app = router::build(state, &cfg.frontend_dir);

    // Start server
    let listener = tokio::net::TcpListener::bind(&cfg.listen_addr).await?;
    tracing::info!("ForgeConfig listening on {}", cfg.listen_addr);

    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await?;

    tracing::info!("ForgeConfig shutting down");
    Ok(())
}

/// WebSocket upgrade handler
pub async fn ws_upgrade_handler(
    _auth: auth::AuthUser,
    ws: axum::extract::ws::WebSocketUpgrade,
    axum::extract::State(state): axum::extract::State<Arc<AppState>>,
) -> axum::response::Response {
    use axum::response::IntoResponse;

    if let Some(hub) = &state.ws_hub {
        ws::ws_handler(ws, axum::extract::State(hub.clone())).await
    } else {
        axum::http::StatusCode::SERVICE_UNAVAILABLE.into_response()
    }
}

async fn shutdown_signal() {
    let ctrl_c = async {
        if let Err(e) = signal::ctrl_c().await {
            tracing::error!("Failed to install Ctrl+C handler: {}", e);
        }
    };

    #[cfg(unix)]
    let terminate = async {
        match signal::unix::signal(signal::unix::SignalKind::terminate()) {
            Ok(mut sig) => { sig.recv().await; }
            Err(e) => {
                tracing::error!("Failed to install SIGTERM handler: {}", e);
                std::future::pending::<()>().await;
            }
        }
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => {},
        _ = terminate => {},
    }
}

async fn start_dnsmasq(config_path: &str, pid_file: &str) {
    use tokio::fs;
    use tokio::process::Command;

    // Check if dnsmasq is already running
    if let Ok(pid_data) = fs::read_to_string(pid_file).await {
        if let Ok(pid) = pid_data.trim().parse::<i32>() {
            #[cfg(unix)]
            {
                use nix::sys::signal::{kill, Signal};
                use nix::unistd::Pid;

                // Check if process exists
                if kill(Pid::from_raw(pid), None).is_ok() {
                    tracing::info!("dnsmasq already running (PID: {})", pid);
                    // Send SIGHUP to reload config
                    let _ = kill(Pid::from_raw(pid), Signal::SIGHUP);
                    return;
                }
            }
        }
    }

    // Start dnsmasq
    tracing::info!("Starting dnsmasq...");
    match Command::new("dnsmasq")
        .args([
            "--keep-in-foreground",
            "--log-facility=-",
            &format!("--conf-file={}", config_path),
        ])
        .spawn()
    {
        Ok(child) => {
            // Write PID file
            if let Some(id) = child.id() {
                if let Err(e) = fs::write(pid_file, id.to_string()).await {
                    tracing::warn!("Could not write dnsmasq PID file: {}", e);
                }
                tracing::info!("dnsmasq started (PID: {})", id);
            }
        }
        Err(e) => {
            tracing::warn!("Failed to start dnsmasq: {}", e);
        }
    }
}
