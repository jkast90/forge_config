use axum::{
    extract::FromRequestParts,
    http::{request::Parts, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use std::sync::Arc;

use crate::handlers::ErrorResponse;
use crate::models::Claims;
use crate::AppState;

/// Extractor that validates JWT and provides the authenticated user's claims.
///
/// Add `_auth: AuthUser` to a handler's parameters to require authentication.
pub struct AuthUser {
    #[allow(dead_code)]
    pub claims: Claims,
}

#[async_trait::async_trait]
impl FromRequestParts<Arc<AppState>> for AuthUser {
    type Rejection = AuthError;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &Arc<AppState>,
    ) -> Result<Self, Self::Rejection> {
        // Try Authorization header first, then fall back to ?token= query param
        // (WebSocket connections can't send custom headers)
        let token = if let Some(auth_header) = parts
            .headers
            .get("authorization")
            .and_then(|v| v.to_str().ok())
        {
            auth_header
                .strip_prefix("Bearer ")
                .ok_or(AuthError::InvalidToken)?
                .to_string()
        } else if let Some(query) = parts.uri.query() {
            query
                .split('&')
                .find_map(|pair| pair.strip_prefix("token="))
                .ok_or(AuthError::MissingToken)?
                .to_string()
        } else {
            return Err(AuthError::MissingToken);
        };

        let token_data = jsonwebtoken::decode::<Claims>(
            &token,
            &jsonwebtoken::DecodingKey::from_secret(state.config.jwt_secret.as_bytes()),
            &jsonwebtoken::Validation::default(),
        )
        .map_err(|_| AuthError::InvalidToken)?;

        Ok(AuthUser {
            claims: token_data.claims,
        })
    }
}

pub enum AuthError {
    MissingToken,
    InvalidToken,
}

impl IntoResponse for AuthError {
    fn into_response(self) -> Response {
        let (status, message) = match self {
            AuthError::MissingToken => (StatusCode::UNAUTHORIZED, "Missing authentication token"),
            AuthError::InvalidToken => (StatusCode::UNAUTHORIZED, "Invalid or expired token"),
        };
        (status, Json(ErrorResponse::new(message))).into_response()
    }
}
