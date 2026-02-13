use axum::{extract::State, Json};
use std::sync::Arc;

use crate::models::{Claims, LoginRequest, LoginResponse};
use crate::AppState;

use super::ApiError;

/// POST /api/auth/login
pub async fn login(
    State(state): State<Arc<AppState>>,
    Json(req): Json<LoginRequest>,
) -> Result<Json<LoginResponse>, ApiError> {
    if req.username.is_empty() || req.password.is_empty() {
        return Err(ApiError::bad_request("username and password are required"));
    }

    let user = state
        .store
        .get_user_by_username(&req.username)
        .await
        .map_err(|_| ApiError::internal("database error"))?
        .ok_or_else(|| ApiError::unauthorized("invalid credentials"))?;

    let valid = bcrypt::verify(&req.password, &user.password_hash)
        .map_err(|_| ApiError::internal("password verification error"))?;

    if !valid {
        return Err(ApiError::unauthorized("invalid credentials"));
    }

    let now = chrono::Utc::now();
    let exp = now + chrono::TimeDelta::hours(24);

    let claims = Claims {
        sub: user.id.clone(),
        username: user.username.clone(),
        exp: exp.timestamp() as usize,
        iat: now.timestamp() as usize,
    };

    let token = jsonwebtoken::encode(
        &jsonwebtoken::Header::default(),
        &claims,
        &jsonwebtoken::EncodingKey::from_secret(state.config.jwt_secret.as_bytes()),
    )
    .map_err(|e| ApiError::internal(format!("token generation error: {}", e)))?;

    Ok(Json(LoginResponse {
        token,
        username: user.username,
    }))
}
