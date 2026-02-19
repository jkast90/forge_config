import { ReactNode, useState, useCallback, useMemo, useRef, useEffect, isValidElement, Children, cloneElement, ReactElement } from 'react';
import { useTableFeatures, getDefaultPageSize, getTablePageSize, setTablePageSize } from '@core';
import type { ColumnFilterDef } from '@core';
import { Checkbox } from './Checkbox';
import { SelectField } from './SelectField';
import { IconButton } from './IconButton';
import { Tooltip } from './Tooltip';
import { EditIcon, TrashIcon, Icon } from './Icon';
import { useConfirm } from './ConfirmDialog';

/**
 * Highlights matching text within a ReactNode tree.
 * Walks through string children and wraps matches in <mark>.
 */
function highlightInNode(node: ReactNode, query: string): ReactNode {
  if (!query) return node;

  if (typeof node === 'string') {
    const lower = node.toLowerCase();
    const idx = lower.indexOf(query.toLowerCase());
    if (idx === -1) return node;
    return (
      <>
        {node.slice(0, idx)}
        <mark className="search-highlight">{node.slice(idx, idx + query.length)}</mark>
        {highlightInNode(node.slice(idx + query.length), query)}
      </>
    );
  }

  if (typeof node === 'number') {
    return highlightInNode(String(node), query);
  }

  if (isValidElement(node)) {
    const element = node as ReactElement<{ children?: ReactNode }>;
    if (element.props.children) {
      return cloneElement(element, {}, ...Children.map(element.props.children, (child) => highlightInNode(child, query)) || []);
    }
    return node;
  }

  if (Array.isArray(node)) {
    return node.map((child, i) => <span key={i}>{highlightInNode(child, query)}</span>);
  }

  return node;
}

/**
 * Column definition for Table
 */
export interface TableColumn<T> {
  /** Column header label */
  header: string;
  /** Key to access data, or render function */
  accessor: keyof T | ((row: T, index: number) => ReactNode);
  /** Optional CSS class for the column */
  className?: string;
  /** Optional width (e.g., '100px', '20%') */
  width?: string;
  /** Align text (default: left) */
  align?: 'left' | 'center' | 'right';
  /** Hide on mobile */
  hideOnMobile?: boolean;
  /** Exclude this column from search filtering (all columns searchable by default) */
  searchable?: boolean;
  /** Extract searchable text (useful for function-accessor columns) */
  searchValue?: (row: T) => string;
  /** Extract filterable value for per-column dropdown filter. When set, a filter icon appears in the header. */
  filterValue?: (row: T) => string;
  /** Set to false to disable auto-filtering on this column */
  filterable?: boolean;
}

/**
 * Action button configuration
 */
export interface TableAction<T> {
  /** Icon to display */
  icon: ReactNode | ((row: T) => ReactNode);
  /** Button label (for accessibility) */
  label: string | ((row: T) => string);
  /** Click handler */
  onClick: (row: T) => void;
  /** Button variant */
  variant?: 'primary' | 'secondary' | 'danger';
  /** Whether the action is disabled */
  disabled?: (row: T) => boolean;
  /** Whether the action is loading */
  loading?: (row: T) => boolean;
  /** Tooltip content */
  tooltip?: string | ((row: T) => string);
  /** Whether to show this action */
  show?: (row: T) => boolean;
  /** Show as bulk action in selection bar. When true, loops onClick over selected rows. */
  bulk?: boolean;
  /** Separate handler for bulk execution (skips per-row confirmations). Falls back to onClick. */
  bulkOnClick?: (row: T) => void | Promise<void>;
  /** Confirmation shown once before executing bulk action. String uses {count} placeholder; function receives selected rows. */
  bulkConfirm?: string | ((rows: T[]) => { title?: string; message: string; confirmText?: string });
}

export interface TableProps<T> {
  /** Data to display */
  data: T[];
  /** Column definitions */
  columns: TableColumn<T>[];
  /** Unique key for each row */
  getRowKey: (row: T) => string | number;
  /** Row actions (rendered in Actions column) */
  actions?: TableAction<T>[];
  /** Custom actions renderer (alternative to actions array) */
  renderActions?: (row: T) => ReactNode;
  /** Callback when edit action is clicked (shorthand for common pattern) */
  onEdit?: (row: T) => void;
  /** Callback when delete action is clicked (shorthand for common pattern) */
  onDelete?: (row: T) => void;
  /** Confirm message for delete */
  deleteConfirmMessage?: (row: T) => string;
  /** Function to determine if delete is disabled for a row */
  deleteDisabled?: (row: T) => boolean;
  /** Function to determine row CSS class */
  rowClassName?: (row: T) => string | undefined;
  /** Empty state message */
  emptyMessage?: string;
  /** Empty state description */
  emptyDescription?: string;
  /** Actions column header label */
  actionsHeader?: string;
  /** Whether to use compact styling */
  compact?: boolean;
  /** Whether table is striped */
  striped?: boolean;
  /** Whether rows are hoverable */
  hoverable?: boolean;
  /** Callback when row is clicked */
  onRowClick?: (row: T) => void;
  /** Render expanded detail row content (enables click-to-expand) */
  renderExpandedRow?: (row: T) => ReactNode;
  /** Enable built-in search bar */
  searchable?: boolean;
  /** Placeholder text for search input */
  searchPlaceholder?: string;
  /** Custom function to extract searchable text from a row */
  getSearchText?: (row: T) => string;
  /** Enable pagination (default: true) */
  paginate?: boolean;
  /** Initial items per page (falls back to user preference, then 25) */
  pageSize?: number;
  /** Available page size options */
  pageSizeOptions?: number[];
  /** Unique ID for persisting per-table page size overrides */
  tableId?: string;
  /** Enable row selection checkboxes */
  selectable?: boolean;
  /** Currently selected row keys (controlled) */
  selectedKeys?: Set<string | number>;
  /** Called when selection changes */
  onSelectionChange?: (selectedKeys: Set<string | number>) => void;
}

/**
 * Per-column filter dropdown that appears in the column header.
 */
function ColumnFilter({ options, selected, onChange }: {
  options: string[];
  selected: Set<string>;
  onChange: (selected: Set<string>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [filterSearch, setFilterSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const hasFilter = selected.size > 0;

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  useEffect(() => {
    if (open) {
      setFilterSearch('');
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  const filteredOptions = filterSearch
    ? options.filter((opt) => (opt || '(empty)').toLowerCase().includes(filterSearch.toLowerCase()))
    : options;

  const toggle = (value: string) => {
    const next = new Set(selected);
    if (next.has(value)) {
      next.delete(value);
    } else {
      next.add(value);
    }
    onChange(next);
  };

  return (
    <div className="column-filter" ref={ref}>
      <button
        className={`column-filter-toggle ${hasFilter ? 'column-filter-active' : ''}`}
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        title="Filter column"
      >
        <Icon name={hasFilter ? 'filter_list' : 'filter_list'} size={14} />
      </button>
      {open && (
        <div className="column-filter-dropdown" onClick={(e) => e.stopPropagation()}>
          <input
            ref={inputRef}
            type="text"
            className="column-filter-search"
            placeholder="Search..."
            value={filterSearch}
            onChange={(e) => setFilterSearch(e.target.value)}
          />
          {hasFilter && (
            <button className="column-filter-clear" onClick={() => onChange(new Set())}>
              Clear filter
            </button>
          )}
          <div className="column-filter-options">
            {filteredOptions.map((opt) => (
              <label key={opt} className="column-filter-option">
                <Checkbox
                  checked={selected.has(opt)}
                  onChange={() => toggle(opt)}
                />
                <span>{opt || '(empty)'}</span>
              </label>
            ))}
            {filteredOptions.length === 0 && (
              <div className="column-filter-no-results">No matches</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Flexible Table component for displaying data with actions.
 */
export function Table<T>({
  data,
  columns,
  getRowKey,
  actions = [],
  renderActions,
  onEdit,
  onDelete,
  deleteConfirmMessage,
  deleteDisabled,
  rowClassName,
  emptyMessage = 'No data available',
  emptyDescription,
  actionsHeader = 'Actions',
  compact = false,
  striped = false,
  hoverable = true,
  onRowClick,
  renderExpandedRow,
  searchable = false,
  searchPlaceholder = 'Search...',
  getSearchText: getSearchTextProp,
  paginate = true,
  pageSize: initialPageSize,
  pageSizeOptions = [10, 25, 50, 100],
  tableId,
  selectable = false,
  selectedKeys,
  onSelectionChange,
}: TableProps<T>) {
  const { confirm, ConfirmDialogRenderer } = useConfirm();
  const [expandedKeys, setExpandedKeys] = useState<Set<string | number>>(new Set());
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [bulkRunning, setBulkRunning] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollWidth, setScrollWidth] = useState(0);

  // Track scroll container width for constraining expanded row content
  useEffect(() => {
    if (!renderExpandedRow || !scrollRef.current) return;
    const el = scrollRef.current;
    const measure = () => setScrollWidth(el.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [!!renderExpandedRow]);

  // Page size priority: per-table override > prop > user preference > 25
  const resolvedInitialPageSize = initialPageSize
    ?? (tableId ? getTablePageSize(tableId) : null)
    ?? getDefaultPageSize();
  const [pageSize, setPageSizeState] = useState(resolvedInitialPageSize);

  const handlePageSizeChange = useCallback((newSize: number) => {
    setPageSizeState(newSize);
    if (tableId && !initialPageSize) {
      setTablePageSize(tableId, newSize);
    }
  }, [tableId, initialPageSize]);

  const toggleExpand = useCallback((key: string | number) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  // Build default getSearchText from searchable columns
  const getSearchText = useMemo(() => {
    if (getSearchTextProp) return getSearchTextProp;
    return (row: T) => {
      return columns
        .filter((col) => col.searchable !== false)
        .map((col) => {
          if (col.searchValue) return col.searchValue(row);
          if (typeof col.accessor === 'string') {
            const val = row[col.accessor as keyof T];
            return val != null ? String(val) : '';
          }
          return '';
        })
        .join(' ');
    };
  }, [getSearchTextProp, columns]);

  // Per-column filter state
  const [activeFilters, setActiveFilters] = useState<Map<number, Set<string>>>(new Map());

  // Build column filter definitions: explicit filterValue OR auto-detect from searchValue/accessor
  const columnFilterDefs = useMemo<ColumnFilterDef<T>[]>(() => {
    const defs: ColumnFilterDef<T>[] = [];
    for (let idx = 0; idx < columns.length; idx++) {
      const col = columns[idx];
      if (col.filterable === false) continue;
      let getValue: ((row: T) => string) | null = null;
      if (col.filterValue) {
        getValue = col.filterValue;
      } else if (col.searchValue) {
        getValue = col.searchValue;
      } else if (typeof col.accessor === 'string') {
        const key = col.accessor as keyof T;
        getValue = (row: T) => {
          const v = row[key];
          return v != null ? String(v) : '';
        };
      }
      if (getValue) {
        defs.push({ columnIndex: idx, getValue });
      }
    }
    return defs;
  }, [columns]);

  // Compute unique filter options per column (skip columns with <2 distinct values — nothing to filter)
  const filterOptions = useMemo(() => {
    const map = new Map<number, string[]>();
    for (const def of columnFilterDefs) {
      const values = new Set<string>();
      for (const row of data) {
        values.add(def.getValue(row));
      }
      if (values.size < 2) continue;
      const sorted = [...values].sort((a, b) => a.localeCompare(b));
      map.set(def.columnIndex, sorted);
    }
    return map;
  }, [data, columnFilterDefs]);

  const handleFilterChange = useCallback((columnIndex: number, selected: Set<string>) => {
    setActiveFilters(prev => {
      const next = new Map(prev);
      if (selected.size === 0) {
        next.delete(columnIndex);
      } else {
        next.set(columnIndex, selected);
      }
      return next;
    });
  }, []);

  const hasActiveFilters = activeFilters.size > 0;

  const {
    displayData,
    filteredData,
    filteredCount,
    totalCount,
    currentPage,
    setCurrentPage,
    totalPages,
    startIndex,
    endIndex,
  } = useTableFeatures({
    data,
    searchable,
    searchQuery,
    getSearchText,
    paginate,
    pageSize,
    columnFilters: filterOptions.size > 0 ? columnFilterDefs.filter(d => filterOptions.has(d.columnIndex)) : undefined,
    activeFilters: hasActiveFilters ? activeFilters : undefined,
  });

  const isSearching = searchable && searchQuery.trim().length > 0;
  const isFiltering = hasActiveFilters;

  // Selection helpers
  const selectionEnabled = selectable && selectedKeys && onSelectionChange;
  const displayKeys = useMemo(() => selectionEnabled ? new Set(displayData.map(getRowKey)) : new Set<string | number>(), [selectionEnabled, displayData, getRowKey]);
  const allDisplaySelected = selectionEnabled && displayKeys.size > 0 && [...displayKeys].every(k => selectedKeys.has(k));
  const someDisplaySelected = selectionEnabled && !allDisplaySelected && [...displayKeys].some(k => selectedKeys.has(k));

  const toggleSelectAll = useCallback(() => {
    if (!selectionEnabled) return;
    const next = new Set(selectedKeys);
    if (allDisplaySelected) {
      for (const k of displayKeys) next.delete(k);
    } else {
      for (const k of displayKeys) next.add(k);
    }
    onSelectionChange(next);
  }, [selectionEnabled, selectedKeys, onSelectionChange, allDisplaySelected, displayKeys]);

  const toggleSelectRow = useCallback((key: string | number) => {
    if (!selectionEnabled) return;
    const next = new Set(selectedKeys);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    onSelectionChange(next);
  }, [selectionEnabled, selectedKeys, onSelectionChange]);

  const selectAllFiltered = useCallback(() => {
    if (!selectionEnabled) return;
    const next = new Set(selectedKeys);
    for (const row of filteredData) next.add(getRowKey(row));
    onSelectionChange(next);
  }, [selectionEnabled, selectedKeys, onSelectionChange, filteredData, getRowKey]);

  const clearSelection = useCallback(() => {
    if (!selectionEnabled) return;
    onSelectionChange(new Set());
  }, [selectionEnabled, onSelectionChange]);

  // Resolve selected rows for bulk actions
  const selectedRows = useMemo(() => {
    if (!selectionEnabled || selectedKeys.size === 0) return [];
    return data.filter(row => selectedKeys.has(getRowKey(row)));
  }, [selectionEnabled, selectedKeys, data, getRowKey]);

  // Auto-prune stale keys when data changes (e.g., after bulk delete)
  // Skip when data is empty — that's the loading state, not a real change
  const selectedCount = selectedRows.length;
  useEffect(() => {
    if (!selectionEnabled || selectedKeys.size === 0 || data.length === 0) return;
    if (selectedCount < selectedKeys.size) {
      const validKeys = new Set(data.map(getRowKey));
      const pruned = new Set([...selectedKeys].filter(k => validKeys.has(k)));
      onSelectionChange(pruned);
    }
  }, [data, selectionEnabled, selectedKeys, selectedCount, getRowKey, onSelectionChange]);

  const executeBulkAction = useCallback(async (action: TableAction<T>) => {
    if (action.bulkConfirm) {
      let opts: { title?: string; message: string; confirmText?: string };
      if (typeof action.bulkConfirm === 'function') {
        opts = action.bulkConfirm(selectedRows);
      } else {
        opts = { message: action.bulkConfirm.replace('{count}', String(selectedRows.length)) };
      }
      const ok = await confirm({ title: opts.title || 'Confirm Bulk Action', message: opts.message, confirmText: opts.confirmText || 'Confirm', destructive: action.variant === 'danger' });
      if (!ok) return;
    }
    const handler = action.bulkOnClick || action.onClick;
    setBulkRunning(true);
    for (const row of selectedRows) {
      try {
        await handler(row);
      } catch {
        // individual action handles its own errors
      }
    }
    setBulkRunning(false);
  }, [selectedRows, confirm]);

  // Build actions array from shortcuts + custom actions
  const allActions: TableAction<T>[] = [];

  if (onEdit) {
    allActions.push({
      icon: <EditIcon size={14} />,
      label: 'Edit',
      onClick: onEdit,
      variant: 'secondary',
      tooltip: 'Edit',
    });
  }

  allActions.push(...actions);

  if (onDelete) {
    allActions.push({
      icon: <TrashIcon size={14} />,
      label: 'Delete',
      onClick: async (row) => {
        if (deleteConfirmMessage) {
          if (await confirm({ title: 'Confirm Delete', message: deleteConfirmMessage(row), confirmText: 'Delete', destructive: true })) {
            onDelete(row);
          }
        } else {
          onDelete(row);
        }
      },
      variant: 'danger',
      tooltip: 'Delete',
      disabled: deleteDisabled,
    });
  }

  const hasActions = allActions.length > 0 || renderActions;

  if (data.length === 0) {
    return (
      <div className="table-empty">
        <p className="table-empty-message">{emptyMessage}</p>
        {emptyDescription && (
          <p className="table-empty-description">{emptyDescription}</p>
        )}
      </div>
    );
  }

  const isExpandable = !!renderExpandedRow;
  const bulkActions = selectionEnabled ? allActions.filter(a => a.bulk) : [];

  const tableClassName = [
    'data-table',
    compact && 'data-table-compact',
    striped && 'data-table-striped',
    hoverable && 'data-table-hoverable',
    (onRowClick || isExpandable) && 'data-table-clickable',
  ].filter(Boolean).join(' ');

  return (
    <>
      {searchable && searchOpen && (
        <div className="table-search">
          <Icon name="search" size={16} className="table-search-icon" />
          <input
            type="text"
            className="table-search-input"
            placeholder={searchPlaceholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoFocus
          />
          {searchQuery && (
            <button
              className="table-search-clear"
              onClick={() => setSearchQuery('')}
              title="Clear search"
            >
              <Icon name="close" size={14} />
            </button>
          )}
          {isSearching && (
            <span className="table-search-count">
              {filteredCount} of {totalCount}
            </span>
          )}
          <button
            className="table-search-close"
            onClick={() => { setSearchOpen(false); setSearchQuery(''); }}
            title="Close search"
          >
            <Icon name="close" size={16} />
          </button>
        </div>
      )}

      {selectionEnabled && selectedCount > 0 && (
        <div className="table-selection-bar">
          <span className="table-selection-count">{selectedCount} selected</span>
          {selectedCount < filteredCount && (
            <button type="button" className="btn btn-secondary btn-sm" onClick={selectAllFiltered}>
              Select All {filteredCount}
            </button>
          )}
          <button type="button" className="btn btn-secondary btn-sm" onClick={clearSelection}>
            Clear
          </button>
          {bulkActions.length > 0 && (
            <div className="table-selection-actions">
              {bulkActions.map((action, idx) => {
                const label = typeof action.label === 'function' ? 'Action' : action.label;
                const icon = typeof action.icon === 'function' ? null : action.icon;
                return (
                  <button
                    key={idx}
                    type="button"
                    className={`btn btn-sm btn-${action.variant || 'secondary'}`}
                    disabled={bulkRunning}
                    onClick={() => executeBulkAction(action)}
                  >
                    {icon}
                    {label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {(isSearching || isFiltering) && displayData.length === 0 ? (
        <div className="table-no-results">
          {isSearching ? `No results for "${searchQuery}"` : 'No results match the active filters'}
          {isFiltering && (
            <button className="table-clear-filters" onClick={() => setActiveFilters(new Map())}>
              Clear all filters
            </button>
          )}
        </div>
      ) : (
        <div ref={scrollRef} style={{ overflowX: 'auto' }}>
        <table className={tableClassName}>
          <thead>
            <tr>
              {selectionEnabled && (
                <th className="table-select-checkbox">
                  <Checkbox
                    checked={!!allDisplaySelected}
                    indeterminate={!!someDisplaySelected}
                    onChange={toggleSelectAll}
                  />
                </th>
              )}
              {columns.map((col, idx) => (
                <th
                  key={idx}
                  style={{
                    width: col.width,
                    textAlign: col.align,
                  }}
                  className={[col.className, col.hideOnMobile && 'hide-mobile'].filter(Boolean).join(' ')}
                >
                  <span className={filterOptions.has(idx) ? 'column-header-filterable' : undefined}>
                    {col.header}
                    {filterOptions.has(idx) && (
                      <ColumnFilter
                        options={filterOptions.get(idx)!}
                        selected={activeFilters.get(idx) ?? new Set()}
                        onChange={(selected) => handleFilterChange(idx, selected)}
                      />
                    )}
                  </span>
                </th>
              ))}
              {hasActions && (
                <th style={{ textAlign: 'right' }}>
                  <div className="table-actions-header">
                    {searchable && !searchOpen && (
                      <button
                        className="table-search-toggle"
                        onClick={() => setSearchOpen(true)}
                        title="Search"
                      >
                        <Icon name="search" size={15} />
                      </button>
                    )}
                    {actionsHeader}
                  </div>
                </th>
              )}
              {!hasActions && searchable && !searchOpen && (
                <th style={{ width: '1%' }}>
                  <button
                    className="table-search-toggle"
                    onClick={() => setSearchOpen(true)}
                    title="Search"
                  >
                    <Icon name="search" size={15} />
                  </button>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {displayData.map((row, rowIndex) => {
              const key = getRowKey(row);
              const className = rowClassName?.(row);
              const isExpanded = isExpandable && expandedKeys.has(key);
              const isSelected = selectionEnabled && selectedKeys.has(key);
              const totalCols = columns.length + (hasActions ? 1 : 0) + (selectionEnabled ? 1 : 0);

              const handleRowClick = isExpandable
                ? () => toggleExpand(key)
                : onRowClick
                  ? () => onRowClick(row)
                  : undefined;

              return (
                <TableRowGroup key={key}>
                  <tr
                    className={[className, isExpanded && 'expanded-row', isSelected && 'table-row-selected'].filter(Boolean).join(' ')}
                    onClick={handleRowClick}
                  >
                    {selectionEnabled && (
                      <td className="table-select-checkbox" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={!!isSelected}
                          onChange={() => toggleSelectRow(key)}
                        />
                      </td>
                    )}
                    {columns.map((col, idx) => {
                      let content = typeof col.accessor === 'function'
                        ? col.accessor(row, rowIndex)
                        : (row[col.accessor as keyof T] as ReactNode);

                      if (isSearching && col.searchable !== false) {
                        content = highlightInNode(content, searchQuery.trim());
                      }

                      return (
                        <td
                          key={idx}
                          style={{ textAlign: col.align }}
                          className={[col.className, col.hideOnMobile && 'hide-mobile'].filter(Boolean).join(' ')}
                        >
                          {idx === 0 && isExpandable && (
                            <Icon
                              name={isExpanded ? 'expand_more' : 'chevron_right'}
                              size={16}
                              className="expand-icon"
                            />
                          )}
                          {content}
                        </td>
                      );
                    })}
                    {hasActions && (
                      <td>
                        <div className="table-actions">
                          {renderActions ? renderActions(row) : (
                            allActions.map((action, idx) => {
                              if (action.show && !action.show(row)) {
                                return null;
                              }

                              const isDisabled = action.disabled?.(row) ?? false;
                              const isLoading = action.loading?.(row) ?? false;
                              const icon = typeof action.icon === 'function' ? action.icon(row) : action.icon;
                              const tooltip = typeof action.tooltip === 'function' ? action.tooltip(row) : action.tooltip;
                              const label = typeof action.label === 'function' ? action.label(row) : action.label;

                              const button = (
                                <IconButton
                                  key={idx}
                                  variant={action.variant ?? 'secondary'}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    action.onClick(row);
                                  }}
                                  disabled={isDisabled || isLoading}
                                  title={!tooltip ? label : undefined}
                                >
                                  {icon}
                                </IconButton>
                              );

                              return tooltip ? (
                                <Tooltip key={idx} content={tooltip}>
                                  {button}
                                </Tooltip>
                              ) : button;
                            })
                          )}
                        </div>
                      </td>
                    )}
                    {!hasActions && searchable && !searchOpen && <td />}
                  </tr>
                  {isExpanded && renderExpandedRow && (
                    <tr className="expanded-detail-row">
                      <td colSpan={totalCols}>
                        <div className="expanded-detail-content" style={scrollWidth ? { maxWidth: scrollWidth } : undefined}>
                          {renderExpandedRow(row)}
                        </div>
                      </td>
                    </tr>
                  )}
                </TableRowGroup>
              );
            })}
          </tbody>
        </table>
        </div>
      )}

      {filteredCount > 0 && (
        <div className={`table-pagination${paginate ? '' : ' table-pagination-minimal'}`}>
          <div className="table-row-count">
            <span className="table-pagination-info">
              {filteredCount} {filteredCount === 1 ? 'row' : 'rows'}
              {filteredCount !== totalCount && ` (filtered from ${totalCount})`}
            </span>
            {isFiltering && (
              <button className="table-clear-filters" onClick={() => setActiveFilters(new Map())}>
                <Icon name="filter_list_off" size={14} />
                Clear filters
              </button>
            )}
          </div>
          {paginate && totalPages > 1 && (
            <div className="table-pagination-center">
              <div className="table-pagination-prev">
                <IconButton
                  variant="ghost"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage(1)}
                  title="First page"
                >
                  <Icon name="first_page" size={16} />
                </IconButton>
                <IconButton
                  variant="ghost"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage(currentPage - 1)}
                  title="Previous page"
                >
                  <Icon name="chevron_left" size={16} />
                </IconButton>
              </div>
              <div className="table-pagination-labels">
                <span className="table-pagination-page">
                  Page {currentPage} of {totalPages}
                </span>
                <span className="table-pagination-info">
                  {startIndex}&ndash;{endIndex} of {filteredCount}
                </span>
              </div>
              <div className="table-pagination-next">
                <IconButton
                  variant="ghost"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage(currentPage + 1)}
                  title="Next page"
                >
                  <Icon name="chevron_right" size={16} />
                </IconButton>
                <IconButton
                  variant="ghost"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage(totalPages)}
                  title="Last page"
                >
                  <Icon name="last_page" size={16} />
                </IconButton>
              </div>
            </div>
          )}
          {paginate && (
            <div className="table-pagination-size">
              <SelectField
                name="page-size"
                value={String(pageSize)}
                options={pageSizeOptions.map((size) => ({ value: String(size), label: `${size} / page` }))}
                onChange={(e) => handlePageSizeChange(Number(e.target.value))}
              />
            </div>
          )}
        </div>
      )}
      <ConfirmDialogRenderer />
    </>
  );
}

/** Wrapper to group multiple <tr> elements (main row + expanded row) */
function TableRowGroup({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

/**
 * Simple static table for reference data (no actions).
 */
export interface SimpleTableProps {
  headers: string[];
  rows: ReactNode[][];
  className?: string;
}

export function SimpleTable({ headers, rows, className }: SimpleTableProps) {
  return (
    <table className={className}>
      <thead>
        <tr>
          {headers.map((header, idx) => (
            <th key={idx}>{header}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, rowIdx) => (
          <tr key={rowIdx}>
            {row.map((cell, cellIdx) => (
              <td key={cellIdx}>{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * Common cell renderers for reuse
 */
export const Cell = {
  /** Render a value in a code block */
  code: (value: ReactNode) => <code>{value ?? '—'}</code>,

  /** Render a status badge */
  status: (status: string, variant?: 'online' | 'offline' | 'warning' | 'provisioning' | 'accent' | 'neutral') => (
    <span className={`status ${variant || status}`}>
      {status}
    </span>
  ),

  /** Render an enabled/disabled toggle appearance */
  enabled: (enabled: boolean) => (
    <span className={`status ${enabled ? 'online' : 'offline'}`}>
      {enabled ? 'Enabled' : 'Disabled'}
    </span>
  ),

  /** Render a count with status styling */
  count: (count: number, zeroLabel = '0') => (
    <span className={`status ${count > 0 ? 'online' : 'offline'}`}>
      {count > 0 ? count : zeroLabel}
    </span>
  ),

  /** Render a badge with variant */
  badge: (text: string, variant: 'success' | 'error' | 'warning' | 'info' | 'default' = 'default') => (
    <span className={`badge badge-${variant}`}>{text}</span>
  ),

  /** Render a dash for empty/null values */
  dash: (value: ReactNode) => value || '—',

  /** Render a truncated text with tooltip */
  truncate: (text: string, maxLength = 30) => {
    if (text.length <= maxLength) return text;
    return (
      <Tooltip content={text}>
        <span>{text.substring(0, maxLength)}...</span>
      </Tooltip>
    );
  },
};
