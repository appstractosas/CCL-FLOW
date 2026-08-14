import React from 'react';

interface PaginationProps {
  page: number;
  totalPages: number;
  totalItems: number;
  onPageChange: (page: number) => void;
}

/** Páginas visibles con elipsis: primera, última, actual ±1 y saltos con "…". */
function pageWindow(page: number, totalPages: number): (number | '…')[] {
  const set = new Set<number>([1, totalPages, page - 1, page, page + 1]);
  const sorted = [...set].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);
  const out: (number | '…')[] = [];
  let prev = 0;
  for (const p of sorted) {
    if (prev && p - prev > 1) out.push('…');
    out.push(p);
    prev = p;
  }
  return out;
}

/** Paginación compartida (20 filas por página): "Página X de Y" + anterior/siguiente + numeración. */
export const Pagination: React.FC<PaginationProps> = ({ page, totalPages, totalItems, onPageChange }) => {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-zinc-800/80 text-xs">
      <span className="text-zinc-500 font-mono whitespace-nowrap">
        Página {page} de {totalPages} · {totalItems} registros
      </span>
      <div className="flex items-center space-x-1.5">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          className="px-3 py-1.5 rounded-lg border border-zinc-800 text-zinc-300 font-semibold hover:bg-zinc-800 disabled:opacity-40 disabled:hover:bg-transparent disabled:cursor-not-allowed"
        >
          ← Anterior
        </button>
        {pageWindow(page, totalPages).map((p, i) =>
          p === '…' ? (
            <span key={`ellipsis-${i}`} className="px-1 text-zinc-600 select-none">
              …
            </span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              className={`w-8 h-8 rounded-lg font-bold transition-colors ${
                p === page
                  ? 'bg-blue-600 text-white'
                  : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:border-blue-500/40'
              }`}
            >
              {p}
            </button>
          )
        )}
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
          className="px-3 py-1.5 rounded-lg border border-zinc-800 text-zinc-300 font-semibold hover:bg-zinc-800 disabled:opacity-40 disabled:hover:bg-transparent disabled:cursor-not-allowed"
        >
          Siguiente →
        </button>
      </div>
    </div>
  );
};