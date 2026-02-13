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
import { AuthService } from './auth';

export { BaseService, configureServices, getServiceConfig, getInflightCount, onInflightChange, getApiHistory, clearApiHistory, onApiHistoryChange, type ServiceConfig, type ApiHistoryEntry } from './base';
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
export { NetBoxService } from './netbox';
export type { NetBoxConfig, NetBoxStatus, NetBoxSyncResult, NetBoxManufacturer, NetBoxSite, NetBoxDeviceRole, NetBoxDevice, NetBoxVendorSyncResponse } from './netbox';
export { TopologyService } from './topologies';
export { WebSocketService, getWebSocketService } from './websocket';
export type { WebSocketEvent, WebSocketEventType, DeviceDiscoveredPayload, ConfigPulledPayload, WebSocketEventHandler } from './websocket';
export { trackEvent, getTelemetryEvents, clearTelemetryEvents, onTelemetryChange, initTelemetry, type TelemetryEvent, type TelemetryEventType } from './telemetry';
export { addNotification, markAllRead, clearNotifications, getNotifications, getUnreadCount, onNotificationsChange, type Notification, type NotificationLevel } from './notifications';

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
    };
  }
  return services;
}
