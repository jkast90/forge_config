use anyhow::Result;
use chrono::Utc;
use std::path::Path;
use std::sync::Arc;
use tokio::sync::mpsc;
use tokio::time::{sleep, Duration};

use crate::db::Store;
use crate::models::Lease;

/// Backup service handles automated config backups via SSH
pub struct BackupService {
    store: Store,
    backup_dir: String,
    pending_tx: mpsc::Sender<i64>,
}

impl BackupService {
    pub fn new(store: Store, backup_dir: String) -> Arc<Self> {
        let (pending_tx, pending_rx) = mpsc::channel(100);

        let service = Arc::new(Self {
            store,
            backup_dir,
            pending_tx,
        });

        // Start the worker
        let worker_service = service.clone();
        tokio::spawn(async move {
            worker_service.worker(pending_rx).await;
        });

        service
    }

    /// Queue a backup for a device by ID
    pub async fn queue_backup(&self, device_id: i64) {
        if let Err(e) = self.pending_tx.send(device_id).await {
            tracing::warn!("Failed to queue backup for {}: {}", device_id, e);
        }
    }

    /// Trigger an immediate backup for a device by ID
    pub async fn trigger_backup(&self, device_id: i64) {
        self.queue_backup(device_id).await;
    }

    /// Handle a new DHCP lease event
    pub async fn on_new_lease(&self, lease: Lease) {
        // Check if this MAC is registered
        let device = match self.store.get_device_by_mac(&lease.mac).await {
            Ok(Some(device)) => device,
            _ => return,
        };

        // Update device status
        if let Err(e) = self.store.update_device_status(device.id, crate::models::device_status::PROVISIONING).await {
            tracing::warn!("Failed to update device status: {}", e);
        }

        // Get settings for backup delay
        let backup_delay = match self.store.get_settings().await {
            Ok(settings) => settings.backup_delay,
            Err(e) => {
                tracing::warn!("Failed to load settings for backup delay, using default: {}", e);
                30
            }
        };

        tracing::info!(
            "Scheduling backup for {} ({}) in {} seconds",
            device.hostname,
            lease.ip,
            backup_delay
        );

        // Schedule backup after delay using device ID
        let device_id = device.id;
        let tx = self.pending_tx.clone();
        tokio::spawn(async move {
            sleep(Duration::from_secs(backup_delay as u64)).await;
            if let Err(e) = tx.send(device_id).await {
                tracing::warn!("Failed to queue scheduled backup: {}", e);
            }
        });
    }

    async fn worker(&self, mut pending_rx: mpsc::Receiver<i64>) {
        while let Some(device_id) = pending_rx.recv().await {
            if let Err(e) = self.perform_backup(device_id).await {
                tracing::error!("Backup failed for {}: {}", device_id, e);
            }
        }
    }

    async fn perform_backup(&self, device_id: i64) -> Result<()> {
        let device = self
            .store
            .get_device(device_id)
            .await?
            .ok_or_else(|| crate::db::NotFoundError::new("Device", &device_id.to_string()))?;

        let settings = self.store.get_settings().await?;

        // Determine credentials
        let user = device
            .ssh_user
            .clone()
            .filter(|s| !s.is_empty())
            .unwrap_or(settings.default_ssh_user.clone());
        let pass = device
            .ssh_pass
            .clone()
            .filter(|s| !s.is_empty())
            .unwrap_or(settings.default_ssh_pass.clone());

        // Determine backup command
        let command = if let Some(vendor_id) = &device.vendor {
            if let Ok(Some(vendor)) = self.store.get_vendor(vendor_id).await {
                if !vendor.backup_command.is_empty() {
                    vendor.backup_command
                } else {
                    settings.backup_command.clone()
                }
            } else {
                settings.backup_command.clone()
            }
        } else {
            settings.backup_command.clone()
        };

        tracing::info!(
            "Starting backup for {} ({}) as {}",
            device.hostname,
            device.ip,
            user
        );

        // Connect via SSH with retries
        let mut config_output = String::new();
        let mut last_error = None;

        for attempt in 1..=3 {
            match ssh_command(&device.ip, &user, &pass, &command).await {
                Ok(output) => {
                    config_output = output;
                    last_error = None;
                    break;
                }
                Err(e) => {
                    tracing::warn!("SSH attempt {} failed for {}: {}", attempt, device.ip, e);
                    last_error = Some(e);
                    sleep(Duration::from_secs((attempt * 5) as u64)).await;
                }
            }
        }

        if let Some(e) = last_error {
            let err_msg = format!("SSH failed: {}", e);
            self.store.update_device_status(device_id, crate::models::device_status::OFFLINE).await?;
            self.store.update_device_error(device_id, &err_msg).await?;
            return Err(anyhow::anyhow!("All SSH attempts failed: {}", e));
        }

        // Save backup
        self.save_backup(&device.hostname, device_id, &config_output).await?;

        // Update device status
        self.store.update_device_status(device_id, crate::models::device_status::ONLINE).await?;
        self.store.update_device_backup_time(device_id).await?;
        self.store.clear_device_error(device_id).await?;

        tracing::info!("Backup completed for {}", device.hostname);
        Ok(())
    }

    async fn save_backup(&self, hostname: &str, device_id: i64, config: &str) -> Result<()> {
        // Ensure backup directory exists
        tokio::fs::create_dir_all(&self.backup_dir).await?;

        // Generate filename
        let timestamp = Utc::now().format("%Y%m%d_%H%M%S");
        let safe_name = hostname.replace('/', "_");
        let filename = format!("{}_{}.cfg", safe_name, timestamp);
        let file_path = Path::new(&self.backup_dir).join(&filename);

        // Write file
        tokio::fs::write(&file_path, config).await?;

        // Record in database
        let size = config.len() as i64;
        self.store.create_backup(device_id, &filename, size).await?;

        Ok(())
    }
}

async fn ssh_command(host: &str, user: &str, pass: &str, command: &str) -> Result<String> {
    crate::utils::ssh_run_command_async(host, user, pass, command)
        .await
        .map_err(|e| anyhow::anyhow!(e))
}
