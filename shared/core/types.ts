// Domain types - platform agnostic

import { getVendorCache } from './utils/vendor';

export interface Device {
  id: string;
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

// Device variable types (KV pairs per device)
export interface DeviceVariable {
  id: number;
  device_id: string;
  key: string;
  value: string;
  created_at: string;
  updated_at: string;
}

export interface VariableKeyInfo {
  key: string;
  device_count: number;
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
  device_id: string;
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
  device_id: string;
  command: string;
  status: JobStatus;
  output: string | null;
  error: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

// Group types (Ansible-style variable inheritance)
export interface Group {
  id: string;
  name: string;
  description?: string;
  parent_id?: string;
  precedence: number;
  device_count?: number;
  child_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface GroupFormData {
  id: string;
  name: string;
  description: string;
  parent_id: string;
  precedence: number;
}

export interface GroupVariable {
  id: number;
  group_id: string;
  key: string;
  value: string;
  created_at: string;
  updated_at: string;
}

export interface ResolvedVariable {
  key: string;
  value: string;
  source: string;
  source_name: string;
  source_type: 'all' | 'group' | 'host';
}

export interface ResolutionLayer {
  source: string;
  source_name: string;
  source_type: 'all' | 'group' | 'host';
  precedence: number;
  variables: Record<string, string>;
}

export interface ResolvedVariablesResponse {
  variables: Record<string, string>;
  resolved: ResolvedVariable[];
  resolution_order: ResolutionLayer[];
}

// API Response types
export interface ApiError {
  error: string;
  code?: string;
}

// ========== IPAM Types ==========

export type IpamStatus = 'active' | 'reserved' | 'deprecated' | 'dhcp';

export interface IpamRegion {
  id: string;
  name: string;
  description?: string;
  location_count?: number;
  created_at: string;
  updated_at: string;
}

export interface IpamRegionFormData {
  id: string;
  name: string;
  description: string;
}

export interface IpamLocation {
  id: string;
  name: string;
  description?: string;
  region_id: string;
  region_name?: string;
  datacenter_count?: number;
  created_at: string;
  updated_at: string;
}

export interface IpamLocationFormData {
  id: string;
  name: string;
  description: string;
  region_id: string;
}

export interface IpamDatacenter {
  id: string;
  name: string;
  description?: string;
  location_id: string;
  location_name?: string;
  region_name?: string;
  prefix_count?: number;
  created_at: string;
  updated_at: string;
}

export interface IpamDatacenterFormData {
  id: string;
  name: string;
  description: string;
  location_id: string;
}

export interface IpamRole {
  id: string;
  name: string;
  description?: string;
  created_at: string;
}

export interface IpamVrf {
  id: string;
  name: string;
  rd?: string;
  description?: string;
  prefix_count?: number;
  created_at: string;
  updated_at: string;
}

export interface IpamPrefix {
  id: number;
  prefix: string;
  network_int: number;
  broadcast_int: number;
  prefix_length: number;
  description?: string;
  status: IpamStatus;
  is_supernet: boolean;
  role_ids?: string[];
  role_names?: string[];
  parent_id?: number;
  parent_prefix?: string;
  datacenter_id?: string;
  datacenter_name?: string;
  vlan_id?: number;
  vrf_id?: string;
  vrf_name?: string;
  child_prefix_count?: number;
  ip_address_count?: number;
  utilization?: number;
  created_at: string;
  updated_at: string;
}

export interface IpamPrefixFormData {
  prefix: string;
  description: string;
  status: IpamStatus;
  is_supernet: boolean;
  role_ids: string[];
  parent_id: string;
  datacenter_id: string;
  vlan_id: string;
  vrf_id: string;
}

export interface IpamIpAddress {
  id: string;
  address: string;
  address_int: number;
  prefix_id: number;
  prefix?: string;
  description?: string;
  status: IpamStatus;
  role_ids?: string[];
  role_names?: string[];
  dns_name?: string;
  device_id?: string;
  device_hostname?: string;
  interface_name?: string;
  vrf_id?: string;
  vrf_name?: string;
  created_at: string;
  updated_at: string;
}

export interface IpamIpAddressFormData {
  id: string;
  address: string;
  prefix_id: string;
  description: string;
  status: IpamStatus;
  role_ids: string[];
  dns_name: string;
  device_id: string;
  interface_name: string;
  vrf_id: string;
}

export interface IpamTag {
  id: number;
  resource_type: string;
  resource_id: string;
  key: string;
  value: string;
  created_at: string;
}

export const IPAM_STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'reserved', label: 'Reserved' },
  { value: 'deprecated', label: 'Deprecated' },
] as const;

export const IPAM_IP_STATUS_OPTIONS = [
  ...IPAM_STATUS_OPTIONS,
  { value: 'dhcp', label: 'DHCP' },
] as const;

export const EMPTY_IPAM_PREFIX_FORM: IpamPrefixFormData = {
  prefix: '', description: '', status: 'active',
  is_supernet: false, role_ids: [], parent_id: '', datacenter_id: '', vlan_id: '', vrf_id: '',
};

export const EMPTY_IPAM_IP_FORM: IpamIpAddressFormData = {
  id: '', address: '', prefix_id: '', description: '', status: 'active',
  role_ids: [], dns_name: '', device_id: '', interface_name: '', vrf_id: '',
};

// ========== Chassis / Port Layout Types ==========

export type PortConnector = 'rj45' | 'sfp' | 'sfp+' | 'sfp28' | 'qsfp+' | 'qsfp28' | 'qsfp-dd';

export type PortSpeedMbps = 1000 | 2500 | 10000 | 25000 | 40000 | 50000 | 100000 | 400000;

export type PortRole = 'console' | 'mgmt' | 'northbound' | 'southbound' | 'lateral' | 'access' | 'uplink';

export interface ChassisPort {
  col: number;
  vendor_port_name: string;
  connector: PortConnector;
  speed: PortSpeedMbps;
  role?: PortRole;
}

export interface ChassisSection {
  label?: string;
  ports: ChassisPort[];
}

export interface ChassisRow {
  row: number;
  sections: ChassisSection[];
}

export interface ChassisLayout {
  vendor_id: string;
  model: string;
  display_name: string;
  rack_units: number;
  rows: ChassisRow[];
}

export interface DeviceModel {
  id: string;
  vendor_id: string;
  model: string;
  display_name: string;
  rack_units: number;
  layout: ChassisRow[];
  device_count?: number;
  created_at: string;
  updated_at: string;
}

export interface DeviceModelFormData {
  id: string;
  vendor_id: string;
  model: string;
  display_name: string;
  rack_units: number;
  layout: ChassisRow[];
}

export const EMPTY_DEVICE_MODEL_FORM: DeviceModelFormData = {
  id: '', vendor_id: '', model: '', display_name: '', rack_units: 1, layout: [],
};

export const PORT_CONNECTOR_OPTIONS = [
  { value: 'rj45', label: 'RJ45' },
  { value: 'sfp', label: 'SFP' },
  { value: 'sfp+', label: 'SFP+' },
  { value: 'sfp28', label: 'SFP28' },
  { value: 'qsfp+', label: 'QSFP+' },
  { value: 'qsfp28', label: 'QSFP28' },
  { value: 'qsfp-dd', label: 'QSFP-DD' },
] as const;

export const PORT_SPEED_OPTIONS = [
  { value: 1000, label: '1G' },
  { value: 2500, label: '2.5G' },
  { value: 10000, label: '10G' },
  { value: 25000, label: '25G' },
  { value: 40000, label: '40G' },
  { value: 50000, label: '50G' },
  { value: 100000, label: '100G' },
  { value: 400000, label: '400G' },
] as const;

export const PORT_ROLE_OPTIONS = [
  { value: '', label: 'None' },
  { value: 'console', label: 'Console' },
  { value: 'mgmt', label: 'Management' },
  { value: 'northbound', label: 'Northbound' },
  { value: 'southbound', label: 'Southbound' },
  { value: 'lateral', label: 'Lateral' },
  { value: 'access', label: 'Access' },
  { value: 'uplink', label: 'Uplink' },
] as const;
