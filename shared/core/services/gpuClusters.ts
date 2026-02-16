import { BaseService } from './base';
import type { GpuCluster } from '../types';

export class GpuClusterService extends BaseService {
  async list(): Promise<GpuCluster[]> {
    return this.get<GpuCluster[]>('/gpu-clusters');
  }

  async getById(id: number | string): Promise<GpuCluster> {
    return this.get<GpuCluster>(`/gpu-clusters/${encodeURIComponent(id)}`);
  }

  async create(data: Partial<GpuCluster>): Promise<GpuCluster> {
    return this.post<GpuCluster>('/gpu-clusters', data);
  }

  async update(id: number | string, data: Partial<GpuCluster>): Promise<GpuCluster> {
    return this.put<GpuCluster>(`/gpu-clusters/${encodeURIComponent(id)}`, data);
  }

  async remove(id: number | string): Promise<void> {
    return this.delete<void>(`/gpu-clusters/${encodeURIComponent(id)}`);
  }
}
