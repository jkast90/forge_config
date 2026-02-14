// Resolved variables hook - fetches the full resolution with provenance

import { useCallback, useState } from 'react';
import type { ResolvedVariablesResponse } from '../types';
import { addNotification } from '../services/notifications';
import { getErrorMessage } from '../utils/errors';
import { getServices } from '../services';

export interface UseResolvedVariablesReturn {
  result: ResolvedVariablesResponse | null;
  loading: boolean;
  fetch: (deviceId: string) => Promise<void>;
  clear: () => void;
}

export function useResolvedVariables(): UseResolvedVariablesReturn {
  const [result, setResult] = useState<ResolvedVariablesResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async (deviceId: string) => {
    setLoading(true);
    try {
      const data = await getServices().groups.getResolvedVariables(deviceId);
      setResult(data);
    } catch (err) {
      addNotification('error', `Failed to resolve variables: ${getErrorMessage(err)}`);
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const clear = useCallback(() => {
    setResult(null);
  }, []);

  return { result, loading, fetch, clear };
}
