import { useState, useEffect } from 'react';
import type { DiscoveredDevice, DeviceFormData } from '@core';
import {
  useDiscovery,
  useModalRoute,
  lookupVendorByMac,
  createDeviceFromDiscovery,
  getDhcpInfoItems,
  formatDate,
  formatExpiry,
  formatEventType,
  getEventTypeIcon,
} from '@core';
import { Button } from './Button';
import { IconButton } from './IconButton';
import { Card } from './Card';
import { ConnectModal, useConnectModal } from './ConnectModal';
import { InfoSection } from './InfoSection';
import { LoadingState } from './LoadingState';

import { Table, Cell } from './Table';
import type { TableColumn, TableAction } from './Table';
import { VendorBadge } from './VendorBadge';
import { Icon, PlusIcon, RefreshIcon, SpinnerIcon, TrashIcon, loadingIcon } from './Icon';
interface Props {
  onAddDevice: (device: Partial<DeviceFormData>) => void;
}

export function Discovery({ onAddDevice }: Props) {
  const {
    discovered,
    allLeases,
    logs,
    loading,
    logsLoading,
    error,
    refresh,
    dismiss,
    fetchLogs: loadLogs,
    clearLogs,
    clearKnownDevices,
  } = useDiscovery({ autoRefresh: true, refreshInterval: 10000 });

  const connectModal = useConnectModal();
  const modalRoute = useModalRoute();

  // Restore connect modal from URL hash
  useEffect(() => {
    if (modalRoute.isModal('connect') && !connectModal.isOpen) {
      const ip = modalRoute.getParam('ip');
      if (ip) {
        const device = discovered.find(d => d.ip === ip);
        connectModal.open({ ip, hostname: device?.hostname, vendor: device?.vendor });
      }
    }
  }, [modalRoute.modal, discovered]);

  const [showAllLeases, setShowAllLeases] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [showInfo, setShowInfo] = useState(false);

  const handleAddDevice = (device: DiscoveredDevice) => {
    onAddDevice(createDeviceFromDiscovery(device));
  };

  // Check if any discovered device has a given DHCP field populated
  const anyHas = (field: keyof DiscoveredDevice) =>
    discovered.some((d) => d[field]);

  // Render DHCP request metadata as compact badges (used in "All Leases" table)
  const renderDhcpInfo = (d: DiscoveredDevice) => {
    const items = getDhcpInfoItems(d);
    if (items.length === 0) return '—';
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
        {items.map((item, i) => (
          <span key={i} className="dhcp-badge">
            {item}
          </span>
        ))}
      </div>
    );
  };

  return (
    <LoadingState loading={loading && discovered.length === 0} error={error} loadingMessage="Scanning for devices...">
      <Card
        title={`Discovered Devices (${discovered.length})`}
        titleAction={<InfoSection.Toggle open={showInfo} onToggle={setShowInfo} />}
        headerAction={
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span className="helper-text-sm" style={{ opacity: 0.5, fontSize: 11 }}>Auto-refreshes every 10s</span>
            <Button variant="secondary" onClick={() => setShowAllLeases(!showAllLeases)}>
              <Icon name={showAllLeases ? 'visibility_off' : 'visibility'} size={16} />
              {showAllLeases ? 'Show New Only' : 'Show All Leases'}
            </Button>
            <Button variant="secondary" onClick={() => setShowLog(!showLog)}>
              <Icon name="history" size={16} />
              {showLog ? 'Hide Log' : 'Show Log'}
            </Button>
            {discovered.length > 0 && (
              <Button variant="secondary" onClick={async () => { await clearKnownDevices(); refresh(); }}>
                <Icon name="restart_alt" size={16} />
                Clear &amp; Rediscover
              </Button>
            )}
            <Button onClick={refresh}>
              <RefreshIcon size={16} />
              Refresh
            </Button>
          </div>
        }
      >
        <InfoSection open={showInfo}>
          <div>
            <p>
              This page shows devices that have received a DHCP lease from the ZTP server but have not yet been configured.
              Click "Add" to create a device configuration entry, which will allow the device to receive its provisioning config.
            </p>
            <ul>
              <li>Discovered devices are automatically detected from the DHCP lease file</li>
              <li>Once added, devices will appear in the main Devices list</li>
              <li>The lease expiry shows how long until the DHCP lease needs to be renewed</li>
            </ul>
          </div>
        </InfoSection>
        <Table
          data={discovered}
          columns={[
            { header: 'MAC Address', accessor: (d) => Cell.code(d.mac), searchValue: (d) => d.mac },
            { header: 'IP Address', accessor: 'ip' },
            { header: 'Hostname', accessor: (d) => Cell.dash(d.hostname), searchValue: (d) => d.hostname || '' },
            { header: 'Vendor', accessor: (d) => <VendorBadge vendor={d.vendor || lookupVendorByMac(d.mac)} />, searchValue: (d) => d.vendor || '' },
            ...(anyHas('model') ? [{ header: 'Model', accessor: (d: DiscoveredDevice) => Cell.dash(d.model), searchValue: (d: DiscoveredDevice) => d.model || '' }] : []),
            {
              header: 'Lease Expires',
              accessor: (d) => <span className="status online">{formatExpiry(d.expires_at || new Date(d.expiry_time * 1000).toISOString())}</span>,
              searchable: false,
            },
          ] as TableColumn<DiscoveredDevice>[]}
          getRowKey={(d) => d.mac}
          tableId="discovery"
          actions={[
            {
              icon: (d) => loadingIcon(connectModal.loading && connectModal.item?.ip === d.ip, 'cable'),
              label: 'Test',
              onClick: (d) => { connectModal.open({ ip: d.ip, hostname: d.hostname, vendor: d.vendor }); modalRoute.openModal('connect', { ip: d.ip }); },
              variant: 'secondary',
              tooltip: 'Test connectivity',
              loading: (d) => connectModal.loading && connectModal.item?.ip === d.ip,
            },
            {
              icon: <Icon name="playlist_add" size={14} />,
              label: 'Add as device',
              onClick: handleAddDevice,
              tooltip: 'Add as device',
            },
            {
              icon: <TrashIcon size={14} />,
              label: 'Dismiss',
              onClick: (d) => dismiss(d.mac),
              variant: 'danger',
              tooltip: 'Dismiss from discovery',
            },
          ] as TableAction<DiscoveredDevice>[]}
          renderExpandedRow={(d) => (
            <div className="detail-grid">
              {d.serial_number && <DetailItem label="Serial Number" value={d.serial_number} />}
              {d.vendor_class && <DetailItem label="Vendor Class" value={d.vendor_class} />}
              {d.user_class && <DetailItem label="User Class" value={d.user_class} />}
              {d.dhcp_client_id && <DetailItem label="Client ID" value={d.dhcp_client_id} />}
              {d.relay_address && <DetailItem label="Relay Address" value={d.relay_address} />}
              {d.circuit_id && <DetailItem label="Circuit ID" value={d.circuit_id} />}
              {d.remote_id && <DetailItem label="Remote ID" value={d.remote_id} />}
              {d.subscriber_id && <DetailItem label="Subscriber ID" value={d.subscriber_id} />}
              {d.requested_options && <DetailItem label="Requested Options" value={d.requested_options} />}
            </div>
          )}
          searchable
          searchPlaceholder="Search discovered devices..."
          emptyMessage="No new devices discovered."
          emptyDescription="Devices that have received a DHCP lease but are not yet configured will appear here."
        />
      </Card>

      {showAllLeases && (
        <Card title={`All DHCP Leases (${allLeases.length})`}>
          <Table
            data={allLeases}
            columns={[
              { header: 'MAC Address', accessor: (d) => Cell.code(d.mac), searchValue: (d) => d.mac },
              { header: 'Vendor', accessor: (d) => <VendorBadge vendor={d.vendor || lookupVendorByMac(d.mac)} />, searchValue: (d) => d.vendor || '' },
              { header: 'DHCP Info', accessor: (d) => renderDhcpInfo(d), searchable: false },
              { header: 'IP Address', accessor: 'ip' },
              { header: 'Hostname', accessor: (d) => Cell.dash(d.hostname), searchValue: (d) => d.hostname || '' },
              { header: 'Lease Expires', accessor: (d) => formatExpiry(d.expires_at || new Date(d.expiry_time * 1000).toISOString()), searchable: false },
              {
                header: 'Status',
                accessor: (d) => {
                  const isKnown = !discovered.find(disc => disc.mac === d.mac);
                  return (
                    <span className={`status ${isKnown ? 'online' : 'provisioning'}`}>
                      {isKnown ? 'Configured' : 'New'}
                    </span>
                  );
                },
                searchValue: (d) => !discovered.find(disc => disc.mac === d.mac) ? 'Configured' : 'New',
              },
            ] as TableColumn<DiscoveredDevice>[]}
            getRowKey={(d) => d.mac}
            tableId="dhcp-leases"
            searchable
            searchPlaceholder="Search leases..."
            paginate
            pageSize={25}
            emptyMessage="No DHCP leases found."
            emptyDescription="Make sure devices are connected and requesting DHCP addresses."
          />
        </Card>
      )}

      {showLog && (
        <Card
          title={`Discovery Log (${logs.length})`}
          headerAction={
            <div className="flex-row">
              <IconButton variant="secondary" onClick={() => loadLogs()} disabled={logsLoading}>
                {logsLoading ? <SpinnerIcon size={14} /> : <RefreshIcon size={14} />}
              </IconButton>
              {logs.length > 0 && (
                <Button size="sm" variant="secondary" onClick={clearLogs}>
                  <Icon name="delete" size={14} />
                  Clear
                </Button>
              )}
            </div>
          }
        >
          {logsLoading && logs.length === 0 ? (
            <div className="empty-state">
              <SpinnerIcon size={32} />
              <p>Loading discovery log...</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="empty-state">
              <Icon name="history" size={48} />
              <p>No discovery events logged yet.</p>
              <p className="helper-text">
                Events will appear here when devices are discovered or leases are renewed.
              </p>
            </div>
          ) : (
            <div className="discovery-log">
              {logs.map((log) => (
                <div key={log.id} className="discovery-log-entry">
                  <div className="discovery-log-icon">
                    <Icon name={getEventTypeIcon(log.event_type)} size={18} />
                  </div>
                  <div className="discovery-log-content">
                    <div className="discovery-log-header">
                      <span className={`discovery-log-type ${log.event_type}`}>
                        {formatEventType(log.event_type)}
                      </span>
                      <code>{log.mac}</code>
                      <span className="discovery-log-ip">{log.ip}</span>
                    </div>
                    <div className="discovery-log-details">
                      {log.hostname && <span>{log.hostname}</span>}
                      {log.message && <span className="discovery-log-message">{log.message}</span>}
                    </div>
                  </div>
                  <div className="discovery-log-time">
                    {formatDate(log.created_at)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      <ConnectModal modal={{ ...connectModal, close: () => { connectModal.close(); modalRoute.closeModal(); } }} />
    </LoadingState>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="detail-item">
      <span className="detail-label">{label}</span>
      <span className="detail-value">{value}</span>
    </div>
  );
}
