// Port assignment utilities - shared logic for port management views

import type { Device, DeviceModel, ChassisRow, PortAssignment } from '../types';

/** Simple select option type */
export interface SelectOption {
  value: string;
  label: string;
}

/**
 * Detect if a device is a patch panel (by vendor convention)
 */
export function isPatchPanel(device: Device): boolean {
  return device.vendor === 'patch-panel';
}

/**
 * Build a port-name → assignment map.
 * For patch panels, maps by the patch panel port names.
 * For regular devices, maps by port_name.
 */
export function buildPortAssignmentMap(
  assignments: PortAssignment[],
  deviceId: number,
  patchPanel: boolean
): Map<string, PortAssignment> {
  const map = new Map<string, PortAssignment>();
  assignments.forEach((a) => {
    if (patchPanel) {
      if (a.device_id !== deviceId) {
        if (a.patch_panel_a_id === deviceId && a.patch_panel_a_port) {
          map.set(a.patch_panel_a_port, a);
        }
        if (a.patch_panel_b_id === deviceId && a.patch_panel_b_port) {
          map.set(a.patch_panel_b_port, a);
        }
      } else {
        map.set(a.port_name, a);
      }
    } else {
      map.set(a.port_name, a);
    }
  });
  return map;
}

/**
 * Build device select options for remote device pickers.
 * Excludes the current device from the list.
 */
export function buildDeviceOptions(devices: Device[], excludeDeviceId: number): SelectOption[] {
  const opts: SelectOption[] = [{ value: '', label: '— None —' }];
  devices.forEach((d) => {
    if (d.id !== excludeDeviceId) {
      const typeLabel = d.device_type === 'external' ? ' (ext)' : d.device_type === 'host' ? ' (host)' : '';
      opts.push({ value: String(d.id), label: `${d.hostname}${typeLabel}` });
    }
  });
  return opts;
}

/**
 * Build port select options from a device model's chassis layout.
 */
export function buildPortOptionsFromModel(
  model: DeviceModel | undefined,
  emptyLabel = '— Any / Manual —'
): SelectOption[] {
  const opts: SelectOption[] = [{ value: '', label: emptyLabel }];
  if (model) {
    model.layout.forEach((row: ChassisRow) => {
      row.sections.forEach((section) => {
        section.ports.forEach((port) => {
          opts.push({ value: port.vendor_port_name, label: port.vendor_port_name });
        });
      });
    });
  }
  return opts;
}

/**
 * Build patch panel device options (only devices with vendor='patch-panel').
 */
export function buildPatchPanelOptions(devices: Device[]): SelectOption[] {
  const opts: SelectOption[] = [{ value: '', label: '— None —' }];
  devices.forEach((d) => {
    if (d.vendor === 'patch-panel') {
      opts.push({ value: String(d.id), label: d.hostname || String(d.id) });
    }
  });
  return opts;
}

/**
 * Find a device model matching a device's vendor + model.
 */
export function findDeviceModel(
  device: Device,
  deviceModels: DeviceModel[]
): DeviceModel | undefined {
  if (!device.vendor || !device.model) return undefined;
  return deviceModels.find(
    (dm) => String(dm.vendor_id) === String(device.vendor) && dm.model === device.model
  );
}

/**
 * Count total ports in a device model layout.
 */
export function countModelPorts(model: DeviceModel | undefined): number {
  if (!model) return 0;
  return model.layout.reduce(
    (sum, row) => sum + row.sections.reduce((s, sec) => s + sec.ports.length, 0),
    0
  );
}

/**
 * Count assigned ports.
 * For patch panels: assignments from other devices through this panel.
 * For regular devices: assignments with a remote_device_id.
 */
export function countAssignedPorts(
  assignments: PortAssignment[],
  deviceId: number,
  patchPanel: boolean
): number {
  if (patchPanel) {
    return assignments.filter((a) => a.device_id !== deviceId).length;
  }
  return assignments.filter((a) => a.remote_device_id).length;
}
