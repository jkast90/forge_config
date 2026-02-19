use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// Canonical job status values
#[allow(dead_code)]
pub mod job_status {
    pub const QUEUED: &str = "queued";
    pub const RUNNING: &str = "running";
    pub const COMPLETED: &str = "completed";
    pub const FAILED: &str = "failed";
}

/// Canonical job type values
pub mod job_type {
    pub const COMMAND: &str = "command";
    pub const DEPLOY: &str = "deploy";
    pub const DIFF: &str = "diff";
    pub const WEBHOOK: &str = "webhook";
    pub const APPLY_TEMPLATE: &str = "apply_template";
}

fn default_manual() -> String {
    "manual".to_string()
}

/// Job represents an async task (command execution or config deploy)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Job {
    pub id: String,
    pub job_type: String,
    pub device_id: i64,
    pub command: String,
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub output: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    pub created_at: DateTime<Utc>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub started_at: Option<DateTime<Utc>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub completed_at: Option<DateTime<Utc>>,
    #[serde(default)]
    pub credential_id: String,
    #[serde(default = "default_manual")]
    pub triggered_by: String,
}

/// CreateJobRequest for creating a new job
#[derive(Debug, Clone, Deserialize)]
pub struct CreateJobRequest {
    pub device_id: i64,
    pub job_type: String,
    #[serde(default)]
    pub command: String,
    #[serde(default)]
    pub credential_id: String,
    #[serde(default = "default_manual")]
    pub triggered_by: String,
}

// ========== Job Template Models ==========

fn default_true() -> bool {
    true
}

/// JobTemplate represents a saved, reusable job configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JobTemplate {
    pub id: i64,
    pub name: String,
    pub description: String,
    pub job_type: String,
    pub command: String,
    pub action_id: i64,
    pub target_mode: String,
    pub target_device_ids: Vec<i64>,
    #[serde(default)]
    pub target_group_id: i64,
    pub schedule: String,
    pub enabled: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_run_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    #[serde(default)]
    pub credential_id: i64,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CreateJobTemplateRequest {
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub job_type: String,
    #[serde(default)]
    pub command: String,
    #[serde(default)]
    pub action_id: i64,
    #[serde(default)]
    pub target_mode: String,
    #[serde(default)]
    pub target_device_ids: Vec<i64>,
    #[serde(default)]
    pub target_group_id: i64,
    #[serde(default)]
    pub schedule: String,
    #[serde(default = "default_true")]
    pub enabled: bool,
    #[serde(default)]
    pub credential_id: i64,
}

// ========== Credential Models ==========

fn default_ssh() -> String {
    "ssh".to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Credential {
    pub id: i64,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub cred_type: String,
    pub username: String,
    pub password: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CreateCredentialRequest {
    pub name: String,
    #[serde(default)]
    pub description: String,
    #[serde(default = "default_ssh")]
    pub cred_type: String,
    #[serde(default)]
    pub username: String,
    #[serde(default)]
    pub password: String,
}
