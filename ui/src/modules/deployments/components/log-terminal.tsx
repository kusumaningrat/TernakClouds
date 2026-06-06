import { Loader2 } from "lucide-react";

export function LogTerminal({
  lines,
  connected,
  streamError,
  termRef,
  onScroll,
  onClear,
}: {
  lines: string[];
  connected: boolean;
  streamError: string | null;
  termRef: React.RefObject<HTMLDivElement | null>;
  onScroll: () => void;
  onClear: () => void;
}) {
  return (
    <>
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border shrink-0">
        <button
          onClick={onClear}
          className="text-xs px-2 py-1 rounded border border-border hover:bg-accent transition text-muted-foreground"
        >
          Clear
        </button>
        <div className="ml-auto flex items-center gap-1.5">
          {connected ? (
            <>
              <span className="size-1.5 rounded-full bg-success animate-pulse" />
              <span className="text-[11px] text-success font-medium">live</span>
            </>
          ) : streamError ? (
            <span
              className="text-[11px] text-destructive truncate max-w-[220px]"
              title={streamError}
            >
              {streamError}
            </span>
          ) : (
            <>
              <Loader2 className="size-3 animate-spin text-muted-foreground" />
              <span className="text-[11px] text-muted-foreground">connecting…</span>
            </>
          )}
        </div>
      </div>
      <div
        ref={termRef}
        onScroll={onScroll}
        className="flex-1 overflow-y-auto bg-[#0d0d0d] p-3 font-mono text-xs text-green-300 leading-relaxed"
      >
        {lines.length === 0 ? (
          <span className="text-zinc-600 italic">
            {connected ? "Waiting for logs…" : "Connecting…"}
          </span>
        ) : (
          lines.map((line, i) => (
            <div key={i} className="whitespace-pre-wrap break-all">
              {line}
            </div>
          ))
        )}
      </div>
    </>
  );
}
