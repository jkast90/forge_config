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

  async buildVirtualClos(): Promise<ClosLabResponse> {
    return this.post<ClosLabResponse>('/virtual-clos', {});
  }

  async teardownVirtualClos(): Promise<void> {
    await this.delete('/virtual-clos');
  }
}
