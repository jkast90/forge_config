import { BaseService } from './base';
import type { Credential, CredentialFormData } from '../types';

export class CredentialService extends BaseService {
  async list(): Promise<Credential[]> {
    return this.get<Credential[]>('/credentials');
  }

  async getById(id: string): Promise<Credential> {
    return this.get<Credential>(`/credentials/${encodeURIComponent(id)}`);
  }

  async create(data: CredentialFormData): Promise<Credential> {
    return this.post<Credential>('/credentials', data);
  }

  async update(id: string, data: CredentialFormData): Promise<Credential> {
    return this.put<Credential>(`/credentials/${encodeURIComponent(id)}`, data);
  }

  async remove(id: string): Promise<void> {
    return this.delete<void>(`/credentials/${encodeURIComponent(id)}`);
  }
}
