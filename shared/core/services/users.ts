import { BaseService } from './base';
import type { User, UserFormData } from '../types';

export class UserService extends BaseService {
  async list(): Promise<User[]> {
    return this.get<User[]>('/users');
  }

  async getById(id: string): Promise<User> {
    return this.get<User>(`/users/${encodeURIComponent(id)}`);
  }

  async create(data: UserFormData): Promise<User> {
    return this.post<User>('/users', data);
  }

  async update(id: string, data: Partial<UserFormData>): Promise<User> {
    return this.put<User>(`/users/${encodeURIComponent(id)}`, data);
  }

  async remove(id: string): Promise<void> {
    return this.delete<void>(`/users/${encodeURIComponent(id)}`);
  }
}
