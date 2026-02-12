import { useState, useEffect } from 'react';
import { getApiHistory, onApiHistoryChange, type ApiHistoryEntry } from '../services/base';

export function useApiHistory(): ApiHistoryEntry[] {
  const [entries, setEntries] = useState<ApiHistoryEntry[]>(getApiHistory);

  useEffect(() => {
    return onApiHistoryChange(setEntries);
  }, []);

  return entries;
}
