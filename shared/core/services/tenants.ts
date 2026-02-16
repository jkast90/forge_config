import { BaseService } from './base';
import type { Tenant } from '../types';

export class TenantService extends BaseService {
  async list(): Promise<Tenant[]> {
    return this.get<Tenant[]>('/tenants');
  }

  async getById(id: number | string): Promise<Tenant> {
    return this.get<Tenant>(`/tenants/${encodeURIComponent(id)}`);
  }

  async create(data: Partial<Tenant>): Promise<Tenant> {
    return this.post<Tenant>('/tenants', data);
  }

  async update(id: number | string, data: Partial<Tenant>): Promise<Tenant> {
    return this.put<Tenant>(`/tenants/${encodeURIComponent(id)}`, data);
  }

  async remove(id: number | string): Promise<void> {
    return this.delete<void>(`/tenants/${encodeURIComponent(id)}`);
  }
}
