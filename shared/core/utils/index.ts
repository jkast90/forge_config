// Utils barrel export

export {
  formatDate,
  formatRelativeTime,
  formatMacAddress,
  formatFileSize,
  formatExpiry,
  formatEventType,
  getEventTypeIcon,
  type DiscoveryEventType,
} from './format';

export {
  validateMacAddress,
  validateIpAddress,
  validateIpv4,
  validateIpv6,
  validatePrefix,
  validateHostname,
  validateDeviceForm,
  validateSettingsForm,
  validators,
  type ValidationResult,
  type Validator,
} from './validation';

export {
  getErrorMessage,
  parseApiError,
  type ParsedApiError,
} from './errors';

export { lookupVendorByMac, setVendorCache, getVendorCache } from './vendor';

export {
  randomHex,
  generateMac,
  getVendorPrefixOptions,
  getVendorClassForVendor,
  type VendorPrefixOption,
} from './mac-generation';

export {
  getVendorFilterOptions,
  getVendorSelectOptions,
  getVendorName,
  groupByVendor,
  filterByVendor,
  generateId,
  slugify,
  type VendorFilterOption,
  type VendorSelectOption,
  type GroupedByVendor,
} from './data-transform';

export {
  createChangeHandler,
  parseListValue,
  formatListValue,
} from './forms';

export {
  getStatusColor,
  getStatusColors,
  getVariableTypeIcon,
  getVariableTypeColor,
  getStatusIcon,
  getStatusLabel,
  getJobTypeBadgeVariant,
  getCredTypeBadgeVariant,
  getHttpMethodBadgeVariant,
  getActionTypeBadgeVariant,
  type BadgeVariant,
  type VariableTypeIcon,
  type StatusIcon,
} from './styles';

export {
  countDevicesByStatus,
  countRecentBackups,
  getRecentJobs,
} from './device-stats';

export {
  resolveVendor,
  createDeviceFromDiscovery,
  autoDetectVendorFromMac,
  autoSelectTemplateForVendor,
  getDhcpInfoItems,
  getDhcpDetailFields,
} from './device-creation';

export {
  isPatchPanel,
  buildPortAssignmentMap,
  buildDeviceOptions,
  buildPortOptionsFromModel,
  buildPatchPanelOptions,
  findDeviceModel,
  countModelPorts,
  countAssignedPorts,
  type SelectOption,
} from './port-management';
