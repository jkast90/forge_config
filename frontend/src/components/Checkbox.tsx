import { InputHTMLAttributes, useRef, useEffect } from 'react';

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange'> {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Renders as indeterminate (dash) state */
  indeterminate?: boolean;
  /** Optional label text */
  label?: string;
}

export function Checkbox({ checked, onChange, indeterminate, label, disabled, id, name, className, ...rest }: CheckboxProps) {
  const ref = useRef<HTMLInputElement>(null);
  const fieldId = id || name;

  useEffect(() => {
    if (ref.current) {
      ref.current.indeterminate = !!indeterminate;
    }
  }, [indeterminate]);

  const input = (
    <span className={`checkbox${checked ? ' checkbox-checked' : ''}${indeterminate ? ' checkbox-indeterminate' : ''}${disabled ? ' checkbox-disabled' : ''}`}>
      <input
        ref={ref}
        id={fieldId}
        name={name}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="checkbox-input"
        {...rest}
      />
      <svg className="checkbox-icon" viewBox="0 0 16 16" fill="none">
        {indeterminate ? (
          <line x1="4" y1="8" x2="12" y2="8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        ) : checked ? (
          <polyline points="3.5,8 6.5,11 12.5,5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        ) : null}
      </svg>
    </span>
  );

  if (!label) return input;

  return (
    <label htmlFor={fieldId} className={`checkbox-label${disabled ? ' checkbox-disabled' : ''}${className ? ` ${className}` : ''}`}>
      {input}
      <span className="checkbox-label-text">{label}</span>
    </label>
  );
}
