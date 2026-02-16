import { InputHTMLAttributes, TextareaHTMLAttributes, ChangeEvent } from 'react';

interface FormFieldProps {
  label: string;
  name: string;
  error?: string;
  type?: string;
  rows?: number;
  value?: string | number | readonly string[];
  onChange?: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  placeholder?: string;
  id?: string;
  className?: string;
  disabled?: boolean;
  required?: boolean;
  min?: string | number;
  max?: string | number;
  step?: string | number;
  checked?: boolean;
  autoFocus?: boolean;
}

export function FormField({ label, name, id, error, type, rows, ...rest }: FormFieldProps) {
  const fieldId = id || name;

  return (
    <div className={`form-group${error ? ' has-error' : ''}`}>
      <label htmlFor={fieldId}>{label}</label>
      {type === 'textarea' ? (
        <textarea
          id={fieldId}
          name={name}
          className={error ? 'input-error' : undefined}
          rows={rows}
          value={rest.value as string}
          onChange={rest.onChange as TextareaHTMLAttributes<HTMLTextAreaElement>['onChange']}
          placeholder={rest.placeholder}
          disabled={rest.disabled}
          required={rest.required}
          autoFocus={rest.autoFocus}
        />
      ) : (
        <input
          id={fieldId}
          name={name}
          type={type}
          className={error ? 'input-error' : undefined}
          {...rest}
        />
      )}
      {error && <span className="error-message">{error}</span>}
    </div>
  );
}
