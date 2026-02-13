// Vendor service - handles all vendor-related API operations

import { BaseService } from './base';
import type { Vendor, VendorAction } from '../types';

export class VendorService extends BaseService {
  async list(): Promise<Vendor[]> {
    return this.get<Vendor[]>('/vendors');
  }

  async listDefaults(): Promise<Vendor[]> {
    return this.get<Vendor[]>('/vendors/defaults');
  }

  async getById(id: string): Promise<Vendor> {
    return this.get<Vendor>(`/vendors/${encodeURIComponent(id)}`);
  }

  async create(vendor: Partial<Vendor>): Promise<Vendor> {
    return this.post<Vendor>('/vendors', vendor);
  }

  async update(id: string, vendor: Partial<Vendor>): Promise<Vendor> {
    return this.put<Vendor>(`/vendors/${encodeURIComponent(id)}`, vendor);
  }

  async remove(id: string): Promise<void> {
    return this.delete<void>(`/vendors/${encodeURIComponent(id)}`);
  }

  // Vendor Action methods
  async listAllActions(): Promise<VendorAction[]> {
    return this.get<VendorAction[]>('/vendor-actions');
  }

  async listActions(vendorId: string): Promise<VendorAction[]> {
    return this.get<VendorAction[]>(`/vendors/${encodeURIComponent(vendorId)}/actions`);
  }

  async createAction(data: Partial<VendorAction>): Promise<VendorAction> {
    return this.post<VendorAction>('/vendor-actions', data);
  }

  async updateAction(id: string, data: Partial<VendorAction>): Promise<VendorAction> {
    return this.put<VendorAction>(`/vendor-actions/${encodeURIComponent(id)}`, data);
  }

  async deleteAction(id: string): Promise<void> {
    return this.delete<void>(`/vendor-actions/${encodeURIComponent(id)}`);
  }
}
