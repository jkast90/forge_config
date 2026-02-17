import { useMemo } from 'react';
import {
  useDevices,
  useDiscovery,
  useTemplates,
  useVendors,
  useGroups,
  useDeviceModels,
  useTopologies,
  useIpam,
  useJobs,
  formatRelativeTime,
  countDevicesByStatus,
  countRecentBackups,
  getRecentJobs,
} from '@core';
import { Card } from './Card';
import { Button } from './Button';
import { Icon } from './Icon';
import { Tooltip } from './Tooltip';

interface DashboardProps {
  onNavigate?: (page: string) => void;
}

interface MetricCardProps {
  title: string;
  value: number | string;
  icon: string;
  color: string;
  subtitle?: string;
  onClick?: () => void;
}

function MetricCard({ title, value, icon, color, subtitle, onClick }: MetricCardProps) {
  return (
    <div
      className="dashboard-metric"
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
    >
      <div className="metric-icon" style={{ background: color }}>
        <Icon name={icon} size={24} />
      </div>
      <div className="metric-content">
        <span className="metric-value">{value}</span>
        <span className="metric-title">{title}</span>
        {subtitle && <span className="metric-subtitle">{subtitle}</span>}
      </div>
    </div>
  );
}

interface FeatureLinkProps {
  icon: string;
  title: string;
  description: string;
  count?: number;
  onClick?: () => void;
}

function FeatureLink({ icon, title, description, count, onClick }: FeatureLinkProps) {
  return (
    <button className="dashboard-feature-link" onClick={onClick} type="button">
      <Icon name={icon} size={20} />
      <div className="feature-link-content">
        <span className="feature-link-title">{title}</span>
        <span className="feature-link-desc">{description}</span>
      </div>
      {count != null && <span className="feature-link-count">{count}</span>}
      <Icon name="chevron_right" size={16} />
    </button>
  );
}

export function Dashboard({ onNavigate }: DashboardProps) {
  const { devices } = useDevices({ autoRefresh: true, refreshInterval: 10000 });
  const { discovered, logs, logsLoading } = useDiscovery({ autoRefresh: true, refreshInterval: 10000 });
  const { templates } = useTemplates({ vendorFilter: 'all' });
  const { vendors } = useVendors();
  const { groups } = useGroups();
  const { deviceModels } = useDeviceModels();
  const { topologies } = useTopologies();
  const { prefixes, ipAddresses, vrfs } = useIpam();
  const { jobs } = useJobs();

  const statusCounts = useMemo(() => countDevicesByStatus(devices), [devices]);
  const recentBackups = useMemo(() => countRecentBackups(devices), [devices]);
  const recentJobs = useMemo(() => getRecentJobs(jobs), [jobs]);

  // Get event type icon and color
  const getEventStyle = (eventType: string) => {
    switch (eventType) {
      case 'discovered':
        return { icon: 'search', color: 'var(--color-accent-cyan)' };
      case 'added':
        return { icon: 'add_circle', color: 'var(--color-success)' };
      case 'lease_renewed':
        return { icon: 'refresh', color: 'var(--color-accent-blue)' };
      case 'lease_expired':
        return { icon: 'timer_off', color: 'var(--color-warning)' };
      default:
        return { icon: 'info', color: 'var(--color-text-muted)' };
    }
  };

  return (
    <div className="dashboard">
      {/* Metrics Row */}
      <div className="dashboard-metrics">
        <MetricCard
          title="Total Devices"
          value={devices.length}
          icon="devices"
          color="var(--gradient-primary)"
          subtitle={`${statusCounts.online} online`}
          onClick={() => onNavigate?.('resources')}
        />
        <MetricCard
          title="Pending Discovery"
          value={discovered.length}
          icon="radar"
          color="var(--gradient-accent)"
          subtitle="Waiting to be added"
          onClick={() => onNavigate?.('resources')}
        />
        <MetricCard
          title="Topologies"
          value={topologies.length}
          icon="hub"
          color="linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)"
          onClick={() => onNavigate?.('topologies')}
        />
        <MetricCard
          title="IP Prefixes"
          value={prefixes.length}
          icon="lan"
          color="linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)"
          subtitle={`${ipAddresses.length} addresses`}
          onClick={() => onNavigate?.('ipam')}
        />
      </div>

      {/* Two-column layout */}
      <div className="dashboard-grid">
        {/* Device Status Overview */}
        <Card title="Device Status" headerAction={
          <Button variant="secondary" size="sm" onClick={() => onNavigate?.('resources')}>
            View All
          </Button>
        }>
          <div className="status-grid">
            <div className="status-item status-online">
              <Icon name="check_circle" size={20} />
              <span className="status-count">{statusCounts.online}</span>
              <span className="status-label">Online</span>
            </div>
            <div className="status-item status-offline">
              <Icon name="cancel" size={20} />
              <span className="status-count">{statusCounts.offline}</span>
              <span className="status-label">Offline</span>
            </div>
            <div className="status-item status-provisioning">
              <Icon name="sync" size={20} />
              <span className="status-count">{statusCounts.provisioning}</span>
              <span className="status-label">Provisioning</span>
            </div>
            <div className="status-item status-unknown">
              <Icon name="help" size={20} />
              <span className="status-count">{statusCounts.unknown}</span>
              <span className="status-label">Unknown</span>
            </div>
          </div>

          {/* Backup status */}
          <div className="backup-summary">
            <Icon name="backup" size={18} />
            <span>{recentBackups} device{recentBackups !== 1 ? 's' : ''} backed up in last 24h</span>
          </div>

          {/* Quick list of recent devices */}
          {devices.length > 0 && (
            <div className="recent-devices">
              <h4>Recent Devices</h4>
              {devices.slice(0, 5).map((device) => (
                <div key={device.id} className="recent-device-item">
                  <span className={`status-dot status-${device.status}`} />
                  <span className="device-name">{device.hostname}</span>
                  <span className="device-ip">{device.ip}</span>
                  {device.last_seen && (
                    <Tooltip content={`Last seen: ${new Date(device.last_seen).toLocaleString()}`}>
                      <span className="device-seen">{formatRelativeTime(device.last_seen)}</span>
                    </Tooltip>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Recent Activity */}
        <Card title="Recent Activity" headerAction={
          <Button variant="secondary" size="sm" onClick={() => onNavigate?.('resources')}>
            View All
          </Button>
        }>
          {logsLoading ? (
            <div className="activity-loading">Loading activity...</div>
          ) : logs.length === 0 ? (
            <div className="activity-empty">
              <Icon name="inbox" size={32} />
              <p>No recent activity</p>
            </div>
          ) : (
            <div className="activity-list">
              {logs.slice(0, 10).map((log) => {
                const style = getEventStyle(log.event_type);
                return (
                  <div key={log.id} className="activity-item">
                    <div className="activity-icon" style={{ color: style.color }}>
                      <Icon name={style.icon} size={16} />
                    </div>
                    <div className="activity-content">
                      <span className="activity-type">{log.event_type.replace('_', ' ')}</span>
                      <span className="activity-details">
                        {log.hostname || log.ip}
                        {log.vendor && <span className="activity-vendor"> ({log.vendor})</span>}
                      </span>
                      {log.message && <span className="activity-message">{log.message}</span>}
                    </div>
                    <Tooltip content={new Date(log.created_at).toLocaleString()}>
                      <span className="activity-time">{formatRelativeTime(log.created_at)}</span>
                    </Tooltip>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* Feature Overview */}
      <div className="dashboard-grid">
        <Card title="Configuration">
          <div className="dashboard-feature-links">
            <FeatureLink
              icon="description"
              title="Templates"
              description="Config templates with Go template syntax"
              count={templates.length}
              onClick={() => onNavigate?.('config')}
            />
            <FeatureLink
              icon="account_tree"
              title="Groups"
              description="Device groups with variable inheritance"
              count={groups.length}
              onClick={() => onNavigate?.('config')}
            />
            <FeatureLink
              icon="business"
              title="Vendors"
              description="Equipment manufacturers and MAC prefixes"
              count={vendors.length}
              onClick={() => onNavigate?.('vendors-models')}
            />
            <FeatureLink
              icon="memory"
              title="Device Models"
              description="Chassis layouts and port definitions"
              count={deviceModels.length}
              onClick={() => onNavigate?.('vendors-models')}
            />
          </div>
        </Card>

        <Card title="Infrastructure">
          <div className="dashboard-feature-links">
            <FeatureLink
              icon="hub"
              title="Topologies"
              description="CLOS fabric topology management"
              count={topologies.length}
              onClick={() => onNavigate?.('topologies')}
            />
            <FeatureLink
              icon="lan"
              title="IPAM"
              description={`${prefixes.length} prefixes, ${vrfs.length} VRFs`}
              count={ipAddresses.length}
              onClick={() => onNavigate?.('ipam')}
            />
            <FeatureLink
              icon="schedule"
              title="Jobs"
              description={`${recentJobs.length} in last 24h`}
              count={jobs.length}
              onClick={() => onNavigate?.('jobs')}
            />
            <FeatureLink
              icon="terminal"
              title="Actions"
              description="Vendor-specific quick commands"
              onClick={() => onNavigate?.('jobs')}
            />
          </div>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card title="Quick Actions">
        <div className="quick-actions">
          <Button onClick={() => onNavigate?.('resources')}>
            <Icon name="add" size={16} />
            Add Device
          </Button>
          <Button variant="secondary" onClick={() => onNavigate?.('resources')}>
            <Icon name="search" size={16} />
            Check Discovery
          </Button>
          <Button variant="secondary" onClick={() => onNavigate?.('config')}>
            <Icon name="description" size={16} />
            Manage Templates
          </Button>
          <Button variant="secondary" onClick={() => onNavigate?.('vendors-models')}>
            <Icon name="business" size={16} />
            Configure Vendors
          </Button>
          <Button variant="secondary" onClick={() => onNavigate?.('topologies')}>
            <Icon name="hub" size={16} />
            Build Topology
          </Button>
          <Button variant="secondary" onClick={() => onNavigate?.('ipam')}>
            <Icon name="lan" size={16} />
            Manage IPs
          </Button>
        </div>
      </Card>
    </div>
  );
}
