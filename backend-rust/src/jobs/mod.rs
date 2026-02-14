use anyhow::Result;
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
        let device = self.store.get_device(&job.device_id).await?
            .ok_or_else(|| anyhow::anyhow!("Device not found: {}", job.device_id))?;

        let (ssh_user, ssh_pass) = crate::utils::resolve_ssh_credentials(&self.store, &device).await;

        if ssh_user.is_empty() || ssh_pass.is_empty() {
            return Err(anyhow::anyhow!("No SSH credentials available for this device"));
        }

        crate::utils::ssh_run_command_async(&device.ip, &ssh_user, &ssh_pass, &job.command)
            .await
            .map_err(|e| anyhow::anyhow!(e))
    }

    async fn execute_deploy_job(&self, job: &Job) -> Result<String> {
        let device = self.store.get_device(&job.device_id).await?
            .ok_or_else(|| anyhow::anyhow!("Device not found: {}", job.device_id))?;

        // Resolve template: use device's config_template, or fall back to vendor's default_template
        let template_id = if !device.config_template.is_empty() {
            device.config_template.clone()
        } else if let Some(ref vendor_id) = device.vendor {
            let vendor = self.store.get_vendor(vendor_id).await?
                .ok_or_else(|| anyhow::anyhow!("Device has no template and vendor not found"))?;
            if vendor.default_template.is_empty() {
                return Err(anyhow::anyhow!("Device has no template and vendor has no default template"));
            }
            vendor.default_template
        } else {
            return Err(anyhow::anyhow!("Device has no template assigned and no vendor to infer from"));
        };

        let template = self.store.get_template(&template_id).await?
            .ok_or_else(|| anyhow::anyhow!("Template not found: {}", template_id))?;

        let settings = self.store.get_settings().await?;

        // Look up role-specific template (e.g., "arista-eos-spine" or "arista-eos-leaf")
        let role_template = if let Some(ref role) = device.topology_role {
            let role_id = format!("{}-{}", template.id, role);
            self.store.get_template(&role_id).await.ok().flatten()
        } else {
            None
        };

        // Load resolved variables (group + host inheritance) for template rendering
        let vars = self
            .store
            .resolve_device_variables_flat(&device.id)
            .await
            .unwrap_or_default();

        // Render the template
        let rendered_config = render_config(&device, &template, &settings, role_template.as_ref(), &vars)?;

        // Resolve SSH credentials
        let (ssh_user, ssh_pass) = crate::utils::resolve_ssh_credentials(&self.store, &device).await;

        if ssh_user.is_empty() || ssh_pass.is_empty() {
            return Err(anyhow::anyhow!("No SSH credentials available for this device"));
        }

        // Resolve vendor deploy_command wrapper
        let vendor = match device.vendor.as_deref() {
            Some(v) if !v.is_empty() => self.store.get_vendor(v).await.ok().flatten(),
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
        let _ = self.store.update_device_status(&device.id, device_status::ONLINE).await;

        Ok(output)
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
    context.insert("MAC", &device.mac);
    context.insert("IP", &device.ip);
    context.insert("Vendor", &device.vendor.clone().unwrap_or_default());
    context.insert("Model", &device.model.clone().unwrap_or_default());
    context.insert("SerialNumber", &device.serial_number.clone().unwrap_or_default());
    context.insert("TopologyId", &device.topology_id.clone().unwrap_or_default());
    context.insert("TopologyRole", &device.topology_role.clone().unwrap_or_default());
    context.insert("Subnet", &settings.dhcp_subnet);
    context.insert("Gateway", &settings.dhcp_gateway);
    context.insert("vars", vars);

    tera.render("device", &context)
        .map_err(|e| anyhow::anyhow!("Template rendering failed: {}", e))
}
