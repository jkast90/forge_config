import { useAsyncModal, getServices } from '@core';
import type { ConnectResult } from '@core';
import { Button } from './Button';
import { DialogActions } from './DialogActions';
import { Modal } from './Modal';
import { ModalLoading } from './LoadingState';
import { ResultItem } from './ResultItem';

interface ConnectTarget {
  ip: string;
  hostname?: string;
  vendor?: string;
  mac?: string;
}

interface ConnectModalState {
  isOpen: boolean;
  loading: boolean;
  item: ConnectTarget | null;
  result: ConnectResult | null;
  open: (target: ConnectTarget) => void;
  close: () => void;
}

export function useConnectModal(): ConnectModalState {
  const modal = useAsyncModal<ConnectTarget, ConnectResult>();

  const open = async (target: ConnectTarget) => {
    modal.open(target);
    const result = await modal.execute(async () => {
      const services = getServices();
      // If the target has a MAC that's a registered device, use the device connect endpoint
      // Otherwise use the generic IP-based connect
      return services.devices.connectByIp(target.ip, { vendor: target.vendor });
    });
    if (!result && !modal.result) {
      modal.setResult({
        ping: { reachable: false, error: 'Connection failed' },
        ssh: { connected: false, error: 'Could not attempt SSH' },
        success: false,
      });
    }
  };

  return {
    isOpen: modal.isOpen,
    loading: modal.loading,
    item: modal.item,
    result: modal.result,
    open,
    close: modal.close,
  };
}

interface ConnectModalProps {
  modal: ConnectModalState;
}

export function ConnectModal({ modal }: ConnectModalProps) {
  if (!modal.isOpen || !modal.item) return null;

  const title = modal.item.hostname
    ? `Connection Test: ${modal.item.hostname}`
    : `Connection Test: ${modal.item.ip}`;

  return (
    <Modal title={title} onClose={modal.close}>
      {modal.loading ? (
        <ModalLoading message={`Testing connectivity to ${modal.item.ip}...`} />
      ) : modal.result ? (
        <div className="connect-results">
          <ResultItem icon={modal.result.ping.reachable ? 'check_circle' : 'cancel'} title="Ping">
            {modal.result.ping.reachable ? (
              <span className="status online">
                Reachable {modal.result.ping.latency && `(${modal.result.ping.latency})`}
              </span>
            ) : (
              <span className="status offline">
                {modal.result.ping.error || 'Unreachable'}
              </span>
            )}
          </ResultItem>

          <ResultItem icon={modal.result.ssh.connected ? 'check_circle' : 'cancel'} title="SSH">
            {modal.result.ssh.connected ? (
              <span className="status online">Connected</span>
            ) : (
              <span className="status offline">
                {modal.result.ssh.error || 'Failed'}
              </span>
            )}
          </ResultItem>

          {modal.result.ssh.uptime && (
            <ResultItem icon="schedule" title="Uptime">
              <code className="code-sm">{modal.result.ssh.uptime}</code>
            </ResultItem>
          )}

          {modal.result.ssh.hostname && (
            <ResultItem icon="dns" title="Hostname">
              <code className="code-sm">{modal.result.ssh.hostname}</code>
            </ResultItem>
          )}

          {modal.result.ssh.version && (
            <ResultItem icon="info" title="Version / Platform">
              <pre className="pre-scrollable">{modal.result.ssh.version}</pre>
            </ResultItem>
          )}

          {modal.result.ssh.interfaces && (
            <ResultItem icon="lan" title="Interfaces">
              <pre className="pre-scrollable">{modal.result.ssh.interfaces}</pre>
            </ResultItem>
          )}
        </div>
      ) : null}

      <DialogActions>
        <Button
          variant="primary"
          onClick={() => modal.open(modal.item!)}
          disabled={modal.loading}
        >
          Retest
        </Button>
        <Button variant="secondary" onClick={modal.close}>
          Close
        </Button>
      </DialogActions>
    </Modal>
  );
}
