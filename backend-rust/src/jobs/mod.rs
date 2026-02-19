use anyhow::Result;
use std::collections::HashMap;
use std::sync::Arc;
use tera::{Context, Tera};
use tokio::sync::mpsc;

use crate::db::Store;
use crate::models::*;
use crate::ws::{EventType, Hub};

/// JobService manages async command execution and config deploy jobs
pub struct JobService {
    store: Store,
    ws_hub: Option<Arc<Hub>>,
    pending_tx: mpsc::Sender<String>,
}

impl JobService {
    pub fn new(store: Store, ws_hub: Option<Arc<Hub>>) -> Arc<Self> {
        let (pending_tx, pending_rx) = mpsc::channel(100);

        let service = Arc::new(Self {
            store,
            ws_hub,
            pending_tx,
        });

        // Start the worker
        let worker_service = service.clone();
        tokio::spawn(async move {
            worker_service.worker(pending_rx).await;
        });

        // Re-queue stuck jobs from a previous crash
        let requeue_service = service.clone();
        tokio::spawn(async move {
            requeue_service.requeue_stuck_jobs().await;
        });

        service
    }

    /// Submit a job ID for processing
    pub async fn submit(&self, job_id: String) {
        if let Err(e) = self.pending_tx.send(job_id.clone()).await {
            tracing::warn!("Failed to submit job {}: {}", job_id, e);
        }
    }

    /// Re-queue jobs that were stuck (queued/running) from a previous crash
    async fn requeue_stuck_jobs(&self) {
        match self.store.list_jobs_stuck().await {
            Ok(jobs) => {
                for job in &jobs {
                    tracing::info!("Re-queuing stuck job {} (status={})", job.id, job.status);
                    if let Err(e) = self.pending_tx.send(job.id.clone()).await {
                        tracing::warn!("Failed to re-queue job {}: {}", job.id, e);
                    }
                }
                if !jobs.is_empty() {
                    tracing::info!("Re-queued {} stuck jobs", jobs.len());
                }
            }
            Err(e) => {
                tracing::error!("Failed to list stuck jobs: {}", e);
            }
        }
    }

    /// Start the cron scheduler for job templates
    pub fn start_scheduler(self: &Arc<Self>) {
        let svc = self.clone();
        tokio::spawn(async move {
            use std::time::Duration;
            use croner::Cron;

            let mut interval = tokio::time::interval(Duration::from_secs(30));
            loop {
                interval.tick().await;

                let templates = match svc.store.list_scheduled_job_templates().await {
                    Ok(t) => t,
                    Err(e) => {
                        tracing::error!("Scheduler: failed to list templates: {}", e);
                        continue;
                    }
                };

                let now = chrono::Utc::now();

                for tmpl in &templates {
                    // Parse cron expression
                    let cron = match Cron::new(&tmpl.schedule).parse() {
                        Ok(c) => c,
                        Err(e) => {
                            tracing::warn!("Scheduler: invalid cron '{}' for template {}: {}", tmpl.schedule, tmpl.id, e);
                            continue;
                        }
                    };

                    // Check if the template is due to run
                    let reference = tmpl.last_run_at.unwrap_or(tmpl.created_at);
                    let reference_chrono: chrono::DateTime<chrono::Utc> = reference;

                    // Find the next occurrence after last_run_at
                    let next = match cron.find_next_occurrence(&reference_chrono, false) {
                        Ok(n) => n,
                        Err(_) => continue,
                    };

                    if next > now {
                        continue; // Not due yet
                    }

                    tracing::info!("Scheduler: running template '{}' ({})", tmpl.name, tmpl.id);

                    // Resolve target device IDs
                    let device_ids: Vec<i64> = if tmpl.target_mode == "group" && tmpl.target_group_id != 0 {
                        match svc.store.list_group_members(tmpl.target_group_id).await {
                            Ok(ids) => ids,
                            Err(e) => {
                                tracing::warn!("Scheduler: failed to resolve group {}: {}", tmpl.target_group_id, e);
                                continue;
                            }
                        }
                    } else {
                        tmpl.target_device_ids.clone()
                    };

                    let is_webhook = tmpl.job_type == crate::models::job_type::WEBHOOK;

                    let credential_id_str = tmpl.credential_id.to_string();

                    if is_webhook && device_ids.is_empty() {
                        // Static webhook — run once without device
                        let job_id = uuid::Uuid::new_v4().to_string();
                        let req = CreateJobRequest {
                            device_id: 0,
                            job_type: crate::models::job_type::WEBHOOK.to_string(),
                            command: tmpl.action_id.to_string(),
                            credential_id: credential_id_str.clone(),
                            triggered_by: "scheduled".to_string(),
                        };
                        if let Ok(job) = svc.store.create_job(&job_id, &req).await {
                            if let Some(ref hub) = svc.ws_hub {
                                hub.broadcast_job_update(EventType::JobQueued, &job).await;
                            }
                            svc.submit(job_id).await;
                        }
                    } else {
                        // Create a job for each target device
                        for device_id in &device_ids {
                            let job_id = uuid::Uuid::new_v4().to_string();
                            let command = if is_webhook {
                                tmpl.action_id.to_string()
                            } else if tmpl.action_id != 0 {
                                match svc.store.get_vendor_action(tmpl.action_id).await {
                                    Ok(Some(action)) => action.command.clone(),
                                    _ => tmpl.command.clone(),
                                }
                            } else {
                                tmpl.command.clone()
                            };

                            let jt = if is_webhook {
                                crate::models::job_type::WEBHOOK.to_string()
                            } else {
                                tmpl.job_type.clone()
                            };

                            let req = CreateJobRequest {
                                device_id: *device_id,
                                job_type: jt,
                                command,
                                credential_id: credential_id_str.clone(),
                                triggered_by: "scheduled".to_string(),
                            };

                            if let Ok(job) = svc.store.create_job(&job_id, &req).await {
                                if let Some(ref hub) = svc.ws_hub {
                                    hub.broadcast_job_update(EventType::JobQueued, &job).await;
                                }
                                svc.submit(job_id).await;
                            }
                        }
                    }

                    // Update last_run_at
                    let _ = svc.store.update_job_template_last_run(tmpl.id).await;
                }
            }
        });
    }

    async fn worker(&self, mut rx: mpsc::Receiver<String>) {
        while let Some(job_id) = rx.recv().await {
            if let Err(e) = self.process_job(&job_id).await {
                tracing::error!("Job {} processing error: {}", job_id, e);
            }
        }
    }

    async fn process_job(&self, job_id: &str) -> Result<()> {
        let job = match self.store.get_job(job_id).await? {
            Some(j) => j,
            None => {
                tracing::warn!("Job {} not found, skipping", job_id);
                return Ok(());
            }
        };

        // Mark as running
        self.store.update_job_started(job_id).await?;
        self.broadcast_job(EventType::JobStarted, job_id).await;

        // Execute based on job type
        let result = match job.job_type.as_str() {
            job_type::COMMAND => self.execute_command_job(&job).await,
            job_type::DEPLOY => self.execute_deploy_job(&job).await,
            job_type::DIFF => self.execute_diff_job(&job).await,
            job_type::WEBHOOK => self.execute_webhook_job(&job).await,
            job_type::APPLY_TEMPLATE => self.execute_apply_template_job(&job).await,
            _ => Err(anyhow::anyhow!("Unknown job type: {}", job.job_type)),
        };

        // Update job result
        match result {
            Ok(output) => {
                self.store.update_job_completed(job_id, &output).await?;
                self.broadcast_job(EventType::JobCompleted, job_id).await;
            }
            Err(e) => {
                let error_msg = e.to_string();
                self.store.update_job_failed(job_id, &error_msg).await?;
                self.broadcast_job(EventType::JobFailed, job_id).await;
            }
        }

        Ok(())
    }

    async fn execute_command_job(&self, job: &Job) -> Result<String> {
        let device = self.store.get_device(job.device_id).await?
            .ok_or_else(|| anyhow::anyhow!("Device not found: {}", job.device_id))?;

        let (mut ssh_user, mut ssh_pass) = crate::utils::resolve_ssh_credentials(&self.store, device.ssh_user.clone(), device.ssh_pass.clone(), device.vendor.as_deref()).await;

        // Override with job-specific credential if set
        if !job.credential_id.is_empty() {
            if let Ok(cred_id) = job.credential_id.parse::<i64>() {
                if let Some(cred) = self.store.get_credential(cred_id).await? {
                    if !cred.username.is_empty() { ssh_user = cred.username; }
                    if !cred.password.is_empty() { ssh_pass = cred.password; }
                }
            }
        }

        if ssh_user.is_empty() || ssh_pass.is_empty() {
            return Err(anyhow::anyhow!("No SSH credentials available for this device"));
        }

        crate::utils::ssh_run_command_async(&device.ip, &ssh_user, &ssh_pass, &job.command)
            .await
            .map_err(|e| anyhow::anyhow!(e))
    }

    async fn execute_deploy_job(&self, job: &Job) -> Result<String> {
        let device = self.store.get_device(job.device_id).await?
            .ok_or_else(|| anyhow::anyhow!("Device not found: {}", job.device_id))?;

        // Resolve template: use device's config_template, or fall back to vendor's default_template
        let template_id = if !device.config_template.is_empty() {
            device.config_template.parse::<i64>()
                .map_err(|_| anyhow::anyhow!("Invalid template ID: {}", device.config_template))?
        } else if let Some(vendor) = match device.vendor.as_deref() {
            Some(v) if !v.is_empty() => self.store.resolve_vendor(v).await.ok().flatten(),
            _ => None,
        } {
            if vendor.default_template.is_empty() {
                return Err(anyhow::anyhow!("Device has no template and vendor has no default template"));
            }
            vendor.default_template.parse::<i64>()
                .map_err(|_| anyhow::anyhow!("Invalid default template ID: {}", vendor.default_template))?
        } else {
            return Err(anyhow::anyhow!("Device has no template assigned and no vendor to infer from"));
        };

        let template = self.store.get_template(template_id).await?
            .ok_or_else(|| anyhow::anyhow!("Template not found: {}", template_id))?;

        let settings = self.store.get_settings().await?;

        // Look up role-specific template by name convention
        let role_template = if let Some(ref role) = device.topology_role {
            let capitalized_role = format!("{}{}", &role[..1].to_uppercase(), &role[1..]);
            let role_name = if template.name.ends_with(" Default") {
                format!("{} {}", template.name.trim_end_matches(" Default"), capitalized_role)
            } else {
                format!("{} {}", template.name, capitalized_role)
            };
            self.store.get_template_by_name(&role_name).await.ok().flatten()
        } else {
            None
        };

        // Load resolved variables (group + host inheritance) for template rendering
        let vars = self
            .store
            .resolve_device_variables_flat(device.id)
            .await
            .unwrap_or_default();

        // Load port assignments for VRF context
        let port_assignments = self.store.list_port_assignments(device.id).await.unwrap_or_default();

        // Render the template
        let rendered_config = render_config(&device, &template, &settings, role_template.as_ref(), &vars, Some(&port_assignments))?;

        // Resolve SSH credentials
        let (mut ssh_user, mut ssh_pass) = crate::utils::resolve_ssh_credentials(&self.store, device.ssh_user.clone(), device.ssh_pass.clone(), device.vendor.as_deref()).await;

        // Override with job-specific credential if set
        if !job.credential_id.is_empty() {
            if let Ok(cred_id) = job.credential_id.parse::<i64>() {
                if let Some(cred) = self.store.get_credential(cred_id).await? {
                    if !cred.username.is_empty() { ssh_user = cred.username; }
                    if !cred.password.is_empty() { ssh_pass = cred.password; }
                }
            }
        }

        if ssh_user.is_empty() || ssh_pass.is_empty() {
            return Err(anyhow::anyhow!("No SSH credentials available for this device"));
        }

        // Resolve vendor deploy_command wrapper
        let vendor = match device.vendor.as_deref() {
            Some(v) if !v.is_empty() => self.store.resolve_vendor(v).await.ok().flatten(),
            _ => None,
        };

        let has_deploy_command = vendor.as_ref().map_or(false, |v| !v.deploy_command.is_empty());

        let deploy_payload = if let Some(ref v) = vendor {
            if !v.deploy_command.is_empty() {
                v.deploy_command.replace("{CONFIG}", &rendered_config)
            } else {
                rendered_config
            }
        } else {
            rendered_config
        };

        // Use interactive shell for multi-line deploy commands (network devices need PTY)
        let output = if has_deploy_command {
            crate::utils::ssh_run_interactive_async(&device.ip, &ssh_user, &ssh_pass, &deploy_payload)
                .await
                .map_err(|e| anyhow::anyhow!(e))?
        } else {
            crate::utils::ssh_run_command_async(&device.ip, &ssh_user, &ssh_pass, &deploy_payload)
                .await
                .map_err(|e| anyhow::anyhow!(e))?
        };

        // Update device status on successful deploy
        let _ = self.store.update_device_status(device.id, device_status::ONLINE).await;

        Ok(output)
    }

    async fn execute_diff_job(&self, job: &Job) -> Result<String> {
        let device = self.store.get_device(job.device_id).await?
            .ok_or_else(|| anyhow::anyhow!("Device not found: {}", job.device_id))?;

        // Resolve template: use device's config_template, or fall back to vendor's default_template
        let template_id = if !device.config_template.is_empty() {
            device.config_template.parse::<i64>()
                .map_err(|_| anyhow::anyhow!("Invalid template ID: {}", device.config_template))?
        } else if let Some(vendor) = match device.vendor.as_deref() {
            Some(v) if !v.is_empty() => self.store.resolve_vendor(v).await.ok().flatten(),
            _ => None,
        } {
            if vendor.default_template.is_empty() {
                return Err(anyhow::anyhow!("Device has no template and vendor has no default template"));
            }
            vendor.default_template.parse::<i64>()
                .map_err(|_| anyhow::anyhow!("Invalid default template ID: {}", vendor.default_template))?
        } else {
            return Err(anyhow::anyhow!("Device has no template assigned and no vendor to infer from"));
        };

        let template = self.store.get_template(template_id).await?
            .ok_or_else(|| anyhow::anyhow!("Template not found: {}", template_id))?;

        let settings = self.store.get_settings().await?;

        // Look up role-specific template by name convention
        let role_template = if let Some(ref role) = device.topology_role {
            let capitalized_role = format!("{}{}", &role[..1].to_uppercase(), &role[1..]);
            let role_name = if template.name.ends_with(" Default") {
                format!("{} {}", template.name.trim_end_matches(" Default"), capitalized_role)
            } else {
                format!("{} {}", template.name, capitalized_role)
            };
            self.store.get_template_by_name(&role_name).await.ok().flatten()
        } else {
            None
        };

        // Load resolved variables (group + host inheritance) for template rendering
        let vars = self
            .store
            .resolve_device_variables_flat(device.id)
            .await
            .unwrap_or_default();

        // Load port assignments for VRF context
        let port_assignments = self.store.list_port_assignments(device.id).await.unwrap_or_default();

        // Render the template
        let rendered_config = render_config(&device, &template, &settings, role_template.as_ref(), &vars, Some(&port_assignments))?;

        // Resolve SSH credentials
        let (mut ssh_user, mut ssh_pass) = crate::utils::resolve_ssh_credentials(&self.store, device.ssh_user.clone(), device.ssh_pass.clone(), device.vendor.as_deref()).await;

        // Override with job-specific credential if set
        if !job.credential_id.is_empty() {
            if let Ok(cred_id) = job.credential_id.parse::<i64>() {
                if let Some(cred) = self.store.get_credential(cred_id).await? {
                    if !cred.username.is_empty() { ssh_user = cred.username; }
                    if !cred.password.is_empty() { ssh_pass = cred.password; }
                }
            }
        }

        if ssh_user.is_empty() || ssh_pass.is_empty() {
            return Err(anyhow::anyhow!("No SSH credentials available for this device"));
        }

        // Resolve vendor diff_command wrapper
        let vendor = match device.vendor.as_deref() {
            Some(v) if !v.is_empty() => self.store.resolve_vendor(v).await.ok().flatten(),
            _ => None,
        };

        let has_diff_command = vendor.as_ref().map_or(false, |v| !v.diff_command.is_empty());

        if !has_diff_command {
            return Err(anyhow::anyhow!("Vendor has no diff_command configured"));
        }

        // Strip "end" lines that would exit config mode entirely since the diff_command
        // wrapper manages the session lifecycle (e.g., show session-config diffs / abort for Arista)
        let config_for_diff: String = rendered_config
            .lines()
            .filter(|line| !line.trim().eq_ignore_ascii_case("end"))
            .collect::<Vec<_>>()
            .join("\n");
        let diff_payload = vendor.as_ref().unwrap().diff_command.replace("{CONFIG}", &config_for_diff);

        // Use interactive shell for multi-line diff commands (network devices need PTY)
        let output = crate::utils::ssh_run_interactive_async(&device.ip, &ssh_user, &ssh_pass, &diff_payload)
            .await
            .map_err(|e| anyhow::anyhow!(e))?;

        Ok(output)
    }

    async fn execute_apply_template_job(&self, job: &Job) -> Result<String> {
        // job.command stores the template ID to apply
        let template_id: i64 = if !job.command.is_empty() {
            job.command.parse()
                .map_err(|_| anyhow::anyhow!("Invalid template ID: {}", job.command))?
        } else {
            return Err(anyhow::anyhow!("No template ID specified in apply_template job"));
        };

        let device = self.store.get_device(job.device_id).await?
            .ok_or_else(|| anyhow::anyhow!("Device not found: {}", job.device_id))?;

        let template = self.store.get_template(template_id).await?
            .ok_or_else(|| anyhow::anyhow!("Template not found: {}", template_id))?;

        let settings = self.store.get_settings().await?;

        // Look up role-specific template by name convention
        let role_template = if let Some(ref role) = device.topology_role {
            let capitalized_role = format!("{}{}", &role[..1].to_uppercase(), &role[1..]);
            let role_name = if template.name.ends_with(" Default") {
                format!("{} {}", template.name.trim_end_matches(" Default"), capitalized_role)
            } else {
                format!("{} {}", template.name, capitalized_role)
            };
            self.store.get_template_by_name(&role_name).await.ok().flatten()
        } else {
            None
        };

        let vars = self
            .store
            .resolve_device_variables_flat(device.id)
            .await
            .unwrap_or_default();

        let port_assignments = self.store.list_port_assignments(device.id).await.unwrap_or_default();

        let rendered_config = render_config(&device, &template, &settings, role_template.as_ref(), &vars, Some(&port_assignments))?;

        let (mut ssh_user, mut ssh_pass) = crate::utils::resolve_ssh_credentials(&self.store, device.ssh_user.clone(), device.ssh_pass.clone(), device.vendor.as_deref()).await;

        // Override with job-specific credential if set
        if !job.credential_id.is_empty() {
            if let Ok(cred_id) = job.credential_id.parse::<i64>() {
                if let Some(cred) = self.store.get_credential(cred_id).await? {
                    if !cred.username.is_empty() { ssh_user = cred.username; }
                    if !cred.password.is_empty() { ssh_pass = cred.password; }
                }
            }
        }

        if ssh_user.is_empty() || ssh_pass.is_empty() {
            return Err(anyhow::anyhow!("No SSH credentials available for this device"));
        }

        let vendor = match device.vendor.as_deref() {
            Some(v) if !v.is_empty() => self.store.resolve_vendor(v).await.ok().flatten(),
            _ => None,
        };

        let has_deploy_command = vendor.as_ref().map_or(false, |v| !v.deploy_command.is_empty());

        let deploy_payload = if let Some(ref v) = vendor {
            if !v.deploy_command.is_empty() {
                v.deploy_command.replace("{CONFIG}", &rendered_config)
            } else {
                rendered_config
            }
        } else {
            rendered_config
        };

        let output = if has_deploy_command {
            crate::utils::ssh_run_interactive_async(&device.ip, &ssh_user, &ssh_pass, &deploy_payload)
                .await
                .map_err(|e| anyhow::anyhow!(e))?
        } else {
            crate::utils::ssh_run_command_async(&device.ip, &ssh_user, &ssh_pass, &deploy_payload)
                .await
                .map_err(|e| anyhow::anyhow!(e))?
        };

        // Update device's config_template to the applied template
        let _ = self.store.update_device_status(device.id, device_status::ONLINE).await;

        Ok(output)
    }

    async fn execute_webhook_job(&self, job: &Job) -> Result<String> {
        // The command field stores the action ID (as text) for webhook jobs
        let action_id: i64 = job.command.parse()
            .map_err(|_| anyhow::anyhow!("Invalid vendor action ID: {}", job.command))?;
        let action = self.store.get_vendor_action(action_id).await?
            .ok_or_else(|| anyhow::anyhow!("Vendor action not found: {}", job.command))?;

        if action.action_type != "webhook" {
            return Err(anyhow::anyhow!("Action {} is not a webhook action", action.id));
        }

        if action.webhook_url.is_empty() {
            return Err(anyhow::anyhow!("Webhook URL is empty for action {}", action.id));
        }

        // Optionally resolve device context for variable substitution in URL/body
        let device = self.store.get_device(job.device_id).await?;
        let url = if let Some(ref dev) = device {
            substitute_device_vars(&action.webhook_url, dev)
        } else {
            action.webhook_url.clone()
        };
        let body = if let Some(ref dev) = device {
            substitute_device_vars(&action.webhook_body, dev)
        } else {
            action.webhook_body.clone()
        };

        // Parse headers JSON
        let headers: HashMap<String, String> = serde_json::from_str(&action.webhook_headers)
            .unwrap_or_default();

        // Build HTTP request
        let client = reqwest::Client::new();
        let method = match action.webhook_method.to_uppercase().as_str() {
            "GET" => reqwest::Method::GET,
            "POST" => reqwest::Method::POST,
            "PUT" => reqwest::Method::PUT,
            "PATCH" => reqwest::Method::PATCH,
            "DELETE" => reqwest::Method::DELETE,
            other => return Err(anyhow::anyhow!("Unsupported HTTP method: {}", other)),
        };

        let mut request = client.request(method.clone(), &url);

        for (key, value) in &headers {
            request = request.header(key.as_str(), value.as_str());
        }

        // Add body for methods that support it
        if !body.is_empty() && matches!(method, reqwest::Method::POST | reqwest::Method::PUT | reqwest::Method::PATCH) {
            // Auto-set Content-Type if not specified
            if !headers.keys().any(|k| k.to_lowercase() == "content-type") {
                request = request.header("Content-Type", "application/json");
            }
            request = request.body(body);
        }

        let response = request.send().await
            .map_err(|e| anyhow::anyhow!("HTTP request failed: {}", e))?;

        let status = response.status();
        let response_body = response.text().await
            .unwrap_or_else(|_| "(could not read response body)".to_string());

        if status.is_success() {
            Ok(format!("HTTP {} {}\n\n{}", status.as_u16(), status.canonical_reason().unwrap_or(""), response_body))
        } else {
            Err(anyhow::anyhow!("HTTP {} {}\n\n{}", status.as_u16(), status.canonical_reason().unwrap_or(""), response_body))
        }
    }

    async fn broadcast_job(&self, event_type: EventType, job_id: &str) {
        if let Some(ref hub) = self.ws_hub {
            if let Ok(Some(job)) = self.store.get_job(job_id).await {
                hub.broadcast_job_update(event_type, &job).await;
            }
        }
    }
}

/// Render a device config template (shared logic, also used by handlers)
pub fn render_config(
    device: &Device,
    template: &Template,
    settings: &Settings,
    role_template: Option<&Template>,
    vars: &std::collections::HashMap<String, String>,
    port_assignments: Option<&[PortAssignment]>,
) -> Result<String> {
    let tera_content = crate::utils::convert_go_template_to_tera(&template.content);

    let mut tera = Tera::default();
    tera.add_raw_template("device", &tera_content)
        .map_err(|e| anyhow::anyhow!("Invalid template: {}", e))?;

    // Register role template as "role" so the device template can {% include "role" %}
    if let Some(role_tmpl) = role_template {
        let role_content = crate::utils::convert_go_template_to_tera(&role_tmpl.content);
        tera.add_raw_template("role", &role_content)
            .map_err(|e| anyhow::anyhow!("Invalid role template: {}", e))?;
    } else {
        tera.add_raw_template("role", "")
            .map_err(|e| anyhow::anyhow!("Failed to add empty role template: {}", e))?;
    }

    let mut context = Context::new();
    context.insert("Hostname", &device.hostname);
    context.insert("MAC", &device.mac.clone().unwrap_or_default());
    context.insert("IP", &device.ip);
    context.insert("Vendor", &device.vendor.clone().unwrap_or_default());
    context.insert("Model", &device.model.clone().unwrap_or_default());
    context.insert("SerialNumber", &device.serial_number.clone().unwrap_or_default());
    context.insert("TopologyId", &device.topology_id.clone().unwrap_or_default());
    context.insert("TopologyRole", &device.topology_role.clone().unwrap_or_default());
    context.insert("Subnet", &settings.dhcp_subnet);
    context.insert("Gateway", &settings.dhcp_gateway);
    context.insert("vars", vars);

    // Build VRF context from port assignments
    // VRFs = list of unique VRFs with their interfaces
    // Each VRF: { id, name, rd, interfaces: [{ port_name, remote_device, remote_port }] }
    if let Some(assignments) = port_assignments {
        let mut vrf_map: HashMap<String, serde_json::Value> = HashMap::new();
        for pa in assignments {
            if let Some(vrf_id) = pa.vrf_id {
                let vrf_key = vrf_id.to_string();
                let iface = serde_json::json!({
                    "port_name": pa.port_name,
                    "remote_device": pa.remote_device_hostname.clone().unwrap_or_default(),
                    "remote_port": pa.remote_port_name,
                    "description": pa.description.clone().unwrap_or_default(),
                });
                if let Some(existing) = vrf_map.get_mut(&vrf_key) {
                    if let Some(arr) = existing.get_mut("interfaces").and_then(|v| v.as_array_mut()) {
                        arr.push(iface);
                    }
                } else {
                    vrf_map.insert(vrf_key.clone(), serde_json::json!({
                        "id": vrf_id,
                        "name": pa.vrf_name.clone().unwrap_or(vrf_key),
                        "interfaces": [iface],
                    }));
                }
            }
        }
        let vrfs: Vec<serde_json::Value> = vrf_map.into_values().collect();
        context.insert("VRFs", &vrfs);
    } else {
        let empty: Vec<serde_json::Value> = vec![];
        context.insert("VRFs", &empty);
    }

    tera.render("device", &context)
        .map_err(|e| anyhow::anyhow!("Template rendering failed: {}", e))
}

/// Variable substitution for webhook URLs/bodies.
/// Supports {{var}}, {{.var}} (Go template style), and case-insensitive matching.
fn substitute_device_vars(template: &str, device: &Device) -> String {
    use regex_lite::Regex;

    let device_id = device.id.to_string();
    let vars: &[(&str, &str)] = &[
        ("device_id", &device_id),
        ("hostname", &device.hostname),
        ("ip", &device.ip),
        ("mac", device.mac.as_deref().unwrap_or("")),
        ("vendor", device.vendor.as_deref().unwrap_or("")),
        ("model", device.model.as_deref().unwrap_or("")),
        ("serial_number", device.serial_number.as_deref().unwrap_or("")),
    ];

    let mut result = template.to_string();
    for (name, value) in vars {
        // Matches {{name}} and {{.name}}, case-insensitive
        if let Ok(re) = Regex::new(&format!(r"(?i)\{{\{{\.?{}\}}\}}", name)) {
            result = re.replace_all(&result, *value).into_owned();
        }
    }
    result
}
