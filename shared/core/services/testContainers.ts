import { BaseService } from './base';
import type { TestContainer, SpawnContainerRequest, ClosLabResponse } from '../types';

export class TestContainersService extends BaseService {
  async list(): Promise<TestContainer[]> {
    return this.get<TestContainer[]>('/docker/containers');
  }

  async spawn(request: SpawnContainerRequest): Promise<TestContainer> {
    return this.post<TestContainer>('/docker/containers', request);
  }

  async start(id: string): Promise<void> {
    await this.post(`/docker/containers/${id}/start`);
  }

  async restart(id: string): Promise<void> {
    await this.post(`/docker/containers/${id}/restart`);
  }

  async remove(id: string): Promise<void> {
    await this.delete(`/docker/containers/${id}`);
  }

  async buildClosLab(image?: string): Promise<ClosLabResponse> {
    return this.post<ClosLabResponse>('/docker/clos-lab', { image: image || '' });
  }

  async teardownClosLab(): Promise<void> {
    await this.delete('/docker/clos-lab');
  }

  async buildVirtualClos(config?: { spines?: number; leaves?: number; region_id?: string; campus_id?: string; datacenter_id?: string; halls?: number; rows_per_hall?: number; racks_per_row?: number; leaves_per_rack?: number; links_per_leaf?: number; external_devices?: number; uplinks_per_spine?: number; external_names?: string[]; spawn_containers?: boolean; ceos_image?: string }): Promise<ClosLabResponse> {
    return this.post<ClosLabResponse>('/virtual-clos', config || {});
  }

  async teardownVirtualClos(): Promise<void> {
    await this.delete('/virtual-clos');
  }
}
