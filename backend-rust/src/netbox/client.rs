use anyhow::Result;
use reqwest::Client;
use std::time::Duration;

use super::types::*;

/// NetBox API client
pub struct NetBoxClient {
    base_url: String,
    token: String,
    client: Client,
}

impl NetBoxClient {
    pub fn new(url: String, token: String) -> Result<Self> {
        let client = Client::builder()
            .timeout(Duration::from_secs(30))
            .build()
            .map_err(|e| anyhow::anyhow!("Failed to build HTTP client: {}", e))?;

        Ok(Self {
            base_url: url.trim_end_matches('/').to_string(),
            token,
            client,
        })
    }

    fn api_url(&self, path: &str) -> String {
        format!("{}/api{}", self.base_url, path)
    }

    fn auth_header(&self) -> String {
        format!("Token {}", self.token)
    }

    /// Helper to perform a paginated GET list request
    async fn list_paginated<T: serde::de::DeserializeOwned>(&self, endpoint: &str) -> Result<Vec<T>> {
        let resp = self
            .client
            .get(self.api_url(endpoint))
            .header("Authorization", self.auth_header())
            .header("Accept", "application/json")
            .send()
            .await?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            return Err(anyhow::anyhow!("NetBox API error {}: {}", status, body));
        }

        let paginated: PaginatedResponse<T> = resp.json().await?;
        Ok(paginated.results)
    }

    /// Helper to look up a single item by slug
    async fn get_by_slug<T: serde::de::DeserializeOwned>(&self, endpoint: &str, slug: &str) -> Result<Option<T>> {
        let resp = self
            .client
            .get(self.api_url(&format!("{}?slug={}", endpoint, slug)))
            .header("Authorization", self.auth_header())
            .header("Accept", "application/json")
            .send()
            .await?;

        let paginated: PaginatedResponse<T> = resp.json().await?;
        Ok(paginated.results.into_iter().next())
    }

    /// Helper to create a resource via POST
    async fn create_resource<T, B>(&self, endpoint: &str, body: &B) -> Result<T>
    where
        T: serde::de::DeserializeOwned,
        B: serde::Serialize,
    {
        let resp = self
            .client
            .post(self.api_url(endpoint))
            .header("Authorization", self.auth_header())
            .json(body)
            .send()
            .await?;

        if !resp.status().is_success() {
            let body = resp.text().await.unwrap_or_default();
            return Err(anyhow::anyhow!("NetBox API create error: {}", body));
        }

        Ok(resp.json().await?)
    }

    /// Test connectivity to NetBox
    pub async fn test_connection(&self) -> bool {
        match self
            .client
            .get(self.api_url("/dcim/sites/?limit=1"))
            .header("Authorization", self.auth_header())
            .header("Accept", "application/json")
            .send()
            .await
        {
            Ok(resp) => resp.status().is_success(),
            Err(_) => false,
        }
    }

    // --- Manufacturers ---

    pub async fn list_manufacturers(&self) -> Result<Vec<NbManufacturer>> {
        self.list_paginated("/dcim/manufacturers/?limit=1000").await
    }

    pub async fn get_manufacturer_by_slug(&self, slug: &str) -> Result<Option<NbManufacturer>> {
        self.get_by_slug("/dcim/manufacturers/", slug).await
    }

    pub async fn create_manufacturer(&self, name: &str, slug: &str) -> Result<NbManufacturer> {
        self.create_resource("/dcim/manufacturers/", &ManufacturerCreate {
            name: name.to_string(),
            slug: slug.to_string(),
        }).await
    }

    // --- Sites ---

    pub async fn list_sites(&self) -> Result<Vec<NbSite>> {
        self.list_paginated("/dcim/sites/?limit=1000").await
    }

    pub async fn get_or_create_site(&self, name: &str, slug: &str) -> Result<NbSite> {
        if let Some(site) = self.get_by_slug::<NbSite>("/dcim/sites/", slug).await? {
            return Ok(site);
        }

        self.create_resource("/dcim/sites/", &SiteCreate {
            name: name.to_string(),
            slug: slug.to_string(),
            status: "active".to_string(),
        }).await
    }

    // --- Device Roles ---

    pub async fn list_device_roles(&self) -> Result<Vec<NbDeviceRole>> {
        self.list_paginated("/dcim/device-roles/?limit=1000").await
    }

    pub async fn get_or_create_role(&self, name: &str, slug: &str, color: &str) -> Result<NbDeviceRole> {
        if let Some(role) = self.get_by_slug::<NbDeviceRole>("/dcim/device-roles/", slug).await? {
            return Ok(role);
        }

        self.create_resource("/dcim/device-roles/", &DeviceRoleCreate {
            name: name.to_string(),
            slug: slug.to_string(),
            color: color.to_string(),
        }).await
    }

    // --- Device Types ---

    pub async fn get_or_create_device_type(&self, manufacturer_id: i32, model: &str, slug: &str) -> Result<NbDeviceType> {
        if let Some(dt) = self.get_by_slug::<NbDeviceType>("/dcim/device-types/", slug).await? {
            return Ok(dt);
        }

        self.create_resource("/dcim/device-types/", &DeviceTypeCreate {
            manufacturer: manufacturer_id,
            model: model.to_string(),
            slug: slug.to_string(),
        }).await
    }

    // --- Devices ---

    pub async fn list_devices(&self) -> Result<Vec<NbDevice>> {
        self.list_paginated("/dcim/devices/?limit=1000").await
    }

    pub async fn get_device_by_name(&self, name: &str) -> Result<Option<NbDevice>> {
        let resp = self
            .client
            .get(self.api_url(&format!("/dcim/devices/?name={}", name)))
            .header("Authorization", self.auth_header())
            .header("Accept", "application/json")
            .send()
            .await?;

        let paginated: PaginatedResponse<NbDevice> = resp.json().await?;
        Ok(paginated.results.into_iter().next())
    }

    pub async fn create_device(&self, device: &DeviceCreate) -> Result<NbDevice> {
        self.create_resource("/dcim/devices/", device).await
    }

    pub async fn update_device(&self, id: i32, device: &DeviceCreate) -> Result<NbDevice> {
        let resp = self
            .client
            .put(self.api_url(&format!("/dcim/devices/{}/", id)))
            .header("Authorization", self.auth_header())
            .json(device)
            .send()
            .await?;

        if !resp.status().is_success() {
            let body = resp.text().await.unwrap_or_default();
            return Err(anyhow::anyhow!("Failed to update device: {}", body));
        }

        Ok(resp.json().await?)
    }

    // --- Interfaces ---

    pub async fn list_interfaces_by_device(&self, device_id: i32) -> Result<Vec<NbInterface>> {
        self.list_paginated(&format!("/dcim/interfaces/?device_id={}&limit=100", device_id)).await
    }

    pub async fn create_interface(&self, device_id: i32, name: &str, mac: Option<&str>) -> Result<NbInterface> {
        self.create_resource("/dcim/interfaces/", &InterfaceCreate {
            device: device_id,
            name: name.to_string(),
            iface_type: "virtual".to_string(),
            mac_address: mac.map(|s| s.to_string()),
        }).await
    }

}
