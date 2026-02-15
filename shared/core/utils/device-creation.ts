// Device creation utilities - shared logic for creating devices from discovery

import type { DiscoveredDevice, DeviceFormData } from '../types';
import { getDefaultTemplateForVendor } from '../types';
import { lookupVendorByMac } from './vendor';

/**
 * Resolve the best vendor for a discovered device.
 * Prefers server-side detection, falls back to client-side MAC lookup.
 */
export function resolveVendor(device: DiscoveredDevice): string {
  const serverVendor = device.vendor;
  const clientVendor = lookupVendorByMac(device.mac);
  return serverVendor || (clientVendor && clientVendor !== 'local' ? clientVendor : '');
}

/**
 * Build partial DeviceFormData from a DiscoveredDevice.
 * Used when "Add as device" is clicked in discovery views.
 */
export function createDeviceFromDiscovery(device: DiscoveredDevice): Partial<DeviceFormData> {
  const vendor = resolveVendor(device);
  const config_template = vendor ? getDefaultTemplateForVendor(vendor) : '';

  return {
    mac: device.mac,
    ip: device.ip,
    hostname: device.hostname || '',
    vendor,
    model: device.model || '',
    serial_number: device.serial_number || device.dhcp_client_id || '',
    config_template,
    ssh_user: '',
    ssh_pass: '',
  };
}

/**
 * Auto-detect vendor and template from a MAC address.
 * Returns updated fields or null if no vendor detected.
 * Used in device forms when MAC field changes.
 */
export function autoDetectVendorFromMac(
  mac: string,
  currentVendor: string,
  currentTemplate: string
): { vendor: string; config_template: string } | null {
  // Only auto-select if vendor is empty and MAC has at least 6 hex chars (OUI)
  if (currentVendor || mac.replace(/[^a-fA-F0-9]/g, '').length < 6) {
    return null;
  }

  const detectedVendor = lookupVendorByMac(mac);
  if (!detectedVendor || detectedVendor === 'Local') {
    return null;
  }

  return {
    vendor: detectedVendor,
    config_template: currentTemplate || getDefaultTemplateForVendor(detectedVendor),
  };
}

/**
 * Auto-select default template when vendor changes.
 * Returns the template ID or null if no change needed.
 */
export function autoSelectTemplateForVendor(
  vendor: string,
  currentTemplate: string
): string | null {
  if (!vendor || currentTemplate) return null;
  return getDefaultTemplateForVendor(vendor);
}

/**
 * Format DHCP metadata from a discovered device into labeled strings.
 * Returns an array of "Label: value" strings for non-empty DHCP fields.
 */
export function getDhcpInfoItems(device: DiscoveredDevice): string[] {
  const items: string[] = [];
  if (device.vendor_class) items.push(`VC: ${device.vendor_class}`);
  if (device.user_class) items.push(`UC: ${device.user_class}`);
  if (device.dhcp_client_id) items.push(`CID: ${device.dhcp_client_id}`);
  if (device.circuit_id) items.push(`Port: ${device.circuit_id}`);
  if (device.remote_id) items.push(`Switch: ${device.remote_id}`);
  if (device.relay_address) items.push(`Relay: ${device.relay_address}`);
  if (device.requested_options) items.push(`Opts: ${device.requested_options}`);
  return items;
}

/**
 * Get the available DHCP detail fields for a discovered device.
 * Returns label/value pairs for non-empty DHCP metadata (for expanded row views).
 */
export function getDhcpDetailFields(device: DiscoveredDevice): { label: string; value: string }[] {
  const fields: { label: string; value: string }[] = [];
  if (device.serial_number) fields.push({ label: 'Serial Number', value: device.serial_number });
  if (device.vendor_class) fields.push({ label: 'Vendor Class', value: device.vendor_class });
  if (device.user_class) fields.push({ label: 'User Class', value: device.user_class });
  if (device.dhcp_client_id) fields.push({ label: 'Client ID', value: device.dhcp_client_id });
  if (device.relay_address) fields.push({ label: 'Relay Address', value: device.relay_address });
  if (device.circuit_id) fields.push({ label: 'Circuit ID', value: device.circuit_id });
  if (device.remote_id) fields.push({ label: 'Remote ID', value: device.remote_id });
  if (device.subscriber_id) fields.push({ label: 'Subscriber ID', value: device.subscriber_id });
  if (device.requested_options) fields.push({ label: 'Requested Options', value: device.requested_options });
  return fields;
}
