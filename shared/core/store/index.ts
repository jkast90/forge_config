import { configureStore } from '@reduxjs/toolkit';
import devicesReducer from './slices/devicesSlice';
import vendorsReducer from './slices/vendorsSlice';
import templatesReducer from './slices/templatesSlice';
import dhcpOptionsReducer from './slices/dhcpOptionsSlice';
import discoveryReducer from './slices/discoverySlice';
import containersReducer from './slices/containersSlice';
import settingsReducer from './slices/settingsSlice';
import backupsReducer from './slices/backupsSlice';

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
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export { useAppDispatch, useAppSelector } from './hooks';
