import { InputHTMLAttributes } from 'react';

interface ToggleProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange'> {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Optional description shown below the label */
  description?: string;
}

export function Toggle({ label, checked, onChange, description, disabled, id, name, ...rest }: ToggleProps) {
  const fieldId = id || name || label;

  return (
    <label htmlFor={fieldId} className={`toggle-field${disabled ? ' toggle-disabled' : ''}`}>
      <div className="toggle-label-group">
        <span className="toggle-label">{label}</span>
        {description && <span className="toggle-description">{description}</span>}
      </div>
      <div className={`toggle-track${checked ? ' toggle-on' : ''}`}>
        <input
          id={fieldId}
          name={name}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
          className="toggle-input"
          {...rest}
        />
        <div className="toggle-thumb" />
      </div>
    </label>
  );
}
