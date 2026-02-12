import { ReactNode, useState, useCallback, useMemo, isValidElement, Children, cloneElement, ReactElement } from 'react';
import { useTableFeatures, getDefaultPageSize, getTablePageSize, setTablePageSize } from '@core';
import { IconButton } from './IconButton';
import { Tooltip } from './Tooltip';
import { EditIcon, TrashIcon, Icon } from './Icon';

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
}

/**
 * Flexible Table component for displaying data with actions.
 *
 * Features:
 * - Flexible column definitions with accessor functions
 * - Built-in edit/delete shortcuts
 * - Custom actions with loading states
 * - Tooltips on action buttons
 * - Empty state handling
 * - Row click handling
 * - Opt-in search bar and pagination
 *
 * @example
 * // Simple usage with edit/delete
 * <Table
 *   data={items}
 *   columns={[
 *     { header: 'Name', accessor: 'name' },
 *     { header: 'Count', accessor: (row) => <Badge>{row.count}</Badge> },
 *   ]}
 *   getRowKey={(item) => item.id}
 *   onEdit={handleEdit}
 *   onDelete={handleDelete}
 *   deleteConfirmMessage={(item) => `Delete "${item.name}"?`}
 * />
 *
 * @example
 * // With search and pagination
 * <Table
 *   data={devices}
 *   columns={columns}
 *   getRowKey={(d) => d.mac}
 *   searchable
 *   searchPlaceholder="Search devices..."
 *   paginate
 *   pageSize={25}
 * />
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
}: TableProps<T>) {
  const [expandedKeys, setExpandedKeys] = useState<Set<string | number>>(new Set());
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

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

  const {
    displayData,
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
  });

  const isSearching = searchable && searchQuery.trim().length > 0;

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
      onClick: (row) => {
        if (deleteConfirmMessage) {
          if (confirm(deleteConfirmMessage(row))) {
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

      {isSearching && displayData.length === 0 ? (
        <div className="table-no-results">
          No results for &ldquo;{searchQuery}&rdquo;
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
        <table className={tableClassName}>
          <thead>
            <tr>
              {columns.map((col, idx) => (
                <th
                  key={idx}
                  style={{
                    width: col.width,
                    textAlign: col.align,
                  }}
                  className={[col.className, col.hideOnMobile && 'hide-mobile'].filter(Boolean).join(' ')}
                >
                  {col.header}
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
              const totalCols = columns.length + (hasActions ? 1 : 0);

              const handleRowClick = isExpandable
                ? () => toggleExpand(key)
                : onRowClick
                  ? () => onRowClick(row)
                  : undefined;

              return (
                <TableRowGroup key={key}>
                  <tr
                    className={[className, isExpanded && 'expanded-row'].filter(Boolean).join(' ')}
                    onClick={handleRowClick}
                  >
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
                        <div className="expanded-detail-content">
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
        <div className={`table-pagination${totalPages > 1 ? '' : ' table-pagination-minimal'}`}>
          <div className="table-row-count">
            <span className="table-pagination-info">
              {filteredCount} {filteredCount === 1 ? 'row' : 'rows'}
              {filteredCount !== totalCount && ` (filtered from ${totalCount})`}
            </span>
          </div>
          {paginate && totalPages > 1 && (
            <>
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
              <div className="table-pagination-size">
                <select
                  className="table-pagination-select"
                  value={pageSize}
                  onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                >
                  {pageSizeOptions.map((size) => (
                    <option key={size} value={size}>{size} / page</option>
                  ))}
                </select>
              </div>
            </>
          )}
        </div>
      )}
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
  status: (status: string, variant?: 'online' | 'offline' | 'warning' | 'provisioning') => (
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
