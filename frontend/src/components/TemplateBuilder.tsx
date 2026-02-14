import { useState, useEffect, useMemo } from 'react';
import type { Template, TemplateFormData } from '@core';
import {
  useTemplates,
  useDevices,
  useModalForm,
  useModalRoute,
  getVendorFilterOptions,
  getVendorSelectOptions,
  getVendorName,
  filterByVendor,
  generateId,
  EMPTY_TEMPLATE_FORM,
  SAMPLE_DEVICE_FOR_PREVIEW,
} from '@core';
import { ActionBar } from './ActionBar';
import { Button } from './Button';
import { Card } from './Card';
import { DialogActions } from './DialogActions';
import { InfoSection } from './InfoSection';
import { Modal } from './Modal';
import { DropdownSelect } from './DropdownSelect';
import { FormField } from './FormField';

import { SelectField } from './SelectField';
import { Table, SimpleTable, Cell } from './Table';
import type { TableColumn, TableAction } from './Table';
import { Tooltip } from './Tooltip';
import { VendorBadge } from './VendorBadge';
import { LoadingState } from './LoadingState';
import { PlusIcon, Icon } from './Icon';
import { Templatizer } from './Templatizer';
import { ConfigViewer } from './ConfigViewer';

export function TemplateBuilder() {
  const [showInfo, setShowInfo] = useState(false);
  const [showVarsInfo, setShowVarsInfo] = useState(false);
  const [filterVendor, setFilterVendor] = useState('');
  const {
    templates,
    variables,
    loading,
    error,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    previewTemplate,
  } = useTemplates({ vendorFilter: filterVendor || 'all' });

  const form = useModalForm<Template, TemplateFormData>({
    emptyFormData: EMPTY_TEMPLATE_FORM,
    itemToFormData: (template) => ({
      id: template.id,
      name: template.name,
      description: template.description || '',
      vendor_id: template.vendor_id || '',
      content: template.content,
    }),
    onCreate: (data) => createTemplate({
      id: data.id || generateId('tpl'),
      name: data.name,
      description: data.description || undefined,
      vendor_id: data.vendor_id || undefined,
      content: data.content,
    }),
    onUpdate: (id, data) => updateTemplate(id, {
      id: data.id || id,
      name: data.name,
      description: data.description || undefined,
      vendor_id: data.vendor_id || undefined,
      content: data.content,
    }),
    getItemId: (t) => t.id,
    modalName: 'template-form',
  });

  const [previewOutput, setPreviewOutput] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewTemplateId, setPreviewTemplateId] = useState<string | null>(null);
  const [previewDeviceMAC, setPreviewDeviceMAC] = useState<string>('');
  const [showTemplatizer, setShowTemplatizer] = useState(false);
  const modalRoute = useModalRoute();

  // Restore modals from URL hash
  useEffect(() => {
    if (modalRoute.isModal('template-form') && !form.isOpen) {
      const id = modalRoute.getParam('id');
      if (id) {
        const template = templates.find(t => t.id === id);
        if (template) {
          form.openEdit(template);
        } else if (templates.length > 0) {
          modalRoute.closeModal();
        }
      } else {
        form.openAdd();
      }
    }
    if (modalRoute.isModal('template-preview') && !showPreview) {
      const id = modalRoute.getParam('id');
      if (id) {
        const template = templates.find(t => t.id === id);
        if (template) {
          handlePreview(template);
        } else if (templates.length > 0) {
          modalRoute.closeModal();
        }
      }
    }
    if (modalRoute.isModal('templatizer') && !showTemplatizer) {
      setShowTemplatizer(true);
    }
  }, [modalRoute.modal, templates]);

  // Get devices for preview selection
  const { devices } = useDevices();

  // Get vendor options from shared utility
  const filterVendorOptions = useMemo(() => getVendorFilterOptions(), []);
  const vendorSelectOptions = useMemo(() => getVendorSelectOptions(), []);

  // Build device options for preview selection
  const deviceOptions = useMemo(() => [
    { value: '', label: 'Sample Device' },
    ...devices.map((d) => ({ value: d.id, label: `${d.hostname} (${d.ip})` })),
  ], [devices]);

  // Get selected device for preview
  const previewDevice = useMemo(() => {
    if (!previewDeviceMAC) return null;
    return devices.find((d) => d.id === previewDeviceMAC) || null;
  }, [devices, previewDeviceMAC]);

  // Filter templates by vendor (client-side for immediate UI response)
  const filteredTemplates = useMemo(
    () => filterByVendor(templates, filterVendor, (t) => t.vendor_id),
    [templates, filterVendor]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await form.submit();
  };

  const handleDelete = async (id: string) => {
    const template = templates.find((t) => t.id === id);
    if (template && confirm(`Delete template "${template.name}"?`)) {
      await deleteTemplate(id);
    }
  };

  const handlePreview = (template: Template) => {
    setPreviewTemplateId(template.id);
    setPreviewDeviceMAC('');
    setPreviewOutput(null);
    setShowPreview(true);
    modalRoute.openModal('template-preview', { id: template.id });
  };

  const handleGeneratePreview = async () => {
    if (!previewTemplateId) return;
    setPreviewLoading(true);

    const previewData = previewDevice
      ? {
          device: {
            mac: previewDevice.mac,
            ip: previewDevice.ip,
            hostname: previewDevice.hostname,
            vendor: previewDevice.vendor,
            serial_number: previewDevice.serial_number,
          },
          subnet: '255.255.255.0',
          gateway: previewDevice.ip.replace(/\.\d+$/, '.1'),
        }
      : SAMPLE_DEVICE_FOR_PREVIEW;

    const output = await previewTemplate(previewTemplateId, previewData);
    setPreviewLoading(false);
    if (output !== null) {
      setPreviewOutput(output);
    }
  };

  const handleClosePreview = () => {
    setShowPreview(false);
    setPreviewTemplateId(null);
    setPreviewDeviceMAC('');
    setPreviewOutput(null);
    modalRoute.closeModal();
  };

  const handleFormPreview = async () => {
    // For in-form preview, we need to create/update first or use a temp approach
    // For now, this is only available for existing templates
    if (form.editingItem) {
      await handlePreview(form.editingItem);
    }
  };

  const insertVariable = (varName: string) => {
    const textarea = document.querySelector('textarea[name="content"]') as HTMLTextAreaElement;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = form.formData.content;
      const before = text.substring(0, start);
      const after = text.substring(end);
      const newContent = `${before}{{.${varName}}}${after}`;
      form.setField('content', newContent);
      // Set cursor position after inserted variable
      setTimeout(() => {
        textarea.focus();
        const newPos = start + varName.length + 5; // {{.}} = 5 chars
        textarea.setSelectionRange(newPos, newPos);
      }, 0);
    }
  };

  const templateColumns: TableColumn<Template>[] = useMemo(() => [
    {
      header: 'Name',
      accessor: (t) => (
        <>
          <strong>{t.name}</strong>
          {t.description && (
            <>
              <br />
              <span className="text-xs text-secondary">{t.description}</span>
            </>
          )}
        </>
      ),
      searchValue: (t) => `${t.name} ${t.description || ''}`,
    },
    {
      header: 'Vendor',
      accessor: (t) => t.vendor_id
        ? <VendorBadge vendor={getVendorName(t.vendor_id)} size="sm" />
        : <span className="text-muted text-xs">Global</span>,
      searchValue: (t) => t.vendor_id ? getVendorName(t.vendor_id) : 'Global',
    },
    {
      header: 'Preview',
      accessor: (t) => Cell.code(
        t.content.length > 50 ? t.content.substring(0, 50) + '...' : t.content
      ),
      searchable: false,
    },
    {
      header: 'Devices',
      accessor: (t) => Cell.status(
        String(t.device_count || 0),
        (t.device_count || 0) > 0 ? 'online' : 'offline'
      ),
      searchable: false,
    },
  ], []);

  const templateActions: TableAction<Template>[] = useMemo(() => [
    {
      icon: <Icon name="visibility" size={14} />,
      label: 'Preview',
      onClick: handlePreview,
      variant: 'secondary',
      tooltip: 'Preview with sample data',
    },
    {
      icon: <Icon name="edit" size={14} />,
      label: 'Edit',
      onClick: form.openEdit,
      variant: 'secondary',
      tooltip: 'Edit template',
    },
    {
      icon: <Icon name="delete" size={14} />,
      label: 'Delete',
      onClick: (t) => handleDelete(t.id),
      variant: 'danger',
      tooltip: (t) => (t.device_count || 0) > 0 ? 'Cannot delete - in use by devices' : 'Delete template',
      disabled: (t) => (t.device_count || 0) > 0,
    },
  ], []);

  return (
    <LoadingState loading={loading} error={error} loadingMessage="Loading templates...">
      <ActionBar>
        <Button onClick={form.openAdd}>
          <PlusIcon size={16} />
          Add Template
        </Button>
        <Tooltip content="Convert a raw config into a template by detecting variables">
          <Button variant="secondary" onClick={() => { setShowTemplatizer(true); modalRoute.openModal('templatizer'); }}>
            <Icon name="auto_fix_high" size={16} />
            Templatize Config
          </Button>
        </Tooltip>
        <DropdownSelect
          options={filterVendorOptions}
          value={filterVendor}
          onChange={setFilterVendor}
          placeholder="Filter: All Vendors"
          icon="filter_list"
          className="filter-dropdown"
        />
      </ActionBar>

      <Card title="Template Variables" titleAction={<InfoSection.Toggle open={showVarsInfo} onToggle={setShowVarsInfo} />}>
        <InfoSection open={showVarsInfo}>
          <p>
            Use Go template syntax. Variables are accessed with {'{{.VariableName}}'}.
            These variables are automatically populated from device and global settings when rendering a template.
          </p>
        </InfoSection>
        <SimpleTable
          headers={['Variable', 'Description', 'Example']}
          rows={variables.map((v) => [
            Cell.code(`{{.${v.name}}}`),
            v.description,
            Cell.code(v.example),
          ])}
        />
      </Card>

      <Card title="Configuration Templates" titleAction={<InfoSection.Toggle open={showInfo} onToggle={setShowInfo} />}>
        <InfoSection open={showInfo}>
          <div>
            <p>
              Templates use Go template syntax with {'{{.VariableName}}'} for variable substitution.
              Each template can be scoped to a vendor or used globally. Click a row to expand and view the full template content.
            </p>
          </div>
        </InfoSection>
        <Table
          data={filteredTemplates}
          columns={templateColumns}
          getRowKey={(t) => t.id}
          tableId="templates"
          actions={templateActions}
          renderExpandedRow={(t) => (
            <ConfigViewer
              value={t.content}
              lineNumbers
              copyable
              maxHeight={400}
            />
          )}
          searchable
          searchPlaceholder="Search templates..."
          emptyMessage="No templates configured."
          emptyDescription='Click "Add Template" to create your first configuration template.'
        />
      </Card>

      {/* Template Form Dialog - uses custom footer for Preview button */}
      <Modal
        isOpen={form.isOpen}
        onClose={form.close}
        title={form.getTitle('Add Template', 'Edit Template')}
        variant="extra-wide"
        footer={
          <DialogActions align="space-between">
            <div>
              {form.isEditing && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleFormPreview}
                  disabled={previewLoading}
                >
                  <Icon name="visibility" size={14} />
                  Preview
                </Button>
              )}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <Button type="button" variant="secondary" onClick={form.close}>
                Cancel
              </Button>
              <Button type="submit" form="template-form">
                {form.getSubmitText('Add Template', 'Update Template')}
              </Button>
            </div>
          </DialogActions>
        }
      >
        <form id="template-form" onSubmit={handleSubmit}>
          <div className="form-row">
            <FormField
              label="Template Name *"
              name="name"
              type="text"
              value={form.formData.name}
              onChange={form.handleChange}
              placeholder="e.g., Cisco IOS Base Config"
              required
            />
            <SelectField
              label="Vendor"
              name="vendor_id"
              value={form.formData.vendor_id}
              onChange={form.handleChange}
              options={vendorSelectOptions}
            />
          </div>

          <FormField
            label="Description"
            name="description"
            type="text"
            value={form.formData.description}
            onChange={form.handleChange}
            placeholder="Brief description of this template"
          />

          <div className="form-group">
            <div className="mb-8">
              <span className="text-xs text-secondary">
                Insert variable:
              </span>
              {variables.slice(0, 6).map((v) => (
                <Tooltip key={v.name} content={`${v.description} (e.g., ${v.example})`}>
                  <button
                    type="button"
                    onClick={() => insertVariable(v.name)}
                    className="variable-chip"
                  >
                    {v.name}
                  </button>
                </Tooltip>
              ))}
            </div>
            <ConfigViewer
              value={form.formData.content}
              onChange={(val) => form.setField('content', val)}
              editable
              name="content"
              label="Template Content"
              placeholder={`! Example Cisco config template
hostname {{.Hostname}}
!
interface Vlan1
 ip address {{.IP}} {{.Subnet}}
 no shutdown
!
ip default-gateway {{.Gateway}}
!
end`}
              required
              minRows={14}
            />
          </div>
        </form>
      </Modal>

      {/* Preview Dialog */}
      <Modal
        isOpen={showPreview}
        onClose={handleClosePreview}
        title="Template Preview"
        variant="extra-wide"
      >
        <div className="form-group mb-16">
          <label htmlFor="previewDevice">Device</label>
          <div className="flex-row">
            <select
              id="previewDevice"
              name="previewDevice"
              value={previewDeviceMAC}
              onChange={(e) => setPreviewDeviceMAC(e.target.value)}
              style={{ flex: 1 }}
            >
              {deviceOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <Button onClick={handleGeneratePreview} disabled={previewLoading}>
              <Icon name={previewLoading ? 'hourglass_empty' : 'visibility'} size={14} />
              {previewLoading ? 'Generating...' : 'Generate'}
            </Button>
          </div>
        </div>

        {previewDevice ? (
          <div className="info-box mb-16">
            <div className="preview-device-grid">
              <div><span className="text-secondary">Hostname:</span> <code>{previewDevice.hostname}</code></div>
              <div><span className="text-secondary">MAC:</span> <code>{previewDevice.mac}</code></div>
              <div><span className="text-secondary">IP:</span> <code>{previewDevice.ip}</code></div>
              {previewDevice.vendor && <div><span className="text-secondary">Vendor:</span> <code>{previewDevice.vendor}</code></div>}
              {previewDevice.serial_number && <div><span className="text-secondary">Serial:</span> <code>{previewDevice.serial_number}</code></div>}
            </div>
          </div>
        ) : (
          <div className="info-box info-box-primary mb-16">
            <p className="text-sm text-secondary">
              Using sample data: MAC {SAMPLE_DEVICE_FOR_PREVIEW.device.mac}, IP {SAMPLE_DEVICE_FOR_PREVIEW.device.ip}, Hostname {SAMPLE_DEVICE_FOR_PREVIEW.device.hostname}
            </p>
          </div>
        )}

        {previewOutput ? (
          <ConfigViewer
            value={previewOutput}
            label="Rendered Configuration"
            lineNumbers
            copyable
          />
        ) : (
          <div className="empty-state">
            <Icon name="visibility" size={48} />
            <p>Select a device and click Generate to preview the configuration</p>
          </div>
        )}

        <DialogActions>
          <Button variant="secondary" onClick={handleClosePreview}>
            Close
          </Button>
        </DialogActions>
      </Modal>

      {/* Templatizer Dialog */}
      <Modal
        isOpen={showTemplatizer}
        onClose={() => { setShowTemplatizer(false); modalRoute.closeModal(); }}
        title="Templatize Configuration"
        variant="wide"
      >
        <Templatizer
          onComplete={(templateContent) => {
            // Close templatizer and open add form with the generated content
            setShowTemplatizer(false);
            form.openAdd();
            form.setField('content', templateContent);
          }}
          onCancel={() => { setShowTemplatizer(false); modalRoute.closeModal(); }}
        />
      </Modal>
    </LoadingState>
  );
}
