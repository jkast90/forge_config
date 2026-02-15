// Device statistics utilities - shared business logic for dashboard/summary views

import type { Device, DeviceStatus, Job } from '../types';

/**
 * Count devices by status
 */
export function countDevicesByStatus(devices: Device[]): Record<DeviceStatus, number> {
  const counts: Record<DeviceStatus, number> = {
    online: 0,
    offline: 0,
    provisioning: 0,
    unknown: 0,
  };
  devices.forEach((d) => {
    counts[d.status] = (counts[d.status] || 0) + 1;
  });
  return counts;
}

/**
 * Count devices with recent backups within a given time window
 * @param devices - Array of devices
 * @param hours - Time window in hours (default: 24)
 */
export function countRecentBackups(devices: Device[], hours = 24): number {
  const cutoff = Date.now() - hours * 60 * 60 * 1000;
  return devices.filter(
    (d) => d.last_backup && new Date(d.last_backup).getTime() > cutoff
  ).length;
}

/**
 * Get jobs created within a given time window
 * @param jobs - Array of jobs
 * @param hours - Time window in hours (default: 24)
 */
export function getRecentJobs(jobs: Job[], hours = 24): Job[] {
  const cutoff = Date.now() - hours * 60 * 60 * 1000;
  return jobs.filter((j) => new Date(j.created_at).getTime() > cutoff);
}
