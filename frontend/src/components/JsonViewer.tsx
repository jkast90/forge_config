import { useState, useCallback } from 'react';
import { Icon } from './Icon';

interface JsonViewerProps {
  /** The data to display as JSON */
  data: unknown;
  /** Max height for the JSON container (default: 400px) */
  maxHeight?: number;
  /** Label shown above the viewer */
  label?: string;
  /** Enable editing mode */
  editable?: boolean;
  /** Called with parsed JSON when content changes in editable mode */
  onChange?: (data: unknown) => void;
}

/** Display a single JSON value with pretty-printing, copy support, and optional editing */
export function JsonViewer({ data, maxHeight = 400, label, editable, onChange }: JsonViewerProps) {
  const [copied, setCopied] = useState(false);
  const [editValue, setEditValue] = useState<string | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  const json = editValue ?? JSON.stringify(data, null, 2);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(json);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [json]);

  const handleChange = useCallback((value: string) => {
    setEditValue(value);
    try {
      const parsed = JSON.parse(value);
      setParseError(null);
      onChange?.(parsed);
    } catch {
      setParseError('Invalid JSON');
    }
  }, [onChange]);

  const handleFormat = useCallback(() => {
    try {
      const parsed = JSON.parse(json);
      const formatted = JSON.stringify(parsed, null, 2);
      setEditValue(formatted);
      setParseError(null);
      onChange?.(parsed);
    } catch {
      setParseError('Invalid JSON — cannot format');
    }
  }, [json, onChange]);

  return (
    <div className={`json-viewer${parseError ? ' json-viewer-error' : ''}`}>
      <div className="json-viewer-header">
        {label && <span className="json-viewer-label">{label}</span>}
        <div className="json-viewer-actions">
          {editable && editValue !== null && (
            <button className="json-viewer-action clickable" onClick={handleFormat} title="Format JSON">
              <Icon name="format_align_left" size={14} />
              Format
            </button>
          )}
          <button className="json-viewer-action clickable" onClick={handleCopy} title="Copy JSON">
            <Icon name={copied ? 'check' : 'content_copy'} size={14} />
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>
      {parseError && (
        <div className="json-viewer-parse-error">
          <Icon name="error" size={14} />
          {parseError}
        </div>
      )}
      {editable ? (
        <textarea
          className="json-viewer-textarea"
          value={json}
          onChange={(e) => handleChange(e.target.value)}
          style={{ maxHeight, minHeight: Math.min(200, maxHeight) }}
          spellCheck={false}
        />
      ) : (
        <pre className="json-viewer-pre" style={{ maxHeight }}>
          {json}
        </pre>
      )}
    </div>
  );
}

interface JsonRowProps {
  /** The data item to display */
  item: Record<string, unknown>;
  /** Fields to show in the summary row */
  summaryFields?: string[];
  /** Unique key for this row */
  itemKey?: string;
}

/** A single expandable row showing summary fields with full JSON on expand */
export function JsonRow({ item, summaryFields = [] }: JsonRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(JSON.stringify(item, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [item]);

  return (
    <div className="json-viewer-entry">
      <div className="json-viewer-row clickable" onClick={() => setExpanded(!expanded)}>
        <Icon name={expanded ? 'expand_more' : 'chevron_right'} size={16} />
        <div className="json-viewer-summary">
          {summaryFields.map((field) => {
            const val = item[field];
            if (val === undefined || val === null) return null;
            const display = typeof val === 'object' ? JSON.stringify(val) : String(val);
            return (
              <span key={field} className="json-viewer-field">
                <span className="json-viewer-field-label">{field}</span>
                <span className="json-viewer-field-value">{display}</span>
              </span>
            );
          })}
        </div>
        <button
          className="json-viewer-row-copy clickable"
          onClick={handleCopy}
          title="Copy JSON"
        >
          <Icon name={copied ? 'check' : 'content_copy'} size={14} />
        </button>
      </div>
      {expanded && (
        <div className="json-viewer-detail">
          <pre className="pre-scrollable">{JSON.stringify(item, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

interface JsonListProps {
  /** Array of items to display */
  items: Record<string, unknown>[];
  /** Fields to show in each summary row */
  summaryFields?: string[];
  /** Function to get unique key for each item */
  getKey?: (item: Record<string, unknown>, index: number) => string;
}

/** A list of expandable JSON rows */
export function JsonList({ items, summaryFields = [], getKey }: JsonListProps) {
  return (
    <div className="json-viewer-list">
      {items.map((item, i) => (
        <JsonRow
          key={getKey ? getKey(item, i) : (item.id as string) || (item.mac as string) || String(i)}
          item={item}
          summaryFields={summaryFields}
        />
      ))}
    </div>
  );
}
