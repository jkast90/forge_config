import { BaseService } from './base';
import type { Group, GroupFormData, GroupVariable, ResolvedVariablesResponse } from '../types';

export class GroupService extends BaseService {
  // CRUD
  async list(): Promise<Group[]> {
    return this.get<Group[]>('/groups');
  }

  async getById(id: string): Promise<Group> {
    return this.get<Group>(`/groups/${encodeURIComponent(id)}`);
  }

  async create(data: Partial<GroupFormData>): Promise<Group> {
    return this.post<Group>('/groups', data);
  }

  async update(id: string, data: Partial<GroupFormData>): Promise<Group> {
    return this.put<Group>(`/groups/${encodeURIComponent(id)}`, data);
  }

  async remove(id: string): Promise<void> {
    return this.delete<void>(`/groups/${encodeURIComponent(id)}`);
  }

  // Group variables
  async listVariables(groupId: string): Promise<GroupVariable[]> {
    return this.get<GroupVariable[]>(`/groups/${encodeURIComponent(groupId)}/variables`);
  }

  async setVariable(groupId: string, key: string, value: string): Promise<void> {
    return this.put<void>(`/groups/${encodeURIComponent(groupId)}/variables/${encodeURIComponent(key)}`, { value });
  }

  async deleteVariable(groupId: string, key: string): Promise<void> {
    return this.delete<void>(`/groups/${encodeURIComponent(groupId)}/variables/${encodeURIComponent(key)}`);
  }

  // Membership
  async listMembers(groupId: string): Promise<string[]> {
    return this.get<string[]>(`/groups/${encodeURIComponent(groupId)}/members`);
  }

  async setMembers(groupId: string, deviceIds: string[]): Promise<void> {
    return this.put<void>(`/groups/${encodeURIComponent(groupId)}/members`, { device_ids: deviceIds });
  }

  async addMember(groupId: string, deviceId: string): Promise<void> {
    return this.put<void>(`/groups/${encodeURIComponent(groupId)}/members/${encodeURIComponent(deviceId)}`, {});
  }

  async removeMember(groupId: string, deviceId: string): Promise<void> {
    return this.delete<void>(`/groups/${encodeURIComponent(groupId)}/members/${encodeURIComponent(deviceId)}`);
  }

  // Device groups
  async listDeviceGroups(deviceId: string): Promise<Group[]> {
    return this.get<Group[]>(`/devices/${encodeURIComponent(deviceId)}/groups`);
  }

  async setDeviceGroups(deviceId: string, groupIds: string[]): Promise<void> {
    return this.put<void>(`/devices/${encodeURIComponent(deviceId)}/groups`, { group_ids: groupIds });
  }

  // Resolved variables
  async getResolvedVariables(deviceId: string): Promise<ResolvedVariablesResponse> {
    return this.get<ResolvedVariablesResponse>(`/devices/${encodeURIComponent(deviceId)}/resolved-variables`);
  }
}
