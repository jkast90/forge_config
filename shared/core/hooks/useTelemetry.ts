import { useState, useEffect } from 'react';
import { getTelemetryEvents, onTelemetryChange, type TelemetryEvent } from '../services/telemetry';

export function useTelemetry(): TelemetryEvent[] {
  const [events, setEvents] = useState<TelemetryEvent[]>(getTelemetryEvents);

  useEffect(() => {
    return onTelemetryChange(setEvents);
  }, []);

  return events;
}
