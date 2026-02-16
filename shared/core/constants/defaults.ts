// Default configuration values for DHCP options

import type { DhcpOption } from '../types';

/**
 * Default DHCP options for common ZTP scenarios
 */
export const DEFAULT_DHCP_OPTIONS: Omit<DhcpOption, 'id' | 'created_at' | 'updated_at'>[] = [
  {
    option_number: 66,
    name: 'TFTP Server',
    value: '${tftp_server_ip}',
    type: 'ip',
    description: 'TFTP server for config files',
    enabled: true,
  },
  {
    option_number: 67,
    name: 'Cisco Bootfile',
    value: 'network-confg',
    type: 'string',
    description: 'Cisco IOS config filename',
    enabled: true,
  },
  {
    option_number: 67,
    name: 'Arista Bootfile',
    value: 'startup-config',
    type: 'string',
    description: 'Arista EOS config filename',
    enabled: true,
  },
  {
    option_number: 67,
    name: 'Juniper Bootfile',
    value: 'juniper.conf',
    type: 'string',
    description: 'Juniper config filename',
    enabled: true,
  },
  {
    option_number: 150,
    name: 'Cisco TFTP (Option 150)',
    value: '${tftp_server_ip}',
    type: 'ip',
    description: 'Cisco-specific TFTP server option',
    enabled: true,
  },
  {
    option_number: 67,
    name: 'FRR Bootfile',
    value: 'frr.conf',
    type: 'string',
    description: 'FRRouting config filename',
    enabled: true,
  },
  {
    option_number: 67,
    name: 'GoBGP Bootfile',
    value: 'gobgpd.conf',
    type: 'string',
    description: 'GoBGP YAML config filename',
    enabled: true,
  },
  {
    option_number: 43,
    name: 'OpenGear ZTP',
    value: '',
    type: 'hex',
    description: 'OpenGear vendor-specific enrollment options',
    enabled: false,
  },
];

/**
 * DHCP option types for form select fields
 */
export const DHCP_OPTION_TYPES = [
  { value: 'string', label: 'String' },
  { value: 'ip', label: 'IP Address' },
  { value: 'hex', label: 'Hex' },
  { value: 'number', label: 'Number' },
] as const;

/**
 * Empty form data objects for various entity types
 */
export const EMPTY_VENDOR_FORM: import('../types').VendorFormData = {
  name: '',
  backup_command: 'show running-config',
  deploy_command: '',
  diff_command: '',
  ssh_port: 22,
  ssh_user: '',
  ssh_pass: '',
  mac_prefixes: [],
  vendor_class: '',
  default_template: '',
};

export const EMPTY_VENDOR_ACTION_FORM: import('../types').VendorActionFormData = {
  vendor_id: '',
  label: '',
  command: '',
  sort_order: 0,
  action_type: 'ssh',
  webhook_url: '',
  webhook_method: 'POST',
  webhook_headers: '{}',
  webhook_body: '',
  output_parser_id: '',
};

export const EMPTY_DHCP_OPTION_FORM: import('../types').DhcpOptionFormData = {
  option_number: 0,
  name: '',
  value: '',
  type: 'string',
  vendor_id: '',
  description: '',
  enabled: true,
};

export const EMPTY_TEMPLATE_FORM: import('../types').TemplateFormData = {
  name: '',
  description: '',
  vendor_id: '',
  content: '',
};

export const EMPTY_TOPOLOGY_FORM: import('../types').TopologyFormData = {
  name: '',
  description: '',
  region_id: '',
  campus_id: '',
  datacenter_id: '',
};

export const TOPOLOGY_ROLE_OPTIONS = [
  { value: '', label: 'No Role' },
  { value: 'super-spine', label: 'Super-Spine' },
  { value: 'spine', label: 'Spine' },
  { value: 'leaf', label: 'Leaf' },
  { value: 'gpu-node', label: 'GPU Node' },
] as const;

/**
 * Sample device data for template preview
 */
export const SAMPLE_DEVICE_FOR_PREVIEW = {
  device: {
    mac: '00:11:22:33:44:55',
    ip: '192.168.1.100',
    hostname: 'switch-01',
    vendor: 'cisco',
    serial_number: 'ABC123456',
    topology_id: 'dc1-fabric',
    topology_role: 'leaf',
  },
  subnet: '255.255.255.0',
  gateway: '192.168.1.1',
};

/**
 * DHCP Vendor Class options for test container spawn
 */
export const VENDOR_CLASS_OPTIONS = [
  { value: '', label: 'None' },
  { value: 'Cisco', label: 'Cisco' },
  { value: 'Arista', label: 'Arista' },
  { value: 'Juniper', label: 'Juniper' },
  { value: 'OpenGear', label: 'OpenGear' },
  { value: 'FRRouting', label: 'FRRouting' },
  { value: 'GoBGP', label: 'GoBGP' },
  { value: 'AMD', label: 'AMD' },
] as const;

/**
 * Config fetch method options for test containers
 */
export const CONFIG_METHOD_OPTIONS = [
  { value: 'tftp', label: 'TFTP', description: 'Fetch config via TFTP' },
  { value: 'http', label: 'HTTP', description: 'Fetch config via HTTP' },
  { value: 'both', label: 'Both', description: 'Try TFTP then HTTP' },
] as const;

export const EMPTY_TENANT_FORM: import('../types').TenantFormData = {
  name: '',
  description: '',
  status: 'active',
};

export const TENANT_STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];

export const EMPTY_GPU_CLUSTER_FORM: import('../types').GpuClusterFormData = {
  name: '',
  description: '',
  gpu_model: 'MI300X',
  node_count: '1',
  gpus_per_node: '8',
  interconnect_type: 'InfiniBand',
  status: 'provisioning',
  topology_id: '',
  vrf_id: '',
};

export const GPU_MODEL_OPTIONS = [
  { value: 'MI300X', label: 'AMD MI300X' },
  { value: 'MI325X', label: 'AMD MI325X' },
];

export const INTERCONNECT_OPTIONS = [
  { value: 'InfiniBand', label: 'InfiniBand' },
  { value: 'InfinityFabric', label: 'Infinity Fabric' },
  { value: 'RoCE', label: 'RoCE' },
  { value: 'Ethernet', label: 'Ethernet' },
];

export const GPU_CLUSTER_STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'provisioning', label: 'Provisioning' },
  { value: 'offline', label: 'Offline' },
  { value: 'decommissioned', label: 'Decommissioned' },
];
