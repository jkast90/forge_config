import { useState, useRef, useEffect, useMemo, useCallback, type SelectHTMLAttributes } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './Icon';

interface SelectFieldProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> {
  label?: string;
  name: string;
  options: readonly { value: string; label: string }[];
  error?: string;
  placeholder?: string;
  icon?: string;
  onChange?: (e: { target: { name: string; value: string } }) => void;
}

const SEARCH_THRESHOLD = 1;

export function SelectField({ label, name, id, options, error, value, onChange, disabled, placeholder, icon, className, ...rest }: SelectFieldProps) {
  const fieldId = id || name;
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [menuPos, setMenuPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((o) => o.value === String(value ?? ''));
  const showSearch = options.length >= SEARCH_THRESHOLD;

  // Calculate menu position from trigger button
  const updateMenuPosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setMenuPos({
      top: rect.bottom + 4,
      left: rect.left,
      width: rect.width,
    });
  }, []);

  // Reset search and auto-focus when opening
  useEffect(() => {
    if (isOpen) {
      setSearch('');
      updateMenuPosition();
      if (showSearch) {
        requestAnimationFrame(() => searchRef.current?.focus());
      }
    }
  }, [isOpen, showSearch, updateMenuPosition]);

  // Update position on scroll/resize while open
  useEffect(() => {
    if (!isOpen) return;
    const handleReposition = () => updateMenuPosition();
    window.addEventListener('scroll', handleReposition, true);
    window.addEventListener('resize', handleReposition);
    return () => {
      window.removeEventListener('scroll', handleReposition, true);
      window.removeEventListener('resize', handleReposition);
    };
  }, [isOpen, updateMenuPosition]);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (
        dropdownRef.current && !dropdownRef.current.contains(target) &&
        menuRef.current && !menuRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Close on escape key
  useEffect(() => {
    if (!isOpen) return;
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsOpen(false);
    }
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen]);

  // Scroll active item into view when menu opens
  useEffect(() => {
    if (!isOpen || !menuRef.current) return;
    requestAnimationFrame(() => {
      const active = menuRef.current?.querySelector('.select-field-item.active');
      if (active) active.scrollIntoView({ block: 'nearest' });
    });
  }, [isOpen]);

  const handleSelect = (optionValue: string) => {
    onChange?.({ target: { name, value: optionValue } });
    setIsOpen(false);
  };

  const filteredOptions = useMemo(() => {
    if (!search.trim()) return options;
    const q = search.toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q));
  }, [options, search]);

  const menu = isOpen && menuPos && createPortal(
    <div
      className="select-field-menu"
      role="listbox"
      ref={menuRef}
      style={{
        position: 'fixed',
        top: menuPos.top,
        left: menuPos.left,
        width: menuPos.width,
        minWidth: menuPos.width,
      }}
    >
      {showSearch && (
        <div className="select-field-search">
          <Icon name="search" size={14} />
          <input
            ref={searchRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search..."
            className="select-field-search-input"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && filteredOptions.length > 0) {
                handleSelect(filteredOptions[0].value);
              }
            }}
          />
        </div>
      )}
      <div className="select-field-options">
        {filteredOptions.length === 0 ? (
          <div className="select-field-empty">No matches</div>
        ) : (
          filteredOptions.map((option) => (
            <button
              key={option.value}
              className={`select-field-item${option.value === String(value ?? '') ? ' active' : ''}`}
              onClick={() => handleSelect(option.value)}
              role="option"
              aria-selected={option.value === String(value ?? '')}
              type="button"
            >
              <span className="select-field-item-label">{option.label}</span>
              {option.value === String(value ?? '') && <Icon name="check" size={16} />}
            </button>
          ))
        )}
      </div>
    </div>,
    document.body
  );

  const dropdown = (
    <div className={`select-field${className ? ` ${className}` : ''}`} ref={dropdownRef}>
      <button
        id={fieldId}
        type="button"
        className={`select-field-trigger${error ? ' input-error' : ''}${disabled ? ' disabled' : ''}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        disabled={disabled}
        ref={triggerRef}
      >
        {icon && <Icon name={icon} size={18} />}
        <span className="select-field-label">
          {selectedOption?.label || <span className="select-field-placeholder">{placeholder || 'Select...'}</span>}
        </span>
        <Icon name={isOpen ? 'expand_less' : 'expand_more'} size={18} />
      </button>
      {menu}
    </div>
  );

  // Without a label, render just the dropdown (inline mode for filters, action bars, etc.)
  if (!label) return dropdown;

  return (
    <div className={`form-group${error ? ' has-error' : ''}`}>
      <label htmlFor={fieldId}>{label}</label>
      {dropdown}
      {error && <span className="error-message">{error}</span>}
    </div>
  );
}
