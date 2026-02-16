import { BaseService } from './base';
import type { TestContainer, SpawnContainerRequest, ClosLabResponse } from '../types';

export interface UnifiedTopologyRequest {
  architecture?: 'clos' | 'hierarchical';
  external_count?: number;
  external_to_tier1_ratio?: number;
  tier1_count?: number;
  tier1_to_tier2_ratio?: number;
  tier1_model?: string;
  tier1_names?: string[];
  tier2_count?: number;
  tier2_to_tier3_ratio?: number;
  tier2_model?: string;
  tier3_count?: number;
  tier3_model?: string;
  region_id?: number;
  campus_id?: number;
  datacenter_id?: number;
  halls?: number;
  rows_per_hall?: number;
  racks_per_row?: number;
  devices_per_rack?: number;
  spawn_containers?: boolean;
  ceos_image?: string;
  tier3_placement?: 'top' | 'middle' | 'bottom';
  // Super-spine (5-stage CLOS)
  super_spine_enabled?: boolean;
  super_spine_count?: number;
  super_spine_model?: string;
  spine_to_super_spine_ratio?: number;
  pods?: number;
  // Physical spacing for cable length estimation
  row_spacing_cm?: number;
  // User-provided topology name
  topology_name?: string;
  // GPU cluster configuration
  gpu_cluster_count?: number;
  gpu_model?: string;
  gpus_per_node?: number;
  gpu_nodes_per_cluster?: number;
  gpu_interconnect?: string;
  // Per-cluster VRF assignment (indexed by cluster position)
  gpu_vrf_ids?: number[];
  // GPU cabling options
  gpu_include_leaf_uplinks?: boolean;
  gpu_include_fabric_cabling?: boolean;
  // Management switch configuration
  mgmt_switch_model?: string;
  mgmt_switch_distribution?: 'per-row' | 'per-rack' | 'per-hall' | 'count-per-row';
  mgmt_switches_per_row?: number;
}

export interface TopologyPreviewDevice {
  index: number;
  hostname: string;
  role: string;
  loopback: string;
  asn: number;
  model: string;
  mgmt_ip: string;
  rack_name: string | null;
  rack_index: number | null;
  rack_position: number | null;
  device_type?: string;
}

export interface TopologyPreviewLink {
  side_a_hostname: string;
  side_a_interface: string;
  side_a_ip: string;
  side_b_hostname: string;
  side_b_interface: string;
  side_b_ip: string;
  subnet: string;
  cable_length_meters?: number | null;
}

export interface TopologyPreviewRack {
  index: number;
  name: string;
  hall_name: string;
  row_name: string;
  rack_type: string;
}

export interface TopologyPreviewGpuCluster {
  name: string;
  gpu_model: string;
  node_count: number;
  gpus_per_node: number;
  interconnect: string;
  leaf_assignments: string[];
  device_indices: number[];
  leaf_uplink_links: TopologyPreviewLink[];
  fabric_links: TopologyPreviewLink[];
}

export interface TopologyPreviewResponse {
  architecture: string;
  topology_name: string;
  devices: TopologyPreviewDevice[];
  fabric_links: TopologyPreviewLink[];
  racks: TopologyPreviewRack[];
  tier3_placement: string;
  gpu_clusters?: TopologyPreviewGpuCluster[];
}

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

  async previewTopology(config: UnifiedTopologyRequest): Promise<TopologyPreviewResponse> {
    return this.post<TopologyPreviewResponse>('/topology-builder/preview', config);
  }

  async buildTopology(config: UnifiedTopologyRequest & { overrides?: { devices: TopologyPreviewDevice[] } }): Promise<ClosLabResponse> {
    return this.post<ClosLabResponse>('/topology-builder', config);
  }

  async teardownTopology(architecture: 'clos' | 'hierarchical'): Promise<void> {
    await this.delete(`/topology-builder/${architecture}`);
  }

  // Legacy methods that delegate to unified builder
  async buildVirtualClos(config?: { spines?: number; leaves?: number; region_id?: string | number; campus_id?: string | number; datacenter_id?: string | number; halls?: number; rows_per_hall?: number; racks_per_row?: number; leaves_per_rack?: number; links_per_leaf?: number; external_devices?: number; uplinks_per_spine?: number; external_names?: string[]; spine_model?: string; leaf_model?: string; spawn_containers?: boolean; ceos_image?: string }): Promise<ClosLabResponse> {
    const unified: UnifiedTopologyRequest = {
      architecture: 'clos',
      tier1_count: config?.spines,
      tier2_count: config?.leaves,
      external_count: config?.external_devices,
      external_to_tier1_ratio: config?.uplinks_per_spine,
      tier1_to_tier2_ratio: config?.links_per_leaf,
      tier1_model: config?.spine_model,
      tier2_model: config?.leaf_model,
      tier1_names: config?.external_names,
      region_id: config?.region_id ? Number(config.region_id) : undefined,
      campus_id: config?.campus_id ? Number(config.campus_id) : undefined,
      datacenter_id: config?.datacenter_id ? Number(config.datacenter_id) : undefined,
      halls: config?.halls,
      rows_per_hall: config?.rows_per_hall,
      racks_per_row: config?.racks_per_row,
      devices_per_rack: config?.leaves_per_rack,
      spawn_containers: config?.spawn_containers,
      ceos_image: config?.ceos_image,
    };
    return this.buildTopology(unified);
  }

  async teardownVirtualClos(): Promise<void> {
    await this.teardownTopology('clos');
  }
}
