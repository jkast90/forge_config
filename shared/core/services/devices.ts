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

  async getById(id: number): Promise<Device> {
    return this.get<Device>(`/devices/${encodeURIComponent(id)}`);
  }

  async nextHostname(role: string, datacenter?: string): Promise<string> {
    const params = new URLSearchParams({ role });
    if (datacenter) params.set('datacenter', datacenter);
    const res = await this.get<{ hostname: string }>(`/devices/next-hostname?${params}`);
    return res.hostname;
  }

  async create(device: Partial<Device>): Promise<Device> {
    return this.post<Device>('/devices', device);
  }

  async update(id: number, device: Partial<Device>): Promise<Device> {
    return this.put<Device>(`/devices/${encodeURIComponent(id)}`, device);
  }

  async remove(id: number): Promise<void> {
    return this.delete<void>(`/devices/${encodeURIComponent(id)}`);
  }

  async triggerBackup(id: number): Promise<void> {
    return this.post<void>(`/devices/${encodeURIComponent(id)}/backup`);
  }

  async listBackups(id: number): Promise<Backup[]> {
    return this.get<Backup[]>(`/devices/${encodeURIComponent(id)}/backups`);
  }

  async connect(id: number): Promise<ConnectResult> {
    return this.post<ConnectResult>(`/devices/${encodeURIComponent(id)}/connect`);
  }

  async connectByIp(ip: string, options?: { vendor?: string; ssh_user?: string; ssh_pass?: string }): Promise<ConnectResult> {
    return this.post<ConnectResult>('/connect', { ip, ...options });
  }

  async getConfig(id: number): Promise<ConfigResult> {
    return this.get<ConfigResult>(`/devices/${encodeURIComponent(id)}/config`);
  }

  async getBackupContent(id: number): Promise<BackupContentResult> {
    return this.get<BackupContentResult>(`/backups/${id}`);
  }

  async previewConfig(id: number): Promise<ConfigPreviewResult> {
    return this.post<ConfigPreviewResult>(`/devices/${encodeURIComponent(id)}/preview-config`);
  }

  async deployConfig(id: number): Promise<Job> {
    return this.post<Job>(`/devices/${encodeURIComponent(id)}/deploy-config`);
  }

  async diffConfig(id: number): Promise<Job> {
    return this.post<Job>(`/devices/${encodeURIComponent(id)}/diff-config`);
  }

  async exec(id: number, command: string, actionId?: string): Promise<Job> {
    const body: { command?: string; action_id?: string } = {};
    if (command) body.command = command;
    if (actionId) body.action_id = actionId;
    return this.post<Job>(`/devices/${encodeURIComponent(id)}/exec`, body);
  }

  async getJob(id: string): Promise<Job> {
    return this.get<Job>(`/jobs/${encodeURIComponent(id)}`);
  }

  async listJobs(deviceId?: number): Promise<Job[]> {
    const params = deviceId ? `?device_id=${encodeURIComponent(deviceId)}` : '';
    return this.get<Job[]>(`/jobs${params}`);
  }
}
