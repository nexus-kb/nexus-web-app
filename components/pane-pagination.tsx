interface PanePaginationProps {
  ariaLabel: string;
  page: number;
  totalPages: number;
  hasPrev: boolean;
  hasNext: boolean;
  onPageChange: (page: number) => void;
}

export function buildPageNumbers(current: number, total: number): number[] {
  if (total <= 1) {
    return [1];
  }

  const windowSize = 7;
  const start = Math.max(1, current - Math.floor(windowSize / 2));
  const end = Math.min(total, start + windowSize - 1);
  const adjustedStart = Math.max(1, end - windowSize + 1);

  const pages: number[] = [];
  for (let page = adjustedStart; page <= end; page += 1) {
    pages.push(page);
  }
  return pages;
}

export function PanePagination({
  ariaLabel,
  page,
  totalPages,
  hasPrev,
  hasNext,
  onPageChange,
}: PanePaginationProps) {
  const safeTotalPages = Math.max(1, totalPages);
  const pageButtons = buildPageNumbers(page, safeTotalPages);

  return (
    <footer className="pane-pagination" aria-label={ariaLabel}>
      <button
        type="button"
        className="ghost-button"
        onClick={() => onPageChange(Math.max(1, page - 1))}
        disabled={!hasPrev}
      >
        Prev
      </button>
      <div className="page-number-group">
        {pageButtons.map((value) => (
          <button
            key={value}
            type="button"
            className={`page-number ${value === page ? "is-current" : ""}`}
            onClick={() => onPageChange(value)}
            aria-current={value === page ? "page" : undefined}
          >
            {value}
          </button>
        ))}
      </div>
      <button
        type="button"
        className="ghost-button"
        onClick={() => onPageChange(Math.min(safeTotalPages, page + 1))}
        disabled={!hasNext}
      >
        Next
      </button>
    </footer>
  );
}
