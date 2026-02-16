// IPAM management hook - Redux-backed

import { useEffect, useCallback, useState } from 'react';
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
import { useAppDispatch, useAppSelector } from '../store';
import {
  fetchRegions, createRegion as createRegionThunk, updateRegion as updateRegionThunk, deleteRegion as deleteRegionThunk,
  fetchCampuses, createCampus as createCampusThunk, updateCampus as updateCampusThunk, deleteCampus as deleteCampusThunk,
  fetchDatacenters, createDatacenter as createDatacenterThunk, updateDatacenter as updateDatacenterThunk, deleteDatacenter as deleteDatacenterThunk,
  fetchHalls, createHall as createHallThunk, updateHall as updateHallThunk, deleteHall as deleteHallThunk,
  fetchRows, createRow as createRowThunk, updateRow as updateRowThunk, deleteRow as deleteRowThunk,
  fetchRacks, createRack as createRackThunk, updateRack as updateRackThunk, deleteRack as deleteRackThunk,
  fetchRoles, createRole as createRoleThunk, deleteRole as deleteRoleThunk,
  fetchVrfs, createVrf as createVrfThunk, deleteVrf as deleteVrfThunk,
  fetchPrefixes, createPrefix as createPrefixThunk, updatePrefix as updatePrefixThunk, deletePrefix as deletePrefixThunk,
  fetchIpAddresses, createIpAddress as createIpAddressThunk, updateIpAddress as updateIpAddressThunk, deleteIpAddress as deleteIpAddressThunk,
} from '../store/slices/ipamSlice';
import { addNotification } from '../services/notifications';
import { navigateAction } from '../services/navigation';
import { getServices } from '../services';
import { getErrorMessage } from '../utils/errors';

export interface UseIpamOptions {
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export interface UseIpamReturn {
  // Data
  regions: IpamRegion[];
  campuses: IpamCampus[];
  datacenters: IpamDatacenter[];
  halls: IpamHall[];
  rows: IpamRow[];
  racks: IpamRack[];
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
  updateRegion: (id: number | string, data: IpamRegionFormData) => Promise<boolean>;
  deleteRegion: (id: number | string) => Promise<boolean>;
  // Campuses
  createCampus: (data: IpamCampusFormData) => Promise<boolean>;
  updateCampus: (id: number | string, data: IpamCampusFormData) => Promise<boolean>;
  deleteCampus: (id: number | string) => Promise<boolean>;
  // Datacenters
  createDatacenter: (data: IpamDatacenterFormData) => Promise<boolean>;
  updateDatacenter: (id: number | string, data: IpamDatacenterFormData) => Promise<boolean>;
  deleteDatacenter: (id: number | string) => Promise<boolean>;
  // Halls
  createHall: (data: IpamHallFormData) => Promise<boolean>;
  updateHall: (id: number | string, data: IpamHallFormData) => Promise<boolean>;
  deleteHall: (id: number | string) => Promise<boolean>;
  // Rows
  createRow: (data: IpamRowFormData) => Promise<boolean>;
  updateRow: (id: number | string, data: IpamRowFormData) => Promise<boolean>;
  deleteRow: (id: number | string) => Promise<boolean>;
  // Racks
  createRack: (data: IpamRackFormData) => Promise<boolean>;
  updateRack: (id: number | string, data: IpamRackFormData) => Promise<boolean>;
  deleteRack: (id: number | string) => Promise<boolean>;
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
  nextAvailableIp: (prefixId: number, opts?: { description?: string; status?: string; role_ids?: string[]; dns_name?: string; device_id?: number; interface_name?: string }) => Promise<IpamIpAddress | null>;
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
  const { regions, campuses, datacenters, halls, rows, racks, roles, vrfs, prefixes, ipAddresses, loading, error } = useAppSelector((state) => state.ipam);

  const [tags, setTags] = useState<IpamTag[]>([]);
  const [tagsLoading, setTagsLoading] = useState(false);
  const [tagKeys, setTagKeys] = useState<string[]>([]);

  const refresh = useCallback(async () => {
    await Promise.all([
      dispatch(fetchRegions()),
      dispatch(fetchCampuses()),
      dispatch(fetchDatacenters()),
      dispatch(fetchHalls()),
      dispatch(fetchRows()),
      dispatch(fetchRacks()),
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
      addNotification('success', 'Region created', navigateAction('View Locations', 'locations'));
      dispatch(fetchRegions());
      return true;
    } catch (err) {
      addNotification('error', `Failed to create region: ${getErrorMessage(err)}`);
      return false;
    }
  }, [dispatch]);

  const updateRegion = useCallback(async (id: number | string, data: IpamRegionFormData): Promise<boolean> => {
    try {
      await dispatch(updateRegionThunk({ id, data })).unwrap();
      addNotification('success', 'Region updated', navigateAction('View Locations', 'locations'));
      dispatch(fetchRegions());
      return true;
    } catch (err) {
      addNotification('error', `Failed to update region: ${getErrorMessage(err)}`);
      return false;
    }
  }, [dispatch]);

  const deleteRegion = useCallback(async (id: number | string): Promise<boolean> => {
    try {
      await dispatch(deleteRegionThunk(id)).unwrap();
      addNotification('success', 'Region deleted', navigateAction('View Locations', 'locations'));
      dispatch(fetchRegions());
      dispatch(fetchCampuses());
      return true;
    } catch (err) {
      addNotification('error', `Failed to delete region: ${getErrorMessage(err)}`);
      return false;
    }
  }, [dispatch]);

  // ========== Campuses ==========
  const createCampus = useCallback(async (data: IpamCampusFormData): Promise<boolean> => {
    try {
      await dispatch(createCampusThunk(data)).unwrap();
      addNotification('success', 'Campus created', navigateAction('View Locations', 'locations'));
      dispatch(fetchCampuses());
      dispatch(fetchRegions());
      return true;
    } catch (err) {
      addNotification('error', `Failed to create campus: ${getErrorMessage(err)}`);
      return false;
    }
  }, [dispatch]);

  const updateCampus = useCallback(async (id: number | string, data: IpamCampusFormData): Promise<boolean> => {
    try {
      await dispatch(updateCampusThunk({ id, data })).unwrap();
      addNotification('success', 'Campus updated', navigateAction('View Locations', 'locations'));
      dispatch(fetchCampuses());
      return true;
    } catch (err) {
      addNotification('error', `Failed to update campus: ${getErrorMessage(err)}`);
      return false;
    }
  }, [dispatch]);

  const deleteCampus = useCallback(async (id: number | string): Promise<boolean> => {
    try {
      await dispatch(deleteCampusThunk(id)).unwrap();
      addNotification('success', 'Campus deleted', navigateAction('View Locations', 'locations'));
      dispatch(fetchCampuses());
      dispatch(fetchRegions());
      dispatch(fetchDatacenters());
      return true;
    } catch (err) {
      addNotification('error', `Failed to delete campus: ${getErrorMessage(err)}`);
      return false;
    }
  }, [dispatch]);

  // ========== Datacenters ==========
  const createDatacenter = useCallback(async (data: IpamDatacenterFormData): Promise<boolean> => {
    try {
      await dispatch(createDatacenterThunk(data)).unwrap();
      addNotification('success', 'Datacenter created', navigateAction('View Locations', 'locations'));
      dispatch(fetchDatacenters());
      dispatch(fetchCampuses());
      return true;
    } catch (err) {
      addNotification('error', `Failed to create datacenter: ${getErrorMessage(err)}`);
      return false;
    }
  }, [dispatch]);

  const updateDatacenter = useCallback(async (id: number | string, data: IpamDatacenterFormData): Promise<boolean> => {
    try {
      await dispatch(updateDatacenterThunk({ id, data })).unwrap();
      addNotification('success', 'Datacenter updated', navigateAction('View Locations', 'locations'));
      dispatch(fetchDatacenters());
      return true;
    } catch (err) {
      addNotification('error', `Failed to update datacenter: ${getErrorMessage(err)}`);
      return false;
    }
  }, [dispatch]);

  const deleteDatacenter = useCallback(async (id: number | string): Promise<boolean> => {
    try {
      await dispatch(deleteDatacenterThunk(id)).unwrap();
      addNotification('success', 'Datacenter deleted', navigateAction('View Locations', 'locations'));
      dispatch(fetchDatacenters());
      dispatch(fetchCampuses());
      return true;
    } catch (err) {
      addNotification('error', `Failed to delete datacenter: ${getErrorMessage(err)}`);
      return false;
    }
  }, [dispatch]);

  // ========== Halls ==========
  const createHall = useCallback(async (data: IpamHallFormData): Promise<boolean> => {
    try {
      await dispatch(createHallThunk(data)).unwrap();
      addNotification('success', 'Hall created', navigateAction('View Locations', 'locations'));
      dispatch(fetchHalls());
      dispatch(fetchDatacenters());
      return true;
    } catch (err) {
      addNotification('error', `Failed to create hall: ${getErrorMessage(err)}`);
      return false;
    }
  }, [dispatch]);

  const updateHall = useCallback(async (id: number | string, data: IpamHallFormData): Promise<boolean> => {
    try {
      await dispatch(updateHallThunk({ id, data })).unwrap();
      addNotification('success', 'Hall updated', navigateAction('View Locations', 'locations'));
      dispatch(fetchHalls());
      return true;
    } catch (err) {
      addNotification('error', `Failed to update hall: ${getErrorMessage(err)}`);
      return false;
    }
  }, [dispatch]);

  const deleteHall = useCallback(async (id: number | string): Promise<boolean> => {
    try {
      await dispatch(deleteHallThunk(id)).unwrap();
      addNotification('success', 'Hall deleted', navigateAction('View Locations', 'locations'));
      dispatch(fetchHalls());
      dispatch(fetchDatacenters());
      return true;
    } catch (err) {
      addNotification('error', `Failed to delete hall: ${getErrorMessage(err)}`);
      return false;
    }
  }, [dispatch]);

  // ========== Rows ==========
  const createRow = useCallback(async (data: IpamRowFormData): Promise<boolean> => {
    try {
      await dispatch(createRowThunk(data)).unwrap();
      addNotification('success', 'Row created', navigateAction('View Locations', 'locations'));
      dispatch(fetchRows());
      dispatch(fetchHalls());
      return true;
    } catch (err) {
      addNotification('error', `Failed to create row: ${getErrorMessage(err)}`);
      return false;
    }
  }, [dispatch]);

  const updateRow = useCallback(async (id: number | string, data: IpamRowFormData): Promise<boolean> => {
    try {
      await dispatch(updateRowThunk({ id, data })).unwrap();
      addNotification('success', 'Row updated', navigateAction('View Locations', 'locations'));
      dispatch(fetchRows());
      return true;
    } catch (err) {
      addNotification('error', `Failed to update row: ${getErrorMessage(err)}`);
      return false;
    }
  }, [dispatch]);

  const deleteRow = useCallback(async (id: number | string): Promise<boolean> => {
    try {
      await dispatch(deleteRowThunk(id)).unwrap();
      addNotification('success', 'Row deleted', navigateAction('View Locations', 'locations'));
      dispatch(fetchRows());
      dispatch(fetchHalls());
      return true;
    } catch (err) {
      addNotification('error', `Failed to delete row: ${getErrorMessage(err)}`);
      return false;
    }
  }, [dispatch]);

  // ========== Racks ==========
  const createRack = useCallback(async (data: IpamRackFormData): Promise<boolean> => {
    try {
      await dispatch(createRackThunk(data)).unwrap();
      addNotification('success', 'Rack created', navigateAction('View Locations', 'locations'));
      dispatch(fetchRacks());
      dispatch(fetchRows());
      return true;
    } catch (err) {
      addNotification('error', `Failed to create rack: ${getErrorMessage(err)}`);
      return false;
    }
  }, [dispatch]);

  const updateRack = useCallback(async (id: number | string, data: IpamRackFormData): Promise<boolean> => {
    try {
      await dispatch(updateRackThunk({ id, data })).unwrap();
      addNotification('success', 'Rack updated', navigateAction('View Locations', 'locations'));
      dispatch(fetchRacks());
      return true;
    } catch (err) {
      addNotification('error', `Failed to update rack: ${getErrorMessage(err)}`);
      return false;
    }
  }, [dispatch]);

  const deleteRack = useCallback(async (id: number | string): Promise<boolean> => {
    try {
      await dispatch(deleteRackThunk(id)).unwrap();
      addNotification('success', 'Rack deleted', navigateAction('View Locations', 'locations'));
      dispatch(fetchRacks());
      dispatch(fetchRows());
      return true;
    } catch (err) {
      addNotification('error', `Failed to delete rack: ${getErrorMessage(err)}`);
      return false;
    }
  }, [dispatch]);

  // ========== Roles ==========
  const createRole = useCallback(async (data: { id: string; name: string; description?: string }): Promise<boolean> => {
    try {
      await dispatch(createRoleThunk(data)).unwrap();
      addNotification('success', 'Role created', navigateAction('View Roles', 'ipam', 'roles'));
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
      addNotification('success', 'Role deleted', navigateAction('View Roles', 'ipam', 'roles'));
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
      addNotification('success', 'VRF created', navigateAction('View VRFs', 'ipam', 'vrfs'));
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
      addNotification('success', 'VRF deleted', navigateAction('View VRFs', 'ipam', 'vrfs'));
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
      addNotification('success', 'Prefix created', navigateAction('View Prefixes', 'ipam', 'prefixes'));
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
      addNotification('success', 'Prefix updated', navigateAction('View Prefixes', 'ipam', 'prefixes'));
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
      addNotification('success', 'Prefix deleted', navigateAction('View Prefixes', 'ipam', 'prefixes'));
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
      addNotification('success', `Allocated prefix ${prefix.prefix}`, navigateAction('View Prefixes', 'ipam', 'prefixes'));
      dispatch(fetchPrefixes());
      return prefix;
    } catch (err) {
      addNotification('error', `Failed to allocate prefix: ${getErrorMessage(err)}`);
      return null;
    }
  }, [dispatch]);

  const nextAvailableIp = useCallback(async (prefixId: number, opts?: { description?: string; status?: string; role_ids?: string[]; dns_name?: string; device_id?: number; interface_name?: string }): Promise<IpamIpAddress | null> => {
    try {
      const ip = await getServices().ipam.nextAvailableIp(prefixId, opts || {});
      addNotification('success', `Allocated IP ${ip.address}`, navigateAction('View IPs', 'ipam', 'ips'));
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
      addNotification('success', 'IP address created', navigateAction('View IPs', 'ipam', 'ips'));
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
      addNotification('success', 'IP address updated', navigateAction('View IPs', 'ipam', 'ips'));
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
      addNotification('success', 'IP address deleted', navigateAction('View IPs', 'ipam', 'ips'));
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
      addNotification('success', `Tag "${key}" set`, navigateAction('View IPAM', 'ipam'));
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
      addNotification('success', `Tag "${key}" deleted`, navigateAction('View IPAM', 'ipam'));
      await fetchTags(resourceType, resourceId);
      return true;
    } catch (err) {
      addNotification('error', `Failed to delete tag: ${getErrorMessage(err)}`);
      return false;
    }
  }, [fetchTags]);

  return {
    regions, campuses, datacenters, halls, rows, racks, roles, vrfs, prefixes, ipAddresses, loading, error,
    refresh, refreshPrefixes, refreshIpAddresses,
    createRegion, updateRegion, deleteRegion,
    createCampus, updateCampus, deleteCampus,
    createDatacenter, updateDatacenter, deleteDatacenter,
    createHall, updateHall, deleteHall,
    createRow, updateRow, deleteRow,
    createRack, updateRack, deleteRack,
    createRole, deleteRole,
    createVrf, deleteVrf,
    createPrefix, updatePrefix, deletePrefix, nextAvailablePrefix, nextAvailableIp,
    createIpAddress, updateIpAddress, deleteIpAddress,
    tags, tagsLoading, tagKeys, fetchTags, fetchTagKeys, setTag, deleteTag,
  };
}
