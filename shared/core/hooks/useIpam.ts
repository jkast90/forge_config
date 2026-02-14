// IPAM management hook - Redux-backed

import { useEffect, useCallback, useState } from 'react';
import type {
  IpamRegion, IpamRegionFormData,
  IpamLocation, IpamLocationFormData,
  IpamDatacenter, IpamDatacenterFormData,
  IpamRole,
  IpamVrf,
  IpamPrefix, IpamPrefixFormData,
  IpamIpAddress, IpamIpAddressFormData,
  IpamTag,
} from '../types';
import { useAppDispatch, useAppSelector } from '../store';
import {
  fetchRegions, createRegion as createRegionThunk, updateRegion as updateRegionThunk, deleteRegion as deleteRegionThunk,
  fetchLocations, createLocation as createLocationThunk, updateLocation as updateLocationThunk, deleteLocation as deleteLocationThunk,
  fetchDatacenters, createDatacenter as createDatacenterThunk, updateDatacenter as updateDatacenterThunk, deleteDatacenter as deleteDatacenterThunk,
  fetchRoles, createRole as createRoleThunk, deleteRole as deleteRoleThunk,
  fetchVrfs, createVrf as createVrfThunk, deleteVrf as deleteVrfThunk,
  fetchPrefixes, createPrefix as createPrefixThunk, updatePrefix as updatePrefixThunk, deletePrefix as deletePrefixThunk,
  fetchIpAddresses, createIpAddress as createIpAddressThunk, updateIpAddress as updateIpAddressThunk, deleteIpAddress as deleteIpAddressThunk,
} from '../store/slices/ipamSlice';
import { addNotification } from '../services/notifications';
import { getServices } from '../services';
import { getErrorMessage } from '../utils/errors';

export interface UseIpamOptions {
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export interface UseIpamReturn {
  // Data
  regions: IpamRegion[];
  locations: IpamLocation[];
  datacenters: IpamDatacenter[];
  roles: IpamRole[];
  vrfs: IpamVrf[];
  prefixes: IpamPrefix[];
  ipAddresses: IpamIpAddress[];
  loading: boolean;
  error: string | null;
  // Refresh
  refresh: () => Promise<void>;
  refreshPrefixes: () => Promise<void>;
  refreshIpAddresses: () => Promise<void>;
  // Regions
  createRegion: (data: IpamRegionFormData) => Promise<boolean>;
  updateRegion: (id: string, data: IpamRegionFormData) => Promise<boolean>;
  deleteRegion: (id: string) => Promise<boolean>;
  // Locations
  createLocation: (data: IpamLocationFormData) => Promise<boolean>;
  updateLocation: (id: string, data: IpamLocationFormData) => Promise<boolean>;
  deleteLocation: (id: string) => Promise<boolean>;
  // Datacenters
  createDatacenter: (data: IpamDatacenterFormData) => Promise<boolean>;
  updateDatacenter: (id: string, data: IpamDatacenterFormData) => Promise<boolean>;
  deleteDatacenter: (id: string) => Promise<boolean>;
  // Roles
  createRole: (data: { id: string; name: string; description?: string }) => Promise<boolean>;
  deleteRole: (id: string) => Promise<boolean>;
  // VRFs
  createVrf: (data: { id: string; name: string; rd?: string; description?: string }) => Promise<boolean>;
  deleteVrf: (id: string) => Promise<boolean>;
  // Prefixes
  createPrefix: (data: IpamPrefixFormData) => Promise<boolean>;
  updatePrefix: (id: number, data: IpamPrefixFormData) => Promise<boolean>;
  deletePrefix: (id: number) => Promise<boolean>;
  nextAvailablePrefix: (parentId: number, prefixLength: number, opts?: { description?: string; status?: string; datacenter_id?: string }) => Promise<IpamPrefix | null>;
  nextAvailableIp: (prefixId: number, opts?: { description?: string; status?: string; role_ids?: string[]; dns_name?: string; device_id?: string; interface_name?: string }) => Promise<IpamIpAddress | null>;
  // IP Addresses
  createIpAddress: (data: IpamIpAddressFormData) => Promise<boolean>;
  updateIpAddress: (id: string, data: IpamIpAddressFormData) => Promise<boolean>;
  deleteIpAddress: (id: string) => Promise<boolean>;
  // Tags
  tags: IpamTag[];
  tagsLoading: boolean;
  tagKeys: string[];
  fetchTags: (resourceType: string, resourceId: string) => Promise<void>;
  fetchTagKeys: () => Promise<void>;
  setTag: (resourceType: string, resourceId: string, key: string, value: string) => Promise<boolean>;
  deleteTag: (resourceType: string, resourceId: string, key: string) => Promise<boolean>;
}

export function useIpam(options: UseIpamOptions = {}): UseIpamReturn {
  const { autoRefresh = false, refreshInterval = 30000 } = options;
  const dispatch = useAppDispatch();
  const { regions, locations, datacenters, roles, vrfs, prefixes, ipAddresses, loading, error } = useAppSelector((state) => state.ipam);

  const [tags, setTags] = useState<IpamTag[]>([]);
  const [tagsLoading, setTagsLoading] = useState(false);
  const [tagKeys, setTagKeys] = useState<string[]>([]);

  const refresh = useCallback(async () => {
    await Promise.all([
      dispatch(fetchRegions()),
      dispatch(fetchLocations()),
      dispatch(fetchDatacenters()),
      dispatch(fetchRoles()),
      dispatch(fetchVrfs()),
      dispatch(fetchPrefixes()),
      dispatch(fetchIpAddresses()),
    ]);
  }, [dispatch]);

  const refreshPrefixes = useCallback(async () => {
    await dispatch(fetchPrefixes());
  }, [dispatch]);

  const refreshIpAddresses = useCallback(async () => {
    await dispatch(fetchIpAddresses());
  }, [dispatch]);

  // Initial fetch
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(refresh, refreshInterval);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, refresh]);

  // ========== Regions ==========
  const createRegion = useCallback(async (data: IpamRegionFormData): Promise<boolean> => {
    try {
      await dispatch(createRegionThunk(data)).unwrap();
      addNotification('success', 'Region created');
      dispatch(fetchRegions());
      return true;
    } catch (err) {
      addNotification('error', `Failed to create region: ${getErrorMessage(err)}`);
      return false;
    }
  }, [dispatch]);

  const updateRegion = useCallback(async (id: string, data: IpamRegionFormData): Promise<boolean> => {
    try {
      await dispatch(updateRegionThunk({ id, data })).unwrap();
      addNotification('success', 'Region updated');
      dispatch(fetchRegions());
      return true;
    } catch (err) {
      addNotification('error', `Failed to update region: ${getErrorMessage(err)}`);
      return false;
    }
  }, [dispatch]);

  const deleteRegion = useCallback(async (id: string): Promise<boolean> => {
    try {
      await dispatch(deleteRegionThunk(id)).unwrap();
      addNotification('success', 'Region deleted');
      dispatch(fetchRegions());
      dispatch(fetchLocations());
      return true;
    } catch (err) {
      addNotification('error', `Failed to delete region: ${getErrorMessage(err)}`);
      return false;
    }
  }, [dispatch]);

  // ========== Locations ==========
  const createLocation = useCallback(async (data: IpamLocationFormData): Promise<boolean> => {
    try {
      await dispatch(createLocationThunk(data)).unwrap();
      addNotification('success', 'Location created');
      dispatch(fetchLocations());
      dispatch(fetchRegions());
      return true;
    } catch (err) {
      addNotification('error', `Failed to create location: ${getErrorMessage(err)}`);
      return false;
    }
  }, [dispatch]);

  const updateLocation = useCallback(async (id: string, data: IpamLocationFormData): Promise<boolean> => {
    try {
      await dispatch(updateLocationThunk({ id, data })).unwrap();
      addNotification('success', 'Location updated');
      dispatch(fetchLocations());
      return true;
    } catch (err) {
      addNotification('error', `Failed to update location: ${getErrorMessage(err)}`);
      return false;
    }
  }, [dispatch]);

  const deleteLocation = useCallback(async (id: string): Promise<boolean> => {
    try {
      await dispatch(deleteLocationThunk(id)).unwrap();
      addNotification('success', 'Location deleted');
      dispatch(fetchLocations());
      dispatch(fetchRegions());
      dispatch(fetchDatacenters());
      return true;
    } catch (err) {
      addNotification('error', `Failed to delete location: ${getErrorMessage(err)}`);
      return false;
    }
  }, [dispatch]);

  // ========== Datacenters ==========
  const createDatacenter = useCallback(async (data: IpamDatacenterFormData): Promise<boolean> => {
    try {
      await dispatch(createDatacenterThunk(data)).unwrap();
      addNotification('success', 'Datacenter created');
      dispatch(fetchDatacenters());
      dispatch(fetchLocations());
      return true;
    } catch (err) {
      addNotification('error', `Failed to create datacenter: ${getErrorMessage(err)}`);
      return false;
    }
  }, [dispatch]);

  const updateDatacenter = useCallback(async (id: string, data: IpamDatacenterFormData): Promise<boolean> => {
    try {
      await dispatch(updateDatacenterThunk({ id, data })).unwrap();
      addNotification('success', 'Datacenter updated');
      dispatch(fetchDatacenters());
      return true;
    } catch (err) {
      addNotification('error', `Failed to update datacenter: ${getErrorMessage(err)}`);
      return false;
    }
  }, [dispatch]);

  const deleteDatacenter = useCallback(async (id: string): Promise<boolean> => {
    try {
      await dispatch(deleteDatacenterThunk(id)).unwrap();
      addNotification('success', 'Datacenter deleted');
      dispatch(fetchDatacenters());
      dispatch(fetchLocations());
      return true;
    } catch (err) {
      addNotification('error', `Failed to delete datacenter: ${getErrorMessage(err)}`);
      return false;
    }
  }, [dispatch]);

  // ========== Roles ==========
  const createRole = useCallback(async (data: { id: string; name: string; description?: string }): Promise<boolean> => {
    try {
      await dispatch(createRoleThunk(data)).unwrap();
      addNotification('success', 'Role created');
      dispatch(fetchRoles());
      return true;
    } catch (err) {
      addNotification('error', `Failed to create role: ${getErrorMessage(err)}`);
      return false;
    }
  }, [dispatch]);

  const deleteRole = useCallback(async (id: string): Promise<boolean> => {
    try {
      await dispatch(deleteRoleThunk(id)).unwrap();
      addNotification('success', 'Role deleted');
      dispatch(fetchRoles());
      return true;
    } catch (err) {
      addNotification('error', `Failed to delete role: ${getErrorMessage(err)}`);
      return false;
    }
  }, [dispatch]);

  // ========== VRFs ==========
  const createVrf = useCallback(async (data: { id: string; name: string; rd?: string; description?: string }): Promise<boolean> => {
    try {
      await dispatch(createVrfThunk(data)).unwrap();
      addNotification('success', 'VRF created');
      dispatch(fetchVrfs());
      return true;
    } catch (err) {
      addNotification('error', `Failed to create VRF: ${getErrorMessage(err)}`);
      return false;
    }
  }, [dispatch]);

  const deleteVrf = useCallback(async (id: string): Promise<boolean> => {
    try {
      await dispatch(deleteVrfThunk(id)).unwrap();
      addNotification('success', 'VRF deleted');
      dispatch(fetchVrfs());
      dispatch(fetchPrefixes());
      return true;
    } catch (err) {
      addNotification('error', `Failed to delete VRF: ${getErrorMessage(err)}`);
      return false;
    }
  }, [dispatch]);

  // ========== Prefixes ==========
  const createPrefix = useCallback(async (data: IpamPrefixFormData): Promise<boolean> => {
    try {
      await dispatch(createPrefixThunk(data)).unwrap();
      addNotification('success', 'Prefix created');
      dispatch(fetchPrefixes());
      return true;
    } catch (err) {
      addNotification('error', `Failed to create prefix: ${getErrorMessage(err)}`);
      return false;
    }
  }, [dispatch]);

  const updatePrefix = useCallback(async (id: number, data: IpamPrefixFormData): Promise<boolean> => {
    try {
      await dispatch(updatePrefixThunk({ id, data })).unwrap();
      addNotification('success', 'Prefix updated');
      dispatch(fetchPrefixes());
      return true;
    } catch (err) {
      addNotification('error', `Failed to update prefix: ${getErrorMessage(err)}`);
      return false;
    }
  }, [dispatch]);

  const deletePrefix = useCallback(async (id: number): Promise<boolean> => {
    try {
      await dispatch(deletePrefixThunk(id)).unwrap();
      addNotification('success', 'Prefix deleted');
      dispatch(fetchPrefixes());
      dispatch(fetchIpAddresses());
      return true;
    } catch (err) {
      addNotification('error', `Failed to delete prefix: ${getErrorMessage(err)}`);
      return false;
    }
  }, [dispatch]);

  const nextAvailablePrefix = useCallback(async (parentId: number, prefixLength: number, opts?: { description?: string; status?: string; datacenter_id?: string }): Promise<IpamPrefix | null> => {
    try {
      const prefix = await getServices().ipam.nextAvailablePrefix(parentId, { prefix_length: prefixLength, ...opts });
      addNotification('success', `Allocated prefix ${prefix.prefix}`);
      dispatch(fetchPrefixes());
      return prefix;
    } catch (err) {
      addNotification('error', `Failed to allocate prefix: ${getErrorMessage(err)}`);
      return null;
    }
  }, [dispatch]);

  const nextAvailableIp = useCallback(async (prefixId: number, opts?: { description?: string; status?: string; role_ids?: string[]; dns_name?: string; device_id?: string; interface_name?: string }): Promise<IpamIpAddress | null> => {
    try {
      const ip = await getServices().ipam.nextAvailableIp(prefixId, opts || {});
      addNotification('success', `Allocated IP ${ip.address}`);
      dispatch(fetchIpAddresses());
      dispatch(fetchPrefixes());
      return ip;
    } catch (err) {
      addNotification('error', `Failed to allocate IP: ${getErrorMessage(err)}`);
      return null;
    }
  }, [dispatch]);

  // ========== IP Addresses ==========
  const createIpAddress = useCallback(async (data: IpamIpAddressFormData): Promise<boolean> => {
    try {
      await dispatch(createIpAddressThunk(data)).unwrap();
      addNotification('success', 'IP address created');
      dispatch(fetchIpAddresses());
      dispatch(fetchPrefixes());
      return true;
    } catch (err) {
      addNotification('error', `Failed to create IP address: ${getErrorMessage(err)}`);
      return false;
    }
  }, [dispatch]);

  const updateIpAddress = useCallback(async (id: string, data: IpamIpAddressFormData): Promise<boolean> => {
    try {
      await dispatch(updateIpAddressThunk({ id, data })).unwrap();
      addNotification('success', 'IP address updated');
      dispatch(fetchIpAddresses());
      return true;
    } catch (err) {
      addNotification('error', `Failed to update IP address: ${getErrorMessage(err)}`);
      return false;
    }
  }, [dispatch]);

  const deleteIpAddress = useCallback(async (id: string): Promise<boolean> => {
    try {
      await dispatch(deleteIpAddressThunk(id)).unwrap();
      addNotification('success', 'IP address deleted');
      dispatch(fetchIpAddresses());
      dispatch(fetchPrefixes());
      return true;
    } catch (err) {
      addNotification('error', `Failed to delete IP address: ${getErrorMessage(err)}`);
      return false;
    }
  }, [dispatch]);

  // ========== Tags ==========
  const fetchTagKeys = useCallback(async () => {
    try {
      const keys = await getServices().ipam.listTagKeys();
      setTagKeys(keys);
    } catch {
      // non-critical
    }
  }, []);

  const fetchTags = useCallback(async (resourceType: string, resourceId: string) => {
    setTagsLoading(true);
    try {
      const result = await getServices().ipam.listTags(resourceType, resourceId);
      setTags(result);
    } catch (err) {
      addNotification('error', `Failed to load tags: ${getErrorMessage(err)}`);
    } finally {
      setTagsLoading(false);
    }
  }, []);

  const setTag = useCallback(async (resourceType: string, resourceId: string, key: string, value: string): Promise<boolean> => {
    try {
      await getServices().ipam.setTag(resourceType, resourceId, key, value);
      addNotification('success', `Tag "${key}" set`);
      await fetchTags(resourceType, resourceId);
      fetchTagKeys();
      return true;
    } catch (err) {
      addNotification('error', `Failed to set tag: ${getErrorMessage(err)}`);
      return false;
    }
  }, [fetchTags, fetchTagKeys]);

  const deleteTag = useCallback(async (resourceType: string, resourceId: string, key: string): Promise<boolean> => {
    try {
      await getServices().ipam.deleteTag(resourceType, resourceId, key);
      addNotification('success', `Tag "${key}" deleted`);
      await fetchTags(resourceType, resourceId);
      return true;
    } catch (err) {
      addNotification('error', `Failed to delete tag: ${getErrorMessage(err)}`);
      return false;
    }
  }, [fetchTags]);

  return {
    regions, locations, datacenters, roles, vrfs, prefixes, ipAddresses, loading, error,
    refresh, refreshPrefixes, refreshIpAddresses,
    createRegion, updateRegion, deleteRegion,
    createLocation, updateLocation, deleteLocation,
    createDatacenter, updateDatacenter, deleteDatacenter,
    createRole, deleteRole,
    createVrf, deleteVrf,
    createPrefix, updatePrefix, deletePrefix, nextAvailablePrefix, nextAvailableIp,
    createIpAddress, updateIpAddress, deleteIpAddress,
    tags, tagsLoading, tagKeys, fetchTags, fetchTagKeys, setTag, deleteTag,
  };
}
