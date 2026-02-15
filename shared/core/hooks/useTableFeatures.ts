import { useState, useMemo, useEffect } from 'react';

export interface ColumnFilterDef<T> {
  /** Column index this filter applies to */
  columnIndex: number;
  /** Extract the filterable value for a row */
  getValue: (row: T) => string;
}

export interface UseTableFeaturesOptions<T> {
  data: T[];
  searchable?: boolean;
  searchQuery: string;
  getSearchText: (row: T) => string;
  paginate?: boolean;
  pageSize?: number;
  /** Per-column filter definitions */
  columnFilters?: ColumnFilterDef<T>[];
  /** Active column filter values: columnIndex -> Set of selected values */
  activeFilters?: Map<number, Set<string>>;
}

export interface UseTableFeaturesReturn<T> {
  displayData: T[];
  filteredCount: number;
  totalCount: number;
  currentPage: number;
  setCurrentPage: (page: number) => void;
  totalPages: number;
  startIndex: number;
  endIndex: number;
}

export function useTableFeatures<T>({
  data,
  searchable = false,
  searchQuery,
  getSearchText,
  paginate = false,
  pageSize = 25,
  columnFilters,
  activeFilters,
}: UseTableFeaturesOptions<T>): UseTableFeaturesReturn<T> {
  const [currentPage, setCurrentPage] = useState(1);

  // Apply column filters first, then search
  const columnFilteredData = useMemo(() => {
    if (!columnFilters || !activeFilters || activeFilters.size === 0) return data;
    return data.filter((row) => {
      for (const filter of columnFilters) {
        const selected = activeFilters.get(filter.columnIndex);
        if (!selected || selected.size === 0) continue;
        const value = filter.getValue(row);
        if (!selected.has(value)) return false;
      }
      return true;
    });
  }, [data, columnFilters, activeFilters]);

  // Filter data by search query
  const filteredData = useMemo(() => {
    if (!searchable || !searchQuery.trim()) return columnFilteredData;
    const query = searchQuery.toLowerCase().trim();
    return columnFilteredData.filter((row) => getSearchText(row).toLowerCase().includes(query));
  }, [columnFilteredData, searchable, searchQuery, getSearchText]);

  const totalCount = data.length;
  const filteredCount = filteredData.length;
  const totalPages = paginate ? Math.max(1, Math.ceil(filteredCount / pageSize)) : 1;

  // Clamp page when data/filter changes
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  // Reset to page 1 when search, pageSize, or column filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, pageSize, activeFilters]);

  // Paginate
  const displayData = useMemo(() => {
    if (!paginate) return filteredData;
    const start = (currentPage - 1) * pageSize;
    return filteredData.slice(start, start + pageSize);
  }, [filteredData, paginate, currentPage, pageSize]);

  const startIndex = paginate ? (currentPage - 1) * pageSize + 1 : 1;
  const endIndex = paginate ? Math.min(currentPage * pageSize, filteredCount) : filteredCount;

  return {
    displayData,
    filteredCount,
    totalCount,
    currentPage,
    setCurrentPage,
    totalPages,
    startIndex,
    endIndex,
  };
}
