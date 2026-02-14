// Device service - handles all device-related API operations

import { BaseService } from './base';
import type { Device, Backup, ExecCommandResult, Job } from '../types';

export interface PingResult {
  reachable: boolean;
  latency?: string;
  error?: string;
}

export interface SSHResult {
  connected: boolean;
  uptime?: string;
  hostname?: string;
  version?: string;
  interfaces?: string;
  error?: string;
}

export interface ConnectResult {
  ping: PingResult;
  ssh: SSHResult;
  success: boolean;
}

export interface ConfigResult {
  mac: string;
  hostname: string;
  filename: string;
  content: string;
  exists: boolean;
}

export interface BackupContentResult {
  id: number;
  filename: string;
  content: string;
  exists: boolean;
}

export interface ConfigPreviewResult {
  mac: string;
  hostname: string;
  template_id: string;
  template_name: string;
  content: string;
}

export interface DeployConfigResult {
  mac: string;
  hostname: string;
  success: boolean;
  output: string;
  error?: string;
}

export class DeviceService extends BaseService {
  async list(): Promise<Device[]> {
    return this.get<Device[]>('/devices');
  }

  async getById(id: string): Promise<Device> {
    return this.get<Device>(`/devices/${encodeURIComponent(id)}`);
  }

  async create(device: Partial<Device>): Promise<Device> {
    return this.post<Device>('/devices', device);
  }

  async update(id: string, device: Partial<Device>): Promise<Device> {
    return this.put<Device>(`/devices/${encodeURIComponent(id)}`, device);
  }

  async remove(id: string): Promise<void> {
    return this.delete<void>(`/devices/${encodeURIComponent(id)}`);
  }

  async triggerBackup(id: string): Promise<void> {
    return this.post<void>(`/devices/${encodeURIComponent(id)}/backup`);
  }

  async listBackups(id: string): Promise<Backup[]> {
    return this.get<Backup[]>(`/devices/${encodeURIComponent(id)}/backups`);
  }

  async connect(id: string): Promise<ConnectResult> {
    return this.post<ConnectResult>(`/devices/${encodeURIComponent(id)}/connect`);
  }

  async connectByIp(ip: string, options?: { vendor?: string; ssh_user?: string; ssh_pass?: string }): Promise<ConnectResult> {
    return this.post<ConnectResult>('/connect', { ip, ...options });
  }

  async getConfig(id: string): Promise<ConfigResult> {
    return this.get<ConfigResult>(`/devices/${encodeURIComponent(id)}/config`);
  }

  async getBackupContent(id: number): Promise<BackupContentResult> {
    return this.get<BackupContentResult>(`/backups/${id}`);
  }

  async previewConfig(id: string): Promise<ConfigPreviewResult> {
    return this.post<ConfigPreviewResult>(`/devices/${encodeURIComponent(id)}/preview-config`);
  }

  async deployConfig(id: string): Promise<Job> {
    return this.post<Job>(`/devices/${encodeURIComponent(id)}/deploy-config`);
  }

  async exec(id: string, command: string): Promise<Job> {
    return this.post<Job>(`/devices/${encodeURIComponent(id)}/exec`, { command });
  }

  async getJob(id: string): Promise<Job> {
    return this.get<Job>(`/jobs/${encodeURIComponent(id)}`);
  }

  async listJobs(deviceId?: string): Promise<Job[]> {
    const params = deviceId ? `?device_id=${encodeURIComponent(deviceId)}` : '';
    return this.get<Job[]>(`/jobs${params}`);
  }
}
