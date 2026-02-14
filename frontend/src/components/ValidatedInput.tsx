import { useState, useCallback, InputHTMLAttributes } from 'react';
import type { Validator } from '@core';

interface ValidatedInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  name: string;
  /** One or more validators. Runs in order; first error wins. */
  validate?: Validator | Validator[];
  /** External error (e.g. from form-level validation). Shown when no internal error. */
  error?: string;
}

/**
 * A form input that validates on blur and shows inline errors.
 * Clears the error as soon as the user starts typing again.
 */
export function ValidatedInput({ label, name, id, validate, error: externalError, onChange, onBlur, ...inputProps }: ValidatedInputProps) {
  const [internalError, setInternalError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const fieldId = id || name;
  const error = internalError || externalError || null;

  const runValidation = useCallback((value: string) => {
    if (!validate) return null;
    const fns = Array.isArray(validate) ? validate : [validate];
    for (const fn of fns) {
      const result = fn(value);
      if (result) return result;
    }
    return null;
  }, [validate]);

  const handleBlur = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    setTouched(true);
    const err = runValidation(e.target.value);
    setInternalError(err);
    onBlur?.(e);
  }, [runValidation, onBlur]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    // Clear internal error while typing if previously touched
    if (touched && internalError) {
      const err = runValidation(e.target.value);
      if (!err) setInternalError(null);
    }
    onChange?.(e);
  }, [onChange, touched, internalError, runValidation]);

  return (
    <div className={`form-group${error ? ' has-error' : ''}`}>
      <label htmlFor={fieldId}>{label}</label>
      <input
        id={fieldId}
        name={name}
        className={error ? 'input-error' : undefined}
        onChange={handleChange}
        onBlur={handleBlur}
        {...inputProps}
      />
      {error && <span className="error-message">{error}</span>}
    </div>
  );
}
