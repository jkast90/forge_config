import { BaseService } from './base';
import type { DeviceModel, ChassisRow } from '../types';

interface DeviceModelApiResponse {
  id: string;
  vendor_id: string;
  model: string;
  display_name: string;
  rack_units: number;
  layout: string;
  device_count?: number;
  created_at: string;
  updated_at: string;
}

function parseLayout(raw: DeviceModelApiResponse): DeviceModel {
  let layout: ChassisRow[] = [];
  try {
    layout = typeof raw.layout === 'string' ? JSON.parse(raw.layout) : raw.layout;
  } catch { /* empty layout */ }
  return { ...raw, layout };
}

export class DeviceModelService extends BaseService {
  async list(): Promise<DeviceModel[]> {
    const raw = await this.get<DeviceModelApiResponse[]>('/device-models');
    return raw.map(parseLayout);
  }

  async getById(id: string): Promise<DeviceModel> {
    const raw = await this.get<DeviceModelApiResponse>(`/device-models/${encodeURIComponent(id)}`);
    return parseLayout(raw);
  }

  async create(data: Partial<DeviceModel>): Promise<DeviceModel> {
    const payload = { ...data, layout: JSON.stringify(data.layout || []) };
    const raw = await this.post<DeviceModelApiResponse>('/device-models', payload);
    return parseLayout(raw);
  }

  async update(id: string, data: Partial<DeviceModel>): Promise<DeviceModel> {
    const payload = { ...data, layout: JSON.stringify(data.layout || []) };
    const raw = await this.put<DeviceModelApiResponse>(`/device-models/${encodeURIComponent(id)}`, payload);
    return parseLayout(raw);
  }

  async remove(id: string): Promise<void> {
    return this.delete<void>(`/device-models/${encodeURIComponent(id)}`);
  }
}
