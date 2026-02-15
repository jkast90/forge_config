// Domain types - platform agnostic

import { getVendorCache } from './utils/vendor';

export interface Device {
  id: number;
  mac: string | null;
  ip: string;
  hostname: string;
  vendor?: string;
  model?: string;
  serial_number?: string;
  config_template: string;
  ssh_user?: string;
  ssh_pass?: string;
  topology_id?: number;
  topology_role?: TopologyRole;
  hall_id?: number;
  row_id?: number;
  rack_id?: number;
  rack_position?: number;
  status: DeviceStatus;
  device_type?: string;
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
  device_type: string;
}

// Device variable types (KV pairs per device)
export interface DeviceVariable {
  id: number;
  device_id: number;
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
  id: number;
  name: string;
  description?: string;
  region_id?: number;
  campus_id?: number;
  datacenter_id?: number;
  device_count?: number;
  super_spine_count?: number;
  spine_count?: number;
  leaf_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface TopologyFormData {
  name: string;
  description: string;
  region_id: string;
  campus_id: string;
  datacenter_id: string;
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
  // Branding
  app_name: string;
  logo_url: string;
  // Device naming
  hostname_pattern: string;
}

export interface Branding {
  app_name: string;
  logo_url: string | null;
}

export interface Backup {
  id: number;
  device_id: number;
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
  id: number;
  name: string;
  backup_command: string;
  deploy_command: string;
  diff_command: string;
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
  name: string;
  backup_command: string;
  deploy_command: string;
  diff_command: string;
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
  id: number;
  option_number: number;
  name: string;
  value: string;
  type: DhcpOptionType;
  vendor_id?: number; // If set, only applies to this vendor
  description?: string;
  enabled: boolean;
}

export interface DhcpOptionFormData {
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
  id: number;
  name: string;
  description?: string;
  vendor_id?: number;
  content: string;
  device_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface TemplateFormData {
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
  topology_id?: number; // Assign to topology on creation
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
  topology_id: number;
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
export function getDefaultTemplateForVendor(vendorName: string): string {
  const vendors = getVendorCache();
  if (vendors) {
    const vendor = vendors.find((v) => v.name.toLowerCase() === vendorName.toLowerCase());
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
export type ActionType = 'ssh' | 'webhook';
export type WebhookMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface VendorAction {
  id: number;
  vendor_id: number;
  label: string;
  command: string;
  sort_order: number;
  action_type: ActionType;
  webhook_url: string;
  webhook_method: WebhookMethod;
  webhook_headers: string;
  webhook_body: string;
  output_parser_id?: number;
  created_at: string;
}

export interface VendorActionFormData {
  vendor_id: string;
  label: string;
  command: string;
  sort_order: number;
  action_type: ActionType;
  webhook_url: string;
  webhook_method: WebhookMethod;
  webhook_headers: string;
  webhook_body: string;
  output_parser_id: string;
}

export interface ExecCommandResult {
  output: string | null;
  error: string | null;
}

// Job types
export type JobStatus = 'queued' | 'running' | 'completed' | 'failed';
export type JobType = 'command' | 'deploy' | 'webhook' | 'apply_template';

export interface Job {
  id: string;
  job_type: JobType;
  device_id: number;
  command: string;
  status: JobStatus;
  output: string | null;
  error: string | null;
  credential_id?: string;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

// Job template types
export interface JobTemplate {
  id: number;
  name: string;
  description: string;
  job_type: JobType;
  command: string;
  action_id: number;
  credential_id?: number;
  target_mode: 'device' | 'group';
  target_device_ids: number[];
  target_group_id: number;
  schedule: string;
  enabled: boolean;
  last_run_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateJobTemplateRequest {
  name: string;
  description?: string;
  job_type: string;
  command?: string;
  action_id?: number;
  credential_id?: number;
  target_mode: string;
  target_device_ids?: number[];
  target_group_id?: number;
  schedule?: string;
  enabled?: boolean;
}

// User types
export interface User {
  id: number;
  username: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserFormData {
  username: string;
  password: string;
  enabled: boolean;
}

// Credential types
export interface Credential {
  id: number;
  name: string;
  description?: string;
  cred_type: string;
  username: string;
  password: string;
  created_at: string;
  updated_at: string;
}

export interface CredentialFormData {
  name: string;
  description: string;
  cred_type: string;
  username: string;
  password: string;
}

// Output Parser types
export interface OutputParser {
  id: number;
  name: string;
  description?: string;
  pattern: string;
  extract_names: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface OutputParserFormData {
  name: string;
  description: string;
  pattern: string;
  extract_names: string;
  enabled: boolean;
}

// Group types (Ansible-style variable inheritance)
export interface Group {
  id: number;
  name: string;
  description?: string;
  parent_id?: number;
  precedence: number;
  device_count?: number;
  child_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface GroupFormData {
  name: string;
  description: string;
  parent_id: number | null;
  precedence: number;
}

export interface GroupVariable {
  id: number;
  group_id: number;
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
  id: number;
  name: string;
  description?: string;
  campus_count?: number;
  created_at: string;
  updated_at: string;
}

export interface IpamRegionFormData {
  name: string;
  description: string;
}

export interface IpamCampus {
  id: number;
  name: string;
  description?: string;
  region_id: number;
  region_name?: string;
  datacenter_count?: number;
  created_at: string;
  updated_at: string;
}

export interface IpamCampusFormData {
  name: string;
  description: string;
  region_id: string;
}

export interface IpamDatacenter {
  id: number;
  name: string;
  description?: string;
  campus_id: number;
  campus_name?: string;
  region_name?: string;
  hall_count?: number;
  prefix_count?: number;
  created_at: string;
  updated_at: string;
}

export interface IpamDatacenterFormData {
  name: string;
  description: string;
  campus_id: string;
}

export interface IpamHall {
  id: number;
  name: string;
  description?: string;
  datacenter_id: number;
  datacenter_name?: string;
  row_count?: number;
  created_at: string;
  updated_at: string;
}

export interface IpamHallFormData {
  name: string;
  description: string;
  datacenter_id: string;
}

export interface IpamRow {
  id: number;
  name: string;
  description?: string;
  hall_id: number;
  hall_name?: string;
  rack_count?: number;
  created_at: string;
  updated_at: string;
}

export interface IpamRowFormData {
  name: string;
  description: string;
  hall_id: string;
}

export interface IpamRack {
  id: number;
  name: string;
  description?: string;
  row_id: number;
  row_name?: string;
  device_count?: number;
  created_at: string;
  updated_at: string;
}

export interface IpamRackFormData {
  name: string;
  description: string;
  row_id: string;
}

export interface IpamRole {
  id: number;
  name: string;
  description?: string;
  created_at: string;
}

export interface IpamVrf {
  id: number;
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
  role_ids?: number[];
  role_names?: string[];
  parent_id?: number;
  parent_prefix?: string;
  datacenter_id?: number;
  datacenter_name?: string;
  vlan_id?: number;
  vrf_id?: number;
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
  role_ids: number[];
  parent_id: string;
  datacenter_id: string;
  vlan_id: string;
  vrf_id: string;
}

export interface IpamIpAddress {
  id: number;
  address: string;
  address_int: number;
  prefix_id: number;
  prefix?: string;
  description?: string;
  status: IpamStatus;
  role_ids?: number[];
  role_names?: string[];
  dns_name?: string;
  device_id?: number;
  device_hostname?: string;
  interface_name?: string;
  vrf_id?: number;
  vrf_name?: string;
  created_at: string;
  updated_at: string;
}

export interface IpamIpAddressFormData {
  address: string;
  prefix_id: string;
  description: string;
  status: IpamStatus;
  role_ids: number[];
  dns_name: string;
  device_id: string; // kept as string for form input handling
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
  address: '', prefix_id: '', description: '', status: 'active',
  role_ids: [], dns_name: '', device_id: '', interface_name: '', vrf_id: '',
};

// ========== Device Role Types ==========

export interface DeviceRole {
  id: number;
  name: string;
  description?: string;
  template_ids?: number[];
  template_names?: string[];
  group_names: string[];
  created_at: string;
  updated_at: string;
}

export interface DeviceRoleFormData {
  name: string;
  description: string;
  template_ids: number[];
  group_names: string[];
}

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
  vendor_id: number;
  model: string;
  display_name: string;
  rack_units: number;
  rows: ChassisRow[];
}

export interface DeviceModel {
  id: number;
  vendor_id: number;
  model: string;
  display_name: string;
  rack_units: number;
  layout: ChassisRow[];
  device_count?: number;
  created_at: string;
  updated_at: string;
}

export interface DeviceModelFormData {
  vendor_id: string;
  model: string;
  display_name: string;
  rack_units: number;
  layout: ChassisRow[];
}

export const EMPTY_DEVICE_MODEL_FORM: DeviceModelFormData = {
  vendor_id: '', model: '', display_name: '', rack_units: 1, layout: [],
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

// ========== Port Assignment Types ==========

export interface PortAssignment {
  id: number;
  device_id: number;
  port_name: string;
  remote_device_id?: number;
  remote_port_name: string;
  description?: string;
  patch_panel_a_id?: number;
  patch_panel_a_port?: string;
  patch_panel_b_id?: number;
  patch_panel_b_port?: string;
  remote_device_hostname?: string;
  remote_device_type?: string;
  patch_panel_a_hostname?: string;
  patch_panel_b_hostname?: string;
  vrf_id?: number;
  vrf_name?: string;
  created_at: string;
  updated_at: string;
}

export interface SetPortAssignmentRequest {
  port_name: string;
  remote_device_id?: number;
  remote_port_name?: string;
  description?: string;
  patch_panel_a_id?: number;
  patch_panel_a_port?: string;
  patch_panel_b_id?: number;
  patch_panel_b_port?: string;
  vrf_id?: number;
}
