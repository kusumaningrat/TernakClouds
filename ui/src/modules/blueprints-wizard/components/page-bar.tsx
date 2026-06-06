import { ChevronRight } from "lucide-react";

export function PageBar({
  page,
  totalPages,
  total,
  limit,
  isLoading,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  isLoading?: boolean;
  onPageChange: (p: number) => void;
}) {
  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  return (
    <div className="flex items-center justify-between pt-2 border-t border-border/40">
      <span className="text-[11px] text-muted-foreground tabular-nums">
        {total === 0 ? "No items" : `Showing ${from}–${to} of ${total}`}
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page === 1 || isLoading}
          className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium bg-secondary hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          <ChevronRight className="size-3 rotate-180" />
          Prev
        </button>
        <span className="px-2 text-[11px] text-muted-foreground tabular-nums select-none">
          {page} / {totalPages}
        </span>
        <button
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page === totalPages || isLoading}
          className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium bg-secondary hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          Next
          <ChevronRight className="size-3" />
        </button>
      </div>
    </div>
  );
}
