import Button from "./Button";

interface PaginationProps {
  /** 1-indexed current page. */
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  /** Omit to hide the "rows per page" selector entirely. */
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
}

const DEFAULT_PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

/**
 * Prev/Next pager with a "X–Y of Z" summary and an optional rows-per-page selector.
 * Renders nothing when there's nothing to page through at all (total === 0) — otherwise
 * stays visible even on a single page, since the page-size selector still needs a home.
 */
function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
}: PaginationProps) {
  if (total === 0) return null;

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(total, page * pageSize);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-border)] px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="text-sm text-[var(--color-text-secondary)]">
          {start}–{end} of {total}
        </span>
        {onPageSizeChange && (
          <label className="flex items-center gap-1.5 text-sm text-[var(--color-text-secondary)]">
            Rows per page
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="rounded-sm border border-[var(--color-border)] bg-[var(--color-surface)] px-1.5 py-1 text-sm text-[var(--color-text-primary)]"
            >
              {pageSizeOptions.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      {totalPages > 1 && (
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="secondary"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            className="!px-3 !py-1.5 !text-sm"
          >
            Prev
          </Button>
          <span className="text-sm font-semibold text-[var(--color-text-primary)]">
            {page} / {totalPages}
          </span>
          <Button
            type="button"
            variant="secondary"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            className="!px-3 !py-1.5 !text-sm"
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}

export default Pagination;
