import type { ChassisRow, ChassisPort } from '@core';
import { Tooltip } from './Tooltip';

interface ChassisPreviewProps {
  rows: ChassisRow[];
  className?: string;
}

const CONNECTOR_WIDTHS: Record<string, number> = {
  rj45: 24,
  sfp: 28,
  'sfp+': 28,
  sfp28: 28,
  'qsfp+': 40,
  qsfp28: 40,
  'qsfp-dd': 48,
};

const SPEED_COLORS: Record<number, string> = {
  1000: 'var(--color-success)',
  2500: '#4ade80',
  10000: 'var(--color-accent-blue)',
  25000: 'var(--color-accent-teal)',
  40000: '#f59e0b',
  50000: '#f97316',
  100000: '#f97316',
  400000: 'var(--color-accent-purple)',
};

const ROLE_INDICATORS: Record<string, string> = {
  mgmt: 'M',
  console: 'C',
  northbound: 'N',
  southbound: 'S',
  lateral: 'L',
  access: 'A',
  uplink: 'U',
};

function formatSpeed(speed: number): string {
  if (speed >= 100000) return `${speed / 1000}G`;
  if (speed >= 1000) return `${speed / 1000}G`;
  return `${speed}M`;
}

function PortBlock({ port }: { port: ChassisPort }) {
  const width = CONNECTOR_WIDTHS[port.connector] || 28;
  const color = SPEED_COLORS[port.speed] || 'var(--color-text-muted)';
  const roleIndicator = port.role ? ROLE_INDICATORS[port.role] : null;

  const tooltip = [
    port.vendor_port_name,
    `${port.connector.toUpperCase()} ${formatSpeed(port.speed)}`,
    port.role ? `Role: ${port.role}` : null,
  ].filter(Boolean).join('\n');

  return (
    <Tooltip content={tooltip}>
      <div
        className="chassis-port"
        style={{
          width: `${width}px`,
          borderColor: color,
          backgroundColor: `color-mix(in srgb, ${color} 20%, transparent)`,
        }}
      >
        {roleIndicator && <span className="chassis-port-role">{roleIndicator}</span>}
      </div>
    </Tooltip>
  );
}

export function ChassisPreview({ rows, className = '' }: ChassisPreviewProps) {
  if (!rows || rows.length === 0) {
    return (
      <div className={`chassis-preview chassis-preview-empty ${className}`}>
        <span className="chassis-preview-placeholder">No ports defined</span>
      </div>
    );
  }

  const totalPorts = rows.reduce(
    (sum, row) => sum + row.sections.reduce((s, sec) => s + sec.ports.length, 0),
    0,
  );

  return (
    <div className={`chassis-preview ${className}`}>
      <div className="chassis-body">
        {rows.map((row) => (
          <div key={row.row} className="chassis-row">
            {row.sections.map((section, si) => (
              <div key={si} className="chassis-section">
                {section.label && (
                  <span className="chassis-section-label">{section.label}</span>
                )}
                <div className="chassis-ports">
                  {section.ports.map((port, pi) => (
                    <PortBlock key={pi} port={port} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="chassis-legend">
        <span className="chassis-legend-item">
          <span className="chassis-legend-dot" style={{ background: SPEED_COLORS[1000] }} />1G
        </span>
        <span className="chassis-legend-item">
          <span className="chassis-legend-dot" style={{ background: SPEED_COLORS[10000] }} />10G
        </span>
        <span className="chassis-legend-item">
          <span className="chassis-legend-dot" style={{ background: SPEED_COLORS[25000] }} />25G
        </span>
        <span className="chassis-legend-item">
          <span className="chassis-legend-dot" style={{ background: SPEED_COLORS[100000] }} />100G
        </span>
        <span className="chassis-legend-item">
          <span className="chassis-legend-dot" style={{ background: SPEED_COLORS[400000] }} />400G
        </span>
        <span className="chassis-legend-total">{totalPorts} ports</span>
      </div>
    </div>
  );
}
