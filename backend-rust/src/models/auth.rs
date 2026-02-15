use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// User represents an authenticated user
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct User {
    pub id: i64,
    pub username: String,
    #[serde(skip_serializing)]
    pub password_hash: String,
    pub enabled: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Request to create a new user
#[derive(Debug, Clone, Deserialize)]
pub struct CreateUserRequest {
    pub username: String,
    pub password: String,
    #[serde(default = "default_enabled")]
    pub enabled: bool,
}

/// Request to update an existing user
#[derive(Debug, Clone, Deserialize)]
pub struct UpdateUserRequest {
    pub username: String,
    #[serde(default)]
    pub password: Option<String>,
    #[serde(default = "default_enabled")]
    pub enabled: bool,
}

fn default_enabled() -> bool {
    true
}

/// LoginRequest for authenticating a user
#[derive(Debug, Clone, Deserialize)]
pub struct LoginRequest {
    pub username: String,
    pub password: String,
}

/// LoginResponse returned on successful authentication
#[derive(Debug, Clone, Serialize)]
pub struct LoginResponse {
    pub token: String,
    pub username: String,
}

/// JWT claims structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,
    pub username: String,
    pub exp: usize,
    pub iat: usize,
}
