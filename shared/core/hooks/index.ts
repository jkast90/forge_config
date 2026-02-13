// Hooks barrel export

export { useAuth, useAuthState, AuthProvider, type UseAuthReturn } from './useAuth';
export { useDevices, type UseDevicesOptions, type UseDevicesReturn } from './useDevices';
export { useSettings, type UseSettingsReturn } from './useSettings';
export { useBackups, type UseBackupsReturn } from './useBackups';
export { useVendors, type UseVendorsOptions, type UseVendorsReturn } from './useVendors';
export { useDhcpOptions, type UseDhcpOptionsOptions, type UseDhcpOptionsReturn } from './useDhcpOptions';
export { useTemplates, type UseTemplatesOptions, type UseTemplatesReturn } from './useTemplates';
export { useDiscovery, type UseDiscoveryOptions, type UseDiscoveryReturn } from './useDiscovery';
export { useTestContainers, type UseTestContainersOptions, type UseTestContainersReturn } from './useTestContainers';
export {
  useTheme,
  useWebTheme,
  THEME_OPTIONS,
  type ThemeConfig,
  type UseThemeOptions,
  type UseThemeReturn
} from './useTheme';
export {
  useForm,
  type UseFormOptions,
  type UseFormReturn,
} from './useForm';
export {
  useWebSocket,
  type UseWebSocketOptions,
  type UseWebSocketReturn,
} from './useWebSocket';
export {
  useModalForm,
  type UseModalFormOptions,
  type UseModalFormReturn,
} from './useModalForm';
export {
  useNotification,
  createMobileNotificationHandler,
  createWebNotificationHandler,
  type NotificationType,
  type NotificationMessage,
  type ConfirmOptions,
  type NotificationHandler,
  type UseNotificationOptions,
  type UseNotificationReturn,
} from './useNotification';
export {
  useListFiltering,
  filterByVendor,
  groupByVendor,
  type UseListFilteringOptions,
  type UseListFilteringReturn,
  type GroupedItems,
} from './useListFiltering';
export {
  useAsyncModal,
  useSimpleModal,
  type UseAsyncModalOptions,
  type UseAsyncModalReturn,
} from './useAsyncModal';
export {
  useLocalSettings,
  getLocalApiUrl,
  setLocalApiUrl,
  getDefaultPageSize,
  getTablePageSize,
  setTablePageSize,
  clearTablePageSizeOverrides,
  type LocalSettings,
  type UseLocalSettingsReturn,
} from './useLocalSettings';
export {
  useLocalAddresses,
  type UseLocalAddressesReturn,
} from './useLocalAddresses';
export { useInflight } from './useInflight';
export { useApiHistory } from './useApiHistory';
export { useModalRoute, type UseModalRouteReturn } from './useModalRoute';
export { useTelemetry } from './useTelemetry';
export {
  useTableFeatures,
  type UseTableFeaturesOptions,
  type UseTableFeaturesReturn,
} from './useTableFeatures';
export { useNotificationHistory, type UseNotificationsReturn } from './useNotifications';
export { useVendorActions, type UseVendorActionsOptions, type UseVendorActionsReturn } from './useVendorActions';
export { useJobs, type UseJobsOptions, type UseJobsReturn } from './useJobs';
export { useTopologies, type UseTopologiesOptions, type UseTopologiesReturn } from './useTopologies';
