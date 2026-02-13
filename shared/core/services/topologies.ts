import { BaseService } from './base';
import type { Topology } from '../types';

export class TopologyService extends BaseService {
  async list(): Promise<Topology[]> {
    return this.get<Topology[]>('/topologies');
  }

  async getById(id: string): Promise<Topology> {
    return this.get<Topology>(`/topologies/${encodeURIComponent(id)}`);
  }

  async create(topology: Partial<Topology>): Promise<Topology> {
    return this.post<Topology>('/topologies', topology);
  }

  async update(id: string, topology: Partial<Topology>): Promise<Topology> {
    return this.put<Topology>(`/topologies/${encodeURIComponent(id)}`, topology);
  }

  async remove(id: string): Promise<void> {
    return this.delete<void>(`/topologies/${encodeURIComponent(id)}`);
  }
}
