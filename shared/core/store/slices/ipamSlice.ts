import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
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
} from '../../types';
import { getServices } from '../../services';

interface IpamState {
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
}

const initialState: IpamState = {
  regions: [],
  campuses: [],
  datacenters: [],
  halls: [],
  rows: [],
  racks: [],
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

export const updateRegion = createAsyncThunk('ipam/updateRegion', async ({ id, data }: { id: number | string; data: IpamRegionFormData }) => {
  return getServices().ipam.updateRegion(id, data);
});

export const deleteRegion = createAsyncThunk('ipam/deleteRegion', async (id: number | string) => {
  await getServices().ipam.deleteRegion(id);
  return id;
});

// Campuses
export const fetchCampuses = createAsyncThunk('ipam/fetchCampuses', async () => {
  return getServices().ipam.listCampuses();
});

export const createCampus = createAsyncThunk('ipam/createCampus', async (data: IpamCampusFormData) => {
  return getServices().ipam.createCampus(data);
});

export const updateCampus = createAsyncThunk('ipam/updateCampus', async ({ id, data }: { id: number | string; data: IpamCampusFormData }) => {
  return getServices().ipam.updateCampus(id, data);
});

export const deleteCampus = createAsyncThunk('ipam/deleteCampus', async (id: number | string) => {
  await getServices().ipam.deleteCampus(id);
  return id;
});

// Datacenters
export const fetchDatacenters = createAsyncThunk('ipam/fetchDatacenters', async () => {
  return getServices().ipam.listDatacenters();
});

export const createDatacenter = createAsyncThunk('ipam/createDatacenter', async (data: IpamDatacenterFormData) => {
  return getServices().ipam.createDatacenter(data);
});

export const updateDatacenter = createAsyncThunk('ipam/updateDatacenter', async ({ id, data }: { id: number | string; data: IpamDatacenterFormData }) => {
  return getServices().ipam.updateDatacenter(id, data);
});

export const deleteDatacenter = createAsyncThunk('ipam/deleteDatacenter', async (id: number | string) => {
  await getServices().ipam.deleteDatacenter(id);
  return id;
});

// Halls
export const fetchHalls = createAsyncThunk('ipam/fetchHalls', async () => {
  return getServices().ipam.listHalls();
});

export const createHall = createAsyncThunk('ipam/createHall', async (data: IpamHallFormData) => {
  return getServices().ipam.createHall(data);
});

export const updateHall = createAsyncThunk('ipam/updateHall', async ({ id, data }: { id: number | string; data: IpamHallFormData }) => {
  return getServices().ipam.updateHall(id, data);
});

export const deleteHall = createAsyncThunk('ipam/deleteHall', async (id: number | string) => {
  await getServices().ipam.deleteHall(id);
  return id;
});

// Rows
export const fetchRows = createAsyncThunk('ipam/fetchRows', async () => {
  return getServices().ipam.listRows();
});

export const createRow = createAsyncThunk('ipam/createRow', async (data: IpamRowFormData) => {
  return getServices().ipam.createRow(data);
});

export const updateRow = createAsyncThunk('ipam/updateRow', async ({ id, data }: { id: number | string; data: IpamRowFormData }) => {
  return getServices().ipam.updateRow(id, data);
});

export const deleteRow = createAsyncThunk('ipam/deleteRow', async (id: number | string) => {
  await getServices().ipam.deleteRow(id);
  return id;
});

// Racks
export const fetchRacks = createAsyncThunk('ipam/fetchRacks', async () => {
  return getServices().ipam.listRacks();
});

export const createRack = createAsyncThunk('ipam/createRack', async (data: IpamRackFormData) => {
  return getServices().ipam.createRack(data);
});

export const updateRack = createAsyncThunk('ipam/updateRack', async ({ id, data }: { id: number | string; data: IpamRackFormData }) => {
  return getServices().ipam.updateRack(id, data);
});

export const deleteRack = createAsyncThunk('ipam/deleteRack', async (id: number | string) => {
  await getServices().ipam.deleteRack(id);
  return id;
});

// Roles
export const fetchRoles = createAsyncThunk('ipam/fetchRoles', async () => {
  return getServices().ipam.listRoles();
});

export const createRole = createAsyncThunk('ipam/createRole', async (data: { id: number | string; name: string; description?: string }) => {
  return getServices().ipam.createRole(data);
});

export const deleteRole = createAsyncThunk('ipam/deleteRole', async (id: number | string) => {
  await getServices().ipam.deleteRole(id);
  return id;
});

// VRFs
export const fetchVrfs = createAsyncThunk('ipam/fetchVrfs', async () => {
  return getServices().ipam.listVrfs();
});

export const createVrf = createAsyncThunk('ipam/createVrf', async (data: { name: string; rd?: string; description?: string; tenant_id?: number }) => {
  return getServices().ipam.createVrf(data);
});

export const deleteVrf = createAsyncThunk('ipam/deleteVrf', async (id: number | string) => {
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

export const updateIpAddress = createAsyncThunk('ipam/updateIpAddress', async ({ id, data }: { id: number | string; data: IpamIpAddressFormData }) => {
  return getServices().ipam.updateIpAddress(id, data);
});

export const deleteIpAddress = createAsyncThunk('ipam/deleteIpAddress', async (id: number | string) => {
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
      // Campuses
      .addCase(fetchCampuses.pending, (state) => { state.loading = state.campuses.length === 0; })
      .addCase(fetchCampuses.fulfilled, (state, action) => { state.campuses = action.payload || []; state.loading = false; state.error = null; })
      .addCase(fetchCampuses.rejected, (state, action) => { state.loading = false; state.error = action.error.message ?? 'Failed to load campuses'; })
      // Datacenters
      .addCase(fetchDatacenters.pending, (state) => { state.loading = state.datacenters.length === 0; })
      .addCase(fetchDatacenters.fulfilled, (state, action) => { state.datacenters = action.payload || []; state.loading = false; state.error = null; })
      .addCase(fetchDatacenters.rejected, (state, action) => { state.loading = false; state.error = action.error.message ?? 'Failed to load datacenters'; })
      // Halls
      .addCase(fetchHalls.pending, (state) => { state.loading = state.halls.length === 0; })
      .addCase(fetchHalls.fulfilled, (state, action) => { state.halls = action.payload || []; state.loading = false; state.error = null; })
      .addCase(fetchHalls.rejected, (state, action) => { state.loading = false; state.error = action.error.message ?? 'Failed to load halls'; })
      // Rows
      .addCase(fetchRows.pending, (state) => { state.loading = state.rows.length === 0; })
      .addCase(fetchRows.fulfilled, (state, action) => { state.rows = action.payload || []; state.loading = false; state.error = null; })
      .addCase(fetchRows.rejected, (state, action) => { state.loading = false; state.error = action.error.message ?? 'Failed to load rows'; })
      // Racks
      .addCase(fetchRacks.pending, (state) => { state.loading = state.racks.length === 0; })
      .addCase(fetchRacks.fulfilled, (state, action) => { state.racks = action.payload || []; state.loading = false; state.error = null; })
      .addCase(fetchRacks.rejected, (state, action) => { state.loading = false; state.error = action.error.message ?? 'Failed to load racks'; })
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
