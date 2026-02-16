import { useState, useEffect, useCallback } from 'react';
import { useBackups, useDevices, useTopologies, useAsyncModal, useModalRoute, useWebSocket, usePersistedSet, formatDate, getServices, addNotification, navigateAction } from '@core';
import type { Device, ConfigResult, BackupContentResult, ConfigPreviewResult, Backup, NetBoxStatus, Job, TopologyRole } from '@core';
import { Button } from './Button';
import { Card } from './Card';
import { useConfirm } from './ConfirmDialog';
import { ConnectModal, useConnectModal } from './ConnectModal';
import { DialogActions } from './DialogActions';
import { FormDialog } from './FormDialog';
import { InfoSection } from './InfoSection';
import { Modal } from './Modal';
import { SelectField } from './SelectField';
import { ModalLoading } from './LoadingState';
import { ResultItem } from './ResultItem';
import { Table, Cell } from './Table';
import type { TableColumn, TableAction } from './Table';
import { ConfigViewer } from './ConfigViewer';
import { CommandDrawer } from './CommandDrawer';
import { DevicePortAssignments } from './DevicePortAssignments';
import { Icon, EditIcon, DownloadIcon, ClockIcon, TrashIcon, SpinnerIcon, loadingIcon } from './Icon';

interface Props {
  onEdit: (device: Device) => void;
  onDelete: (id: number) => Promise<boolean>;
  onBackup: (id: number) => Promise<boolean>;
  onRefresh?: () => void;
}

type NetBoxSyncResult = { message: string; result: { created: number; updated: number; errors?: string[] } };

export function DeviceList({ onEdit, onDelete, onBackup, onRefresh }: Props) {
  const { confirm, ConfirmDialogRenderer } = useConfirm();
  const { devices } = useDevices();
  const modalRoute = useModalRoute();

  const [showInfo, setShowInfo] = useState(false);
  const [selectedDeviceIds, setSelectedDeviceIds] = usePersistedSet('devices_selected');
  const [commandDevice, setCommandDevice] = useState<Device | null>(null);
  const [portsDevice, setPortsDevice] = useState<Device | null>(null);

  // Connection test modal state (shared with Discovery and TestContainers)
  const connectModal = useConnectModal();

  // Config viewer modal state
  const configModal = useAsyncModal<Device, ConfigResult>();
  const [configTab, setConfigTab] = useState<'tftp' | 'backups'>('tftp');
  const [selectedBackup, setSelectedBackup] = useState<Backup | null>(null);
  const [backupContentLoading, setBackupContentLoading] = useState(false);
  const [backupContent, setBackupContent] = useState<BackupContentResult | null>(null);

  // NetBox modal state
  const netboxModal = useAsyncModal<Device, NetBoxStatus>();
  const [netboxSyncResult, setNetboxSyncResult] = useState<NetBoxSyncResult | null>(null);

  // Config preview + deploy modal state
  const previewModal = useAsyncModal<Device, ConfigPreviewResult>();
  const [deployJob, setDeployJob] = useState<Job | null>(null);
  const [deploying, setDeploying] = useState(false);

  const { topologies } = useTopologies();
  const [topoAssign, setTopoAssign] = useState<{ device: Device; topologyId: string; role: TopologyRole } | null>(null);

  const { backups, loading: backupsLoading, loadBackups, clear: clearBackups } = useBackups();

  // Handle deploy job updates via WebSocket
  const onJobUpdate = useCallback((job: Job) => {
    setDeployJob((prev) => {
      if (!prev || prev.id !== job.id) return prev;
      return job;
    });
    if (job.status === 'completed' || job.status === 'failed') {
      setDeploying(false);
      if (job.status === 'completed' && onRefresh) {
        onRefresh();
      }
    }
  }, [onRefresh]);

  useWebSocket({ onJobUpdate });

  // Restore modal state from URL hash
  useEffect(() => {
    if (devices.length === 0) return;
    const idParam = modalRoute.getParam('id');
    const device = idParam ? devices.find(d => d.id === Number(idParam)) : undefined;
    if (!device) return;

    if (modalRoute.isModal('config') && !configModal.isOpen) {
      handleViewConfig(device);
    } else if (modalRoute.isModal('netbox') && !netboxModal.isOpen) {
      handleShowNetbox(device);
    } else if (modalRoute.isModal('preview') && !previewModal.isOpen) {
      handlePreviewConfig(device);
    } else if (modalRoute.isModal('connect') && !connectModal.isOpen) {
      connectModal.open({ ip: device.ip, hostname: device.hostname, vendor: device.vendor });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalRoute.modal, devices.length]);

  const handleViewConfig = async (device: Device) => {
    configModal.open(device);
    modalRoute.openModal('config', { id: String(device.id) });
    setConfigTab('tftp');
    setSelectedBackup(null);
    setBackupContent(null);
    // Load both TFTP config and backups in parallel
    const result = await configModal.execute(async () => {
      const services = getServices();
      const [configRes] = await Promise.all([
        services.devices.getConfig(device.id),
        loadBackups(device.id),
      ]);
      return configRes;
    });
    // Handle failure - set a fallback result
    if (!result && !configModal.result) {
      configModal.setResult({
        mac: device.mac || '',
        hostname: device.hostname,
        filename: '',
        content: '',
        exists: false,
      });
    }
  };

  const handleCloseConfig = () => {
    configModal.close();
    modalRoute.closeModal();
    setSelectedBackup(null);
    setBackupContent(null);
    clearBackups();
  };

  const handleViewBackupContent = async (backup: Backup) => {
    setSelectedBackup(backup);
    setBackupContent(null);
    setBackupContentLoading(true);
    try {
      const services = getServices();
      const result = await services.devices.getBackupContent(backup.id);
      setBackupContent(result);
    } catch (err) {
      setBackupContent({
        id: backup.id,
        filename: backup.filename,
        content: '',
        exists: false,
      });
    } finally {
      setBackupContentLoading(false);
    }
  };

  const handleShowNetbox = async (device: Device) => {
    netboxModal.open(device);
    modalRoute.openModal('netbox', { id: String(device.id) });
    setNetboxSyncResult(null);
    const result = await netboxModal.execute(async () => {
      const services = getServices();
      return services.netbox.getStatus();
    });
    // Handle failure - set a fallback result
    if (!result && !netboxModal.result) {
      netboxModal.setResult({
        connected: false,
        configured: false,
        error: 'Failed to check NetBox status',
      });
    }
  };

  const handlePushToNetbox = async () => {
    if (!netboxModal.item) return;
    netboxModal.setLoading(true);
    try {
      const services = getServices();
      const result = await services.netbox.syncPush();
      setNetboxSyncResult(result);
    } catch (err) {
      setNetboxSyncResult({
        message: 'Sync failed',
        result: { created: 0, updated: 0, errors: [err instanceof Error ? err.message : 'Unknown error'] },
      });
    } finally {
      netboxModal.setLoading(false);
    }
  };

  const handleCloseNetbox = () => {
    netboxModal.close();
    modalRoute.closeModal();
    setNetboxSyncResult(null);
  };

  const handlePreviewConfig = async (device: Device) => {
    previewModal.open(device);
    modalRoute.openModal('preview', { id: String(device.id) });
    setDeployJob(null);
    await previewModal.execute(async () => {
      const services = getServices();
      return services.devices.previewConfig(device.id);
    });
  };

  const handleDeployConfig = async () => {
    if (!previewModal.item) return;
    if (!(await confirm({ title: 'Deploy Configuration', message: `Deploy configuration to ${previewModal.item.hostname} (${previewModal.item.ip})? This will push the config via SSH.`, confirmText: 'Deploy' }))) return;
    setDeploying(true);
    setDeployJob(null);
    try {
      const services = getServices();
      const job = await services.devices.deployConfig(previewModal.item.id);
      setDeployJob(job);
      // Job result will arrive via WebSocket
    } catch (err) {
      setDeployJob({
        id: `error-${Date.now()}`,
        job_type: 'deploy',
        device_id: previewModal.item.id,
        command: '',
        status: 'failed',
        output: null,
        error: err instanceof Error ? err.message : 'Deploy failed',
        created_at: new Date().toISOString(),
        started_at: null,
        completed_at: null,
      });
      setDeploying(false);
    }
  };

  const handleDiffConfig = async () => {
    if (!previewModal.item) return;
    const hostname = previewModal.item.hostname;
    previewModal.close();
    try {
      await getServices().devices.diffConfig(previewModal.item.id);
      addNotification('success', `Diff queued for ${hostname}`, navigateAction('View Jobs', 'jobs', 'history'));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Diff failed';
      addNotification('error', `Diff failed for ${hostname}: ${msg}`, navigateAction('View Jobs', 'jobs', 'history'));
    }
  };

  const handleClosePreview = () => {
    previewModal.close();
    modalRoute.closeModal();
    setDeployJob(null);
    setDeploying(false);
  };

  const handleAssignTopology = async () => {
    if (!topoAssign) return;
    try {
      await getServices().devices.update(topoAssign.device.id, {
        ...topoAssign.device,
        topology_id: topoAssign.topologyId ? Number(topoAssign.topologyId) : undefined,
        topology_role: topoAssign.role,
      });
      addNotification('success', `Assigned ${topoAssign.device.hostname} as ${topoAssign.role} in topology`, navigateAction('View Topologies', 'topologies'));
      setTopoAssign(null);
      if (onRefresh) onRefresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      addNotification('error', `Failed to assign: ${msg}`);
    }
  };

  const columns: TableColumn<Device>[] = [
    { header: 'Hostname', accessor: 'hostname' },
    { header: 'Model', accessor: (d) => Cell.dash(d.model), searchValue: (d) => d.model || '', hideOnMobile: true },
    { header: 'Serial Number', accessor: (d) => Cell.dash(d.serial_number), searchValue: (d) => d.serial_number || '', filterable: false, hideOnMobile: true },
    { header: 'MAC Address', accessor: (d) => Cell.code(d.mac || ''), searchValue: (d) => d.mac || '', filterable: false },
    { header: 'IP Address', accessor: 'ip', filterable: false },
    { header: 'Vendor', accessor: (d) => Cell.dash(d.vendor), searchValue: (d) => d.vendor || '', hideOnMobile: true },
    { header: 'Status', accessor: (d) => Cell.status(d.status, d.status as 'online' | 'offline' | 'provisioning'), searchValue: (d) => d.status },
    { header: 'Type', accessor: (d) => Cell.status(d.device_type || 'internal', d.device_type === 'external' ? 'offline' : d.device_type === 'host' ? 'provisioning' : 'online'), searchValue: (d) => d.device_type || 'internal', hideOnMobile: true },
    { header: 'Last Backup', accessor: (d) => formatDate(d.last_backup), searchable: false, hideOnMobile: true },
  ];

  const actions: TableAction<Device>[] = [
    {
      icon: (d) => loadingIcon(connectModal.loading && connectModal.item?.ip === d.ip, 'cable'),
      label: 'Test connectivity',
      onClick: (d) => { connectModal.open({ ip: d.ip, hostname: d.hostname, vendor: d.vendor }); modalRoute.openModal('connect', { ip: d.ip }); },
      variant: 'secondary',
      tooltip: 'Test connectivity',
      loading: (d) => connectModal.loading && connectModal.item?.ip === d.ip,
    },
    {
      icon: <EditIcon size={14} />,
      label: 'Edit',
      onClick: onEdit,
      variant: 'secondary',
      tooltip: 'Edit device',
    },
    {
      icon: <DownloadIcon size={14} />,
      label: 'Backup',
      onClick: (d) => onBackup(d.id),
      tooltip: 'Trigger backup',
      bulk: true,
    },
    {
      icon: (d) => loadingIcon(configModal.item?.id === d.id && configModal.loading, 'description'),
      label: 'View configs',
      onClick: handleViewConfig,
      variant: 'secondary',
      tooltip: 'View configs',
      loading: (d) => configModal.item?.id === d.id && configModal.loading,
    },
    {
      icon: (d) => loadingIcon(previewModal.item?.id === d.id && previewModal.loading, 'play_arrow'),
      label: 'Preview config',
      onClick: handlePreviewConfig,
      variant: 'secondary',
      tooltip: 'Preview & deploy config',
      loading: (d) => previewModal.item?.id === d.id && previewModal.loading,
      disabled: (d) => !d.config_template && !d.vendor,
    },
    {
      icon: <Icon name="send" size={14} />,
      label: 'Deploy',
      onClick: async (d) => {
        try {
          await getServices().devices.deployConfig(d.id);
          addNotification('success', `Deploy queued for ${d.hostname}`, navigateAction('View Jobs', 'jobs', 'history'));
        } catch {
          addNotification('error', `Failed to deploy to ${d.hostname}`, navigateAction('View Jobs', 'jobs', 'history'));
        }
      },
      variant: 'primary',
      tooltip: 'Deploy config via SSH',
      disabled: (d) => !d.config_template && !d.vendor,
      bulk: true,
      show: () => false, // Hidden from per-row actions, only shown in bulk bar
    },
    {
      icon: (d) => loadingIcon(netboxModal.item?.id === d.id && netboxModal.loading, 'cloud'),
      label: 'NetBox',
      onClick: handleShowNetbox,
      variant: 'secondary',
      tooltip: 'NetBox info',
      loading: (d) => netboxModal.item?.id === d.id && netboxModal.loading,
    },
    {
      icon: <Icon name="terminal" size={14} />,
      label: 'Commands',
      onClick: setCommandDevice,
      variant: 'secondary',
      tooltip: 'Run commands',
    },
    {
      icon: <Icon name="settings_ethernet" size={14} />,
      label: 'Ports',
      onClick: setPortsDevice,
      variant: 'secondary',
      tooltip: 'Port assignments',
    },
    {
      icon: <Icon name="account_tree" size={14} />,
      label: 'Add to topology',
      onClick: (d) => setTopoAssign({ device: d, topologyId: String(d.topology_id || topologies[0]?.id || ''), role: (d.topology_role as TopologyRole) || 'leaf' }),
      variant: 'secondary',
      tooltip: (d) => d.topology_id ? `Topology: ${d.topology_id} (${d.topology_role})` : 'Assign to topology',
    },
    {
      icon: <TrashIcon size={14} />,
      label: 'Delete',
      onClick: async (d) => {
        if (await confirm({ title: 'Delete Device', message: `Delete device ${d.hostname}?`, confirmText: 'Delete', destructive: true })) {
          onDelete(d.id);
        }
      },
      variant: 'danger',
      tooltip: 'Delete device',
      bulk: true,
      bulkOnClick: (d) => { onDelete(d.id); },
      bulkConfirm: (rows) => ({
        title: `Delete ${rows.length} Devices`,
        message: `This will delete the following devices:\n\n${rows.map(d => `  \u2022 ${d.hostname} (${d.ip})`).join('\n')}\n\nThis cannot be undone.`,
        confirmText: 'Delete All',
      }),
    },
  ];

  return (
    <>
      <Card title="Devices" titleAction={<InfoSection.Toggle open={showInfo} onToggle={setShowInfo} />}>
        <InfoSection open={showInfo}>
          <div>
            <p>
              Managed devices that will receive ZTP provisioning. Each device is identified by its MAC address and
              assigned a configuration template that gets rendered with device-specific variables.
            </p>
            <ul>
              <li>Test connectivity via SSH to verify reachability</li>
              <li>View generated TFTP configs and backup history</li>
              <li>Preview and deploy rendered configuration via SSH</li>
              <li>Sync device inventory with NetBox</li>
            </ul>
          </div>
        </InfoSection>
        <Table
          data={devices}
          columns={columns}
          getRowKey={(d) => d.id}
          actions={actions}
          tableId="devices"
          searchable
          searchPlaceholder="Search devices..."
          emptyMessage="No devices configured yet."
          emptyDescription="Add a device using the button above."
          selectable
          selectedKeys={selectedDeviceIds}
          onSelectionChange={setSelectedDeviceIds}
        />
      </Card>

      <ConnectModal modal={{ ...connectModal, close: () => { connectModal.close(); modalRoute.closeModal(); } }} />

      {configModal.isOpen && configModal.item && (
        <Modal title={`Configs: ${configModal.item.hostname}`} onClose={handleCloseConfig} variant="extra-wide"
          footer={
            <DialogActions>
              <Button variant="secondary" onClick={handleCloseConfig}>
                Close
              </Button>
            </DialogActions>
          }
        >
          {configModal.loading ? (
            <ModalLoading message="Loading configurations..." />
          ) : (
            <>
              <div className="config-tabs">
                <button
                  className={`config-tab ${configTab === 'tftp' ? 'active' : ''}`}
                  onClick={() => { setConfigTab('tftp'); setSelectedBackup(null); setBackupContent(null); }}
                >
                  <Icon name="upload" size={14} />
                  TFTP Config
                </button>
                <button
                  className={`config-tab ${configTab === 'backups' ? 'active' : ''}`}
                  onClick={() => setConfigTab('backups')}
                >
                  <ClockIcon size={14} />
                  Backup History ({backups.length})
                </button>
              </div>

              {configTab === 'tftp' && configModal.result && (
                <>
                  {configModal.result.exists ? (
                    <ConfigViewer
                      value={configModal.result.content || ''}
                      label={configModal.result.filename}
                      lineNumbers
                      copyable
                    />
                  ) : (
                    <div className="config-empty">
                      <Icon name="info" size={24} />
                      <p>No configuration file generated for this device yet.</p>
                    </div>
                  )}
                </>
              )}

              {configTab === 'backups' && !selectedBackup && (
                <>
                  {backupsLoading ? (
                    <p>Loading...</p>
                  ) : backups.length === 0 ? (
                    <div className="config-empty">
                      <Icon name="info" size={24} />
                      <p>No backups found for this device.</p>
                    </div>
                  ) : (
                    <div className="backup-list">
                      {backups.map((backup) => (
                        <div key={backup.id} className="backup-item">
                          <button
                            className="backup-filename-link"
                            onClick={() => handleViewBackupContent(backup)}
                          >
                            <Icon name="description" size={14} />
                            {backup.filename}
                          </button>
                          <span>{formatDate(backup.created_at)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {configTab === 'backups' && selectedBackup && (
                <>
                  {backupContentLoading ? (
                    <ModalLoading message="Loading backup content..." />
                  ) : backupContent ? (
                    <>
                      <div className="config-filename">
                        <button
                          className="backup-back-link"
                          onClick={() => { setSelectedBackup(null); setBackupContent(null); }}
                        >
                          <Icon name="arrow_back" size={14} />
                          Back to list
                        </button>
                      </div>
                      {backupContent.exists ? (
                        <ConfigViewer
                          value={backupContent.content || ''}
                          label={backupContent.filename}
                          lineNumbers
                          copyable
                        />
                      ) : (
                        <div className="config-empty">
                          <Icon name="info" size={24} />
                          <p>Backup file not found on disk.</p>
                        </div>
                      )}
                    </>
                  ) : null}
                </>
              )}
            </>
          )}
        </Modal>
      )}

      {previewModal.isOpen && previewModal.item && (
        <Modal title={`Config Preview: ${previewModal.item.hostname}`} onClose={handleClosePreview} variant="extra-wide"
          footer={
            <DialogActions>
              {previewModal.result && (!deployJob || deployJob.status === 'queued' || deployJob.status === 'running') && (
                <>
                  <Button onClick={handleDiffConfig} disabled={deploying} variant="secondary">
                    {deploying ? <SpinnerIcon size={14} /> : <Icon name="compare_arrows" size={14} />}
                    {deploying ? 'Diffing...' : 'Diff'}
                  </Button>
                  <Button onClick={handleDeployConfig} disabled={deploying}>
                    {deploying ? <SpinnerIcon size={14} /> : <Icon name="send" size={14} />}
                    {deploying ? 'Deploying...' : 'Deploy to Device'}
                  </Button>
                </>
              )}
              <Button variant="secondary" onClick={handleClosePreview}>
                Close
              </Button>
            </DialogActions>
          }
        >
          {previewModal.loading ? (
            <ModalLoading message="Rendering configuration..." />
          ) : previewModal.error ? (
            <div className="config-empty">
              <Icon name="cancel" size={24} />
              <p>{previewModal.error}</p>
            </div>
          ) : previewModal.result ? (
            <>
              <ConfigViewer
                value={previewModal.result.content || ''}
                label={`Template: ${previewModal.result.template_name}`}
                lineNumbers
                copyable
              />

              {deployJob && (deployJob.status === 'completed' || deployJob.status === 'failed') && (
                <div className="connect-results" style={{ marginTop: '1rem' }}>
                  <ResultItem icon={deployJob.status === 'completed' ? 'check_circle' : 'cancel'} title="Deploy Result">
                    {deployJob.status === 'completed' ? (
                      <span className="status online">Config deployed successfully</span>
                    ) : (
                      <span className="status offline">{deployJob.error || 'Deploy failed'}</span>
                    )}
                    {deployJob.output && (
                      <pre className="pre-scrollable" style={{ marginTop: '0.5rem' }}>
                        {deployJob.output}
                      </pre>
                    )}
                  </ResultItem>
                </div>
              )}
            </>
          ) : null}
        </Modal>
      )}

      {netboxModal.isOpen && netboxModal.item && (
        <Modal title={`NetBox: ${netboxModal.item.hostname}`} onClose={handleCloseNetbox}
          footer={
            <DialogActions>
              {netboxModal.result?.connected && (
                <Button onClick={handlePushToNetbox} disabled={netboxModal.loading}>
                  {netboxModal.loading ? <SpinnerIcon size={14} /> : <Icon name="cloud_upload" size={14} />}
                  Push to NetBox
                </Button>
              )}
              <Button variant="secondary" onClick={handleCloseNetbox}>
                Close
              </Button>
            </DialogActions>
          }
        >
          {netboxModal.loading && !netboxModal.result ? (
            <ModalLoading message="Checking NetBox connection..." />
          ) : netboxModal.result ? (
            <div className="netbox-info">
              <div className="connect-results">
                <ResultItem icon={netboxModal.result.connected ? 'check_circle' : 'cancel'} title="NetBox Status">
                  {netboxModal.result.connected ? (
                    <span className="status online">Connected to {netboxModal.result.url}</span>
                  ) : netboxModal.result.configured ? (
                    <span className="status offline">{netboxModal.result.error || 'Not connected'}</span>
                  ) : (
                    <span className="status offline">Not configured</span>
                  )}
                </ResultItem>

                <ResultItem icon="dns" title="Device Info">
                  <div className="info-grid">
                    <span className="label">Hostname:</span>
                    <span>{netboxModal.item.hostname}</span>
                    <span className="label">MAC:</span>
                    <code>{netboxModal.item.mac || '—'}</code>
                    <span className="label">IP:</span>
                    <span>{netboxModal.item.ip}</span>
                    <span className="label">Vendor:</span>
                    <span>{netboxModal.item.vendor || '—'}</span>
                    <span className="label">Serial:</span>
                    <span>{netboxModal.item.serial_number || '—'}</span>
                  </div>
                </ResultItem>

                {netboxSyncResult && (
                  <ResultItem icon={netboxSyncResult.result.errors?.length ? 'warning' : 'check_circle'} title="Sync Result">
                    <p>{netboxSyncResult.message}</p>
                    <p className="helper-text-sm">
                      Created: {netboxSyncResult.result.created}, Updated: {netboxSyncResult.result.updated}
                    </p>
                    {netboxSyncResult.result.errors?.map((error, i) => (
                      <p key={i} className="text-sm" style={{ color: 'var(--color-error)' }}>{error}</p>
                    ))}
                  </ResultItem>
                )}
              </div>
            </div>
          ) : null}
        </Modal>
      )}

      <CommandDrawer device={commandDevice} onClose={() => setCommandDevice(null)} />

      {portsDevice && (
        <DevicePortAssignments device={portsDevice} onClose={() => setPortsDevice(null)} />
      )}

      {topoAssign && (
        <FormDialog isOpen={true} onClose={() => setTopoAssign(null)} title={`Assign ${topoAssign.device.hostname} to Topology`} onSubmit={(e) => { e.preventDefault(); handleAssignTopology(); }} submitText="Assign">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <SelectField
              label="Topology"
              name="topo-select"
              value={topoAssign.topologyId}
              onChange={(e) => setTopoAssign({ ...topoAssign, topologyId: e.target.value })}
              options={[
                { value: '', label: '— Select topology —' },
                ...topologies.map((t) => ({ value: String(t.id), label: t.name })),
              ]}
            />
            <SelectField
              label="Role"
              name="role-select"
              value={topoAssign.role}
              onChange={(e) => setTopoAssign({ ...topoAssign, role: e.target.value as TopologyRole })}
              options={[
                { value: 'super-spine', label: 'Super-Spine' },
                { value: 'spine', label: 'Spine' },
                { value: 'leaf', label: 'Leaf' },
              ]}
            />
          </div>
        </FormDialog>
      )}


      <ConfirmDialogRenderer />
    </>
  );
}
