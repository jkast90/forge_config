import { configureStore } from '@reduxjs/toolkit';
import devicesReducer from './slices/devicesSlice';
import vendorsReducer from './slices/vendorsSlice';
import templatesReducer from './slices/templatesSlice';
import dhcpOptionsReducer from './slices/dhcpOptionsSlice';
import discoveryReducer from './slices/discoverySlice';
import containersReducer from './slices/containersSlice';
import settingsReducer from './slices/settingsSlice';
import backupsReducer from './slices/backupsSlice';
import vendorActionsReducer from './slices/vendorActionsSlice';
import jobsReducer from './slices/jobsSlice';
import topologiesReducer from './slices/topologiesSlice';
import deviceVariablesReducer from './slices/deviceVariablesSlice';
import groupsReducer from './slices/groupsSlice';
import ipamReducer from './slices/ipamSlice';
import deviceModelsReducer from './slices/deviceModelsSlice';
import credentialsReducer from './slices/credentialsSlice';
import jobTemplatesReducer from './slices/jobTemplatesSlice';
import outputParsersReducer from './slices/outputParsersSlice';
import deviceRolesReducer from './slices/deviceRolesSlice';
import usersReducer from './slices/usersSlice';
import gpuClustersReducer from './slices/gpuClustersSlice';
import tenantsReducer from './slices/tenantsSlice';

export const store = configureStore({
  reducer: {
    devices: devicesReducer,
    vendors: vendorsReducer,
    templates: templatesReducer,
    dhcpOptions: dhcpOptionsReducer,
    discovery: discoveryReducer,
    containers: containersReducer,
    settings: settingsReducer,
    backups: backupsReducer,
    vendorActions: vendorActionsReducer,
    jobs: jobsReducer,
    topologies: topologiesReducer,
    deviceVariables: deviceVariablesReducer,
    groups: groupsReducer,
    ipam: ipamReducer,
    deviceModels: deviceModelsReducer,
    credentials: credentialsReducer,
    jobTemplates: jobTemplatesReducer,
    outputParsers: outputParsersReducer,
    deviceRoles: deviceRolesReducer,
    users: usersReducer,
    gpuClusters: gpuClustersReducer,
    tenants: tenantsReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      // Disable checks that use window APIs not available in React Native
      immutableCheck: false,
      serializableCheck: false,
    }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export { useAppDispatch, useAppSelector } from './hooks';
