// Port assignments hook - local state (per-device detail data)

import { useState, useEffect, useCallback } from 'react';
import type { PortAssignment, SetPortAssignmentRequest } from '../types';
import { getServices } from '../services';
import { addNotification } from '../services/notifications';
import { navigateAction } from '../services/navigation';
import { getErrorMessage } from '../utils/errors';

export interface UsePortAssignmentsReturn {
  assignments: PortAssignment[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  setAssignment: (req: SetPortAssignmentRequest) => Promise<boolean>;
  removeAssignment: (portName: string) => Promise<boolean>;
  bulkSet: (assignments: SetPortAssignmentRequest[]) => Promise<boolean>;
}

export function usePortAssignments(deviceId: number | undefined): UsePortAssignmentsReturn {
  const [assignments, setAssignments] = useState<PortAssignment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!deviceId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getServices().portAssignments.list(deviceId);
      setAssignments(data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [deviceId]);

  useEffect(() => {
    if (deviceId) {
      refresh();
    } else {
      setAssignments([]);
    }
  }, [deviceId, refresh]);

  const setAssignment = useCallback(async (req: SetPortAssignmentRequest): Promise<boolean> => {
    if (!deviceId) return false;
    try {
      await getServices().portAssignments.set(deviceId, req);
      addNotification('success', `Port ${req.port_name} assignment saved`, navigateAction('View Topology', 'topologies'));
      await refresh();
      return true;
    } catch (err) {
      addNotification('error', `Failed to set port assignment: ${getErrorMessage(err)}`);
      return false;
    }
  }, [deviceId, refresh]);

  const removeAssignment = useCallback(async (portName: string): Promise<boolean> => {
    if (!deviceId) return false;
    try {
      await getServices().portAssignments.remove(deviceId, portName);
      addNotification('success', `Port ${portName} assignment cleared`, navigateAction('View Topology', 'topologies'));
      await refresh();
      return true;
    } catch (err) {
      addNotification('error', `Failed to remove port assignment: ${getErrorMessage(err)}`);
      return false;
    }
  }, [deviceId, refresh]);

  const bulkSet = useCallback(async (reqs: SetPortAssignmentRequest[]): Promise<boolean> => {
    if (!deviceId) return false;
    try {
      await getServices().portAssignments.bulkSet(deviceId, reqs);
      addNotification('success', `Port assignments updated`, navigateAction('View Topology', 'topologies'));
      await refresh();
      return true;
    } catch (err) {
      addNotification('error', `Failed to update port assignments: ${getErrorMessage(err)}`);
      return false;
    }
  }, [deviceId, refresh]);

  return { assignments, loading, error, refresh, setAssignment, removeAssignment, bulkSet };
}
