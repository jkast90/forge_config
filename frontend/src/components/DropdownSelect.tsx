import { useState, useRef, useEffect, useMemo } from 'react';
import { Icon } from './Icon';

export interface DropdownOption {
  id: string;
  label: string;
  icon?: string;
  description?: string;
}

interface Props {
  options: DropdownOption[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  icon?: string;
  showCheckmark?: boolean;
  className?: string;
  triggerClassName?: string;
  /** When set, renders a multi-column grid drawer with this many rows per column */
  columnRows?: number;
  /** Show a search input at the top of the dropdown */
  searchable?: boolean;
}

export function DropdownSelect({
  options,
  value,
  onChange,
  placeholder = 'Select...',
  icon = 'menu',
  showCheckmark = true,
  className = '',
  triggerClassName,
  columnRows,
  searchable = false,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selectedOption = options.find((o) => o.id === value);

  // Reset search and auto-focus when opening
  useEffect(() => {
    if (isOpen) {
      setSearch('');
      // Small delay so the DOM has rendered the input
      requestAnimationFrame(() => searchRef.current?.focus());
    }
  }, [isOpen]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Close on escape key
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen]);

  const handleSelect = (id: string) => {
    onChange(id);
    setIsOpen(false);
  };

  // Filter options by search term
  const filteredOptions = useMemo(() => {
    if (!search.trim()) return options;
    const q = search.toLowerCase();
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        o.description?.toLowerCase().includes(q) ||
        o.id.toLowerCase().includes(q)
    );
  }, [options, search]);

  // Split filtered options into columns when columnRows is set
  const columns = columnRows
    ? Array.from(
        { length: Math.ceil(filteredOptions.length / columnRows) || 1 },
        (_, i) => filteredOptions.slice(i * columnRows, (i + 1) * columnRows)
      )
    : null;

  const searchInput = searchable ? (
    <div className="dropdown-select-search">
      <Icon name="search" size={16} />
      <input
        ref={searchRef}
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search pages..."
        className="dropdown-select-search-input"
        onKeyDown={(e) => {
          // Enter selects the first match
          if (e.key === 'Enter' && filteredOptions.length > 0) {
            handleSelect(filteredOptions[0].id);
          }
        }}
      />
    </div>
  ) : null;

  return (
    <div className={`dropdown-select ${className}`} ref={dropdownRef}>
      <button
        className={triggerClassName || 'dropdown-select-trigger'}
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        type="button"
      >
        <Icon name={icon} size={20} />
        <span className="dropdown-select-label">
          {selectedOption?.label || placeholder}
        </span>
        <Icon name={isOpen ? 'expand_less' : 'expand_more'} size={20} />
      </button>

      {isOpen && (
        columns ? (
          <div className="dropdown-select-drawer" role="listbox">
            {searchInput}
            <div className="dropdown-select-drawer-columns">
              {filteredOptions.length === 0 ? (
                <div className="dropdown-select-empty">No matches</div>
              ) : (
                columns.map((col, colIndex) => (
                  <div key={colIndex} className="dropdown-select-drawer-column">
                    {col.map((option) => (
                      <button
                        key={option.id}
                        className={`dropdown-select-drawer-item${option.id === value ? ' active' : ''}`}
                        onClick={() => handleSelect(option.id)}
                        role="option"
                        aria-selected={option.id === value}
                        type="button"
                      >
                        {option.icon && <Icon name={option.icon} size={20} />}
                        <div className="dropdown-select-drawer-item-content">
                          <span className="dropdown-select-drawer-item-label">{option.label}</span>
                          {option.description && (
                            <span className="dropdown-select-drawer-item-description">
                              {option.description}
                            </span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                ))
              )}
            </div>
          </div>
        ) : (
          <div className="dropdown-select-menu" role="listbox">
            {searchInput}
            {filteredOptions.length === 0 ? (
              <div className="dropdown-select-empty">No matches</div>
            ) : (
              filteredOptions.map((option) => (
                <button
                  key={option.id}
                  className={`dropdown-select-item${option.id === value ? ' active' : ''}`}
                  onClick={() => handleSelect(option.id)}
                  role="option"
                  aria-selected={option.id === value}
                  type="button"
                >
                  {option.icon && <Icon name={option.icon} size={18} />}
                  <div className="dropdown-select-item-content">
                    <span className="dropdown-select-item-label">{option.label}</span>
                    {option.description && (
                      <span className="dropdown-select-item-description">
                        {option.description}
                      </span>
                    )}
                  </div>
                  {showCheckmark && option.id === value && (
                    <Icon name="check" size={18} />
                  )}
                </button>
              ))
            )}
          </div>
        )
      )}
    </div>
  );
}
