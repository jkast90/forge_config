import { useState, useEffect, useMemo } from 'react';
import type { SpawnContainerRequest } from '@core';
import {
  useTestContainers,
  useVendors,
  useModalRoute,
  usePersistedSet,
  CONFIG_METHOD_OPTIONS,
  createChangeHandler,
  generateMac,
  getVendorPrefixOptions,
  getVendorClassForVendor,
  getServices,
  addNotification,
} from '@core';
import { Button } from './Button';
import { Card } from './Card';
import { ConnectModal, useConnectModal } from './ConnectModal';
import { FormDialog } from './FormDialog';
import { FormField } from './FormField';
import { InfoSection } from './InfoSection';
import { LoadingState } from './LoadingState';
import { SelectField } from './SelectField';

import { Table, Cell } from './Table';
import type { TableAction } from './Table';
import type { TestContainer as TestContainerType } from '@core';
import { Icon, PlusIcon, RefreshIcon, SpinnerIcon, TrashIcon, loadingIcon } from './Icon';

export function TestContainers() {
  const {
    containers,
    loading,
    error,
    refresh,
    spawn,
    start,
    restart,
    remove,
  } = useTestContainers({ autoRefresh: true, refreshInterval: 5000 });
  const { vendors } = useVendors();

  const connectModal = useConnectModal();
  const modalRoute = useModalRoute();
  const [selectedIds, setSelectedIds] = usePersistedSet('containers_selected');

  // Restore modals from URL hash
  useEffect(() => {
    if (modalRoute.isModal('spawn') && !showSpawnDialog) {
      handleOpenDialog();
    }
    if (modalRoute.isModal('connect') && !connectModal.isOpen) {
      const ip = modalRoute.getParam('ip');
      if (ip) {
        const container = containers.find(c => c.ip === ip);
        connectModal.open({ ip, hostname: container?.hostname });
      }
    }
  }, [modalRoute.modal, containers]);

  const [showInfo, setShowInfo] = useState(false);
  const [showSpawnDialog, setShowSpawnDialog] = useState(false);
  const [spawning, setSpawning] = useState(false);
  const [spawningCeos, setSpawningCeos] = useState(false);
  const [buildingClos, setBuildingClos] = useState(false);
  const [formData, setFormData] = useState<SpawnContainerRequest>({
    hostname: '',
    mac: '',
    vendor_class: '',
    config_method: 'tftp',
  });
  const [selectedVendorPrefix, setSelectedVendorPrefix] = useState('');

  const handleFormChange = useMemo(() => createChangeHandler<SpawnContainerRequest>(
    (name, value) => setFormData(prev => ({ ...prev, [name]: value }))
  ), []);

  // Get vendor prefix options from API vendors
  const vendorPrefixOptions = useMemo(() => getVendorPrefixOptions(vendors), [vendors]);

  // Build vendor class options from API vendors
  const vendorClassOptions = useMemo(() => [
    { value: '', label: 'None (random)' },
    ...vendors.map(v => ({ value: getVendorClassForVendor(v.id) || v.name, label: v.name })),
  ], [vendors]);

  const handleGenerateMac = () => {
    const mac = generateMac(selectedVendorPrefix || undefined);
    setFormData(prev => ({ ...prev, mac }));
  };

  const handleVendorPrefixChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const prefix = e.target.value;
    setSelectedVendorPrefix(prefix);
    // Auto-generate MAC with new prefix
    const mac = generateMac(prefix || undefined);
    // Find the vendor name for this prefix and auto-fill vendor class
    const selectedOption = vendorPrefixOptions.find(opt => opt.value === prefix);
    const vendorClass = selectedOption ? getVendorClassForVendor(selectedOption.vendor) : '';
    setFormData(prev => ({ ...prev, mac, vendor_class: vendorClass }));
  };

  const handleSpawn = async (e: React.FormEvent) => {
    e.preventDefault();
    setSpawning(true);
    try {
      await spawn(formData);
      setShowSpawnDialog(false);
      modalRoute.closeModal();
      setFormData({ hostname: '', mac: '', vendor_class: '', config_method: 'tftp' });
      setSelectedVendorPrefix('');
    } finally {
      setSpawning(false);
    }
  };

  const handleSpawnCeos = async () => {
    setSpawningCeos(true);
    try {
      await spawn({ image: 'ceosimage:latest' });
    } finally {
      setSpawningCeos(false);
    }
  };

  const handleSpawnFrr = async () => {
    setSpawningCeos(true);
    try {
      await spawn({ image: 'frr-client:latest' });
    } finally {
      setSpawningCeos(false);
    }
  };

  const handleBuildClosLab = async (image?: string) => {
    setBuildingClos(true);
    try {
      const result = await getServices().testContainers.buildVirtualClos({
        spines: 2,
        leaves: 2,
        external_devices: 0,
        spawn_containers: true,
        ceos_image: image || '',
      });
      const type_ = image?.includes('frr') ? 'FRR' : 'cEOS';
      addNotification('success', `CLOS lab ready: ${result.devices.length} ${type_} switches in ${result.topology_name}`);
      refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      addNotification('error', `Failed to build CLOS lab: ${msg}`);
    } finally {
      setBuildingClos(false);
    }
  };

  const handleTeardownClosLab = async () => {
    try {
      await getServices().testContainers.teardownVirtualClos();
      addNotification('success', 'CLOS lab torn down');
      refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      addNotification('error', `Failed to teardown CLOS lab: ${msg}`);
    }
  };

  const handleOpenDialog = () => {
    // Generate initial MAC
    const mac = generateMac();
    setFormData({ hostname: '', mac, vendor_class: '', config_method: 'tftp' });
    setSelectedVendorPrefix('');
    setShowSpawnDialog(true);
    modalRoute.openModal('spawn');
  };

  return (
    <>
    <LoadingState loading={loading && containers.length === 0} loadingMessage="Loading test containers...">
      <Card title="Test Containers" titleAction={<InfoSection.Toggle open={showInfo} onToggle={setShowInfo} />}>
        <InfoSection open={showInfo}>
          <div>
            <p>
              Test containers simulate network devices requesting DHCP leases. They will appear in the Discovery page
              if not yet configured as a device. Use these to test your ZTP workflow end-to-end.
            </p>
            <ul>
              <li>Each container runs a DHCP client and SSH server</li>
              <li>You can specify a vendor MAC prefix to simulate specific equipment</li>
              <li>DHCP vendor class identifier helps identify the device type</li>
              <li>Config fetch method: TFTP (traditional), HTTP (modern), or both</li>
            </ul>
          </div>
        </InfoSection>
        <div className="actions-bar" style={{ marginBottom: '16px' }}>
          <Button onClick={handleOpenDialog}>
            <PlusIcon size={16} />
            Spawn Test Device
          </Button>
          <Button onClick={handleSpawnCeos} disabled={spawningCeos}>
            <PlusIcon size={16} />
            Spawn cEOS
          </Button>
          <Button onClick={handleSpawnFrr} disabled={spawningCeos}>
            <PlusIcon size={16} />
            Spawn FRR
          </Button>
          <Button onClick={() => handleBuildClosLab()} disabled={buildingClos}>
            <Icon name="hub" size={16} />
            {buildingClos ? 'Building...' : 'CLOS cEOS'}
          </Button>
          <Button onClick={() => handleBuildClosLab('frr-client:latest')} disabled={buildingClos}>
            <Icon name="hub" size={16} />
            {buildingClos ? 'Building...' : 'CLOS FRR'}
          </Button>
          {containers.some(c => c.name.startsWith('clos-')) && (
            <Button variant="danger" onClick={handleTeardownClosLab}>
              <TrashIcon size={16} />
              Teardown CLOS
            </Button>
          )}
          <Button variant="secondary" onClick={refresh}>
            <RefreshIcon size={16} />
            Refresh
          </Button>
          <span style={{ marginLeft: 'auto', fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
            {containers.length} container{containers.length !== 1 ? 's' : ''} running
          </span>
        </div>

        {error && (
          <div className="message error" style={{ marginBottom: '16px' }}>
            <Icon name="error" size={16} />
            <span>Docker not available: {error}</span>
          </div>
        )}

        <Table<TestContainerType>
          data={containers}
          columns={[
            { header: 'Hostname', accessor: 'hostname' },
            { header: 'MAC Address', accessor: (c) => Cell.code(c.mac), searchValue: (c) => c.mac },
            { header: 'IP Address', accessor: (c) => Cell.dash(c.ip), searchValue: (c) => c.ip || '' },
            { header: 'Status', accessor: (c) => Cell.status(c.status, c.status === 'running' ? 'online' : 'offline'), searchValue: (c) => c.status },
          ]}
          getRowKey={(c) => c.id}
          tableId="test-containers"
          actions={[
            {
              icon: (c) => loadingIcon(connectModal.loading && connectModal.item?.ip === c.ip, 'cable'),
              label: 'Test connectivity',
              onClick: (c) => { connectModal.open({ ip: c.ip, hostname: c.hostname }); modalRoute.openModal('connect', { ip: c.ip }); },
              variant: 'secondary',
              tooltip: 'Test connectivity',
              disabled: (c) => !c.ip,
              loading: (c) => connectModal.loading && connectModal.item?.ip === c.ip,
            },
            {
              icon: <Icon name="play_arrow" size={14} />,
              label: 'Start',
              onClick: (c) => start(c.id),
              variant: 'secondary',
              tooltip: 'Start container',
              show: (c) => c.status !== 'running',
            },
            {
              icon: <Icon name="restart_alt" size={14} />,
              label: 'Restart',
              onClick: (c) => restart(c.id),
              variant: 'secondary',
              tooltip: 'Restart container',
              bulk: true,
            },
            {
              icon: <TrashIcon size={14} />,
              label: 'Remove',
              onClick: (c) => remove(c.id),
              variant: 'danger',
              tooltip: 'Remove container',
              bulk: true,
              bulkConfirm: (rows) => ({
                title: `Remove ${rows.length} Containers`,
                message: `This will remove the following containers:\n\n${rows.map(c => `  \u2022 ${c.hostname}`).join('\n')}\n\nThis cannot be undone.`,
                confirmText: 'Remove All',
              }),
            },
          ] as TableAction<TestContainerType>[]}
          selectable
          selectedKeys={selectedIds}
          onSelectionChange={setSelectedIds}
          searchable
          searchPlaceholder="Search containers..."
          emptyMessage="No test containers running."
          emptyDescription="Spawn a test device to simulate network equipment requesting DHCP."
        />
      </Card>

    </LoadingState>

      <ConnectModal modal={{ ...connectModal, close: () => { connectModal.close(); modalRoute.closeModal(); } }} />

      <FormDialog
        isOpen={showSpawnDialog}
        onClose={() => { setShowSpawnDialog(false); modalRoute.closeModal(); }}
        title="Spawn Test Device"
        onSubmit={handleSpawn}
        submitText="Spawn Container"
        saving={spawning}
        variant="wide"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <FormField
            label="Hostname"
            name="hostname"
            type="text"
            value={formData.hostname || ''}
            onChange={handleFormChange}
            placeholder="test-switch-01 (auto-generated if empty)"
          />

          <div>
            <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>
              MAC Address Vendor Prefix
            </label>
            <SelectField
              label=""
              name="vendor_prefix"
              value={selectedVendorPrefix}
              onChange={handleVendorPrefixChange}
              options={vendorPrefixOptions}
            />
            <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
              Select a vendor to use their OUI prefix, or leave random for a locally-administered MAC
            </p>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>
              MAC Address
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                name="mac"
                value={formData.mac || ''}
                onChange={handleFormChange}
                placeholder="aa:bb:cc:dd:ee:ff"
                style={{ flex: 1 }}
              />
              <Button type="button" variant="secondary" onClick={handleGenerateMac}>
                <RefreshIcon size={14} />
                Generate
              </Button>
            </div>
          </div>

          <SelectField
            label="DHCP Vendor Class (Option 60)"
            name="vendor_class"
            value={formData.vendor_class || ''}
            onChange={handleFormChange}
            options={vendorClassOptions}
          />
          <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '-12px' }}>
            The vendor class identifier is sent in DHCP requests to identify the device type
          </p>

          <div>
            <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>
              Config Fetch Method
            </label>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              {CONFIG_METHOD_OPTIONS.map(option => (
                <label
                  key={option.value}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '8px',
                    padding: '8px 12px',
                    border: `2px solid ${formData.config_method === option.value ? 'var(--color-primary)' : 'var(--color-border)'}`,
                    borderRadius: '6px',
                    cursor: 'pointer',
                    backgroundColor: formData.config_method === option.value ? 'var(--color-bg-secondary)' : 'transparent',
                    flex: '1',
                    minWidth: '140px',
                  }}
                >
                  <input
                    type="radio"
                    name="config_method"
                    value={option.value}
                    checked={formData.config_method === option.value}
                    onChange={handleFormChange}
                    style={{ marginTop: '2px' }}
                  />
                  <div>
                    <div style={{ fontWeight: 500 }}>{option.label}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
                      {option.description}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <details style={{ marginTop: '8px' }}>
            <summary style={{ cursor: 'pointer', fontWeight: 500, marginBottom: '8px' }}>
              Configured Vendor MAC Prefixes (OUI Reference)
            </summary>
            <div style={{
              maxHeight: '200px',
              overflow: 'auto',
              fontSize: '0.75rem',
              backgroundColor: 'var(--color-bg-secondary)',
              padding: '12px',
              borderRadius: '4px',
            }}>
              <table style={{ width: '100%', fontSize: 'inherit' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '4px 8px' }}>Vendor</th>
                    <th style={{ textAlign: 'left', padding: '4px 8px' }}>MAC Prefixes (OUI)</th>
                  </tr>
                </thead>
                <tbody>
                  {vendors.filter(v => v.mac_prefixes && v.mac_prefixes.length > 0).map(v => (
                    <tr key={v.id}>
                      <td style={{ padding: '4px 8px', verticalAlign: 'top' }}>{v.name}</td>
                      <td style={{ padding: '4px 8px' }}>
                        <code style={{ fontSize: '0.7rem' }}>
                          {v.mac_prefixes.slice(0, 5).join(', ')}
                          {v.mac_prefixes.length > 5 && ` (+${v.mac_prefixes.length - 5} more)`}
                        </code>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </div>
      </FormDialog>
    </>
  );
}
