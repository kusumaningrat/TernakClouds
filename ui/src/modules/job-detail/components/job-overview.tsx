import { Cpu, MemoryStick } from "lucide-react";
import type { NomadJobDetail } from "@/lib/types";
import { formatTime, JOB_STATUS_DOT, JOB_STATUS_TEXT } from "../utils/status";

export function JobOverview({ detail }: { detail: NomadJobDetail }) {
  const dotCls = JOB_STATUS_DOT[detail.Status] ?? "bg-muted-foreground";
  const textCls = JOB_STATUS_TEXT[detail.Status] ?? "text-muted-foreground";
  const hasMeta = detail.Meta && Object.keys(detail.Meta).length > 0;

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-border bg-card p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
            Status
          </p>
          <div className="flex items-center gap-1.5">
            <span className={`size-2 rounded-full shrink-0 ${dotCls}`} />
            <span className={`text-sm font-medium capitalize ${textCls}`}>{detail.Status}</span>
          </div>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
            Type
          </p>
          <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-secondary border border-border text-muted-foreground">
            {detail.Type}
          </span>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
            Namespace
          </p>
          <span className="text-sm font-mono text-foreground">{detail.Namespace}</span>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
            Priority
          </p>
          <span className="text-sm font-mono text-foreground">{detail.Priority}</span>
        </div>
        {(detail.Datacenters?.length ?? 0) > 0 && (
          <div className="col-span-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
              Datacenters
            </p>
            <div className="flex flex-wrap gap-1">
              {detail.Datacenters.map((dc) => (
                <span
                  key={dc}
                  className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-secondary border border-border text-muted-foreground"
                >
                  {dc}
                </span>
              ))}
            </div>
          </div>
        )}
        {detail.SubmitTime && (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
              Submitted
            </p>
            <span className="text-sm text-foreground">{formatTime(detail.SubmitTime)}</span>
          </div>
        )}
        {detail.ModifyTime && (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
              Last Modified
            </p>
            <span className="text-sm text-foreground">{formatTime(detail.ModifyTime)}</span>
          </div>
        )}
      </div>

      {detail.TaskGroups && detail.TaskGroups.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Task Groups
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {detail.TaskGroups.map((tg) => (
              <div key={tg.Name} className="rounded-lg border border-border bg-card p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm">{tg.Name}</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-secondary border border-border text-muted-foreground">
                    ×{tg.Count}
                  </span>
                </div>
                {tg.Tasks && tg.Tasks.length > 0 && (
                  <div className="space-y-1.5">
                    {tg.Tasks.map((task) => (
                      <div
                        key={task.Name}
                        className="rounded-md bg-secondary/60 px-2.5 py-2 space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium">{task.Name}</span>
                          <span className="text-[10px] font-mono text-muted-foreground px-1 py-px rounded bg-background border border-border">
                            {task.Driver}
                          </span>
                        </div>
                        {task.Resources && (
                          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                            {task.Resources.CPU != null && (
                              <span className="flex items-center gap-1">
                                <Cpu className="size-3" />
                                {task.Resources.CPU} MHz
                              </span>
                            )}
                            {task.Resources.MemoryMB != null && (
                              <span className="flex items-center gap-1">
                                <MemoryStick className="size-3" />
                                {task.Resources.MemoryMB} MB
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {hasMeta && (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            Metadata
          </p>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(detail.Meta!).map(([k, v]) => (
              <span
                key={k}
                className="text-[11px] font-mono px-2 py-0.5 rounded bg-secondary border border-border text-muted-foreground"
              >
                {k}: <span className="text-foreground">{v}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
