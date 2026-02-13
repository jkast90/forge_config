// Domain types - platform agnostic

import { getVendorCache } from './utils/vendor';

export interface Device {
  mac: string;
  ip: string;
  hostname: string;
  vendor?: string;
  model?: string;
  serial_number?: string;
  config_template: string;
  ssh_user?: string;
  ssh_pass?: string;
  topology_id?: string;
  topology_role?: TopologyRole;
  status: DeviceStatus;
  last_seen?: string;
  last_backup?: string;
  last_error?: string;
  created_at: string;
  updated_at: string;
}

export type DeviceStatus = 'online' | 'offline' | 'provisioning' | 'unknown';
export type TopologyRole = 'super-spine' | 'spine' | 'leaf';

export interface DeviceFormData {
  mac: string;
  ip: string;
  hostname: string;
  vendor: string;
  model: string;
  serial_number: string;
  config_template: string;
  ssh_user: string;
  ssh_pass: string;
  topology_id: string;
  topology_role: string;
}

// Topology types (CLOS fabric)
export interface Topology {
  id: string;
  name: string;
  description?: string;
  device_count?: number;
  super_spine_count?: number;
  spine_count?: number;
  leaf_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface TopologyFormData {
  id: string;
  name: string;
  description: string;
}

export interface Settings {
  default_ssh_user: string;
  default_ssh_pass: string;
  backup_command: string;
  backup_delay: number;
  dhcp_range_start: string;
  dhcp_range_end: string;
  dhcp_subnet: string;
  dhcp_gateway: string;
  tftp_server_ip: string;
  // OpenGear ZTP enrollment options
  opengear_enroll_url: string;
  opengear_enroll_bundle: string;
  opengear_enroll_password: string;
}

export interface Backup {
  id: number;
  device_mac: string;
  filename: string;
  size: number;
  created_at: string;
}

// UI State types
export type Theme = 'dark' | 'light' | 'plain' | 'solarized' | 'dracula' | 'nord' | 'evergreen-dark' | 'evergreen-light' | 'ocean-dark' | 'ocean-light' | 'nautical-dark' | 'nautical-light' | 'contrast-dark' | 'contrast-light';

export interface Message {
  type: 'success' | 'error';
  text: string;
}

// Vendor configuration
export interface Vendor {
  id: string;
  name: string;
  backup_command: string;
  deploy_command: string;
  ssh_port: number;
  ssh_user?: string;
  ssh_pass?: string;
  mac_prefixes: string[];
  vendor_class?: string; // DHCP Option 60 vendor class identifier
  default_template?: string; // Default template ID for this vendor
  device_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface VendorFormData {
  id: string;
  name: string;
  backup_command: string;
  deploy_command: string;
  ssh_port: number;
  ssh_user: string;
  ssh_pass: string;
  mac_prefixes: string[];
  vendor_class: string;
  default_template: string;
}

// DHCP Option types
export type DhcpOptionType = 'string' | 'ip' | 'hex' | 'number';

export interface DhcpOption {
  id: string;
  option_number: number;
  name: string;
  value: string;
  type: DhcpOptionType;
  vendor_id?: string; // If set, only applies to this vendor
  description?: string;
  enabled: boolean;
}

export interface DhcpOptionFormData {
  id: string;
  option_number: number;
  name: string;
  value: string;
  type: DhcpOptionType;
  vendor_id: string;
  description: string;
  enabled: boolean;
}

// Common DHCP options reference
export const COMMON_DHCP_OPTIONS = [
  { number: 66, name: 'TFTP Server', description: 'Boot server hostname or IP' },
  { number: 67, name: 'Bootfile Name', description: 'Boot file path' },
  { number: 43, name: 'Vendor Specific', description: 'Vendor-specific information (hex encoded)' },
  { number: 60, name: 'Vendor Class ID', description: 'Vendor class identifier' },
  { number: 150, name: 'TFTP Server Address', description: 'TFTP server IP (Cisco)' },
  { number: 125, name: 'Vendor-Identifying', description: 'Vendor-identifying vendor-specific info' },
] as const;

// Template types
export interface Template {
  id: string;
  name: string;
  description?: string;
  vendor_id?: string;
  content: string;
  device_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface TemplateFormData {
  id: string;
  name: string;
  description: string;
  vendor_id: string;
  content: string;
}

export interface TemplateVariable {
  name: string;
  description: string;
  example: string;
}

// Discovery types
export interface DiscoveredDevice {
  mac: string;
  ip: string;
  hostname: string;
  expiry_time: number;
  expires_at: string;
  first_seen?: string;
  // Auto-detected vendor ID (from MAC prefix or DHCP vendor class)
  vendor?: string;
  // Derived from DHCP data
  model?: string;             // From user_class or cpewan_class
  serial_number?: string;     // From cpewan_serial or client_id
  // DHCP request metadata (captured from dnsmasq dhcp-script)
  vendor_class?: string;      // Option 60: vendor class identifier
  user_class?: string;        // Option 77: user class (model/firmware info)
  dhcp_client_id?: string;    // Option 61: client identifier (serial/DUID)
  requested_options?: string; // Options requested by client (fingerprinting)
  relay_address?: string;     // DHCP relay IP
  circuit_id?: string;        // Option 82.1: circuit ID (switch port)
  remote_id?: string;         // Option 82.2: remote ID (switch MAC/name)
  subscriber_id?: string;     // Option 82.6: subscriber ID
}

export type DiscoveryEventType = 'discovered' | 'added' | 'lease_renewed' | 'lease_expired';

export interface DiscoveryLog {
  id: number;
  event_type: DiscoveryEventType;
  mac: string;
  ip: string;
  hostname?: string;
  vendor?: string;
  message?: string;
  created_at: string;
}

// Test container types
export interface TestContainer {
  id: string;
  name: string;
  hostname: string;
  mac: string;
  ip: string;
  status: string;
  created_at: string;
}

export interface SpawnContainerRequest {
  hostname?: string;
  mac?: string;
  vendor_class?: string; // DHCP Option 60 vendor class identifier
  config_method?: 'tftp' | 'http' | 'both'; // Config fetch method
  image?: string; // Docker image to use (e.g., 'ceosimage:latest' for cEOS)
  topology_id?: string; // Assign to topology on creation
  topology_role?: string; // Role in topology (spine, leaf, super-spine)
}

// CLOS lab types
export interface ClosLabDevice {
  hostname: string;
  role: string;
  mac: string;
  ip: string;
  container_name: string;
}

export interface ClosLabResponse {
  topology_id: string;
  topology_name: string;
  devices: ClosLabDevice[];
  fabric_links: string[];
}

// Config fetch method options
export const CONFIG_METHOD_OPTIONS = [
  { value: 'tftp', label: 'TFTP', description: 'Traditional TFTP-based config fetch (Cisco IOS, Juniper, etc.)' },
  { value: 'http', label: 'HTTP', description: 'HTTP-based config fetch (OpenGear, newer devices)' },
  { value: 'both', label: 'Both (TFTP first)', description: 'Try TFTP first, fall back to HTTP' },
] as const;

// Get the default template for a vendor using vendor cache
export function getDefaultTemplateForVendor(vendorId: string): string {
  const vendors = getVendorCache();
  if (vendors) {
    const vendor = vendors.find((v) => v.id.toLowerCase() === vendorId.toLowerCase());
    if (vendor?.default_template) {
      return vendor.default_template;
    }
  }
  // Fallback to generic-switch if vendor not found or no default_template set
  return 'generic-switch';
}

// Network interface types
export interface NetworkInterface {
  name: string;
  addresses: string[];
  is_up: boolean;
  is_loopback: boolean;
}

// Vendor Action types
export interface VendorAction {
  id: string;
  vendor_id: string;
  label: string;
  command: string;
  sort_order: number;
  created_at: string;
}

export interface VendorActionFormData {
  id: string;
  vendor_id: string;
  label: string;
  command: string;
  sort_order: number;
}

export interface ExecCommandResult {
  output: string | null;
  error: string | null;
}

// Job types
export type JobStatus = 'queued' | 'running' | 'completed' | 'failed';
export type JobType = 'command' | 'deploy';

export interface Job {
  id: string;
  job_type: JobType;
  device_mac: string;
  command: string;
  status: JobStatus;
  output: string | null;
  error: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

// API Response types
export interface ApiError {
  error: string;
  code?: string;
}
