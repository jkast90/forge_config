use anyhow::Result;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tokio::time::{interval, Duration};

use crate::models::Lease;

/// Callback type for lease events
pub type LeaseCallback = Arc<dyn Fn(Lease) + Send + Sync>;

/// LeaseWatcher monitors the dnsmasq lease file for changes
pub struct LeaseWatcher {
    lease_path: String,
    known_macs: Arc<RwLock<HashMap<String, i64>>>,
    callbacks: Vec<LeaseCallback>,
    stop_tx: Option<tokio::sync::oneshot::Sender<()>>,
}

impl LeaseWatcher {
    pub fn new(lease_path: String) -> Self {
        Self {
            lease_path,
            known_macs: Arc::new(RwLock::new(HashMap::new())),
            callbacks: Vec::new(),
            stop_tx: None,
        }
    }

    /// Add a callback to be notified on lease changes
    pub fn add_callback(&mut self, callback: LeaseCallback) {
        self.callbacks.push(callback);
    }

    /// Start watching the lease file
    pub fn start(&mut self) {
        let (stop_tx, mut stop_rx) = tokio::sync::oneshot::channel();
        self.stop_tx = Some(stop_tx);

        let lease_path = self.lease_path.clone();
        let known_macs = self.known_macs.clone();
        let callbacks = self.callbacks.clone();

        tokio::spawn(async move {
            let mut ticker = interval(Duration::from_secs(5));

            // Initial read
            if let Err(e) = check_leases(&lease_path, &known_macs, &callbacks).await {
                tracing::warn!("Error checking leases: {}", e);
            }

            loop {
                tokio::select! {
                    _ = ticker.tick() => {
                        if let Err(e) = check_leases(&lease_path, &known_macs, &callbacks).await {
                            tracing::warn!("Error checking leases: {}", e);
                        }
                    }
                    _ = &mut stop_rx => {
                        tracing::info!("Lease watcher stopped");
                        break;
                    }
                }
            }
        });
    }

    /// Stop watching the lease file
    pub fn stop(&mut self) {
        if let Some(tx) = self.stop_tx.take() {
            let _ = tx.send(());
        }
    }

    /// Clear known MACs and re-check leases
    pub async fn clear_known_macs(&self) {
        let mut macs = self.known_macs.write().await;
        macs.clear();
    }
}

async fn check_leases(
    lease_path: &str,
    known_macs: &Arc<RwLock<HashMap<String, i64>>>,
    callbacks: &[LeaseCallback],
) -> Result<()> {
    let leases = parse_lease_file(lease_path).await?;

    for lease in leases {
        let mut macs = known_macs.write().await;
        let prev_expiry = macs.get(&lease.mac).copied();

        if prev_expiry.is_none() || lease.expiry_time > prev_expiry.unwrap_or(0) {
            macs.insert(lease.mac.clone(), lease.expiry_time);
            drop(macs); // Release lock before callbacks

            // Notify all callbacks
            for callback in callbacks {
                callback(lease.clone());
            }
        }
    }

    Ok(())
}

/// Parse the dnsmasq lease file into a list of leases.
/// Shared by both the lease watcher and the discovery handler.
pub async fn parse_lease_file(path: &str) -> Result<Vec<Lease>> {
    let content = match tokio::fs::read_to_string(path).await {
        Ok(content) => content,
        Err(_) => return Ok(Vec::new()),
    };

    let mut leases = Vec::new();

    for line in content.lines() {
        let line = line.trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }

        if let Some(lease) = parse_lease_line(line) {
            leases.push(lease);
        }
    }

    Ok(leases)
}

/// Parse a single lease line.
/// Format: expiry_time mac_address ip_address hostname client_id
fn parse_lease_line(line: &str) -> Option<Lease> {
    let fields: Vec<&str> = line.split_whitespace().collect();
    if fields.len() < 4 {
        return None;
    }

    let expiry_time: i64 = fields[0].parse().ok()?;

    Some(Lease {
        expiry_time,
        mac: fields[1].to_lowercase(),
        ip: fields[2].to_string(),
        hostname: fields[3].to_string(),
        client_id: fields.get(4).map(|s| s.to_string()),
        vendor: None,
        model: None,
        serial_number: None,
        vendor_class: None,
        user_class: None,
        dhcp_client_id: None,
        requested_options: None,
        relay_address: None,
        circuit_id: None,
        remote_id: None,
        subscriber_id: None,
    })
}
