use tokio::process::Command;
use tokio::time::{interval, Duration};

use crate::db::Store;

/// Status checker periodically pings devices to check connectivity
pub struct StatusChecker {
    store: Store,
    interval_secs: u64,
    stop_tx: Option<tokio::sync::oneshot::Sender<()>>,
}

impl StatusChecker {
    pub fn new(store: Store, interval_secs: u64) -> Self {
        Self {
            store,
            interval_secs,
            stop_tx: None,
        }
    }

    /// Start the status checker
    pub fn start(&mut self) {
        let (stop_tx, mut stop_rx) = tokio::sync::oneshot::channel();
        self.stop_tx = Some(stop_tx);

        let store = self.store.clone();
        let interval_secs = self.interval_secs;

        tokio::spawn(async move {
            let mut ticker = interval(Duration::from_secs(interval_secs));

            loop {
                tokio::select! {
                    _ = ticker.tick() => {
                        if let Err(e) = check_all_devices(&store).await {
                            tracing::warn!("Error checking device status: {}", e);
                        }
                    }
                    _ = &mut stop_rx => {
                        tracing::info!("Status checker stopped");
                        break;
                    }
                }
            }
        });
    }

    /// Stop the status checker
    #[allow(dead_code)]
    pub fn stop(&mut self) {
        if let Some(tx) = self.stop_tx.take() {
            let _ = tx.send(());
        }
    }
}

async fn check_all_devices(store: &Store) -> anyhow::Result<()> {
    let devices = store.list_devices().await?;

    for device in devices {
        let is_reachable = ping_device(&device.ip).await;
        let new_status = if is_reachable { crate::models::device_status::ONLINE } else { crate::models::device_status::OFFLINE };

        // Only update if status changed or device is online (to update last_seen)
        if device.status != new_status || is_reachable {
            if let Err(e) = store.update_device_status(device.id, new_status).await {
                tracing::warn!("Failed to update status for {}: {}", device.id, e);
            }
        }
    }

    Ok(())
}

async fn ping_device(ip: &str) -> bool {
    if !crate::utils::is_valid_ipv4(ip) {
        return false;
    }

    let output = Command::new("ping")
        .args(["-c", "1", "-W", "2", ip])
        .output()
        .await;

    match output {
        Ok(output) => output.status.success(),
        Err(_) => false,
    }
}
