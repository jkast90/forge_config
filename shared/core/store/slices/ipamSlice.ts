import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type {
  IpamRegion, IpamRegionFormData,
  IpamLocation, IpamLocationFormData,
  IpamDatacenter, IpamDatacenterFormData,
  IpamRole,
  IpamVrf,
  IpamPrefix, IpamPrefixFormData,
  IpamIpAddress, IpamIpAddressFormData,
} from '../../types';
import { getServices } from '../../services';

interface IpamState {
  regions: IpamRegion[];
  locations: IpamLocation[];
  datacenters: IpamDatacenter[];
  roles: IpamRole[];
  vrfs: IpamVrf[];
  prefixes: IpamPrefix[];
  ipAddresses: IpamIpAddress[];
  loading: boolean;
  error: string | null;
}

const initialState: IpamState = {
  regions: [],
  locations: [],
  datacenters: [],
  roles: [],
  vrfs: [],
  prefixes: [],
  ipAddresses: [],
  loading: true,
  error: null,
};

// Regions
export const fetchRegions = createAsyncThunk('ipam/fetchRegions', async () => {
  return getServices().ipam.listRegions();
});

export const createRegion = createAsyncThunk('ipam/createRegion', async (data: IpamRegionFormData) => {
  return getServices().ipam.createRegion(data);
});

export const updateRegion = createAsyncThunk('ipam/updateRegion', async ({ id, data }: { id: string; data: IpamRegionFormData }) => {
  return getServices().ipam.updateRegion(id, data);
});

export const deleteRegion = createAsyncThunk('ipam/deleteRegion', async (id: string) => {
  await getServices().ipam.deleteRegion(id);
  return id;
});

// Locations
export const fetchLocations = createAsyncThunk('ipam/fetchLocations', async () => {
  return getServices().ipam.listLocations();
});

export const createLocation = createAsyncThunk('ipam/createLocation', async (data: IpamLocationFormData) => {
  return getServices().ipam.createLocation(data);
});

export const updateLocation = createAsyncThunk('ipam/updateLocation', async ({ id, data }: { id: string; data: IpamLocationFormData }) => {
  return getServices().ipam.updateLocation(id, data);
});

export const deleteLocation = createAsyncThunk('ipam/deleteLocation', async (id: string) => {
  await getServices().ipam.deleteLocation(id);
  return id;
});

// Datacenters
export const fetchDatacenters = createAsyncThunk('ipam/fetchDatacenters', async () => {
  return getServices().ipam.listDatacenters();
});

export const createDatacenter = createAsyncThunk('ipam/createDatacenter', async (data: IpamDatacenterFormData) => {
  return getServices().ipam.createDatacenter(data);
});

export const updateDatacenter = createAsyncThunk('ipam/updateDatacenter', async ({ id, data }: { id: string; data: IpamDatacenterFormData }) => {
  return getServices().ipam.updateDatacenter(id, data);
});

export const deleteDatacenter = createAsyncThunk('ipam/deleteDatacenter', async (id: string) => {
  await getServices().ipam.deleteDatacenter(id);
  return id;
});

// Roles
export const fetchRoles = createAsyncThunk('ipam/fetchRoles', async () => {
  return getServices().ipam.listRoles();
});

export const createRole = createAsyncThunk('ipam/createRole', async (data: { id: string; name: string; description?: string }) => {
  return getServices().ipam.createRole(data);
});

export const deleteRole = createAsyncThunk('ipam/deleteRole', async (id: string) => {
  await getServices().ipam.deleteRole(id);
  return id;
});

// VRFs
export const fetchVrfs = createAsyncThunk('ipam/fetchVrfs', async () => {
  return getServices().ipam.listVrfs();
});

export const createVrf = createAsyncThunk('ipam/createVrf', async (data: { id: string; name: string; rd?: string; description?: string }) => {
  return getServices().ipam.createVrf(data);
});

export const deleteVrf = createAsyncThunk('ipam/deleteVrf', async (id: string) => {
  await getServices().ipam.deleteVrf(id);
  return id;
});

// Prefixes
export const fetchPrefixes = createAsyncThunk('ipam/fetchPrefixes', async () => {
  return getServices().ipam.listPrefixes();
});

export const createPrefix = createAsyncThunk('ipam/createPrefix', async (data: IpamPrefixFormData) => {
  return getServices().ipam.createPrefix(data);
});

export const updatePrefix = createAsyncThunk('ipam/updatePrefix', async ({ id, data }: { id: number; data: IpamPrefixFormData }) => {
  return getServices().ipam.updatePrefix(id, data);
});

export const deletePrefix = createAsyncThunk('ipam/deletePrefix', async (id: number) => {
  await getServices().ipam.deletePrefix(id);
  return id;
});

// IP Addresses
export const fetchIpAddresses = createAsyncThunk('ipam/fetchIpAddresses', async () => {
  return getServices().ipam.listIpAddresses();
});

export const createIpAddress = createAsyncThunk('ipam/createIpAddress', async (data: IpamIpAddressFormData) => {
  return getServices().ipam.createIpAddress(data);
});

export const updateIpAddress = createAsyncThunk('ipam/updateIpAddress', async ({ id, data }: { id: string; data: IpamIpAddressFormData }) => {
  return getServices().ipam.updateIpAddress(id, data);
});

export const deleteIpAddress = createAsyncThunk('ipam/deleteIpAddress', async (id: string) => {
  await getServices().ipam.deleteIpAddress(id);
  return id;
});

const ipamSlice = createSlice({
  name: 'ipam',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      // Regions
      .addCase(fetchRegions.pending, (state) => { state.loading = state.regions.length === 0; })
      .addCase(fetchRegions.fulfilled, (state, action) => { state.regions = action.payload || []; state.loading = false; state.error = null; })
      .addCase(fetchRegions.rejected, (state, action) => { state.loading = false; state.error = action.error.message ?? 'Failed to load regions'; })
      // Locations
      .addCase(fetchLocations.pending, (state) => { state.loading = state.locations.length === 0; })
      .addCase(fetchLocations.fulfilled, (state, action) => { state.locations = action.payload || []; state.loading = false; state.error = null; })
      .addCase(fetchLocations.rejected, (state, action) => { state.loading = false; state.error = action.error.message ?? 'Failed to load locations'; })
      // Datacenters
      .addCase(fetchDatacenters.pending, (state) => { state.loading = state.datacenters.length === 0; })
      .addCase(fetchDatacenters.fulfilled, (state, action) => { state.datacenters = action.payload || []; state.loading = false; state.error = null; })
      .addCase(fetchDatacenters.rejected, (state, action) => { state.loading = false; state.error = action.error.message ?? 'Failed to load datacenters'; })
      // Roles
      .addCase(fetchRoles.pending, (state) => { state.loading = state.roles.length === 0; })
      .addCase(fetchRoles.fulfilled, (state, action) => { state.roles = action.payload || []; state.loading = false; state.error = null; })
      .addCase(fetchRoles.rejected, (state, action) => { state.loading = false; state.error = action.error.message ?? 'Failed to load roles'; })
      // VRFs
      .addCase(fetchVrfs.pending, (state) => { state.loading = state.vrfs.length === 0; })
      .addCase(fetchVrfs.fulfilled, (state, action) => { state.vrfs = action.payload || []; state.loading = false; state.error = null; })
      .addCase(fetchVrfs.rejected, (state, action) => { state.loading = false; state.error = action.error.message ?? 'Failed to load VRFs'; })
      // Prefixes
      .addCase(fetchPrefixes.pending, (state) => { state.loading = state.prefixes.length === 0; })
      .addCase(fetchPrefixes.fulfilled, (state, action) => { state.prefixes = action.payload || []; state.loading = false; state.error = null; })
      .addCase(fetchPrefixes.rejected, (state, action) => { state.loading = false; state.error = action.error.message ?? 'Failed to load prefixes'; })
      // IP Addresses
      .addCase(fetchIpAddresses.pending, (state) => { state.loading = state.ipAddresses.length === 0; })
      .addCase(fetchIpAddresses.fulfilled, (state, action) => { state.ipAddresses = action.payload || []; state.loading = false; state.error = null; })
      .addCase(fetchIpAddresses.rejected, (state, action) => { state.loading = false; state.error = action.error.message ?? 'Failed to load IP addresses'; });
  },
});

export default ipamSlice.reducer;
