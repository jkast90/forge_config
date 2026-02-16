// Service layer - aggregates all services

import { DeviceService } from './devices';
import { SettingsService } from './settings';
import { VendorService } from './vendors';
import { DhcpOptionService } from './dhcpOptions';
import { TemplateService } from './templates';
import { DiscoveryService } from './discovery';
import { TestContainersService } from './testContainers';
import { NetBoxService } from './netbox';
import { TopologyService } from './topologies';
import { DeviceVariableService } from './deviceVariables';
import { GroupService } from './groups';
import { IpamService } from './ipam';
import { DeviceModelService } from './deviceModels';
import { PortAssignmentService } from './portAssignments';
import { JobTemplateService } from './jobTemplates';
import { CredentialService } from './credentials';
import { OutputParserService } from './outputParsers';
import { DeviceRoleService } from './deviceRoles';
import { UserService } from './users';
import { GpuClusterService } from './gpuClusters';
import { TenantService } from './tenants';
import { AuthService } from './auth';

export { BaseService, configureServices, getServiceConfig, getInflightCount, onInflightChange, getApiHistory, clearApiHistory, onApiHistoryChange, checkApiHealth, type ServiceConfig, type ApiHistoryEntry } from './base';
export { AuthService } from './auth';
export type { LoginRequest, LoginResponse } from './auth';
export { getTokenStorage, setTokenStorage, type TokenStorage } from './tokenStorage';
export { DeviceService } from './devices';
export type { ConnectResult, ConfigResult, BackupContentResult, ConfigPreviewResult, DeployConfigResult, PingResult, SSHResult } from './devices';
export { SettingsService } from './settings';
export { VendorService } from './vendors';
export { DhcpOptionService } from './dhcpOptions';
export { TemplateService } from './templates';
export type { DetectedVariable, TemplatizeResponse } from './templates';
export { DiscoveryService } from './discovery';
export { TestContainersService } from './testContainers';
export type { UnifiedTopologyRequest, TopologyPreviewDevice, TopologyPreviewLink, TopologyPreviewRack, TopologyPreviewResponse } from './testContainers';
export { NetBoxService } from './netbox';
export type { NetBoxConfig, NetBoxStatus, NetBoxSyncResult, NetBoxManufacturer, NetBoxSite, NetBoxDeviceRole, NetBoxDevice, NetBoxVendorSyncResponse } from './netbox';
export { TopologyService } from './topologies';
export { DeviceVariableService } from './deviceVariables';
export { GroupService } from './groups';
export { IpamService } from './ipam';
export { DeviceModelService } from './deviceModels';
export { PortAssignmentService } from './portAssignments';
export { JobTemplateService } from './jobTemplates';
export { CredentialService } from './credentials';
export { OutputParserService } from './outputParsers';
export { DeviceRoleService } from './deviceRoles';
export { UserService } from './users';
export { GpuClusterService } from './gpuClusters';
export { TenantService } from './tenants';
export { WebSocketService, getWebSocketService } from './websocket';
export type { WebSocketEvent, WebSocketEventType, DeviceDiscoveredPayload, ConfigPulledPayload, WebSocketEventHandler } from './websocket';
export { trackEvent, getTelemetryEvents, clearTelemetryEvents, onTelemetryChange, initTelemetry, type TelemetryEvent, type TelemetryEventType } from './telemetry';
export { addNotification, markAllRead, clearNotifications, getNotifications, getUnreadCount, onNotificationsChange, type Notification, type NotificationAction, type NotificationLevel } from './notifications';
export { navigateTo, navigateAction, dialogAction, registerNavigator, onTabNavigate, consumePendingTab, type NavigationTarget } from './navigation';

export interface Services {
  auth: AuthService;
  devices: DeviceService;
  settings: SettingsService;
  vendors: VendorService;
  dhcpOptions: DhcpOptionService;
  templates: TemplateService;
  discovery: DiscoveryService;
  testContainers: TestContainersService;
  netbox: NetBoxService;
  topologies: TopologyService;
  deviceVariables: DeviceVariableService;
  groups: GroupService;
  ipam: IpamService;
  deviceModels: DeviceModelService;
  portAssignments: PortAssignmentService;
  jobTemplates: JobTemplateService;
  credentials: CredentialService;
  outputParsers: OutputParserService;
  deviceRoles: DeviceRoleService;
  users: UserService;
  gpuClusters: GpuClusterService;
  tenants: TenantService;
}

// Singleton services that use global config
let services: Services | null = null;

export function getServices(): Services {
  if (!services) {
    services = {
      auth: new AuthService(),
      devices: new DeviceService(),
      settings: new SettingsService(),
      vendors: new VendorService(),
      dhcpOptions: new DhcpOptionService(),
      templates: new TemplateService(),
      discovery: new DiscoveryService(),
      testContainers: new TestContainersService(),
      netbox: new NetBoxService(),
      topologies: new TopologyService(),
      deviceVariables: new DeviceVariableService(),
      groups: new GroupService(),
      ipam: new IpamService(),
      deviceModels: new DeviceModelService(),
      portAssignments: new PortAssignmentService(),
      jobTemplates: new JobTemplateService(),
      credentials: new CredentialService(),
      outputParsers: new OutputParserService(),
      deviceRoles: new DeviceRoleService(),
      users: new UserService(),
      gpuClusters: new GpuClusterService(),
      tenants: new TenantService(),
    };
  }
  return services;
}
