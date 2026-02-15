import { BaseService } from './base';
import type { Group, GroupFormData, GroupVariable, ResolvedVariablesResponse } from '../types';

export class GroupService extends BaseService {
  // CRUD
  async list(): Promise<Group[]> {
    return this.get<Group[]>('/groups');
  }

  async getById(id: number): Promise<Group> {
    return this.get<Group>(`/groups/${id}`);
  }

  async create(data: Partial<GroupFormData>): Promise<Group> {
    return this.post<Group>('/groups', data);
  }

  async update(id: number, data: Partial<GroupFormData>): Promise<Group> {
    return this.put<Group>(`/groups/${id}`, data);
  }

  async remove(id: number): Promise<void> {
    return this.delete<void>(`/groups/${id}`);
  }

  // Group variables
  async listVariables(groupId: number): Promise<GroupVariable[]> {
    return this.get<GroupVariable[]>(`/groups/${groupId}/variables`);
  }

  async setVariable(groupId: number, key: string, value: string): Promise<void> {
    return this.put<void>(`/groups/${groupId}/variables/${encodeURIComponent(key)}`, { value });
  }

  async deleteVariable(groupId: number, key: string): Promise<void> {
    return this.delete<void>(`/groups/${groupId}/variables/${encodeURIComponent(key)}`);
  }

  // Membership
  async listMembers(groupId: number): Promise<number[]> {
    return this.get<number[]>(`/groups/${groupId}/members`);
  }

  async setMembers(groupId: number, deviceIds: number[]): Promise<void> {
    return this.put<void>(`/groups/${groupId}/members`, { device_ids: deviceIds });
  }

  async addMember(groupId: number, deviceId: number): Promise<void> {
    return this.put<void>(`/groups/${groupId}/members/${deviceId}`, {});
  }

  async removeMember(groupId: number, deviceId: number): Promise<void> {
    return this.delete<void>(`/groups/${groupId}/members/${deviceId}`);
  }

  // Device groups
  async listDeviceGroups(deviceId: number): Promise<Group[]> {
    return this.get<Group[]>(`/devices/${deviceId}/groups`);
  }

  async setDeviceGroups(deviceId: number, groupIds: number[]): Promise<void> {
    return this.put<void>(`/devices/${deviceId}/groups`, { group_ids: groupIds });
  }

  // Resolved variables
  async getResolvedVariables(deviceId: number): Promise<ResolvedVariablesResponse> {
    return this.get<ResolvedVariablesResponse>(`/devices/${deviceId}/resolved-variables`);
  }
}
