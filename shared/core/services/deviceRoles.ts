import { BaseService } from './base';
import type { DeviceRole, DeviceRoleFormData } from '../types';

export class DeviceRoleService extends BaseService {
  async list(): Promise<DeviceRole[]> {
    return this.get<DeviceRole[]>('/device-roles');
  }

  async getById(id: string): Promise<DeviceRole> {
    return this.get<DeviceRole>(`/device-roles/${encodeURIComponent(id)}`);
  }

  async create(data: DeviceRoleFormData): Promise<DeviceRole> {
    return this.post<DeviceRole>('/device-roles', data);
  }

  async update(id: string, data: DeviceRoleFormData): Promise<DeviceRole> {
    return this.put<DeviceRole>(`/device-roles/${encodeURIComponent(id)}`, data);
  }

  async remove(id: string): Promise<void> {
    return this.delete<void>(`/device-roles/${encodeURIComponent(id)}`);
  }
}
