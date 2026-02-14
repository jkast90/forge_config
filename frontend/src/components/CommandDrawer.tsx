import { useState, useEffect, useRef, useCallback } from 'react';
import type { Device, VendorAction, Job } from '@core';
import { getServices, useWebSocket } from '@core';
import { Drawer } from './Drawer';
import { Button } from './Button';
import { Icon, SpinnerIcon } from './Icon';
import { VendorBadge } from './VendorBadge';

interface Props {
  device: Device | null;
  onClose: () => void;
}

interface CommandEntry {
  jobId: string;
  label: string;
  command: string;
  result: { output: string | null; error: string | null } | null;
  loading: boolean;
}

export function CommandDrawer({ device, onClose }: Props) {
  const [actions, setActions] = useState<VendorAction[]>([]);
  const [customCommand, setCustomCommand] = useState('');
  const [history, setHistory] = useState<CommandEntry[]>([]);
  const historyRef = useRef<HTMLDivElement>(null);

  // Handle job updates via WebSocket
  const onJobUpdate = useCallback((job: Job) => {
    setHistory((prev) => prev.map((entry) => {
      if (entry.jobId !== job.id) return entry;
      if (job.status === 'completed' || job.status === 'failed') {
        return {
          ...entry,
          result: { output: job.output, error: job.error },
          loading: false,
        };
      }
      return entry;
    }));
  }, []);

  useWebSocket({ onJobUpdate });

  // Fetch vendor actions when device changes
  useEffect(() => {
    if (!device?.vendor) {
      setActions([]);
      return;
    }
    const services = getServices();
    services.vendors.listActions(device.vendor).then(setActions).catch(() => setActions([]));
  }, [device?.vendor]);

  // Clear history when device changes
  useEffect(() => {
    setHistory([]);
    setCustomCommand('');
  }, [device?.id]);

  const runCommand = async (label: string, command: string) => {
    if (!device) return;

    try {
      const services = getServices();
      const job = await services.devices.exec(device.id, command);
      const entry: CommandEntry = {
        jobId: job.id,
        label,
        command,
        result: null,
        loading: true,
      };
      setHistory((prev) => [entry, ...prev]);
    } catch (err) {
      // If job creation itself fails, show inline error
      const entry: CommandEntry = {
        jobId: `error-${Date.now()}`,
        label,
        command,
        result: { output: null, error: err instanceof Error ? err.message : 'Failed to create job' },
        loading: false,
      };
      setHistory((prev) => [entry, ...prev]);
    }
  };

  const handleRunCustom = () => {
    if (!customCommand.trim()) return;
    runCommand(customCommand, customCommand);
    setCustomCommand('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleRunCustom();
    }
  };

  return (
    <Drawer isOpen={!!device} onClose={onClose} title="Run Commands" wide>
      {device && (
        <div className="command-drawer-inner">
          {/* Device header */}
          <div className="command-device-header">
            <div className="command-device-info">
              <strong>{device.hostname}</strong>
              <span className="text-secondary">{device.ip}</span>
            </div>
            {device.vendor && <VendorBadge vendor={device.vendor} />}
          </div>

          {/* Quick action buttons */}
          {actions.length > 0 && (
            <div className="command-actions-grid">
              {actions.map((action) => (
                <Button
                  key={action.id}
                  variant="secondary"
                  size="sm"
                  onClick={() => runCommand(action.label, action.command)}
                  title={action.command}
                >
                  <Icon name="play_arrow" size={14} />
                  {action.label}
                </Button>
              ))}
            </div>
          )}

          {/* Free-form command input */}
          <div className="command-input-row">
            <span className="command-prompt">&gt;</span>
            <input
              type="text"
              className="form-input"
              value={customCommand}
              onChange={(e) => setCustomCommand(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Enter command..."
            />
            <Button onClick={handleRunCustom} disabled={!customCommand.trim()} size="sm">
              <Icon name="send" size={14} />
              Run
            </Button>
          </div>

          {/* Command output history */}
          <div className="command-history" ref={historyRef}>
            {history.length === 0 && (
              <div className="command-empty">
                <Icon name="terminal" size={24} />
                <p>Run a command to see output here</p>
              </div>
            )}
            {history.map((entry) => (
              <div key={entry.jobId} className="command-entry">
                <div className="command-entry-header">
                  <code className="command-entry-label">{entry.label}</code>
                  {entry.loading && <SpinnerIcon size={14} />}
                </div>
                {entry.result && (
                  <pre className="command-entry-output">
                    {entry.result.error
                      ? `Error: ${entry.result.error}`
                      : entry.result.output || '(no output)'}
                  </pre>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </Drawer>
  );
}
