import { useCallback, useRef } from 'react';
import { Icon } from './Icon';

interface NumberInputProps {
  value: number | string;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  className?: string;
  /** Compact mode for inline table usage */
  size?: 'default' | 'sm';
}

export function NumberInput({ value, onChange, min, max, step = 1, disabled, className, size = 'default' }: NumberInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const numValue = typeof value === 'string' ? parseInt(value) || 0 : value;

  const clamp = useCallback((v: number) => {
    if (min !== undefined && v < min) return min;
    if (max !== undefined && v > max) return max;
    return v;
  }, [min, max]);

  const handleIncrement = useCallback(() => {
    if (disabled) return;
    onChange(clamp(numValue + step));
  }, [numValue, step, clamp, onChange, disabled]);

  const handleDecrement = useCallback(() => {
    if (disabled) return;
    onChange(clamp(numValue - step));
  }, [numValue, step, clamp, onChange, disabled]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (raw === '' || raw === '-') return;
    const parsed = parseInt(raw);
    if (!isNaN(parsed)) onChange(clamp(parsed));
  }, [onChange, clamp]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowUp') { e.preventDefault(); handleIncrement(); }
    if (e.key === 'ArrowDown') { e.preventDefault(); handleDecrement(); }
  }, [handleIncrement, handleDecrement]);

  const sm = size === 'sm';

  return (
    <div className={`number-input${sm ? ' number-input-sm' : ''}${disabled ? ' number-input-disabled' : ''}${className ? ` ${className}` : ''}`}>
      <button
        type="button"
        className="number-input-btn"
        onClick={handleDecrement}
        disabled={disabled || (min !== undefined && numValue <= min)}
        tabIndex={-1}
        aria-label="Decrease"
      >
        <Icon name="remove" size={sm ? 12 : 14} />
      </button>
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        disabled={disabled}
      />
      <button
        type="button"
        className="number-input-btn"
        onClick={handleIncrement}
        disabled={disabled || (max !== undefined && numValue >= max)}
        tabIndex={-1}
        aria-label="Increase"
      >
        <Icon name="add" size={sm ? 12 : 14} />
      </button>
    </div>
  );
}
