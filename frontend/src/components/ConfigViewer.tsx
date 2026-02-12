import { useRef, useCallback, useMemo } from 'react';
import { IconButton } from './IconButton';
import { Icon } from './Icon';
import { Tooltip } from './Tooltip';

interface ConfigViewerProps {
  /** The config/template content to display or edit */
  value: string;
  /** Called when content changes (edit mode only) */
  onChange?: (value: string) => void;
  /** Whether the content is editable */
  editable?: boolean;
  /** Textarea name attribute (for form integration) */
  name?: string;
  /** Placeholder text for empty state */
  placeholder?: string;
  /** Minimum rows for textarea */
  minRows?: number;
  /** Whether the textarea is required */
  required?: boolean;
  /** Show line numbers (read-only mode only) */
  lineNumbers?: boolean;
  /** Maximum height before scrolling (read-only mode) */
  maxHeight?: number;
  /** Show copy button */
  copyable?: boolean;
  /** Label shown above the viewer */
  label?: string;
  /** Additional className */
  className?: string;
}

export function ConfigViewer({
  value,
  onChange,
  editable = false,
  name,
  placeholder,
  minRows = 12,
  required = false,
  lineNumbers = true,
  maxHeight,
  copyable = true,
  label,
  className = '',
}: ConfigViewerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = value;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
  }, [value]);

  const lines = useMemo(() => value.split('\n'), [value]);
  const lineCount = lines.length;

  const toolbar = (copyable) && (
    <div className="cv-toolbar">
      {copyable && value && (
        <Tooltip content="Copy to clipboard">
          <IconButton variant="ghost" size="sm" onClick={handleCopy}>
            <Icon name="content_copy" size={14} />
          </IconButton>
        </Tooltip>
      )}
      {lineCount > 0 && value && (
        <span className="cv-meta">
          {lineCount} line{lineCount !== 1 ? 's' : ''}
        </span>
      )}
    </div>
  );

  if (editable) {
    return (
      <div className={`cv cv-editable ${className}`}>
        {(label || toolbar) && (
          <div className="cv-header">
            {label && <label className="cv-label">{label}</label>}
            {toolbar}
          </div>
        )}
        <textarea
          ref={textareaRef}
          name={name}
          className="cv-textarea"
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          placeholder={placeholder}
          rows={minRows}
          required={required}
          spellCheck={false}
        />
      </div>
    );
  }

  return (
    <div className={`cv ${className}`}>
      {(label || toolbar) && (
        <div className="cv-header">
          {label && <label className="cv-label">{label}</label>}
          {toolbar}
        </div>
      )}
      <div
        className="cv-content"
        style={maxHeight ? { maxHeight } : undefined}
      >
        {lineNumbers ? (
          <div className="cv-lines">
            <div className="cv-gutter">
              {lines.map((_, i) => (
                <span key={i} className="cv-line-number">
                  {i + 1}
                </span>
              ))}
            </div>
            <pre className="cv-code">
              {value || <span className="text-muted">{placeholder || 'No content'}</span>}
            </pre>
          </div>
        ) : (
          <pre className="cv-code">
            {value || <span className="text-muted">{placeholder || 'No content'}</span>}
          </pre>
        )}
      </div>
    </div>
  );
}
