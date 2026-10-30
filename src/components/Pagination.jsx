import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export function Pagination({
  currentPage = 1,
  pageSize = 10,
  totalItems = 0,
  onPageChange,
  onPageSizeChange
}) {
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  if (totalItems === 0) return null;

  return (
    <div className="hidden md:flex items-center justify-between gap-3 px-5 py-3.5 bg-slate-50/70 border-t border-slate-100 text-xs text-slate-600 select-none shrink-0">
      {/* Entries Info & Rows Per Page */}
      <div className="flex items-center gap-3">
        <span className="text-slate-500">
          Showing <strong className="font-semibold text-slate-800">{startItem}</strong> to{' '}
          <strong className="font-semibold text-slate-800">{endItem}</strong> of{' '}
          <strong className="font-semibold text-slate-800">{totalItems}</strong>
        </span>

        {onPageSizeChange && (
          <div className="flex items-center gap-1.5 border-l border-slate-200/80 pl-3">
            <span className="text-slate-400 text-[11px] uppercase tracking-wider font-semibold">Rows:</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="px-2.5 py-1 bg-white border border-slate-200/80 rounded-lg text-slate-700 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 shadow-2xs cursor-pointer"
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
          </div>
        )}
      </div>

      {/* Navigation Buttons & Page Indicators */}
      <div className="flex items-center justify-end gap-1.5">
        <button
          type="button"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
          className="inline-flex items-center justify-center gap-1 px-3 py-1.5 bg-white border border-slate-200/80 text-slate-600 hover:bg-slate-50 hover:text-slate-900 rounded-xl text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all shadow-2xs hover:shadow-xs active:scale-95"
          aria-label="Previous Page"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          <span>Prev</span>
        </button>

        {/* Full Page Numbers on Tablets / Desktops */}
        <div className="flex items-center gap-1 mx-1">
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
            .map((page, index, arr) => {
              const prev = arr[index - 1];
              const hasGap = prev && page - prev > 1;
              const isActive = page === currentPage;

              return (
                <React.Fragment key={page}>
                  {hasGap && <span className="px-1 text-slate-400">...</span>}
                  <button
                    type="button"
                    onClick={() => onPageChange(page)}
                    className={`min-w-8 h-8 flex items-center justify-center rounded-xl text-xs font-semibold cursor-pointer transition-all ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-xs shadow-indigo-300/40 font-bold'
                        : 'bg-white border border-slate-200/80 text-slate-600 hover:bg-slate-50 hover:text-slate-900 shadow-2xs hover:-translate-y-0.5'
                    }`}
                  >
                    {page}
                  </button>
                </React.Fragment>
              );
            })}
        </div>

        <button
          type="button"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          className="inline-flex items-center justify-center gap-1 px-3 py-1.5 bg-white border border-slate-200/80 text-slate-600 hover:bg-slate-50 hover:text-slate-900 rounded-xl text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all shadow-2xs hover:shadow-xs active:scale-95"
          aria-label="Next Page"
        >
          <span>Next</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
