// Vendor service - handles all vendor-related API operations

import { BaseService } from './base';
import type { Vendor, VendorAction, Job } from '../types';

export class VendorService extends BaseService {
  async list(): Promise<Vendor[]> {
    return this.get<Vendor[]>('/vendors');
  }

  async listDefaults(): Promise<Vendor[]> {
    return this.get<Vendor[]>('/vendors/defaults');
  }

  async getById(id: number | string): Promise<Vendor> {
    return this.get<Vendor>(`/vendors/${encodeURIComponent(id)}`);
  }

  async create(vendor: Partial<Vendor>): Promise<Vendor> {
    return this.post<Vendor>('/vendors', vendor);
  }

  async update(id: number | string, vendor: Partial<Vendor>): Promise<Vendor> {
    return this.put<Vendor>(`/vendors/${encodeURIComponent(id)}`, vendor);
  }

  async remove(id: number | string): Promise<void> {
    return this.delete<void>(`/vendors/${encodeURIComponent(id)}`);
  }

  // Vendor Action methods
  async listAllActions(): Promise<VendorAction[]> {
    return this.get<VendorAction[]>('/vendor-actions');
  }

  async listActions(vendorId: number | string): Promise<VendorAction[]> {
    return this.get<VendorAction[]>(`/vendors/${encodeURIComponent(vendorId)}/actions`);
  }

  async createAction(data: Partial<VendorAction>): Promise<VendorAction> {
    return this.post<VendorAction>('/vendor-actions', data);
  }

  async updateAction(id: number | string, data: Partial<VendorAction>): Promise<VendorAction> {
    return this.put<VendorAction>(`/vendor-actions/${encodeURIComponent(id)}`, data);
  }

  async deleteAction(id: number | string): Promise<void> {
    return this.delete<void>(`/vendor-actions/${encodeURIComponent(id)}`);
  }

  async runAction(id: number | string): Promise<Job> {
    return this.post<Job>(`/vendor-actions/${encodeURIComponent(id)}/run`, {});
  }
}
