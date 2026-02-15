use anyhow::Result;
use sqlx::{Pool, Sqlite};
use std::collections::{HashMap, HashSet};

use crate::models::{
    Group, ResolvedVariable, ResolvedVariablesResponse, ResolutionLayer,
};

use super::groups::GroupRepo;
use super::device_variables::DeviceVariableRepo;

/// The "all" group always has integer ID 1 after migration.
const ALL_GROUP_ID: i64 = 1;

/// Ansible-style variable resolution with group inheritance.
///
/// Resolution order (lowest → highest priority):
/// 1. "all" group variables (precedence 0)
/// 2. Group variables sorted by (depth ASC, precedence ASC)
/// 3. Host variables (device_variables) — always win
pub struct VariableResolver;

impl VariableResolver {
    /// Full resolution with provenance tracking (for the inspector API).
    pub async fn resolve(
        pool: &Pool<Sqlite>,
        device_id: i64,
    ) -> Result<ResolvedVariablesResponse> {
        // 1. Load all groups into a lookup map
        let all_groups = GroupRepo::list_all_raw(pool).await?;
        let groups_by_id: HashMap<i64, Group> = all_groups
            .iter()
            .cloned()
            .map(|g| (g.id, g))
            .collect();

        // 2. Load device's direct group memberships
        let member_group_ids: Vec<i64> = sqlx::query_scalar(
            "SELECT group_id FROM device_group_members WHERE device_id = ?",
        )
        .bind(device_id)
        .fetch_all(pool)
        .await?;

        // 3. For each direct group, build ancestor chain (walk parent_id up to root)
        let mut all_relevant_ids: HashSet<i64> = HashSet::new();
        // (group_id, depth) — depth = distance from "all" root
        let mut group_depths: HashMap<i64, usize> = HashMap::new();

        for gid in &member_group_ids {
            let chain = build_ancestor_chain(*gid, &groups_by_id);
            for (depth, id) in chain.iter().enumerate() {
                all_relevant_ids.insert(*id);
                // Use the shallowest depth if a group appears in multiple chains
                let d = depth + 1; // +1 because "all" is depth 0
                group_depths.entry(*id).and_modify(|e| {
                    if d < *e { *e = d; }
                }).or_insert(d);
            }
        }

        // 4. Sort groups by (depth ASC, precedence ASC) — parents before children,
        //    lower precedence evaluated first (overridden by higher)
        let mut sorted_groups: Vec<&Group> = all_relevant_ids
            .iter()
            .filter(|id| **id != ALL_GROUP_ID) // "all" handled separately as layer 0
            .filter_map(|id| groups_by_id.get(id))
            .collect();

        sorted_groups.sort_by(|a, b| {
            let depth_a = group_depths.get(&a.id).copied().unwrap_or(999);
            let depth_b = group_depths.get(&b.id).copied().unwrap_or(999);
            depth_a.cmp(&depth_b).then(a.precedence.cmp(&b.precedence))
        });

        // 5. Load group variables for all relevant groups (including "all")
        let mut var_group_ids: Vec<i64> = vec![ALL_GROUP_ID];
        var_group_ids.extend(sorted_groups.iter().map(|g| g.id));

        let all_group_vars = GroupRepo::list_variables_for_groups(pool, &var_group_ids).await?;

        // Index group vars by group_id
        let mut vars_by_group: HashMap<i64, HashMap<String, String>> = HashMap::new();
        for gv in &all_group_vars {
            vars_by_group
                .entry(gv.group_id)
                .or_default()
                .insert(gv.key.clone(), gv.value.clone());
        }

        // 6. Load host variables (device_variables)
        let host_vars_list = DeviceVariableRepo::list_by_device(pool, device_id).await?;
        let host_vars: HashMap<String, String> = host_vars_list
            .into_iter()
            .map(|v| (v.key, v.value))
            .collect();

        // 7. Build resolution layers
        let mut layers: Vec<ResolutionLayer> = Vec::new();

        // Layer 0: "all" group
        let all_group = groups_by_id.get(&ALL_GROUP_ID);
        let all_vars = vars_by_group.remove(&ALL_GROUP_ID).unwrap_or_default();
        layers.push(ResolutionLayer {
            source: ALL_GROUP_ID.to_string(),
            source_name: all_group.map(|g| g.name.clone()).unwrap_or_else(|| "all".to_string()),
            source_type: "all".to_string(),
            precedence: 0,
            variables: all_vars,
        });

        // Layers 1..N: groups in sorted order
        for group in &sorted_groups {
            let gvars = vars_by_group.remove(&group.id).unwrap_or_default();
            layers.push(ResolutionLayer {
                source: group.id.to_string(),
                source_name: group.name.clone(),
                source_type: "group".to_string(),
                precedence: group.precedence,
                variables: gvars,
            });
        }

        // Layer N+1: host vars
        layers.push(ResolutionLayer {
            source: "host".to_string(),
            source_name: "Host Variables".to_string(),
            source_type: "host".to_string(),
            precedence: i32::MAX,
            variables: host_vars,
        });

        // 8. Merge layers left-to-right, tracking provenance
        let mut merged: HashMap<String, String> = HashMap::new();
        let mut provenance: HashMap<String, (String, String, String)> = HashMap::new(); // key -> (source, source_name, source_type)

        for layer in &layers {
            for (key, value) in &layer.variables {
                merged.insert(key.clone(), value.clone());
                provenance.insert(
                    key.clone(),
                    (layer.source.clone(), layer.source_name.clone(), layer.source_type.clone()),
                );
            }
        }

        // Build resolved list
        let mut resolved: Vec<ResolvedVariable> = merged
            .iter()
            .map(|(key, value)| {
                let (source, source_name, source_type) = provenance
                    .get(key)
                    .cloned()
                    .unwrap_or(("unknown".to_string(), "Unknown".to_string(), "unknown".to_string()));
                ResolvedVariable {
                    key: key.clone(),
                    value: value.clone(),
                    source,
                    source_name,
                    source_type,
                }
            })
            .collect();
        resolved.sort_by(|a, b| a.key.cmp(&b.key));

        Ok(ResolvedVariablesResponse {
            variables: merged,
            resolved,
            resolution_order: layers,
        })
    }

    /// Convenience: resolve and return only the merged HashMap.
    /// Drop-in replacement for the old `list_device_variables → HashMap` pattern.
    pub async fn resolve_flat(
        pool: &Pool<Sqlite>,
        device_id: i64,
    ) -> Result<HashMap<String, String>> {
        let result = Self::resolve(pool, device_id).await?;
        Ok(result.variables)
    }
}

/// Build ancestor chain for a group, walking parent_id up.
/// Returns a list from outermost ancestor to self (excluding "all").
/// Stops at "all" or on cycle detection.
fn build_ancestor_chain(group_id: i64, groups_by_id: &HashMap<i64, Group>) -> Vec<i64> {
    let mut chain = Vec::new();
    let mut visited = HashSet::new();
    let mut current = Some(group_id);

    while let Some(id) = current {
        if id == ALL_GROUP_ID || !visited.insert(id) {
            break;
        }
        chain.push(id);
        current = groups_by_id.get(&id).and_then(|g| g.parent_id);
    }

    chain.reverse(); // ancestors first, self last
    chain
}
