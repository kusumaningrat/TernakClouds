import { createPortal } from "react-dom";
import { useState } from "react";
import { Loader2, Square, AlertCircle } from "lucide-react";

export function StopModal({
  jobName,
  isPending,
  onConfirm,
  onCancel,
}: {
  jobName: string;
  isPending: boolean;
  onConfirm: (purge: boolean) => void;
  onCancel: () => void;
}) {
  const [purge, setPurge] = useState(false);
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="glass rounded-xl border border-border shadow-2xl w-full max-w-sm mx-4 p-6 space-y-5">
        <div className="flex items-start gap-3">
          <div className="size-10 rounded-full bg-destructive/15 grid place-items-center shrink-0">
            <AlertCircle className="size-5 text-destructive" />
          </div>
          <div>
            <p className="font-semibold">Stop job?</p>
            <p className="text-sm text-muted-foreground mt-0.5">
              <span className="font-mono font-medium text-foreground">{jobName}</span> will be
              deregistered and all running allocations stopped.
            </p>
          </div>
        </div>
        <label className="flex items-start gap-2.5 cursor-pointer group">
          <input
            type="checkbox"
            checked={purge}
            onChange={(e) => setPurge(e.target.checked)}
            className="mt-0.5 accent-destructive cursor-pointer"
          />
          <div>
            <span className="text-sm font-medium group-hover:text-foreground transition">
              Purge job
            </span>
            <p className="text-xs text-muted-foreground mt-0.5">
              Permanently remove the job from Nomad state. Cannot be restarted later.
            </p>
          </div>
        </label>
        <div className="flex gap-2 pt-1">
          <button
            onClick={onCancel}
            disabled={isPending}
            className="flex-1 py-2 rounded-md border border-border text-sm hover:bg-accent transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(purge)}
            disabled={isPending}
            className="flex-1 py-2 rounded-md bg-destructive text-destructive-foreground text-sm font-medium hover:bg-destructive/90 transition disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            {isPending ? <Loader2 className="size-4 animate-spin" /> : <Square className="size-4" />}
            Stop
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
