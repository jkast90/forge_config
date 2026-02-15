import { BaseService } from './base';
import type {
  IpamRegion, IpamRegionFormData,
  IpamCampus, IpamCampusFormData,
  IpamDatacenter, IpamDatacenterFormData,
  IpamHall, IpamHallFormData,
  IpamRow, IpamRowFormData,
  IpamRack, IpamRackFormData,
  IpamRole,
  IpamVrf,
  IpamPrefix, IpamPrefixFormData,
  IpamIpAddress, IpamIpAddressFormData,
  IpamTag,
} from '../types';

// Convert empty strings to undefined for optional fields, parse vlan_id
function cleanPrefixData(data: IpamPrefixFormData): Record<string, unknown> {
  return {
    prefix: data.prefix,
    description: data.description || undefined,
    status: data.status,
    is_supernet: data.is_supernet,
    role_ids: data.role_ids.filter(id => id !== ''),
    parent_id: data.parent_id ? parseInt(data.parent_id, 10) || undefined : undefined,
    datacenter_id: data.datacenter_id || undefined,
    vlan_id: data.vlan_id ? parseInt(data.vlan_id, 10) || undefined : undefined,
    vrf_id: data.vrf_id || undefined,
  };
}

function cleanIpData(data: IpamIpAddressFormData): Record<string, unknown> {
  return {
    id: data.id,
    address: data.address,
    prefix_id: data.prefix_id ? parseInt(data.prefix_id, 10) : undefined,
    description: data.description || undefined,
    status: data.status,
    role_ids: data.role_ids.filter(id => id !== ''),
    dns_name: data.dns_name || undefined,
    device_id: data.device_id ? parseInt(data.device_id, 10) || undefined : undefined,
    interface_name: data.interface_name || undefined,
    vrf_id: data.vrf_id || undefined,
  };
}

export class IpamService extends BaseService {
  // ========== Regions ==========
  async listRegions(): Promise<IpamRegion[]> {
    return this.get<IpamRegion[]>('/ipam/regions');
  }

  async createRegion(data: IpamRegionFormData): Promise<IpamRegion> {
    return this.post<IpamRegion>('/ipam/regions', data);
  }

  async updateRegion(id: string, data: IpamRegionFormData): Promise<IpamRegion> {
    return this.put<IpamRegion>(`/ipam/regions/${encodeURIComponent(id)}`, data);
  }

  async deleteRegion(id: string): Promise<void> {
    return this.delete<void>(`/ipam/regions/${encodeURIComponent(id)}`);
  }

  // ========== Campuses ==========
  async listCampuses(): Promise<IpamCampus[]> {
    return this.get<IpamCampus[]>('/ipam/campuses');
  }

  async createCampus(data: IpamCampusFormData): Promise<IpamCampus> {
    return this.post<IpamCampus>('/ipam/campuses', data);
  }

  async updateCampus(id: string, data: IpamCampusFormData): Promise<IpamCampus> {
    return this.put<IpamCampus>(`/ipam/campuses/${encodeURIComponent(id)}`, data);
  }

  async deleteCampus(id: string): Promise<void> {
    return this.delete<void>(`/ipam/campuses/${encodeURIComponent(id)}`);
  }

  // ========== Datacenters ==========
  async listDatacenters(): Promise<IpamDatacenter[]> {
    return this.get<IpamDatacenter[]>('/ipam/datacenters');
  }

  async createDatacenter(data: IpamDatacenterFormData): Promise<IpamDatacenter> {
    return this.post<IpamDatacenter>('/ipam/datacenters', data);
  }

  async updateDatacenter(id: string, data: IpamDatacenterFormData): Promise<IpamDatacenter> {
    return this.put<IpamDatacenter>(`/ipam/datacenters/${encodeURIComponent(id)}`, data);
  }

  async deleteDatacenter(id: string): Promise<void> {
    return this.delete<void>(`/ipam/datacenters/${encodeURIComponent(id)}`);
  }

  // ========== Halls ==========
  async listHalls(): Promise<IpamHall[]> {
    return this.get<IpamHall[]>('/ipam/halls');
  }

  async createHall(data: IpamHallFormData): Promise<IpamHall> {
    return this.post<IpamHall>('/ipam/halls', data);
  }

  async updateHall(id: string, data: IpamHallFormData): Promise<IpamHall> {
    return this.put<IpamHall>(`/ipam/halls/${encodeURIComponent(id)}`, data);
  }

  async deleteHall(id: string): Promise<void> {
    return this.delete<void>(`/ipam/halls/${encodeURIComponent(id)}`);
  }

  // ========== Rows ==========
  async listRows(): Promise<IpamRow[]> {
    return this.get<IpamRow[]>('/ipam/rows');
  }

  async createRow(data: IpamRowFormData): Promise<IpamRow> {
    return this.post<IpamRow>('/ipam/rows', data);
  }

  async updateRow(id: string, data: IpamRowFormData): Promise<IpamRow> {
    return this.put<IpamRow>(`/ipam/rows/${encodeURIComponent(id)}`, data);
  }

  async deleteRow(id: string): Promise<void> {
    return this.delete<void>(`/ipam/rows/${encodeURIComponent(id)}`);
  }

  // ========== Racks ==========
  async listRacks(): Promise<IpamRack[]> {
    return this.get<IpamRack[]>('/ipam/racks');
  }

  async createRack(data: IpamRackFormData): Promise<IpamRack> {
    return this.post<IpamRack>('/ipam/racks', data);
  }

  async updateRack(id: string, data: IpamRackFormData): Promise<IpamRack> {
    return this.put<IpamRack>(`/ipam/racks/${encodeURIComponent(id)}`, data);
  }

  async deleteRack(id: string): Promise<void> {
    return this.delete<void>(`/ipam/racks/${encodeURIComponent(id)}`);
  }

  // ========== Roles ==========
  async listRoles(): Promise<IpamRole[]> {
    return this.get<IpamRole[]>('/ipam/roles');
  }

  async createRole(data: { id: string; name: string; description?: string }): Promise<IpamRole> {
    return this.post<IpamRole>('/ipam/roles', data);
  }

  async deleteRole(id: string): Promise<void> {
    return this.delete<void>(`/ipam/roles/${encodeURIComponent(id)}`);
  }

  // ========== Prefixes ==========
  async listPrefixes(): Promise<IpamPrefix[]> {
    return this.get<IpamPrefix[]>('/ipam/prefixes');
  }

  async listSupernets(): Promise<IpamPrefix[]> {
    return this.get<IpamPrefix[]>('/ipam/prefixes/supernets');
  }

  async getPrefix(id: number): Promise<IpamPrefix> {
    return this.get<IpamPrefix>(`/ipam/prefixes/${id}`);
  }

  async createPrefix(data: IpamPrefixFormData): Promise<IpamPrefix> {
    return this.post<IpamPrefix>('/ipam/prefixes', cleanPrefixData(data));
  }

  async updatePrefix(id: number, data: IpamPrefixFormData): Promise<IpamPrefix> {
    return this.put<IpamPrefix>(`/ipam/prefixes/${id}`, cleanPrefixData(data));
  }

  async deletePrefix(id: number): Promise<void> {
    return this.delete<void>(`/ipam/prefixes/${id}`);
  }

  async nextAvailablePrefix(parentId: number, data: { prefix_length: number; description?: string; status?: string; datacenter_id?: string }): Promise<IpamPrefix> {
    return this.post<IpamPrefix>(`/ipam/prefixes/${parentId}/available-prefixes`, data);
  }

  async nextAvailableIp(prefixId: number, data: { description?: string; status?: string; role_ids?: string[]; dns_name?: string; device_id?: number; interface_name?: string }): Promise<IpamIpAddress> {
    return this.post<IpamIpAddress>(`/ipam/prefixes/${prefixId}/available-ips`, data);
  }

  // ========== IP Addresses ==========
  async listIpAddresses(): Promise<IpamIpAddress[]> {
    return this.get<IpamIpAddress[]>('/ipam/ip-addresses');
  }

  async getIpAddress(id: string): Promise<IpamIpAddress> {
    return this.get<IpamIpAddress>(`/ipam/ip-addresses/${encodeURIComponent(id)}`);
  }

  async createIpAddress(data: IpamIpAddressFormData): Promise<IpamIpAddress> {
    return this.post<IpamIpAddress>('/ipam/ip-addresses', cleanIpData(data));
  }

  async updateIpAddress(id: string, data: IpamIpAddressFormData): Promise<IpamIpAddress> {
    return this.put<IpamIpAddress>(`/ipam/ip-addresses/${encodeURIComponent(id)}`, cleanIpData(data));
  }

  async deleteIpAddress(id: string): Promise<void> {
    return this.delete<void>(`/ipam/ip-addresses/${encodeURIComponent(id)}`);
  }

  // ========== VRFs ==========
  async listVrfs(): Promise<IpamVrf[]> {
    return this.get<IpamVrf[]>('/ipam/vrfs');
  }

  async createVrf(data: { id: string; name: string; rd?: string; description?: string }): Promise<IpamVrf> {
    return this.post<IpamVrf>('/ipam/vrfs', data);
  }

  async deleteVrf(id: string): Promise<void> {
    return this.delete<void>(`/ipam/vrfs/${encodeURIComponent(id)}`);
  }

  // ========== Tags ==========
  async listTagKeys(): Promise<string[]> {
    return this.get<string[]>('/ipam/tags/keys');
  }

  async listTags(resourceType: string, resourceId: string): Promise<IpamTag[]> {
    return this.get<IpamTag[]>(`/ipam/tags/${encodeURIComponent(resourceType)}/${encodeURIComponent(resourceId)}`);
  }

  async setTag(resourceType: string, resourceId: string, key: string, value: string): Promise<void> {
    return this.post<void>(`/ipam/tags/${encodeURIComponent(resourceType)}/${encodeURIComponent(resourceId)}`, { key, value });
  }

  async deleteTag(resourceType: string, resourceId: string, key: string): Promise<void> {
    return this.delete<void>(`/ipam/tags/${encodeURIComponent(resourceType)}/${encodeURIComponent(resourceId)}/${encodeURIComponent(key)}`);
  }
}
