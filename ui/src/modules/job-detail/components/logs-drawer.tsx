import { createPortal } from "react-dom";
import { useState, useEffect, useRef } from "react";
import { Terminal, X, Loader2, AlertTriangle } from "lucide-react";
import type { NomadAllocationStub } from "@/lib/types";
import { useNomadAllocations, useNomadAllocation } from "@/lib/queries";
import { useJobLogStream } from "../hooks/use-job-log-stream";
import { ALLOC_DOT, formatTime } from "../utils/status";

export function LogsDrawer({
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

  const { lines, connected, streamError, clear } = useJobLogStream({
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
          {/* Alloc list */}
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

          {/* Right pane */}
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
