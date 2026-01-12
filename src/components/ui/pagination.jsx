import React from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react';

const Pagination = ({ 
  currentPage, 
  totalPages, 
  totalItems, 
  itemsPerPage, 
  onPageChange, 
  className = "" 
}) => {
  if (totalPages <= 1) return null;

  const generatePageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 15; // Aumentado de 7 para 15 páginas visíveis
    const showEllipsis = totalPages > maxVisiblePages;

    if (!showEllipsis) {
      // Mostrar todas as páginas se forem 15 ou menos
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Lógica de ellipsis para muitas páginas
      const halfVisible = Math.floor(maxVisiblePages / 2);
      
      if (currentPage <= halfVisible + 2) {
        // Início: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, ..., last
        for (let i = 1; i <= maxVisiblePages - 2; i++) {
          pages.push(i);
        }
        pages.push('...', totalPages);
      } else if (currentPage >= totalPages - halfVisible - 1) {
        // Fim: 1, ..., last-12, last-11, last-10, ..., last-2, last-1, last
        pages.push(1, '...');
        for (let i = totalPages - (maxVisiblePages - 3); i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        // Meio: 1, ..., current-6, current-5, ..., current, ..., current+5, current+6, ..., last
        pages.push(1, '...');
        for (let i = currentPage - halfVisible + 2; i <= currentPage + halfVisible - 2; i++) {
          pages.push(i);
        }
        pages.push('...', totalPages);
      }
    }

    return pages;
  };

  const pageNumbers = generatePageNumbers();
  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  return (
    <div className={`flex items-center justify-between px-2 ${className}`}>
      {/* Info de registros */}
      <div className="text-sm text-slate-600 dark:text-slate-400">
        Mostrando {startItem} a {endItem} de {totalItems} registros
      </div>

      {/* Controles de paginação */}
      <div className="flex items-center space-x-2">
        {/* Botão Anterior */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="border-2 border-slate-300 dark:border-slate-600 hover:border-blue-400 dark:hover:border-blue-500 text-slate-700 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-950/20 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl"
        >
          <ChevronLeft className="w-4 h-4" />
          Anterior
        </Button>

        {/* Números das páginas */}
        <div className="flex items-center space-x-1">
          {pageNumbers.map((page, index) => (
            page === '...' ? (
              <div key={index} className="px-3 py-2">
                <MoreHorizontal className="w-4 h-4 text-slate-400" />
              </div>
            ) : (
              <Button
                key={page}
                variant={currentPage === page ? "default" : "outline"}
                size="sm"
                onClick={() => onPageChange(page)}
                className={
                  currentPage === page
                    ? "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white border-none shadow-lg rounded-xl min-w-[40px] font-bold"
                    : "border-2 border-slate-300 dark:border-slate-600 hover:border-blue-400 dark:hover:border-blue-500 text-slate-700 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-950/20 rounded-xl min-w-[40px]"
                }
              >
                {page}
              </Button>
            )
          ))}
        </div>

        {/* Botão Próximo */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="border-2 border-slate-300 dark:border-slate-600 hover:border-blue-400 dark:hover:border-blue-500 text-slate-700 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-950/20 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl"
        >
          Próximo
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};

export default Pagination;
