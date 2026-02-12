import { useState, useMemo, useEffect } from 'react';

export interface UseTableFeaturesOptions<T> {
  data: T[];
  searchable?: boolean;
  searchQuery: string;
  getSearchText: (row: T) => string;
  paginate?: boolean;
  pageSize?: number;
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
}: UseTableFeaturesOptions<T>): UseTableFeaturesReturn<T> {
  const [currentPage, setCurrentPage] = useState(1);

  // Filter data by search query
  const filteredData = useMemo(() => {
    if (!searchable || !searchQuery.trim()) return data;
    const query = searchQuery.toLowerCase().trim();
    return data.filter((row) => getSearchText(row).toLowerCase().includes(query));
  }, [data, searchable, searchQuery, getSearchText]);

  const totalCount = data.length;
  const filteredCount = filteredData.length;
  const totalPages = paginate ? Math.max(1, Math.ceil(filteredCount / pageSize)) : 1;

  // Clamp page when data/filter changes
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  // Reset to page 1 when search or pageSize changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, pageSize]);

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
