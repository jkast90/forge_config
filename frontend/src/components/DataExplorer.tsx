import { useState } from 'react';
import { useAppSelector } from '@core';
import type { RootState } from '@core';
import { Icon } from './Icon';
import { EmptyState } from './EmptyState';
import { JsonViewer, JsonList } from './JsonViewer';

type SliceId = 'devices' | 'vendors' | 'templates' | 'dhcpOptions' | 'discovery-discovered' | 'discovery-leases' | 'containers' | 'settings' | 'backups';

interface SliceConfig {
  id: SliceId;
  label: string;
  icon: string;
  getItems: (state: RootState) => unknown[];
  getCount: (state: RootState) => number;
  summaryFields: string[];
  isLoading: (state: RootState) => boolean;
  getError: (state: RootState) => string | null;
}

const SLICES: SliceConfig[] = [
  {
    id: 'devices',
    label: 'Devices',
    icon: 'devices',
    getItems: (s) => s.devices.items,
    getCount: (s) => s.devices.items.length,
    summaryFields: ['mac', 'hostname', 'ip', 'status'],
    isLoading: (s) => s.devices.loading,
    getError: (s) => s.devices.error,
  },
  {
    id: 'vendors',
    label: 'Vendors',
    icon: 'business',
    getItems: (s) => s.vendors.items,
    getCount: (s) => s.vendors.items.length,
    summaryFields: ['id', 'name'],
    isLoading: (s) => s.vendors.loading,
    getError: (s) => s.vendors.error,
  },
  {
    id: 'templates',
    label: 'Templates',
    icon: 'description',
    getItems: (s) => s.templates.items,
    getCount: (s) => s.templates.items.length,
    summaryFields: ['id', 'name', 'vendor_id'],
    isLoading: (s) => s.templates.loading,
    getError: (s) => s.templates.error,
  },
  {
    id: 'dhcpOptions',
    label: 'DHCP Options',
    icon: 'lan',
    getItems: (s) => s.dhcpOptions.items,
    getCount: (s) => s.dhcpOptions.items.length,
    summaryFields: ['option_number', 'name', 'value'],
    isLoading: (s) => s.dhcpOptions.loading,
    getError: (s) => s.dhcpOptions.error,
  },
  {
    id: 'discovery-discovered',
    label: 'Discovered',
    icon: 'search',
    getItems: (s) => s.discovery.discovered,
    getCount: (s) => s.discovery.discovered.length,
    summaryFields: ['mac', 'ip', 'hostname', 'vendor'],
    isLoading: (s) => s.discovery.loading,
    getError: (s) => s.discovery.error,
  },
  {
    id: 'discovery-leases',
    label: 'All Leases',
    icon: 'dns',
    getItems: (s) => s.discovery.allLeases,
    getCount: (s) => s.discovery.allLeases.length,
    summaryFields: ['mac', 'ip', 'hostname', 'expiry_time'],
    isLoading: (s) => s.discovery.loading,
    getError: (s) => s.discovery.error,
  },
  {
    id: 'containers',
    label: 'Containers',
    icon: 'deployed_code',
    getItems: (s) => s.containers.items,
    getCount: (s) => s.containers.items.length,
    summaryFields: ['hostname', 'mac', 'ip', 'status'],
    isLoading: (s) => s.containers.loading,
    getError: (s) => s.containers.error,
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: 'settings',
    getItems: (s) => s.settings.data ? [s.settings.data] : [],
    getCount: (s) => s.settings.data ? 1 : 0,
    summaryFields: [],
    isLoading: (s) => s.settings.loading,
    getError: (s) => s.settings.error,
  },
  {
    id: 'backups',
    label: 'Backups',
    icon: 'backup',
    getItems: (s) => {
      const entries = Object.entries(s.backups.byDevice);
      return entries.map(([mac, backups]) => ({ _deviceMac: mac, backups }));
    },
    getCount: (s) => Object.keys(s.backups.byDevice).length,
    summaryFields: [],
    isLoading: (s) => s.backups.loading,
    getError: (s) => s.backups.error,
  },
];

function SettingsView({ data }: { data: any }) {
  const [expanded, setExpanded] = useState(false);

  if (!data) return null;

  return (
    <div>
      <div className="info-grid" style={{ fontSize: '0.8rem' }}>
        {Object.entries(data).map(([key, value]) => (
          <div key={key} className="data-explorer-setting-row">
            <span className="label">{key}</span>
            <code className="code-sm">
              {typeof value === 'object' ? JSON.stringify(value) : String(value)}
            </code>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 8 }}>
        <button className="data-explorer-raw-toggle clickable" onClick={() => setExpanded(!expanded)}>
          <Icon name={expanded ? 'expand_more' : 'chevron_right'} size={14} />
          <span>Raw JSON</span>
        </button>
        {expanded && (
          <div style={{ marginTop: 4 }}>
            <JsonViewer data={data} maxHeight={300} />
          </div>
        )}
      </div>
    </div>
  );
}

function BackupsView({ byDevice }: { byDevice: Record<string, any[]> }) {
  const [expandedMac, setExpandedMac] = useState<string | null>(null);
  const entries = Object.entries(byDevice);

  if (entries.length === 0) {
    return (
      <EmptyState
        icon="backup"
        message="No backups loaded"
        description="Select a device to load its backups"
        size="sm"
      />
    );
  }

  return (
    <div className="data-explorer-list">
      {entries.map(([mac, backups]) => (
        <div key={mac} className="data-explorer-entry">
          <div className="data-explorer-row clickable" onClick={() => setExpandedMac(expandedMac === mac ? null : mac)}>
            <Icon name={expandedMac === mac ? 'expand_more' : 'chevron_right'} size={16} />
            <div className="data-explorer-summary">
              <span className="data-explorer-field">
                <span className="data-explorer-field-label">device</span>
                <span className="data-explorer-field-value">{mac}</span>
              </span>
              <span className="data-explorer-field">
                <span className="data-explorer-field-label">count</span>
                <span className="data-explorer-field-value">{backups.length}</span>
              </span>
            </div>
          </div>
          {expandedMac === mac && (
            <div className="data-explorer-detail">
              {backups.map((backup: any, i: number) => (
                <div key={i} style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginBottom: 2 }}>
                    {backup.filename || `Backup ${i + 1}`}
                    {backup.size && <span style={{ marginLeft: 8 }}>{backup.size}</span>}
                    {backup.created_at && <span style={{ marginLeft: 8 }}>{backup.created_at}</span>}
                  </div>
                  <pre className="pre-scrollable">{JSON.stringify(backup, null, 2)}</pre>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function SliceButton({ config, active, onClick }: { config: SliceConfig; active: boolean; onClick: () => void }) {
  const count = useAppSelector(config.getCount);
  const loading = useAppSelector(config.isLoading);
  const error = useAppSelector(config.getError);

  return (
    <button
      className={`data-explorer-slice-btn${active ? ' active' : ''}`}
      onClick={onClick}
    >
      <Icon name={config.icon} size={18} />
      <span className="data-explorer-slice-label">{config.label}</span>
      <span className="data-explorer-slice-count">
        {loading ? <Icon name="sync" size={12} className="icon-spin" /> : count}
      </span>
      {error && <span className="data-explorer-slice-error" title={error}>!</span>}
    </button>
  );
}

function SliceContent({ config }: { config: SliceConfig }) {
  const items = useAppSelector(config.getItems);
  const loading = useAppSelector(config.isLoading);
  const error = useAppSelector(config.getError);
  const state = useAppSelector((s) => s);

  if (error) {
    return (
      <div className="data-explorer-error">
        <Icon name="error" size={20} />
        <span>{error}</span>
      </div>
    );
  }

  if (loading && items.length === 0) {
    return <div className="data-explorer-loading">Loading...</div>;
  }

  // Special renderers
  if (config.id === 'settings') {
    return <SettingsView data={state.settings.data} />;
  }

  if (config.id === 'backups') {
    return <BackupsView byDevice={state.backups.byDevice} />;
  }

  if (items.length === 0) {
    return (
      <EmptyState
        icon={config.icon}
        message={`No ${config.label.toLowerCase()}`}
        description="Data will appear here when available"
        size="sm"
      />
    );
  }

  return (
    <JsonList
      items={items as Record<string, unknown>[]}
      summaryFields={config.summaryFields}
    />
  );
}

export function DataExplorer() {
  const [activeSlice, setActiveSlice] = useState<SliceId>('devices');
  const activeConfig = SLICES.find((s) => s.id === activeSlice)!;

  return (
    <div className="data-explorer">
      <div className="data-explorer-sidebar">
        <div className="data-explorer-sidebar-header">
          <Icon name="storage" size={16} />
          <span>Redux Store</span>
        </div>
        {SLICES.map((config) => (
          <SliceButton
            key={config.id}
            config={config}
            active={config.id === activeSlice}
            onClick={() => setActiveSlice(config.id)}
          />
        ))}
      </div>
      <div className="data-explorer-content">
        <div className="data-explorer-content-header">
          <Icon name={activeConfig.icon} size={20} />
          <h3>{activeConfig.label}</h3>
        </div>
        <SliceContent config={activeConfig} />
      </div>
    </div>
  );
}
