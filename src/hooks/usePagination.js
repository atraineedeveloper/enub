import { useState } from "react";

const PAGE_SIZE = 10;

export function usePagination(data = []) {
  const [currentPage, setCurrentPage] = useState(1);

  const totalCount = data.length;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  // Si los datos cambian y la página actual ya no existe, volvemos a la 1
  const safePage = totalPages > 0 ? Math.min(currentPage, totalPages) : 1;

  const startIndex = (safePage - 1) * PAGE_SIZE;
  const paginatedData = data.slice(startIndex, startIndex + PAGE_SIZE);

  return {
    currentPage: safePage,
    totalPages,
    totalCount,
    paginatedData,
    setCurrentPage,
  };
}
