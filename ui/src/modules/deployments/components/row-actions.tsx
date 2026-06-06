import { Terminal, Settings2 } from "lucide-react";

export function ActionBtn({
  onClick,
  icon: Icon,
  label,
}: {
  onClick: () => void;
  icon: React.ElementType;
  label: string;
}) {
  return (
    <div className="relative group/tip">
      <button
        onClick={onClick}
        className="p-1.5 rounded hover:bg-accent transition text-muted-foreground hover:text-foreground"
      >
        <Icon className="size-3.5" />
      </button>
      <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 rounded-md bg-popover border border-border text-[11px] text-foreground whitespace-nowrap shadow-md opacity-0 group-hover/tip:opacity-100 transition-opacity z-50">
        {label}
      </div>
    </div>
  );
}

export function RowActions({ onLogs, onDetails }: { onLogs: () => void; onDetails: () => void }) {
  return (
    <div className="flex items-center gap-0.5">
      <ActionBtn onClick={onLogs} icon={Terminal} label="View logs" />
      <ActionBtn onClick={onDetails} icon={Settings2} label="Details" />
    </div>
  );
}
