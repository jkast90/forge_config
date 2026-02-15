use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// OutputParser represents a regex-based parser for extracting structured data from command output
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OutputParser {
    pub id: i64,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub pattern: String,
    pub extract_names: String,
    pub enabled: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// CreateOutputParserRequest for creating/updating output parsers
#[derive(Debug, Clone, Deserialize)]
pub struct CreateOutputParserRequest {
    pub name: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub pattern: String,
    #[serde(default)]
    pub extract_names: String,
    #[serde(default = "default_enabled")]
    pub enabled: bool,
}

fn default_enabled() -> bool {
    true
}
