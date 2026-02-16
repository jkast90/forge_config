import { BaseService } from './base';
import type { Topology } from '../types';

export class TopologyService extends BaseService {
  async list(): Promise<Topology[]> {
    return this.get<Topology[]>('/topologies');
  }

  async getById(id: number | string): Promise<Topology> {
    return this.get<Topology>(`/topologies/${encodeURIComponent(id)}`);
  }

  async create(topology: Partial<Topology>): Promise<Topology> {
    return this.post<Topology>('/topologies', topology);
  }

  async update(id: number | string, topology: Partial<Topology>): Promise<Topology> {
    return this.put<Topology>(`/topologies/${encodeURIComponent(id)}`, topology);
  }

  async remove(id: number | string): Promise<void> {
    return this.delete<void>(`/topologies/${encodeURIComponent(id)}`);
  }

  async removeWithDevices(id: number | string): Promise<void> {
    return this.delete<void>(`/topologies/${encodeURIComponent(id)}?delete_devices=true`);
  }
}
