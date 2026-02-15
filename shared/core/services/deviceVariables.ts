import { BaseService } from './base';
import type { DeviceVariable, VariableKeyInfo } from '../types';

export class DeviceVariableService extends BaseService {
  async listForDevice(deviceId: number): Promise<DeviceVariable[]> {
    return this.get<DeviceVariable[]>(`/devices/${encodeURIComponent(deviceId)}/variables`);
  }

  async setForDevice(deviceId: number, variables: Record<string, string>): Promise<void> {
    return this.put<void>(`/devices/${encodeURIComponent(deviceId)}/variables`, { variables });
  }

  async setVariable(deviceId: number, key: string, value: string): Promise<void> {
    return this.put<void>(`/devices/${encodeURIComponent(deviceId)}/variables/${encodeURIComponent(key)}`, { value });
  }

  async deleteVariable(deviceId: number, key: string): Promise<void> {
    return this.delete<void>(`/devices/${encodeURIComponent(deviceId)}/variables/${encodeURIComponent(key)}`);
  }

  async listKeys(): Promise<VariableKeyInfo[]> {
    return this.get<VariableKeyInfo[]>('/variables/keys');
  }

  async deleteKey(key: string): Promise<void> {
    return this.delete<void>(`/variables/keys/${encodeURIComponent(key)}`);
  }

  async listByKey(key: string): Promise<DeviceVariable[]> {
    return this.get<DeviceVariable[]>(`/variables/by-key/${encodeURIComponent(key)}`);
  }

  async bulkSet(entries: { device_id: number; key: string; value: string }[]): Promise<void> {
    return this.post<void>('/variables/bulk', { entries });
  }
}
