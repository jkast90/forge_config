import { useState, useMemo, useCallback } from 'react';
import {
  useResolvedVariables,
  useDevices,
  useGroups,
} from '@core';
import type { ResolvedVariable, ResolutionLayer } from '@core';
import { Card } from './Card';
import { InfoSection } from './InfoSection';
import { LoadingState } from './LoadingState';
import { SelectField } from './SelectField';
import { Table } from './Table';
import type { TableColumn } from './Table';
import { Icon } from './Icon';

const SOURCE_COLORS: Record<string, { bg: string; text: string }> = {
  all: { bg: 'rgba(128, 128, 128, 0.2)', text: '#999' },
  group: { bg: 'rgba(100, 149, 237, 0.2)', text: '#6495ed' },
  host: { bg: 'rgba(76, 175, 80, 0.2)', text: '#4caf50' },
};

function SourceBadge({ sourceType, sourceName }: { sourceType: string; sourceName: string }) {
  const colors = SOURCE_COLORS[sourceType] || SOURCE_COLORS.group;
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      padding: '2px 8px',
      borderRadius: '10px',
      fontSize: '12px',
      fontWeight: 500,
      background: colors.bg,
      color: colors.text,
    }}>
      <Icon
        name={sourceType === 'all' ? 'public' : sourceType === 'host' ? 'computer' : 'folder'}
        size={12}
      />
      {sourceName}
    </span>
  );
}

export function ResolvedVariablesInspector() {
  const [showInfo, setShowInfo] = useState(false);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');

  const { result, loading, fetch } = useResolvedVariables();
  const { devices } = useDevices();
  const { groups } = useGroups();

  const deviceOptions = useMemo(() => [
    { value: '', label: 'Select a device...' },
    ...devices.map(d => ({
      value: String(d.id),
      label: `${d.hostname || d.mac || String(d.id)} (${d.mac || 'no MAC'})`,
    })),
  ], [devices]);

  const handleSelectDevice = useCallback((deviceId: string) => {
    setSelectedDeviceId(deviceId);
    if (deviceId) fetch(Number(deviceId));
  }, [fetch]);

  // Resolved variables table
  const resolvedColumns: TableColumn<ResolvedVariable>[] = useMemo(() => [
    { header: 'Key', accessor: 'key' as keyof ResolvedVariable },
    { header: 'Value', accessor: 'value' as keyof ResolvedVariable },
    {
      header: 'Source',
      accessor: (row: ResolvedVariable) => (
        <SourceBadge sourceType={row.source_type} sourceName={row.source_name} />
      ),
    },
  ], []);

  // Find which variables in a layer get overridden by later layers
  const getOverriddenKeys = useCallback((layerIndex: number, layers: ResolutionLayer[]): Set<string> => {
    const overridden = new Set<string>();
    if (!layers) return overridden;
    const currentKeys = Object.keys(layers[layerIndex]?.variables || {});
    for (const key of currentKeys) {
      for (let i = layerIndex + 1; i < layers.length; i++) {
        if (key in layers[i].variables) {
          overridden.add(key);
          break;
        }
      }
    }
    return overridden;
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <Card title="Variable Inspector" headerAction={<InfoSection.Toggle open={showInfo} onToggle={setShowInfo} />}>
        <InfoSection open={showInfo}>
          <div>
            <p>
              The Variable Inspector shows the final resolved variables for a device after applying
              all inheritance layers. Variables are resolved in order: <code>all</code> group &rarr;
              parent groups &rarr; child groups (by depth, then precedence) &rarr; host variables.
            </p>
            <p>
              Later layers override earlier ones on key conflicts. Host variables always win.
              The waterfall below shows each layer's contribution with overridden values struck through.
            </p>
          </div>
        </InfoSection>

        <div style={{ padding: '16px' }}>
          <SelectField
            label="Select Device"
            name="device"
            value={selectedDeviceId}
            onChange={(e) => handleSelectDevice(e.target.value)}
            options={deviceOptions}
          />
        </div>
      </Card>

      {selectedDeviceId && (
        <LoadingState loading={loading} loadingMessage="Resolving variables...">
          {result && (
            <>
              {/* Resolved Variables Table */}
              <Card title={`Resolved Variables (${result.resolved.length})`}>
                <Table
                  data={result.resolved}
                  columns={resolvedColumns}
                  getRowKey={(row) => row.key}
                  tableId="resolved-variables"
                  emptyMessage="No variables resolved for this device."
                  emptyDescription="Assign variables via groups or per-device settings."
                  searchable
                  searchPlaceholder="Filter variables..."
                />
              </Card>

              {/* Resolution Waterfall */}
              <Card title="Resolution Waterfall">
                <div style={{ padding: '0' }}>
                  {result.resolution_order.map((layer, layerIndex) => {
                    const overridden = getOverriddenKeys(layerIndex, result.resolution_order);
                    const entries = Object.entries(layer.variables);
                    const isEmpty = entries.length === 0;

                    return (
                      <div
                        key={layer.source}
                        style={{
                          borderBottom: layerIndex < result.resolution_order.length - 1 ? '1px solid var(--border-color)' : 'none',
                        }}
                      >
                        {/* Layer header */}
                        <div style={{
                          padding: '10px 16px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          background: 'var(--surface-color, rgba(0,0,0,0.02))',
                        }}>
                          <SourceBadge sourceType={layer.source_type} sourceName={layer.source_name} />
                          <span style={{ fontSize: '12px', opacity: 0.5 }}>
                            precedence: {layer.precedence === 2147483647 ? 'MAX (always wins)' : layer.precedence}
                          </span>
                          <span style={{ fontSize: '12px', opacity: 0.5 }}>
                            &middot; {entries.length} variable{entries.length !== 1 ? 's' : ''}
                          </span>
                          {layerIndex > 0 && (
                            <Icon name="arrow_downward" size={14} style={{ opacity: 0.3 }} />
                          )}
                        </div>

                        {/* Layer variables */}
                        {isEmpty ? (
                          <div style={{ padding: '8px 16px 12px', fontSize: '13px', opacity: 0.4, fontStyle: 'italic' }}>
                            No variables in this layer
                          </div>
                        ) : (
                          <div style={{ padding: '4px 16px 8px' }}>
                            {entries.map(([key, value]) => {
                              const isOverridden = overridden.has(key);
                              return (
                                <div
                                  key={key}
                                  style={{
                                    display: 'flex',
                                    gap: '8px',
                                    padding: '3px 0',
                                    fontSize: '13px',
                                    opacity: isOverridden ? 0.45 : 1,
                                    textDecoration: isOverridden ? 'line-through' : 'none',
                                  }}
                                >
                                  <span style={{ fontWeight: 500, minWidth: '120px' }}>{key}</span>
                                  <span style={{ opacity: 0.3 }}>=</span>
                                  <span style={{ fontFamily: 'var(--font-mono, monospace)' }}>{value}</span>
                                  {isOverridden && (
                                    <span style={{ fontSize: '11px', opacity: 0.6, fontStyle: 'italic', textDecoration: 'none' }}>
                                      (overridden)
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Card>
            </>
          )}
        </LoadingState>
      )}
    </div>
  );
}
