import { createPortal } from "react-dom";
import { useState, useRef } from "react";
import { Settings2, X } from "lucide-react";
import type { DrawerTarget } from "../types";
import { formatTime, formatDate, formatCreated, formatPorts } from "../utils/format";

function DetailRow({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div className="flex items-start gap-4 py-2 border-b border-border last:border-0">
      <span className="text-xs text-muted-foreground w-24 shrink-0 pt-0.5">{label}</span>
      <span className="text-xs font-mono break-all">{value ?? "—"}</span>
    </div>
  );
}

function LabelRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="py-2 border-b border-border last:border-0 space-y-0.5">
      <div className="text-[11px] text-muted-foreground font-mono truncate" title={k}>
        {k}
      </div>
      <div className="text-xs font-mono break-all">{v || "—"}</div>
    </div>
  );
}

export function DetailsDrawer({
  target,
  onClose,
}: {
  target: DrawerTarget;
  onClose: () => void;
}) {
  const title =
    target.kind === "nomad"
      ? target.job.Name
      : target.kind === "k8s"
        ? target.dep.name
        : target.container.name.replace(/^\//, "");

  const [width, setWidth] = useState(400);
  const dragging = useRef(false);

  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;

    const onMove = (ev: MouseEvent) => {
      if (!dragging.current) return;
      const next = window.innerWidth - ev.clientX;
      setWidth(Math.min(Math.max(next, 300), 800));
    };
    const onUp = () => {
      dragging.current = false;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div
        className="absolute right-0 top-0 h-full flex flex-col bg-background border-l border-border shadow-2xl"
        style={{ width }}
      >
        {/* Drag-to-resize handle */}
        <div
          onMouseDown={handleResizeMouseDown}
          className="absolute left-0 top-0 h-full w-1.5 cursor-col-resize group/resize z-10 flex items-center justify-center"
        >
          <div className="h-8 w-0.5 rounded-full bg-border group-hover/resize:bg-primary/50 transition-colors" />
        </div>

        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <Settings2 className="size-4 text-muted-foreground shrink-0" />
            <p className="font-semibold text-sm truncate">{title}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-accent transition text-muted-foreground shrink-0"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {target.kind === "nomad" && (
            <section>
              <p className="text-[10px] font-semibold tracking-widest text-muted-foreground mb-2">
                JOB
              </p>
              <DetailRow label="Job ID" value={target.job.ID} />
              <DetailRow label="Name" value={target.job.Name} />
              <DetailRow label="Type" value={target.job.Type} />
              <DetailRow label="Status" value={target.job.Status} />
              <DetailRow label="Namespace" value={target.namespace} />
              <DetailRow
                label="Datacenters"
                value={(target.job.Datacenters ?? []).join(", ") || "—"}
              />
              <DetailRow label="Submitted" value={formatTime(target.job.SubmitTime)} />
            </section>
          )}
          {target.kind === "k8s" && (
            <section>
              <p className="text-[10px] font-semibold tracking-widest text-muted-foreground mb-2">
                DEPLOYMENT
              </p>
              <DetailRow label="Name" value={target.dep.name} />
              <DetailRow label="Namespace" value={target.dep.namespace} />
              <DetailRow
                label="Replicas"
                value={`${target.dep.ready} / ${target.dep.desired} ready`}
              />
              <DetailRow label="Up-to-date" value={String(target.dep.upToDate)} />
              <DetailRow label="Available" value={String(target.dep.available)} />
              <DetailRow label="Created" value={formatDate(target.dep.createdAt)} />
            </section>
          )}
          {target.kind === "docker" && (
            <>
              <section>
                <p className="text-[10px] font-semibold tracking-widest text-muted-foreground mb-2">
                  CONTAINER
                </p>
                <DetailRow label="Container ID" value={target.container.id} />
                <DetailRow label="Name" value={target.container.name.replace(/^\//, "")} />
                <DetailRow label="Image" value={target.container.image} />
                <DetailRow label="State" value={target.container.state} />
                <DetailRow label="Status" value={target.container.status} />
                <DetailRow label="Created" value={formatCreated(target.container.created)} />
                <DetailRow label="Ports" value={formatPorts(target.container.ports)} />
              </section>
              {Object.keys(target.container.labels ?? {}).length > 0 && (
                <section>
                  <p className="text-[10px] font-semibold tracking-widest text-muted-foreground mb-2">
                    LABELS
                  </p>
                  {Object.entries(target.container.labels).map(([k, v]) => (
                    <LabelRow key={k} k={k} v={v} />
                  ))}
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
