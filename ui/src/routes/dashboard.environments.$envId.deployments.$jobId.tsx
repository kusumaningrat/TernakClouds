import { createFileRoute, useParams, useSearch, Link } from "@tanstack/react-router";
import { createPortal } from "react-dom";
import { DashboardTopbar } from "@/components/DashboardTopbar";
import { useWorkspaceContext } from "@/lib/workspace-context";
import {
  useNomadJob,
  useNomadAllocations,
  useNomadAllocation,
  useNomadDeployments,
  useStopJob,
  useStartJob,
} from "@/lib/queries";
import { useState, useEffect, useRef } from "react";
import {
  Loader2,
  AlertTriangle,
  ArrowLeft,
  Cpu,
  MemoryStick,
  Square,
  Play,
  AlertCircle,
  Terminal,
  X,
} from "lucide-react";
import type { NomadAllocationStub, NomadDeploymentStub, NomadJobDetail } from "@/lib/types";
import { getAccessToken } from "@/lib/auth";

export const Route = createFileRoute("/dashboard/environments/$envId/deployments/$jobId")({
  validateSearch: (search: Record<string, unknown>) => ({
    namespace: typeof search.namespace === "string" ? search.namespace : "default",
  }),
  head: () => ({ meta: [{ title: "Job Detail · TernakClouds" }] }),
  component: JobDetailPage,
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(ns: number | undefined) {
  if (!ns) return "—";
  return new Date(ns / 1_000_000).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const ALLOC_DOT: Record<string, string> = {
  running: "bg-success",
  pending: "bg-yellow-500",
  complete: "bg-blue-500",
  failed: "bg-destructive",
  lost: "bg-muted-foreground",
  unknown: "bg-muted-foreground",
};
const ALLOC_TEXT: Record<string, string> = {
  running: "text-success",
  pending: "text-yellow-500",
  complete: "text-blue-500",
  failed: "text-destructive",
  lost: "text-muted-foreground",
  unknown: "text-muted-foreground",
};
const DEPLOY_STATUS: Record<string, { dot: string; text: string }> = {
  successful: { dot: "bg-success", text: "text-success" },
  running: { dot: "bg-yellow-500", text: "text-yellow-500" },
  failed: { dot: "bg-destructive", text: "text-destructive" },
  cancelled: { dot: "bg-muted-foreground", text: "text-muted-foreground" },
  paused: { dot: "bg-blue-400", text: "text-blue-400" },
};
const JOB_STATUS_DOT: Record<string, string> = {
  running: "bg-success",
  pending: "bg-yellow-500",
  dead: "bg-muted-foreground",
};
const JOB_STATUS_TEXT: Record<string, string> = {
  running: "text-success",
  pending: "text-yellow-500",
  dead: "text-muted-foreground",
};

// ─── Stop confirmation modal ──────────────────────────────────────────────────

function StopModal({
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
            {isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Square className="size-4" />
            )}
            Stop
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ─── Log streaming hook ───────────────────────────────────────────────────────

const LOG_BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? "";
const MAX_LOG_LINES = 2000;

interface LogStreamParams {
  slug: string;
  envSlug: string;
  allocID: string;
  task: string;
  logType: "stdout" | "stderr";
  follow: boolean;
  enabled: boolean;
}

function useLogStream({ slug, envSlug, allocID, task, logType, follow, enabled }: LogStreamParams) {
  const [lines, setLines] = useState<string[]>([]);
  const [connected, setConnected] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !allocID || !task) return;
    const ctrl = new AbortController();
    setLines([]);
    setConnected(false);
    setStreamError(null);
    const token = getAccessToken();
    const url =
      `${LOG_BASE_URL}/api/v1/workspaces/${slug}/environments/${encodeURIComponent(envSlug)}/nomad/allocations/${encodeURIComponent(allocID)}/logs` +
      `?task=${encodeURIComponent(task)}&type=${logType}&follow=${follow}&origin=start`;
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    (async () => {
      try {
        const res = await fetch(url, { signal: ctrl.signal, headers });
        if (!res.ok) {
          setStreamError(`HTTP ${res.status}`);
          return;
        }
        if (!res.body) {
          setStreamError("No response body");
          return;
        }
        setConnected(true);
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split("\n\n");
          buffer = parts.pop() ?? "";
          for (const part of parts) {
            let eventType = "message";
            let data = "";
            for (const ln of part.split("\n")) {
              if (ln.startsWith("event: ")) eventType = ln.slice(7).trim();
              else if (ln.startsWith("data: ")) data = ln.slice(6);
            }
            if (eventType === "log" && data) {
              setLines((prev) => {
                const next = [...prev, data];
                return next.length > MAX_LOG_LINES ? next.slice(next.length - MAX_LOG_LINES) : next;
              });
            }
          }
        }
        setConnected(false);
      } catch (err) {
        if ((err as Error).name !== "AbortError") setStreamError(String(err));
        setConnected(false);
      }
    })();
    return () => ctrl.abort();
  }, [slug, envSlug, allocID, task, logType, follow, enabled]);

  return { lines, connected, streamError, clear: () => setLines([]) };
}

// ─── Logs drawer (slide-over) ─────────────────────────────────────────────────

function LogsDrawer({
  jobID,
  jobName,
  slug,
  envId,
  namespace,
  onClose,
}: {
  jobID: string;
  jobName: string;
  slug: string;
  envId: string;
  namespace: string;
  onClose: () => void;
}) {
  const [selectedAllocID, setSelectedAllocID] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<string>("");
  const [logType, setLogType] = useState<"stdout" | "stderr">("stdout");
  const [follow, setFollow] = useState(true);
  const [rightTab, setRightTab] = useState<"logs" | "events">("logs");
  const termRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);

  const { data: allocs = [], isLoading: allocsLoading } = useNomadAllocations(
    slug,
    envId,
    jobID,
    namespace,
  );

  useEffect(() => {
    if (allocs.length > 0 && !selectedAllocID) setSelectedAllocID(allocs[0].ID);
  }, [allocs, selectedAllocID]);

  useEffect(() => {
    const alloc = allocs.find((a) => a.ID === selectedAllocID);
    if (alloc) {
      const tasks = Object.keys(alloc.TaskStates ?? {});
      if (tasks.length > 0) setSelectedTask(tasks[0]);
    }
  }, [allocs, selectedAllocID]);

  const selectedAlloc = allocs.find((a) => a.ID === selectedAllocID);
  const taskNames = Object.keys(selectedAlloc?.TaskStates ?? {});

  const { lines, connected, streamError, clear } = useLogStream({
    slug,
    envSlug: envId,
    allocID: selectedAllocID ?? "",
    task: selectedTask,
    logType,
    follow,
    enabled: !!selectedAllocID && !!selectedTask && rightTab === "logs",
  });

  const { data: allocDetail, isLoading: allocDetailLoading } = useNomadAllocation(
    slug,
    envId,
    selectedAllocID ?? "",
    !!selectedAllocID && rightTab === "events",
  );

  useEffect(() => {
    if (termRef.current && atBottomRef.current) {
      termRef.current.scrollTop = termRef.current.scrollHeight;
    }
  }, [lines]);

  const handleTermScroll = () => {
    if (!termRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = termRef.current;
    atBottomRef.current = scrollHeight - scrollTop - clientHeight < 60;
  };

  const handleSelectAlloc = (id: string) => {
    setSelectedAllocID(id);
    setSelectedTask("");
    atBottomRef.current = true;
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute right-0 top-0 h-full w-[800px] max-w-[95vw] flex flex-col glass border-l border-border shadow-2xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <Terminal className="size-4 text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <p className="font-semibold text-sm leading-none">Logs</p>
              <p className="text-xs font-mono text-muted-foreground truncate mt-0.5">{jobName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-accent transition text-muted-foreground shrink-0"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <aside className="w-52 shrink-0 border-r border-border flex flex-col overflow-hidden">
            <div className="px-3 py-2 border-b border-border shrink-0">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Allocations
              </p>
            </div>
            <div className="flex-1 overflow-y-auto">
              {allocsLoading && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground p-3">
                  <Loader2 className="size-3.5 animate-spin" /> Loading…
                </div>
              )}
              {!allocsLoading && allocs.length === 0 && (
                <p className="text-xs text-muted-foreground p-3">No allocations found.</p>
              )}
              {allocs.map((alloc: NomadAllocationStub) => {
                const dot = ALLOC_DOT[alloc.ClientStatus] ?? "bg-muted-foreground";
                const isSelected = alloc.ID === selectedAllocID;
                return (
                  <button
                    key={alloc.ID}
                    onClick={() => handleSelectAlloc(alloc.ID)}
                    className={`w-full text-left px-3 py-2.5 border-b border-border/50 transition ${isSelected ? "bg-primary/10" : "hover:bg-accent"}`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className={`size-1.5 rounded-full shrink-0 ${dot}`} />
                      <span className="text-[11px] font-mono truncate">{alloc.ID.slice(0, 8)}</span>
                    </div>
                    <div className="text-[10px] text-muted-foreground truncate mt-0.5 pl-3">
                      {alloc.NodeName}
                    </div>
                    <div className="text-[10px] font-mono text-muted-foreground truncate pl-3">
                      {alloc.TaskGroup}
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>

          <div className="flex-1 flex flex-col overflow-hidden">
            {!selectedAllocID ? (
              <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
                Select an allocation to view logs
              </div>
            ) : (
              <>
                <div className="flex border-b border-border shrink-0">
                  {(["logs", "events"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setRightTab(t)}
                      className={`px-4 py-2 text-xs font-medium border-b-2 -mb-px capitalize transition ${rightTab === t ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
                    >
                      {t}
                    </button>
                  ))}
                </div>

                {rightTab === "events" && (
                  <div className="flex-1 overflow-y-auto p-3 space-y-1">
                    {allocDetailLoading && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground py-4">
                        <Loader2 className="size-3.5 animate-spin" /> Loading events…
                      </div>
                    )}
                    {!allocDetailLoading &&
                    selectedTask &&
                    allocDetail?.TaskStates?.[selectedTask]?.Events?.length
                      ? [...allocDetail.TaskStates[selectedTask].Events].reverse().map((ev, i) => (
                          <div
                            key={i}
                            className={`rounded-lg border px-3 py-2 space-y-0.5 ${ev.FailsTask ? "border-destructive/40 bg-destructive/5" : "border-border bg-background"}`}
                          >
                            <div className="flex items-center gap-2">
                              {ev.FailsTask && (
                                <AlertTriangle className="size-3 text-destructive shrink-0" />
                              )}
                              <span
                                className={`text-[11px] font-semibold ${ev.FailsTask ? "text-destructive" : "text-foreground"}`}
                              >
                                {ev.Type}
                              </span>
                              <span className="text-[10px] text-muted-foreground ml-auto">
                                {ev.Time ? formatTime(ev.Time / 1_000_000) : ""}
                              </span>
                            </div>
                            {ev.DisplayMessage && (
                              <p className="text-xs text-muted-foreground pl-0.5">
                                {ev.DisplayMessage}
                              </p>
                            )}
                            {ev.Details && Object.keys(ev.Details).length > 0 && (
                              <div className="flex flex-wrap gap-1 pt-0.5">
                                {Object.entries(ev.Details).map(([k, v]) => (
                                  <span
                                    key={k}
                                    className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-secondary border border-border text-muted-foreground"
                                  >
                                    {k}: <span className="text-foreground">{v}</span>
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        ))
                      : !allocDetailLoading && (
                          <p className="text-xs text-muted-foreground py-4">
                            {selectedTask
                              ? "No events for this task."
                              : "Select a task to view events."}
                          </p>
                        )}
                  </div>
                )}

                {rightTab === "logs" && (
                  <>
                    <div className="flex items-center gap-2 px-3 py-2 border-b border-border shrink-0 flex-wrap">
                      {taskNames.length > 0 && (
                        <select
                          value={selectedTask}
                          onChange={(e) => setSelectedTask(e.target.value)}
                          className="text-xs px-2 py-1 rounded border border-border bg-background font-mono focus:outline-none focus:ring-1 focus:ring-primary/50"
                        >
                          {taskNames.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                      )}
                      <div className="flex rounded border border-border overflow-hidden text-xs font-mono">
                        {(["stdout", "stderr"] as const).map((t) => (
                          <button
                            key={t}
                            onClick={() => setLogType(t)}
                            className={`px-2 py-1 transition ${logType === t ? "bg-primary text-primary-foreground" : "hover:bg-accent text-muted-foreground"}`}
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                      <label className="flex items-center gap-1.5 cursor-pointer text-xs text-muted-foreground select-none">
                        <input
                          type="checkbox"
                          checked={follow}
                          onChange={(e) => setFollow(e.target.checked)}
                          className="accent-primary cursor-pointer"
                        />
                        Follow
                      </label>
                      <button
                        onClick={() => {
                          clear();
                          atBottomRef.current = true;
                        }}
                        className="text-xs px-2 py-1 rounded border border-border hover:bg-accent transition text-muted-foreground"
                      >
                        Clear
                      </button>
                      <div className="ml-auto flex items-center gap-1.5 shrink-0">
                        {connected ? (
                          <>
                            <span className="size-1.5 rounded-full bg-success animate-pulse" />
                            <span className="text-[11px] text-success font-medium">live</span>
                          </>
                        ) : streamError ? (
                          <span
                            className="text-[11px] text-destructive truncate max-w-[140px]"
                            title={streamError}
                          >
                            {streamError}
                          </span>
                        ) : (
                          <>
                            <span className="size-1.5 rounded-full bg-muted-foreground" />
                            <span className="text-[11px] text-muted-foreground">disconnected</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div
                      ref={termRef}
                      onScroll={handleTermScroll}
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
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ─── Job overview ─────────────────────────────────────────────────────────────

function JobOverview({ detail }: { detail: NomadJobDetail }) {
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

// ─── Allocations ──────────────────────────────────────────────────────────────

function AllocationsSection({
  allocs,
  isLoading,
}: {
  allocs: NomadAllocationStub[];
  isLoading: boolean;
}) {
  if (isLoading)
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
        <Loader2 className="size-4 animate-spin" /> Loading allocations…
      </div>
    );
  if (allocs.length === 0)
    return <p className="text-sm text-muted-foreground py-4">No allocations found.</p>;

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-secondary/50">
            {["Alloc ID", "Status", "Task Group", "Node", "Created"].map((h) => (
              <th
                key={h}
                className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-background">
          {allocs.map((alloc) => {
            const dot = ALLOC_DOT[alloc.ClientStatus] ?? "bg-muted-foreground";
            const text = ALLOC_TEXT[alloc.ClientStatus] ?? "text-muted-foreground";
            return (
              <tr
                key={alloc.ID}
                className="border-b border-border last:border-0 hover:bg-accent/20 transition"
              >
                <td className="px-3 py-2.5 font-mono text-xs">{alloc.ID.slice(0, 8)}</td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-1.5">
                    <span className={`size-1.5 rounded-full shrink-0 ${dot}`} />
                    <span className={`text-xs capitalize font-medium ${text}`}>
                      {alloc.ClientStatus}
                    </span>
                  </div>
                </td>
                <td className="px-3 py-2.5 text-xs font-mono text-muted-foreground">
                  {alloc.TaskGroup}
                </td>
                <td className="px-3 py-2.5 text-xs text-muted-foreground">
                  {alloc.NodeName || "—"}
                </td>
                <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                  {formatTime(alloc.CreateTime)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Deployment history ───────────────────────────────────────────────────────

function DeploymentHistorySection({
  deployments,
  isLoading,
  jobType,
}: {
  deployments: NomadDeploymentStub[];
  isLoading: boolean;
  jobType: string;
}) {
  if (jobType !== "service") {
    return (
      <p className="text-sm text-muted-foreground py-4">
        Deployment history is only tracked for <span className="font-mono">service</span> type jobs.
      </p>
    );
  }
  if (isLoading)
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
        <Loader2 className="size-4 animate-spin" /> Loading deployments…
      </div>
    );
  if (deployments.length === 0)
    return <p className="text-sm text-muted-foreground py-4">No deployments recorded.</p>;

  const sorted = [...deployments].sort((a, b) => b.ModifyTime - a.ModifyTime).slice(0, 10);

  return (
    <div className="space-y-2">
      {sorted.map((dep: NomadDeploymentStub) => {
        const st = DEPLOY_STATUS[dep.Status] ?? {
          dot: "bg-muted-foreground",
          text: "text-muted-foreground",
        };
        return (
          <div key={dep.ID} className="rounded-lg border border-border bg-card p-3 space-y-2">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1.5">
                <span className={`size-1.5 rounded-full shrink-0 ${st.dot}`} />
                <span className={`text-[11px] font-semibold capitalize ${st.text}`}>
                  {dep.Status}
                </span>
              </div>
              <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-secondary border border-border text-muted-foreground">
                v{dep.JobVersion}
              </span>
              {dep.StatusDescription && (
                <span className="text-[11px] text-muted-foreground">{dep.StatusDescription}</span>
              )}
              <span className="text-[11px] font-mono text-muted-foreground ml-auto">
                {formatTime(dep.ModifyTime)}
              </span>
            </div>
            {dep.TaskGroups && Object.keys(dep.TaskGroups).length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1 border-t border-border">
                {Object.entries(dep.TaskGroups).map(([tg, tgs]) => (
                  <div key={tg} className="flex items-center gap-2 text-[11px]">
                    <span className="font-mono font-medium text-foreground truncate">{tg}</span>
                    <span className="text-muted-foreground shrink-0">
                      {tgs.PlacedAllocs}/{tgs.DesiredTotal} placed
                    </span>
                    <span className="text-success shrink-0">{tgs.HealthyAllocs} healthy</span>
                    {tgs.UnhealthyAllocs > 0 && (
                      <span className="text-destructive shrink-0">
                        {tgs.UnhealthyAllocs} unhealthy
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function JobDetailPage() {
  const { envId, jobId } = useParams({ from: "/dashboard/environments/$envId/deployments/$jobId" });
  const { namespace } = useSearch({ from: "/dashboard/environments/$envId/deployments/$jobId" });
  const { selectedWorkspace } = useWorkspaceContext();
  const slug = selectedWorkspace?.slug ?? "";

  const [showStop, setShowStop] = useState(false);
  const [showLogs, setShowLogs] = useState(false);

  const {
    data: detail,
    isLoading: jobLoading,
    error: jobError,
  } = useNomadJob(slug, envId, jobId, namespace);
  const { data: allocs = [], isLoading: allocsLoading } = useNomadAllocations(
    slug,
    envId,
    jobId,
    namespace,
  );
  const { data: deployments = [], isLoading: deploymentsLoading } = useNomadDeployments(
    slug,
    envId,
    jobId,
    namespace,
  );

  const stopJob = useStopJob();
  const startJob = useStartJob();

  const canStop = detail?.Status === "running" || detail?.Status === "pending";
  const canStart = detail?.Status === "dead";

  const handleStop = async (purge: boolean) => {
    await stopJob.mutateAsync({ slug, envSlug: envId, jobID: jobId, namespace, purge });
    setShowStop(false);
  };

  return (
    <>
      <DashboardTopbar
        title={detail?.Name ?? jobId}
        subtitle={`Job detail · namespace: ${namespace}`}
      />

      <main className="p-6 space-y-8">
        {/* Back + actions row */}
        <div className="flex items-center justify-between">
          <Link
            to="/dashboard/environments/$envId/deployments"
            params={{ envId }}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition"
          >
            <ArrowLeft className="size-3.5" /> Back to Deployments
          </Link>

          {detail && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowLogs(true)}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-border text-muted-foreground hover:bg-accent transition"
              >
                <Terminal className="size-3.5" /> Logs
              </button>
              {canStop && (
                <button
                  onClick={() => setShowStop(true)}
                  disabled={stopJob.isPending}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-destructive/40 text-destructive hover:bg-destructive/10 transition disabled:opacity-50"
                >
                  {stopJob.isPending ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Square className="size-3.5" />
                  )}{" "}
                  Stop
                </button>
              )}
              {canStart && (
                <button
                  onClick={() =>
                    void startJob.mutateAsync({ slug, envSlug: envId, jobID: jobId, namespace })
                  }
                  disabled={startJob.isPending}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-success/40 text-success hover:bg-success/10 transition disabled:opacity-50"
                >
                  {startJob.isPending ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Play className="size-3.5" />
                  )}{" "}
                  Start
                </button>
              )}
            </div>
          )}
        </div>

        {jobLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
            <Loader2 className="size-4 animate-spin" /> Loading job details…
          </div>
        )}
        {jobError && !jobLoading && (
          <div className="flex items-center gap-2 text-sm text-destructive py-4">
            <AlertTriangle className="size-4" /> Failed to load job details
          </div>
        )}

        {!jobLoading && detail && (
          <section className="space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Overview
            </p>
            <JobOverview detail={detail} />
          </section>
        )}

        {!jobLoading && detail && (
          <section className="space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Allocations {!allocsLoading && `(${allocs.length})`}
            </p>
            <AllocationsSection allocs={allocs} isLoading={allocsLoading} />
          </section>
        )}

        {!jobLoading && detail && (
          <section className="space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Deployment History
            </p>
            <DeploymentHistorySection
              deployments={deployments}
              isLoading={deploymentsLoading}
              jobType={detail.Type}
            />
          </section>
        )}
      </main>

      {showStop && detail && (
        <StopModal
          jobName={detail.Name}
          isPending={stopJob.isPending}
          onConfirm={(purge) => void handleStop(purge)}
          onCancel={() => setShowStop(false)}
        />
      )}
      {showLogs && detail && (
        <LogsDrawer
          jobID={jobId}
          jobName={detail.Name}
          slug={slug}
          envId={envId}
          namespace={namespace}
          onClose={() => setShowLogs(false)}
        />
      )}
    </>
  );
}
