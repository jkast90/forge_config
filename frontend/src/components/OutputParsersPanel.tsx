import { useState, useMemo } from 'react';
import type { OutputParser, OutputParserFormData } from '@core';
import { Button } from './Button';
import { Card } from './Card';
import { FormDialog } from './FormDialog';
import { FormField } from './FormField';
import { InfoSection } from './InfoSection';
import { Table, Cell } from './Table';
import type { TableColumn, TableAction } from './Table';
import { Icon, PlusIcon, RefreshIcon, SpinnerIcon } from './Icon';

interface OutputParsersPanelProps {
  outputParsers: OutputParser[];
  loading: boolean;
  onCreate: (data: OutputParserFormData) => Promise<boolean>;
  onUpdate: (id: number, data: OutputParserFormData) => Promise<boolean>;
  onDelete: (id: number) => Promise<boolean>;
  onRefresh: () => void;
}

const EMPTY_FORM: OutputParserFormData = {
  name: '',
  description: '',
  pattern: '',
  extract_names: '',
  enabled: true,
};

export function OutputParsersPanel({ outputParsers, loading, onCreate, onUpdate, onDelete, onRefresh }: OutputParsersPanelProps) {
  const [showInfo, setShowInfo] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<OutputParser | null>(null);
  const [formData, setFormData] = useState<OutputParserFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [testInput, setTestInput] = useState('');
  const [testResult, setTestResult] = useState<string | null>(null);

  const openCreate = () => {
    setEditing(null);
    setFormData(EMPTY_FORM);
    setTestInput('');
    setTestResult(null);
    setShowForm(true);
  };

  const openEdit = (parser: OutputParser) => {
    setEditing(parser);
    setFormData({
      name: parser.name,
      description: parser.description || '',
      pattern: parser.pattern,
      extract_names: parser.extract_names,
      enabled: parser.enabled,
    });
    setTestInput('');
    setTestResult(null);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.pattern.trim()) return;
    setSaving(true);
    try {
      const ok = editing
        ? await onUpdate(editing.id, formData)
        : await onCreate(formData);
      if (ok) setShowForm(false);
    } finally {
      setSaving(false);
    }
  };

  const handleTestRegex = () => {
    if (!formData.pattern || !testInput) {
      setTestResult(null);
      return;
    }
    try {
      const regex = new RegExp(formData.pattern, 'gm');
      const names = formData.extract_names.split(',').map(n => n.trim()).filter(Boolean);
      const matches: Record<string, string>[] = [];
      let match;
      while ((match = regex.exec(testInput)) !== null) {
        const row: Record<string, string> = {};
        match.slice(1).forEach((val, i) => {
          row[names[i] || `group_${i + 1}`] = val || '';
        });
        matches.push(row);
        if (!regex.global) break;
      }
      if (matches.length === 0) {
        setTestResult('No matches found');
      } else {
        setTestResult(JSON.stringify(matches, null, 2));
      }
    } catch (err) {
      setTestResult(`Regex error: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const columns: TableColumn<OutputParser>[] = useMemo(() => [
    {
      header: 'Name',
      accessor: (p) => p.name,
      searchValue: (p) => p.name,
    },
    {
      header: 'Pattern',
      accessor: (p) => Cell.code(p.pattern.length > 50 ? p.pattern.slice(0, 50) + '...' : p.pattern),
      searchValue: (p) => p.pattern,
    },
    {
      header: 'Extract Names',
      accessor: (p) => p.extract_names || <span className="text-muted">-</span>,
      searchValue: (p) => p.extract_names,
    },
    {
      header: 'Enabled',
      accessor: (p) => Cell.status(p.enabled ? 'Yes' : 'No', p.enabled ? 'online' : 'offline'),
      searchable: false,
      width: '80px',
    },
    {
      header: 'Description',
      accessor: (p) => p.description || <span className="text-muted">-</span>,
      searchValue: (p) => p.description || '',
    },
  ], []);

  const tableActions: TableAction<OutputParser>[] = [
    {
      icon: <Icon name="edit" size={14} />,
      label: 'Edit',
      onClick: (p: OutputParser) => openEdit(p),
      variant: 'secondary',
      tooltip: 'Edit parser',
    },
    {
      icon: <Icon name="delete" size={14} />,
      label: 'Delete',
      onClick: (p: OutputParser) => onDelete(p.id),
      variant: 'danger',
      tooltip: 'Delete parser',
    },
  ];

  return (
    <>
      <Card
        title="Output Parsers"
        titleAction={<InfoSection.Toggle open={showInfo} onToggle={setShowInfo} />}
        headerAction={
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button variant="primary" onClick={openCreate}>
              <PlusIcon size={14} />
              Add Parser
            </Button>
            <Button variant="secondary" onClick={onRefresh} disabled={loading}>
              <RefreshIcon size={14} />
            </Button>
          </div>
        }
      >
        <InfoSection open={showInfo}>
          <div>
            <p>
              Regex-based parsers that extract structured data from command output. Assign a parser to a vendor action
              to view parsed results as a table in the job history.
            </p>
            <ul>
              <li>Define regex patterns with capture groups</li>
              <li>Map capture groups to named columns via extract names</li>
              <li>Test patterns against sample output before saving</li>
            </ul>
          </div>
        </InfoSection>
        {loading && outputParsers.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '24px', justifyContent: 'center' }}>
            <SpinnerIcon size={16} /> Loading output parsers...
          </div>
        ) : (
          <Table
            data={outputParsers}
            columns={columns}
            getRowKey={(p) => p.id}
            actions={tableActions}
            tableId="output-parsers"
            searchable
            searchPlaceholder="Search parsers..."
            emptyMessage="No output parsers configured."
            emptyDescription="Create parsers to extract structured data from command output using regex."
          />
        )}
      </Card>

      <FormDialog
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        title={editing ? 'Edit Output Parser' : 'Add Output Parser'}
        onSubmit={handleSubmit}
        submitText={editing ? 'Update' : 'Create'}
        saving={saving}
        submitDisabled={!formData.name.trim() || !formData.pattern.trim()}
        variant="wide"
      >
        <FormField
          label="Name"
          name="name"
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="e.g., Parse Interface Status"
          required
        />
        <FormField
          label="Description"
          name="description"
          type="text"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Optional description of what this parser extracts"
        />
        <div className="form-group">
          <label htmlFor="pattern">Regex Pattern *</label>
          <textarea
            id="pattern"
            name="pattern"
            value={formData.pattern}
            onChange={(e) => setFormData({ ...formData, pattern: e.target.value })}
            placeholder="e.g., (\S+)\s+(up|down)\s+(\S+)"
            rows={3}
            required
            style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '0.85rem' }}
          />
        </div>
        <FormField
          label="Extract Names (comma-separated)"
          name="extract_names"
          type="text"
          value={formData.extract_names}
          onChange={(e) => setFormData({ ...formData, extract_names: e.target.value })}
          placeholder="e.g., interface, status, protocol"
        />
        <div className="form-hint">
          Each capture group in the regex maps to a name. Names are used as column headers when displaying parsed output.
        </div>
        <div className="form-group">
          <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="checkbox"
              checked={formData.enabled}
              onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
            />
            Enabled
          </label>
        </div>

        {/* Test Section */}
        <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '12px', marginTop: '8px' }}>
          <div className="form-group">
            <label htmlFor="test-input" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>Test Input</span>
              <Button variant="secondary" size="sm" onClick={handleTestRegex} disabled={!formData.pattern || !testInput}>
                <Icon name="play_arrow" size={14} />
                Test
              </Button>
            </label>
            <textarea
              id="test-input"
              value={testInput}
              onChange={(e) => setTestInput(e.target.value)}
              placeholder="Paste sample command output here to test your regex..."
              rows={4}
              style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '0.85rem' }}
            />
          </div>
          {testResult && (
            <div className="form-group">
              <label className="form-label">Test Result</label>
              <pre className="command-entry-output" style={{ maxHeight: '200px', overflow: 'auto' }}>
                {testResult}
              </pre>
            </div>
          )}
        </div>
      </FormDialog>
    </>
  );
}
