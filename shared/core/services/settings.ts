// Settings service - handles global settings API operations

import { BaseService, getServiceConfig } from './base';
import { getTokenStorage } from './tokenStorage';
import type { Settings, NetworkInterface, Branding } from '../types';

export class SettingsService extends BaseService {
  async getSettings(): Promise<Settings> {
    return super.get<Settings>('/settings');
  }

  async update(settings: Settings): Promise<Settings> {
    return this.put<Settings>('/settings', settings);
  }

  async reloadConfig(): Promise<void> {
    return this.post<void>('/reload');
  }

  async getLocalAddresses(): Promise<NetworkInterface[]> {
    return super.get<NetworkInterface[]>('/network/addresses');
  }

  async getBranding(): Promise<Branding> {
    return super.get<Branding>('/branding');
  }

  async uploadLogo(file: File): Promise<void> {
    const baseUrl = getServiceConfig().baseUrl || '/api';
    const tokenStorage = getTokenStorage();
    const token = await tokenStorage.getToken();
    const response = await fetch(`${baseUrl}/branding/logo`, {
      method: 'POST',
      headers: {
        'Content-Type': file.type || 'application/octet-stream',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: file,
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
      throw new Error(err.error || `HTTP ${response.status}`);
    }
  }

  async deleteLogo(): Promise<void> {
    return this.delete<void>('/branding/logo');
  }

  async broadcastWs(type: string, payload: unknown): Promise<{ clients: number }> {
    return this.post<{ clients: number }>('/ws/broadcast', { type, payload });
  }
}
