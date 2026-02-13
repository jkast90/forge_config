import { useState, useEffect, useCallback } from 'react';
import { useBackups, useDevices, useTopologies, useAsyncModal, useModalRoute, useWebSocket, formatDate, getServices, addNotification } from '@core';
import type { Device, ConfigResult, BackupContentResult, ConfigPreviewResult, Backup, NetBoxStatus, Job, TopologyRole } from '@core';
import { Button } from './Button';
import { Card } from './Card';
import { ConnectModal, useConnectModal } from './ConnectModal';
import { DialogActions } from './DialogActions';
import { InfoSection } from './InfoSection';
import { Modal } from './Modal';
import { ModalLoading } from './LoadingState';
import { ResultItem } from './ResultItem';
import { Table, Cell } from './Table';
import type { TableColumn, TableAction } from './Table';
import { ConfigViewer } from './ConfigViewer';
import { CommandDrawer } from './CommandDrawer';
import { Icon, EditIcon, DownloadIcon, ClockIcon, TrashIcon, SpinnerIcon, loadingIcon } from './Icon';

interface Props {
  onEdit: (device: Device) => void;
  onDelete: (mac: string) => Promise<boolean>;
  onBackup: (mac: string) => Promise<boolean>;
  onRefresh?: () => void;
}

type NetBoxSyncResult = { message: string; result: { created: number; updated: number; errors?: string[] } };

export function DeviceList({ onEdit, onDelete, onBackup, onRefresh }: Props) {
  const { devices } = useDevices();
  const modalRoute = useModalRoute();

  const [showInfo, setShowInfo] = useState(false);
  const [commandDevice, setCommandDevice] = useState<Device | null>(null);

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
    const mac = modalRoute.getParam('mac');
    const device = mac ? devices.find(d => d.mac === mac) : undefined;
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
    modalRoute.openModal('config', { mac: device.mac });
    setConfigTab('tftp');
    setSelectedBackup(null);
    setBackupContent(null);
    // Load both TFTP config and backups in parallel
    const result = await configModal.execute(async () => {
      const services = getServices();
      const [configRes] = await Promise.all([
        services.devices.getConfig(device.mac),
        loadBackups(device.mac),
      ]);
      return configRes;
    });
    // Handle failure - set a fallback result
    if (!result && !configModal.result) {
      configModal.setResult({
        mac: device.mac,
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
    modalRoute.openModal('netbox', { mac: device.mac });
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
    modalRoute.openModal('preview', { mac: device.mac });
    setDeployJob(null);
    await previewModal.execute(async () => {
      const services = getServices();
      return services.devices.previewConfig(device.mac);
    });
  };

  const handleDeployConfig = async () => {
    if (!previewModal.item) return;
    if (!confirm(`Deploy configuration to ${previewModal.item.hostname} (${previewModal.item.ip})? This will push the config via SSH.`)) return;
    setDeploying(true);
    setDeployJob(null);
    try {
      const services = getServices();
      const job = await services.devices.deployConfig(previewModal.item.mac);
      setDeployJob(job);
      // Job result will arrive via WebSocket
    } catch (err) {
      setDeployJob({
        id: `error-${Date.now()}`,
        job_type: 'deploy',
        device_mac: previewModal.item.mac,
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

  const handleClosePreview = () => {
    previewModal.close();
    modalRoute.closeModal();
    setDeployJob(null);
    setDeploying(false);
  };

  const handleAssignTopology = async () => {
    if (!topoAssign) return;
    try {
      await getServices().devices.update(topoAssign.device.mac, {
        ...topoAssign.device,
        topology_id: topoAssign.topologyId,
        topology_role: topoAssign.role,
      });
      addNotification('success', `Assigned ${topoAssign.device.hostname} as ${topoAssign.role} in topology`);
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
    { header: 'Serial Number', accessor: (d) => Cell.dash(d.serial_number), searchValue: (d) => d.serial_number || '', hideOnMobile: true },
    { header: 'MAC Address', accessor: (d) => Cell.code(d.mac), searchValue: (d) => d.mac },
    { header: 'IP Address', accessor: 'ip' },
    { header: 'Vendor', accessor: (d) => Cell.dash(d.vendor), searchValue: (d) => d.vendor || '', hideOnMobile: true },
    { header: 'Status', accessor: (d) => Cell.status(d.status, d.status as 'online' | 'offline' | 'provisioning'), searchValue: (d) => d.status },
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
      onClick: (d) => onBackup(d.mac),
      tooltip: 'Trigger backup',
    },
    {
      icon: (d) => loadingIcon(configModal.item?.mac === d.mac && configModal.loading, 'description'),
      label: 'View configs',
      onClick: handleViewConfig,
      variant: 'secondary',
      tooltip: 'View configs',
      loading: (d) => configModal.item?.mac === d.mac && configModal.loading,
    },
    {
      icon: (d) => loadingIcon(previewModal.item?.mac === d.mac && previewModal.loading, 'play_arrow'),
      label: 'Preview config',
      onClick: handlePreviewConfig,
      variant: 'secondary',
      tooltip: 'Preview & deploy config',
      loading: (d) => previewModal.item?.mac === d.mac && previewModal.loading,
      disabled: (d) => !d.config_template && !d.vendor,
    },
    {
      icon: (d) => loadingIcon(netboxModal.item?.mac === d.mac && netboxModal.loading, 'cloud'),
      label: 'NetBox',
      onClick: handleShowNetbox,
      variant: 'secondary',
      tooltip: 'NetBox info',
      loading: (d) => netboxModal.item?.mac === d.mac && netboxModal.loading,
    },
    {
      icon: <Icon name="terminal" size={14} />,
      label: 'Commands',
      onClick: setCommandDevice,
      variant: 'secondary',
      tooltip: 'Run commands',
    },
    {
      icon: <Icon name="account_tree" size={14} />,
      label: 'Add to topology',
      onClick: (d) => setTopoAssign({ device: d, topologyId: d.topology_id || topologies[0]?.id || '', role: (d.topology_role as TopologyRole) || 'leaf' }),
      variant: 'secondary',
      tooltip: (d) => d.topology_id ? `Topology: ${d.topology_id} (${d.topology_role})` : 'Assign to topology',
    },
    {
      icon: <TrashIcon size={14} />,
      label: 'Delete',
      onClick: (d) => {
        if (confirm(`Delete device ${d.hostname}?`)) {
          onDelete(d.mac);
        }
      },
      variant: 'danger',
      tooltip: 'Delete device',
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
          getRowKey={(d) => d.mac}
          actions={actions}
          tableId="devices"
          searchable
          searchPlaceholder="Search devices..."
          emptyMessage="No devices configured yet."
          emptyDescription="Add a device using the button above."
        />
      </Card>

      <ConnectModal modal={{ ...connectModal, close: () => { connectModal.close(); modalRoute.closeModal(); } }} />

      {configModal.isOpen && configModal.item && (
        <Modal title={`Configs: ${configModal.item.hostname}`} onClose={handleCloseConfig} variant="extra-wide">
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

          <DialogActions>
            <Button variant="secondary" onClick={handleCloseConfig}>
              Close
            </Button>
          </DialogActions>
        </Modal>
      )}

      {previewModal.isOpen && previewModal.item && (
        <Modal title={`Config Preview: ${previewModal.item.hostname}`} onClose={handleClosePreview} variant="extra-wide">
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

          <DialogActions>
            {previewModal.result && (!deployJob || deployJob.status === 'queued' || deployJob.status === 'running') && (
              <Button onClick={handleDeployConfig} disabled={deploying}>
                {deploying ? <SpinnerIcon size={14} /> : <Icon name="send" size={14} />}
                {deploying ? 'Deploying...' : 'Deploy to Device'}
              </Button>
            )}
            <Button variant="secondary" onClick={handleClosePreview}>
              Close
            </Button>
          </DialogActions>
        </Modal>
      )}

      {netboxModal.isOpen && netboxModal.item && (
        <Modal title={`NetBox: ${netboxModal.item.hostname}`} onClose={handleCloseNetbox}>
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
                    <code>{netboxModal.item.mac}</code>
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
        </Modal>
      )}

      <CommandDrawer device={commandDevice} onClose={() => setCommandDevice(null)} />

      {topoAssign && (
        <Modal title={`Assign ${topoAssign.device.hostname} to Topology`} onClose={() => setTopoAssign(null)}>
          <div className="form-group">
            <label htmlFor="topo-select">Topology</label>
            <select
              id="topo-select"
              value={topoAssign.topologyId}
              onChange={(e) => setTopoAssign({ ...topoAssign, topologyId: e.target.value })}
            >
              <option value="">— Select topology —</option>
              {topologies.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="role-select">Role</label>
            <select
              id="role-select"
              value={topoAssign.role}
              onChange={(e) => setTopoAssign({ ...topoAssign, role: e.target.value as TopologyRole })}
            >
              <option value="super-spine">Super-Spine</option>
              <option value="spine">Spine</option>
              <option value="leaf">Leaf</option>
            </select>
          </div>
          <DialogActions>
            <Button onClick={handleAssignTopology} disabled={!topoAssign.topologyId}>
              <Icon name="account_tree" size={14} />
              Assign
            </Button>
            <Button variant="secondary" onClick={() => setTopoAssign(null)}>
              Cancel
            </Button>
          </DialogActions>
        </Modal>
      )}
    </>
  );
}
