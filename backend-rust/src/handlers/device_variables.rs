use axum::{
    extract::{Path, State},
    Json,
};
use serde::Deserialize;
use std::sync::Arc;

use crate::AppState;

use super::ApiError;

/// List all variables for a device
pub async fn list_device_variables(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
    Path(id): Path<i64>,
) -> Result<Json<Vec<crate::models::DeviceVariable>>, ApiError> {
    let vars = state.store.list_device_variables(id).await?;
    Ok(Json(vars))
}

#[derive(Deserialize)]
pub struct SetVariablesRequest {
    pub variables: std::collections::HashMap<String, String>,
}

/// Bulk set variables for a device (replaces all)
pub async fn set_device_variables(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
    Path(id): Path<i64>,
    Json(req): Json<SetVariablesRequest>,
) -> Result<Json<Vec<crate::models::DeviceVariable>>, ApiError> {
    // Delete existing, then insert new
    state.store.delete_all_device_variables(id).await?;
    for (key, value) in &req.variables {
        state.store.set_device_variable(id, key, value).await?;
    }

    let vars = state.store.list_device_variables(id).await?;
    Ok(Json(vars))
}

#[derive(Deserialize)]
pub struct SetVariableRequest {
    pub value: String,
}

/// Set a single variable for a device
pub async fn set_device_variable(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
    Path((id, key)): Path<(i64, String)>,
    Json(req): Json<SetVariableRequest>,
) -> Result<Json<serde_json::Value>, ApiError> {
    state.store.set_device_variable(id, &key, &req.value).await?;
    Ok(Json(serde_json::json!({"message": "variable set"})))
}

/// Delete a single variable for a device
pub async fn delete_device_variable(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
    Path((id, key)): Path<(i64, String)>,
) -> Result<Json<serde_json::Value>, ApiError> {
    state.store.delete_device_variable(id, &key).await?;
    Ok(Json(serde_json::json!({"message": "variable deleted"})))
}

#[derive(serde::Serialize)]
pub struct VariableKeyInfo {
    pub key: String,
    pub device_count: i64,
}

/// List all distinct variable keys
pub async fn list_variable_keys(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<VariableKeyInfo>>, ApiError> {
    let keys = state.store.list_variable_keys().await?;
    let result: Vec<VariableKeyInfo> = keys
        .into_iter()
        .map(|(key, count)| VariableKeyInfo { key, device_count: count })
        .collect();
    Ok(Json(result))
}

/// List all device values for a specific key
pub async fn list_by_key(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
    Path(key): Path<String>,
) -> Result<Json<Vec<crate::models::DeviceVariable>>, ApiError> {
    let vars = state.store.list_variables_by_key(&key).await?;
    Ok(Json(vars))
}

#[derive(Deserialize)]
pub struct BulkSetEntry {
    pub device_id: i64,
    pub key: String,
    pub value: String,
}

#[derive(Deserialize)]
pub struct BulkSetRequest {
    pub entries: Vec<BulkSetEntry>,
}

/// Bulk set variables across multiple devices
pub async fn bulk_set_variables(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
    Json(req): Json<BulkSetRequest>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let entries: Vec<(i64, String, String)> = req
        .entries
        .into_iter()
        .map(|e| (e.device_id, e.key, e.value))
        .collect();

    let count = entries.len();
    state.store.bulk_set_device_variables(&entries).await?;

    Ok(Json(serde_json::json!({
        "message": format!("{} variables set", count),
        "count": count,
    })))
}

/// Delete a key from all devices
pub async fn delete_variable_key(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
    Path(key): Path<String>,
) -> Result<Json<serde_json::Value>, ApiError> {
    state.store.delete_variable_key(&key).await?;
    Ok(Json(serde_json::json!({"message": "key deleted from all devices"})))
}
