use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        State,
    },
    response::Response,
};
use futures_util::{SinkExt, StreamExt};
use serde::Serialize;
use std::sync::Arc;
use tokio::sync::{broadcast, RwLock};

/// Event types for WebSocket messages
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum EventType {
    DeviceDiscovered,
    DeviceOnline,
    DeviceOffline,
    BackupStarted,
    BackupCompleted,
    BackupFailed,
    ConfigPulled,
}

/// WebSocket event message
#[derive(Debug, Clone, Serialize)]
pub struct Event {
    #[serde(rename = "type")]
    pub event_type: EventType,
    pub payload: serde_json::Value,
}

/// Payload for device discovery events
#[derive(Debug, Clone, Serialize)]
pub struct DeviceDiscoveredPayload {
    pub mac: String,
    pub ip: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub hostname: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub vendor: Option<String>,
}

/// Payload for config pull events
#[derive(Debug, Clone, Serialize)]
pub struct ConfigPulledPayload {
    pub mac: String,
    pub ip: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub hostname: Option<String>,
    pub filename: String,
    pub protocol: String,
}

/// WebSocket hub manages connections and broadcasts events
pub struct Hub {
    tx: broadcast::Sender<String>,
    client_count: Arc<RwLock<usize>>,
}

impl Hub {
    pub fn new() -> Self {
        let (tx, _) = broadcast::channel(256);
        Self {
            tx,
            client_count: Arc::new(RwLock::new(0)),
        }
    }

    /// Broadcast an event to all connected clients
    pub async fn broadcast_event(&self, event: Event) {
        let data = match serde_json::to_string(&event) {
            Ok(data) => data,
            Err(e) => {
                tracing::error!("Error serializing WebSocket event: {}", e);
                return;
            }
        };

        let count = *self.client_count.read().await;
        if count > 0 {
            if let Err(e) = self.tx.send(data) {
                tracing::warn!("Error broadcasting WebSocket event: {}", e);
            } else {
                tracing::debug!("Broadcasting {:?} to {} clients", event.event_type, count);
            }
        }
    }

    /// Broadcast a device discovered event
    pub async fn broadcast_device_discovered(
        &self,
        mac: &str,
        ip: &str,
        hostname: Option<&str>,
        vendor: Option<&str>,
    ) {
        self.broadcast_event(Event {
            event_type: EventType::DeviceDiscovered,
            payload: serde_json::to_value(DeviceDiscoveredPayload {
                mac: mac.to_string(),
                ip: ip.to_string(),
                hostname: hostname.map(|s| s.to_string()),
                vendor: vendor.map(|s| s.to_string()),
            })
            .unwrap_or_default(),
        })
        .await;
    }

    /// Broadcast a config pulled event
    pub async fn broadcast_config_pulled(
        &self,
        mac: &str,
        ip: &str,
        hostname: &str,
        filename: &str,
        protocol: &str,
    ) {
        self.broadcast_event(Event {
            event_type: EventType::ConfigPulled,
            payload: serde_json::to_value(ConfigPulledPayload {
                mac: mac.to_string(),
                ip: ip.to_string(),
                hostname: Some(hostname.to_string()),
                filename: filename.to_string(),
                protocol: protocol.to_string(),
            })
            .unwrap_or_default(),
        })
        .await;
    }

    /// Get the number of connected clients
    pub async fn client_count(&self) -> usize {
        *self.client_count.read().await
    }

    /// Subscribe to events
    fn subscribe(&self) -> broadcast::Receiver<String> {
        self.tx.subscribe()
    }

    async fn increment_clients(&self) {
        let mut count = self.client_count.write().await;
        *count += 1;
        tracing::info!("WebSocket client connected. Total clients: {}", *count);
    }

    async fn decrement_clients(&self) {
        let mut count = self.client_count.write().await;
        *count = count.saturating_sub(1);
        tracing::info!("WebSocket client disconnected. Total clients: {}", *count);
    }
}

impl Default for Hub {
    fn default() -> Self {
        Self::new()
    }
}

/// WebSocket handler for axum
pub async fn ws_handler(
    ws: WebSocketUpgrade,
    State(hub): State<Arc<Hub>>,
) -> Response {
    ws.on_upgrade(move |socket| handle_socket(socket, hub))
}

async fn handle_socket(socket: WebSocket, hub: Arc<Hub>) {
    let (mut sender, mut receiver) = socket.split();

    hub.increment_clients().await;

    // Subscribe to broadcast events
    let mut rx = hub.subscribe();

    // Task to send messages to client
    let send_task = tokio::spawn(async move {
        while let Ok(msg) = rx.recv().await {
            if sender.send(Message::Text(msg)).await.is_err() {
                break;
            }
        }
    });

    // Task to receive messages from client (just to keep connection alive)
    let recv_task = tokio::spawn(async move {
        while let Some(msg) = receiver.next().await {
            if msg.is_err() {
                break;
            }
        }
    });

    // Wait for either task to complete
    tokio::select! {
        _ = send_task => {},
        _ = recv_task => {},
    }

    hub.decrement_clients().await;
}
