use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// Template represents a configuration template
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Template {
    pub id: i64,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub vendor_id: Option<i64>,
    pub content: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub device_count: Option<i32>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// CreateTemplateRequest for creating new templates
#[derive(Debug, Clone, Deserialize)]
pub struct CreateTemplateRequest {
    pub name: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub vendor_id: Option<i64>,
    pub content: String,
}

/// TemplatePreviewDevice contains the device fields for preview
#[derive(Debug, Clone, Deserialize)]
pub struct TemplatePreviewDevice {
    #[serde(default)]
    pub id: String,
    #[serde(default)]
    pub mac: String,
    #[serde(default)]
    pub ip: String,
    #[serde(default)]
    pub hostname: String,
    #[serde(default)]
    pub vendor: Option<String>,
    #[serde(default)]
    pub serial_number: Option<String>,
    #[serde(default)]
    pub ssh_user: Option<String>,
    #[serde(default)]
    pub ssh_pass: Option<String>,
    #[serde(default)]
    pub topology_id: Option<String>,
    #[serde(default)]
    pub topology_role: Option<String>,
}

/// TemplatePreviewRequest for previewing a template with device data
#[derive(Debug, Clone, Deserialize)]
pub struct TemplatePreviewRequest {
    pub device: TemplatePreviewDevice,
    #[serde(default)]
    pub subnet: String,
    #[serde(default)]
    pub gateway: String,
}

/// TemplatePreviewResponse wraps the rendered output
#[derive(Debug, Clone, Serialize)]
pub struct TemplatePreviewResponse {
    pub output: String,
}

/// TemplateVariable represents a single available template variable
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TemplateVariable {
    pub name: String,
    pub description: String,
    pub example: String,
}
