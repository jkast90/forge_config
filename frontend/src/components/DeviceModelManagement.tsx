import { useState, useEffect, useCallback, useMemo } from 'react';
import type {
  DeviceModel,
  DeviceModelFormData,
  ChassisRow,
  ChassisSection,
  ChassisPort,
  PortConnector,
  PortSpeedMbps,
  PortRole,
} from '@core';
import {
  useDeviceModels,
  useVendors,
  useModalForm,
  useModalRoute,
  EMPTY_DEVICE_MODEL_FORM,
  PORT_CONNECTOR_OPTIONS,
  PORT_SPEED_OPTIONS,
  PORT_ROLE_OPTIONS,
  slugify,
  getVendorName,
} from '@core';
import { usePageWidthOverride } from '../context';
import { ActionBar } from './ActionBar';
import { Button } from './Button';
import { Card } from './Card';
import { FormDialog } from './FormDialog';
import { FormField } from './FormField';
import { SelectField } from './SelectField';
import { InfoSection } from './InfoSection';
import { LoadingState } from './LoadingState';
import { Table, Cell } from './Table';
import type { TableColumn } from './Table';
import { ChassisPreview } from './ChassisPreview';
import { PlusIcon, TrashIcon, Icon } from './Icon';

// ---------------------------------------------------------------------------
// Row / Section / Port inline editor helpers
// ---------------------------------------------------------------------------

function defaultPort(col: number): ChassisPort {
  return { col, vendor_port_name: '', connector: 'rj45', speed: 1000 };
}

function defaultSection(): ChassisSection {
  return { label: '', ports: [defaultPort(1)] };
}

function defaultRow(rowNum: number): ChassisRow {
  return { row: rowNum, sections: [defaultSection()] };
}

function countPorts(rows: ChassisRow[]): number {
  return rows.reduce((sum, r) => sum + r.sections.reduce((s, sec) => s + sec.ports.length, 0), 0);
}

// ---------------------------------------------------------------------------
// Port editor row
// ---------------------------------------------------------------------------

interface PortEditorProps {
  port: ChassisPort;
  onChange: (port: ChassisPort) => void;
  onRemove: () => void;
}

function PortEditor({ port, onChange, onRemove }: PortEditorProps) {
  return (
    <div className="chassis-editor-port">
      <input
        type="number"
        className="chassis-editor-input chassis-editor-col"
        value={port.col}
        onChange={(e) => onChange({ ...port, col: parseInt(e.target.value) || 1 })}
        title="Column"
        min={1}
      />
      <input
        type="text"
        className="chassis-editor-input chassis-editor-name"
        value={port.vendor_port_name}
        onChange={(e) => onChange({ ...port, vendor_port_name: e.target.value })}
        placeholder="Ethernet1"
        title="Port name"
      />
      <select
        className="chassis-editor-input chassis-editor-connector"
        value={port.connector}
        onChange={(e) => onChange({ ...port, connector: e.target.value as PortConnector })}
        title="Connector"
      >
        {PORT_CONNECTOR_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <select
        className="chassis-editor-input chassis-editor-speed"
        value={port.speed}
        onChange={(e) => onChange({ ...port, speed: parseInt(e.target.value) as PortSpeedMbps })}
        title="Speed"
      >
        {PORT_SPEED_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <select
        className="chassis-editor-input chassis-editor-role"
        value={port.role || ''}
        onChange={(e) => {
          const val = e.target.value as PortRole | '';
          onChange({ ...port, role: val || undefined });
        }}
        title="Role"
      >
        {PORT_ROLE_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <button type="button" className="btn-icon btn-icon-danger" onClick={onRemove} title="Remove port">
        <TrashIcon size={14} />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bulk add dialog
// ---------------------------------------------------------------------------

interface BulkAddState {
  count: number;
  startCol: number;
  namePrefix: string;
  startIndex: number;
  connector: PortConnector;
  speed: PortSpeedMbps;
  oddEven: 'sequential' | 'odd' | 'even';
}

const DEFAULT_BULK: BulkAddState = {
  count: 8,
  startCol: 1,
  namePrefix: 'Ethernet',
  startIndex: 1,
  connector: 'qsfp28',
  speed: 100000,
  oddEven: 'sequential',
};

// ---------------------------------------------------------------------------
// Section editor
// ---------------------------------------------------------------------------

interface SectionEditorProps {
  section: ChassisSection;
  onChange: (section: ChassisSection) => void;
  onRemove: () => void;
}

function SectionEditor({ section, onChange, onRemove }: SectionEditorProps) {
  const [showBulk, setShowBulk] = useState(false);
  const [bulk, setBulk] = useState<BulkAddState>({ ...DEFAULT_BULK });

  const updatePort = (pi: number, port: ChassisPort) => {
    const ports = [...section.ports];
    ports[pi] = port;
    onChange({ ...section, ports });
  };

  const removePort = (pi: number) => {
    onChange({ ...section, ports: section.ports.filter((_, i) => i !== pi) });
  };

  const addPort = () => {
    const maxCol = section.ports.reduce((m, p) => Math.max(m, p.col), 0);
    onChange({ ...section, ports: [...section.ports, defaultPort(maxCol + 1)] });
  };

  const applyBulk = () => {
    const newPorts: ChassisPort[] = [];
    for (let i = 0; i < bulk.count; i++) {
      let idx: number;
      if (bulk.oddEven === 'odd') idx = bulk.startIndex + i * 2;
      else if (bulk.oddEven === 'even') idx = bulk.startIndex + i * 2;
      else idx = bulk.startIndex + i;

      newPorts.push({
        col: bulk.startCol + i,
        vendor_port_name: `${bulk.namePrefix}${idx}`,
        connector: bulk.connector,
        speed: bulk.speed,
      });
    }
    onChange({ ...section, ports: [...section.ports, ...newPorts] });
    setShowBulk(false);
  };

  return (
    <div className="chassis-editor-section">
      <div className="chassis-editor-section-header">
        <input
          type="text"
          className="chassis-editor-input"
          value={section.label || ''}
          onChange={(e) => onChange({ ...section, label: e.target.value })}
          placeholder="Section label (e.g. QSFP28 100G)"
          style={{ flex: 1 }}
        />
        <button type="button" className="btn-icon btn-icon-danger" onClick={onRemove} title="Remove section">
          <TrashIcon size={14} />
        </button>
      </div>

      <div className="chassis-editor-port-header">
        <span className="chassis-editor-col">Col</span>
        <span className="chassis-editor-name">Port Name</span>
        <span className="chassis-editor-connector">Connector</span>
        <span className="chassis-editor-speed">Speed</span>
        <span className="chassis-editor-role">Role</span>
        <span style={{ width: 28 }} />
      </div>

      {section.ports.map((port, pi) => (
        <PortEditor key={pi} port={port} onChange={(p) => updatePort(pi, p)} onRemove={() => removePort(pi)} />
      ))}

      <div className="chassis-editor-port-actions">
        <button type="button" className="btn btn-secondary btn-sm" onClick={addPort}>
          <PlusIcon size={12} /> Port
        </button>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowBulk(!showBulk)}>
          <Icon name="playlist_add" size={14} /> Bulk Add
        </button>
      </div>

      {showBulk && (
        <div className="chassis-editor-bulk">
          <div className="chassis-editor-bulk-row">
            <label>Count <input type="number" min={1} max={64} value={bulk.count} onChange={(e) => setBulk({ ...bulk, count: parseInt(e.target.value) || 1 })} /></label>
            <label>Start Col <input type="number" min={1} value={bulk.startCol} onChange={(e) => setBulk({ ...bulk, startCol: parseInt(e.target.value) || 1 })} /></label>
            <label>Prefix <input type="text" value={bulk.namePrefix} onChange={(e) => setBulk({ ...bulk, namePrefix: e.target.value })} placeholder="Ethernet" /></label>
            <label>Start # <input type="number" min={0} value={bulk.startIndex} onChange={(e) => setBulk({ ...bulk, startIndex: parseInt(e.target.value) || 0 })} /></label>
          </div>
          <div className="chassis-editor-bulk-row">
            <label>Connector
              <select value={bulk.connector} onChange={(e) => setBulk({ ...bulk, connector: e.target.value as PortConnector })}>
                {PORT_CONNECTOR_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>
            <label>Speed
              <select value={bulk.speed} onChange={(e) => setBulk({ ...bulk, speed: parseInt(e.target.value) as PortSpeedMbps })}>
                {PORT_SPEED_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>
            <label>Numbering
              <select value={bulk.oddEven} onChange={(e) => setBulk({ ...bulk, oddEven: e.target.value as BulkAddState['oddEven'] })}>
                <option value="sequential">Sequential</option>
                <option value="odd">Odd (1,3,5…)</option>
                <option value="even">Even (2,4,6…)</option>
              </select>
            </label>
            <button type="button" className="btn btn-primary btn-sm" onClick={applyBulk}>Add {bulk.count} Ports</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Row editor
// ---------------------------------------------------------------------------

interface RowEditorProps {
  row: ChassisRow;
  onChange: (row: ChassisRow) => void;
  onRemove: () => void;
}

function RowEditor({ row, onChange, onRemove }: RowEditorProps) {
  const updateSection = (si: number, section: ChassisSection) => {
    const sections = [...row.sections];
    sections[si] = section;
    onChange({ ...row, sections });
  };

  const removeSection = (si: number) => {
    onChange({ ...row, sections: row.sections.filter((_, i) => i !== si) });
  };

  const addSection = () => {
    onChange({ ...row, sections: [...row.sections, defaultSection()] });
  };

  return (
    <div className="chassis-editor-row">
      <div className="chassis-editor-row-header">
        <strong>Row {row.row}</strong>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="btn btn-secondary btn-sm" onClick={addSection}>
            <PlusIcon size={12} /> Section
          </button>
          <button type="button" className="btn-icon btn-icon-danger" onClick={onRemove} title="Remove row">
            <TrashIcon size={14} />
          </button>
        </div>
      </div>
      {row.sections.map((section, si) => (
        <SectionEditor
          key={si}
          section={section}
          onChange={(s) => updateSection(si, s)}
          onRemove={() => removeSection(si)}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Layout editor (manages rows)
// ---------------------------------------------------------------------------

interface LayoutEditorProps {
  layout: ChassisRow[];
  onChange: (layout: ChassisRow[]) => void;
}

function LayoutEditor({ layout, onChange }: LayoutEditorProps) {
  const updateRow = (ri: number, row: ChassisRow) => {
    const rows = [...layout];
    rows[ri] = row;
    onChange(rows);
  };

  const removeRow = (ri: number) => {
    onChange(layout.filter((_, i) => i !== ri));
  };

  const addRow = () => {
    const maxRow = layout.reduce((m, r) => Math.max(m, r.row), 0);
    onChange([...layout, defaultRow(maxRow + 1)]);
  };

  return (
    <div className="chassis-editor">
      {layout.map((row, ri) => (
        <RowEditor
          key={ri}
          row={row}
          onChange={(r) => updateRow(ri, r)}
          onRemove={() => removeRow(ri)}
        />
      ))}
      <button type="button" className="btn btn-secondary btn-sm" onClick={addRow} style={{ marginTop: 8 }}>
        <PlusIcon size={12} /> Add Row
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main management component
// ---------------------------------------------------------------------------

export function DeviceModelManagement() {
  usePageWidthOverride('wide');
  const [showInfo, setShowInfo] = useState(false);
  const { vendors } = useVendors();
  const {
    deviceModels,
    loading,
    error,
    createDeviceModel,
    updateDeviceModel,
    deleteDeviceModel,
  } = useDeviceModels();

  const vendorOptions = useMemo(() => {
    return [
      { value: '', label: 'Select vendor...' },
      ...vendors.map((v) => ({ value: String(v.id), label: v.name })),
    ];
  }, [vendors]);

  const form = useModalForm<DeviceModel, DeviceModelFormData>({
    emptyFormData: { ...EMPTY_DEVICE_MODEL_FORM },
    itemToFormData: (model) => ({
      vendor_id: String(model.vendor_id),
      model: model.model,
      display_name: model.display_name,
      rack_units: model.rack_units,
      layout: model.layout,
    }),
    onCreate: (data) =>
      createDeviceModel({ ...data, vendor_id: Number(data.vendor_id) }),
    onUpdate: (id, data) => updateDeviceModel(id, { ...data, vendor_id: Number(data.vendor_id) }),
    getItemId: (m) => String(m.id),
    modalName: 'device-model-form',
  });

  const modalRoute = useModalRoute();

  useEffect(() => {
    if (modalRoute.isModal('device-model-form') && !form.isOpen) {
      const id = modalRoute.getParam('id');
      if (id) {
        const model = deviceModels.find((m) => String(m.id) === id);
        if (model) form.openEdit(model);
        else if (deviceModels.length > 0) modalRoute.closeModal();
      } else {
        form.openAdd();
      }
    }
  }, [modalRoute.modal, deviceModels]);

  const handleDelete = async (model: DeviceModel) => {
    await deleteDeviceModel(String(model.id));
  };

  const handleLayoutChange = useCallback(
    (layout: ChassisRow[]) => {
      form.setField('layout', layout);
    },
    [form],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await form.submit();
  };

  const columns: TableColumn<DeviceModel>[] = [
    {
      header: 'Model',
      accessor: (m) => <strong>{m.display_name}</strong>,
      searchValue: (m) => `${m.display_name} ${m.model}`,
    },
    {
      header: 'Vendor',
      accessor: (m) => getVendorName(m.vendor_id, vendors),
      searchValue: (m) => String(m.vendor_id),
    },
    {
      header: 'Ports',
      accessor: (m) => Cell.count(countPorts(m.layout)),
      searchable: false,
    },
    {
      header: 'Rack Units',
      accessor: 'rack_units',
      searchable: false,
    },
    {
      header: 'Devices',
      accessor: (m) => Cell.count(m.device_count || 0),
      searchable: false,
    },
    {
      header: 'Preview',
      accessor: (m) => (
        <div style={{ maxWidth: 300 }}>
          <ChassisPreview rows={m.layout} className="chassis-preview-mini" />
        </div>
      ),
      searchable: false,
    },
  ];

  return (
    <LoadingState loading={loading} error={error} loadingMessage="Loading device models...">
      <ActionBar>
        <Button onClick={form.openAdd}>
          <PlusIcon size={16} />
          Add Model
        </Button>
      </ActionBar>

      <Card title="Device Models" titleAction={<InfoSection.Toggle open={showInfo} onToggle={setShowInfo} />}>
        <InfoSection open={showInfo}>
          <div>
            <p>
              Device models define the physical port layout of network switches and routers.
              Each model specifies its rows, sections, and individual ports with connector types and speeds.
            </p>
            <ul>
              <li>Models are organized by vendor and display a visual chassis preview</li>
              <li>Port roles (mgmt, northbound, southbound, etc.) help classify port functions</li>
              <li>Use the bulk-add helper to quickly populate ports for new models</li>
            </ul>
          </div>
        </InfoSection>
        <Table
          data={deviceModels}
          columns={columns}
          getRowKey={(m) => m.id}
          tableId="device-models"
          onEdit={form.openEdit}
          onDelete={handleDelete}
          deleteConfirmMessage={(m) => `Delete model "${m.display_name}"?`}
          deleteDisabled={(m) => (m.device_count || 0) > 0}
          searchable
          searchPlaceholder="Search models..."
          emptyMessage="No device models defined."
          emptyDescription='Click "Add Model" to define a new chassis layout.'
        />
      </Card>

      <FormDialog
        isOpen={form.isOpen}
        onClose={form.close}
        title={form.getTitle('Add Device Model', 'Edit Device Model')}
        onSubmit={handleSubmit}
        submitText={form.getSubmitText('Add Model', 'Update Model')}
        variant="extra-wide"
      >
        <div className="chassis-form-layout">
          {/* Left: form fields + layout editor */}
          <div className="chassis-form-left">
            <div className="form-columns">
              <div className="form-column">
                <SelectField
                  label="Vendor *"
                  name="vendor_id"
                  options={vendorOptions}
                  value={form.formData.vendor_id}
                  onChange={form.handleChange}
                  required
                />
                <FormField
                  label="Model Name *"
                  name="model"
                  type="text"
                  value={form.formData.model}
                  onChange={form.handleChange}
                  placeholder="7050CX3-32S"
                  required
                />
              </div>
              <div className="form-column">
                <FormField
                  label="Display Name *"
                  name="display_name"
                  type="text"
                  value={form.formData.display_name}
                  onChange={form.handleChange}
                  placeholder="Arista 7050CX3-32S"
                  required
                />
                <FormField
                  label="Rack Units"
                  name="rack_units"
                  type="number"
                  value={form.formData.rack_units.toString()}
                  onChange={form.handleChange}
                  placeholder="1"
                  min={1}
                  max={48}
                />
              </div>
            </div>

            <h4 style={{ margin: '16px 0 8px' }}>Port Layout</h4>
            <LayoutEditor layout={form.formData.layout} onChange={handleLayoutChange} />
          </div>

          {/* Right: live chassis preview */}
          <div className="chassis-form-right">
            <h4 style={{ margin: '0 0 8px' }}>Preview</h4>
            <ChassisPreview rows={form.formData.layout} />
          </div>
        </div>
      </FormDialog>
    </LoadingState>
  );
}
