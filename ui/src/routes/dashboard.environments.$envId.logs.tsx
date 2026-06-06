import { createFileRoute, useParams } from "@tanstack/react-router";
import { DashboardTopbar } from "@/components/DashboardTopbar";
import { useWorkspaceContext } from "@/lib/workspace-context";
import {
  useLogsProviders,
  useLogsWorkloads,
  useNomadJob,
  useNomadNamespaces,
  useK8sNamespaces,
} from "@/lib/queries";
import { getAccessToken } from "@/lib/auth";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ScrollText,
  Terminal,
  Play,
  Square,
  Trash2,
  ChevronDown,
  Loader2,
  AlertTriangle,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import type { RuntimeWorkload } from "@/lib/types";

export const Route = createFileRoute("/dashboard/environments/$envId/logs")({
  head: () => ({ meta: [{ title: "Logs · TernakClouds" }] }),
  component: EnvLogsPage,
});

// ─── Constants ────────────────────────────────────────────────────────────────

const LOG_BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? "";
const MAX_LOG_LINES = 3000;

// ─── Log stream hook ──────────────────────────────────────────────────────────

interface LogStreamParams {
  slug: string;
  envSlug: string;
  runtime: string;
  workload: string;
  namespace: string;
  container: string;
  task: string;
  source: string;
  enabled: boolean;
}

function useLogsStream({
  slug,
  envSlug,
  runtime,
  workload,
  namespace,
  container,
  task,
  source,
  enabled,
}: LogStreamParams) {
  const [lines, setLines] = useState<string[]>([]);
  const [connected, setConnected] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !workload) return;
    const ctrl = new AbortController();
    setLines([]);
    setConnected(false);
    setStreamError(null);

    const token = getAccessToken();
    const baseURL = `${LOG_BASE_URL}/api/v1/workspaces/${slug}/environments/${encodeURIComponent(envSlug)}`;

    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    void (async () => {
      try {
        let url = "";
        if (runtime === "kubernetes") {
          if (!container) {
            setStreamError("Container is required");
            return;
          }
          const params = new URLSearchParams({ follow: "true", container });
          url =
            `${baseURL}/kubernetes/pods/${encodeURIComponent(namespace)}/${encodeURIComponent(workload)}/logs` +
            `?${params.toString()}`;
        } else if (runtime === "nomad") {
          if (!task) {
            setStreamError("Task is required");
            return;
          }

          const allocRes = await fetch(
            `${baseURL}/nomad/jobs/${encodeURIComponent(workload)}/allocations?namespace=${encodeURIComponent(namespace)}`,
            { signal: ctrl.signal, headers },
          );
          if (!allocRes.ok) {
            setStreamError(`HTTP ${allocRes.status}`);
            return;
          }

          const allocJson = (await allocRes.json()) as
            | { data?: Array<{ ID: string; ClientStatus?: string; ModifyTime?: number }> }
            | Array<{ ID: string; ClientStatus?: string; ModifyTime?: number }>;
          const allocations = Array.isArray(allocJson)
            ? allocJson
            : Array.isArray(allocJson.data)
              ? allocJson.data
              : [];
          if (allocations.length === 0) {
            setStreamError("No allocations found");
            return;
          }

          const running = allocations.filter((a) => a.ClientStatus === "running");
          const candidates = running.length > 0 ? running : allocations;
          candidates.sort((a, b) => (b.ModifyTime ?? 0) - (a.ModifyTime ?? 0));
          const allocID = candidates[0]?.ID;
          if (!allocID) {
            setStreamError("No allocation found");
            return;
          }

          const params = new URLSearchParams({
            task,
            type: source,
            follow: "true",
            origin: "start",
          });
          url = `${baseURL}/nomad/allocations/${encodeURIComponent(allocID)}/logs?${params.toString()}`;
        } else {
          setStreamError(`Unsupported runtime: ${runtime}`);
          return;
        }

        const res = await fetch(url, { signal: ctrl.signal, headers });
        if (!res.ok) {
          setStreamError(`HTTP ${res.status}`);
          return;
        }
        if (!res.body) {
          setStreamError("No response body");
          return;
        }
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
            if (eventType === "connected") {
              setConnected(true);
            } else if ((eventType === "log" || eventType === "message") && data) {
              setLines((prev) => {
                const next = [...prev, data];
                return next.length > MAX_LOG_LINES ? next.slice(next.length - MAX_LOG_LINES) : next;
              });
            } else if (eventType === "error" && data) {
              setStreamError(data);
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
  }, [slug, envSlug, runtime, workload, namespace, container, task, source, enabled]);

  return { lines, connected, streamError, clear: () => setLines([]) };
}

// ─── Highlight matching text in a log line ────────────────────────────────────

function HighlightedLine({ text, search }: { text: string; search: string }) {
  if (!search) return <>{text}</>;
  const parts = text.split(new RegExp(`(${search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === search.toLowerCase() ? (
          <mark key={i} className="bg-yellow-400/30 text-yellow-200 rounded-sm px-0.5">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

// ─── Small select primitive ───────────────────────────────────────────────────

function Select({
  value,
  onChange,
  placeholder,
  options,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  options: { value: string; label: string }[];
  disabled?: boolean;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="appearance-none h-8 pl-3 pr-8 text-xs rounded-md border border-border bg-background text-foreground disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-1 focus:ring-ring w-full"
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
    </div>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusDot({
  connected,
  error,
  streaming,
}: {
  connected: boolean;
  error: string | null;
  streaming: boolean;
}) {
  if (!streaming)
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <span className="size-1.5 rounded-full bg-muted-foreground" />
        idle
      </span>
    );
  if (error)
    return (
      <span
        className="inline-flex items-center gap-1.5 text-[11px] text-destructive truncate max-w-[240px]"
        title={error}
      >
        <AlertTriangle className="size-3" />
        {error}
      </span>
    );
  if (connected)
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] text-success font-medium">
        <span className="size-1.5 rounded-full bg-success animate-pulse" />
        live
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
      <Loader2 className="size-3 animate-spin" />
      connecting…
    </span>
  );
}

// ─── Workload status badge ────────────────────────────────────────────────────

function WorkloadStatusBadge({ status }: { status?: string }) {
  if (!status) return null;
  const s = status.toLowerCase();
  const cls =
    s === "running"
      ? "bg-success/10 text-success border-success/20"
      : s === "pending" || s === "starting"
        ? "bg-yellow-500/10 text-yellow-500 border-yellow-500/20"
        : s === "dead" || s === "failed"
          ? "bg-destructive/10 text-destructive border-destructive/20"
          : "bg-secondary text-muted-foreground border-border";
  return (
    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${cls}`}>{status}</span>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function EnvLogsPage() {
  const { envId } = useParams({ from: "/dashboard/environments/$envId/logs" });
  const { selectedWorkspace } = useWorkspaceContext();
  const slug = selectedWorkspace?.slug ?? "";

  // Controls state
  const [runtime, setRuntime] = useState("");
  const [namespace, setNamespace] = useState("default");
  const [selectedWorkloadId, setSelectedWorkloadId] = useState("");
  const [container, setContainer] = useState("");
  const [task, setTask] = useState("");
  const [source, setSource] = useState<"stdout" | "stderr">("stdout");
  const [streaming, setStreaming] = useState(false);

  // Search state
  const [searchInput, setSearchInput] = useState("");
  const [activeSearch, setActiveSearch] = useState("");

  const [workloads, setWorkloads] = useState<RuntimeWorkload[]>([]);

  const selectedWorkload = workloads.find((w) => w.id === selectedWorkloadId) ?? null;
  const containers = useMemo(
    () => (selectedWorkload?.metadata?.containers as string[] | undefined) ?? [],
    [selectedWorkload],
  );

  // Providers — only runtimes the user has registered for this environment
  const {
    data: providers,
    isLoading: loadingProviders,
    error: providersError,
  } = useLogsProviders(slug, envId);

  // Workloads (only when runtime is set)
  const {
    data: workloadData,
    isLoading: loadingWorkloads,
    refetch: refetchWorkloads,
  } = useLogsWorkloads(slug, envId, runtime, namespace, !!runtime);

  // Namespace lists for dropdowns
  const { data: k8sNamespaces } = useK8sNamespaces(slug, envId, runtime === "kubernetes");
  const { data: nomadNamespaces } = useNomadNamespaces(slug, envId, runtime === "nomad");

  const namespaceOptions = useMemo(() => {
    if (runtime === "kubernetes") {
      return (k8sNamespaces ?? []).map((ns) => ({ value: ns.name, label: ns.name }));
    }
    if (runtime === "nomad") {
      return (nomadNamespaces ?? []).map((ns) => ({ value: ns.Name, label: ns.Name }));
    }
    return [];
  }, [runtime, k8sNamespaces, nomadNamespaces]);

  // Nomad job detail for task discovery
  const { data: nomadJobDetail } = useNomadJob(
    slug,
    envId,
    selectedWorkloadId,
    namespace,
    runtime === "nomad" && !!selectedWorkloadId,
  );

  const nomadTasks = useMemo(() => {
    if (!nomadJobDetail?.TaskGroups) return [];
    return nomadJobDetail.TaskGroups.flatMap((tg) => tg.Tasks?.map((t) => t.Name) ?? []);
  }, [nomadJobDetail]);

  useEffect(() => {
    setWorkloads(workloadData ?? []);
    setSelectedWorkloadId("");
    setContainer("");
    setTask("");
  }, [workloadData]);

  // When runtime changes, reset everything
  useEffect(() => {
    setSelectedWorkloadId("");
    setContainer("");
    setTask("");
    setNamespace("default");
  }, [runtime]);

  // Auto-select first container when workload changes (kubernetes)
  useEffect(() => {
    if (containers.length > 0) setContainer(containers[0]);
    else setContainer("");
  }, [selectedWorkloadId, containers]);

  // Auto-select first task when Nomad tasks are discovered
  useEffect(() => {
    if (nomadTasks.length > 0) setTask(nomadTasks[0]);
    else if (runtime === "nomad") setTask("");
  }, [nomadTasks, runtime]);

  // Log stream
  const { lines, connected, streamError, clear } = useLogsStream({
    slug,
    envSlug: envId,
    runtime,
    workload: selectedWorkloadId,
    namespace,
    container,
    task,
    source,
    enabled: streaming,
  });

  // Filtered lines based on active search
  const filteredLines = useMemo(() => {
    if (!activeSearch) return lines;
    const lower = activeSearch.toLowerCase();
    return lines.filter((l) => l.toLowerCase().includes(lower));
  }, [lines, activeSearch]);

  // Auto-scroll
  const termRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);
  useEffect(() => {
    if (termRef.current && atBottomRef.current) {
      termRef.current.scrollTop = termRef.current.scrollHeight;
    }
  }, [filteredLines]);
  const handleScroll = () => {
    if (!termRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = termRef.current;
    atBottomRef.current = scrollHeight - scrollTop - clientHeight < 60;
  };

  const canStream =
    !!runtime &&
    !!selectedWorkloadId &&
    (runtime !== "kubernetes" || !!container) &&
    (runtime !== "nomad" || !!task);

  const providerOptions =
    providers?.map((p) => ({
      value: p.name,
      label: p.name.charAt(0).toUpperCase() + p.name.slice(1),
    })) ?? [];

  const workloadOptions = workloads.map((w) => ({
    value: w.id,
    label: w.name + (w.namespace ? ` (${w.namespace})` : ""),
  }));

  const containerOptions = containers.map((c) => ({ value: c, label: c }));
  const taskOptions = nomadTasks.map((t) => ({ value: t, label: t }));

  return (
    <>
      <DashboardTopbar title="Logs" subtitle="Centralized log streaming across runtimes." />

      <main className="p-6 flex flex-col gap-4 h-[calc(100vh-64px)]">
        {/* Controls bar */}
        <div className="rounded-lg border border-border bg-card p-3 flex flex-wrap items-end gap-3">
          {/* Runtime */}
          <div className="flex flex-col gap-1 min-w-[130px]">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Runtime
            </label>
            {loadingProviders ? (
              <div className="h-8 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" /> Loading…
              </div>
            ) : providersError ? (
              <div className="h-8 flex items-center gap-1.5 text-xs text-destructive">
                <AlertTriangle className="size-3.5 shrink-0" />
                <span className="truncate" title={String(providersError)}>
                  Failed to load providers
                </span>
              </div>
            ) : providerOptions.length === 0 ? (
              <div className="h-8 flex items-center gap-1.5 text-xs text-muted-foreground">
                <AlertTriangle className="size-3.5 shrink-0" />
                No runtime configured
              </div>
            ) : (
              <Select
                value={runtime}
                onChange={(v) => {
                  setRuntime(v);
                  setStreaming(false);
                }}
                placeholder="Select runtime"
                options={providerOptions}
                disabled={streaming}
              />
            )}
          </div>

          {/* Namespace — dropdown for both Kubernetes and Nomad */}
          {runtime && (
            <div className="flex flex-col gap-1 min-w-[130px]">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Namespace
              </label>
              {namespaceOptions.length > 0 ? (
                <Select
                  value={namespace}
                  onChange={(v) => {
                    setNamespace(v);
                    setSelectedWorkloadId("");
                    setContainer("");
                    setTask("");
                  }}
                  placeholder="Select namespace"
                  options={namespaceOptions}
                  disabled={streaming}
                />
              ) : (
                <input
                  type="text"
                  value={namespace}
                  onChange={(e) => {
                    setNamespace(e.target.value);
                    setSelectedWorkloadId("");
                    setContainer("");
                    setTask("");
                  }}
                  disabled={streaming}
                  placeholder="default"
                  className="h-8 px-3 text-xs rounded-md border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
                />
              )}
            </div>
          )}

          {/* Workload */}
          <div className="flex flex-col gap-1 min-w-[180px] flex-1">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Workload
              </label>
              {runtime && (
                <button
                  onClick={() => void refetchWorkloads()}
                  disabled={loadingWorkloads || streaming}
                  className="text-muted-foreground hover:text-foreground transition disabled:opacity-40"
                  title="Refresh workloads"
                >
                  <RefreshCw className={`size-3 ${loadingWorkloads ? "animate-spin" : ""}`} />
                </button>
              )}
            </div>
            <Select
              value={selectedWorkloadId}
              onChange={setSelectedWorkloadId}
              placeholder={
                loadingWorkloads ? "Loading…" : runtime ? "Select workload" : "Select runtime first"
              }
              options={workloadOptions}
              disabled={!runtime || streaming || loadingWorkloads}
            />
          </div>

          {/* Container (kubernetes) */}
          {runtime === "kubernetes" && (
            <div className="flex flex-col gap-1 min-w-[140px]">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Container
              </label>
              {containerOptions.length > 0 ? (
                <Select
                  value={container}
                  onChange={setContainer}
                  placeholder="Select container"
                  options={containerOptions}
                  disabled={!selectedWorkloadId || streaming}
                />
              ) : (
                <input
                  type="text"
                  value={container}
                  onChange={(e) => setContainer(e.target.value)}
                  disabled={!selectedWorkloadId || streaming}
                  placeholder="container name"
                  className="h-8 px-3 text-xs rounded-md border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
                />
              )}
            </div>
          )}

          {/* Task (nomad) — dropdown if discovered, free text as fallback */}
          {runtime === "nomad" && (
            <div className="flex flex-col gap-1 min-w-[140px]">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Task
              </label>
              {taskOptions.length > 0 ? (
                <Select
                  value={task}
                  onChange={setTask}
                  placeholder="Select task"
                  options={taskOptions}
                  disabled={!selectedWorkloadId || streaming}
                />
              ) : (
                <input
                  type="text"
                  value={task}
                  onChange={(e) => setTask(e.target.value)}
                  disabled={!selectedWorkloadId || streaming}
                  placeholder="task name"
                  className="h-8 px-3 text-xs rounded-md border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
                />
              )}
            </div>
          )}

          {/* Source toggle */}
          {runtime && (
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Source
              </label>
              <div className="flex h-8 rounded-md border border-border overflow-hidden text-xs">
                {(["stdout", "stderr"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setSource(s)}
                    disabled={streaming}
                    className={`px-3 transition disabled:opacity-50 ${
                      source === s
                        ? "bg-primary text-primary-foreground"
                        : "bg-background text-muted-foreground hover:bg-accent"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Stream button */}
          <div className="flex flex-col gap-1 ml-auto">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground opacity-0 select-none">
              &nbsp;
            </label>
            {!streaming ? (
              <button
                onClick={() => setStreaming(true)}
                disabled={!canStream}
                className="inline-flex items-center gap-1.5 h-8 px-4 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Play className="size-3.5" />
                Stream
              </button>
            ) : (
              <button
                onClick={() => setStreaming(false)}
                className="inline-flex items-center gap-1.5 h-8 px-4 rounded-md bg-destructive/10 text-destructive border border-destructive/20 text-xs font-medium hover:bg-destructive/20 transition"
              >
                <Square className="size-3.5" />
                Stop
              </button>
            )}
          </div>
        </div>

        {/* Selected workload info strip */}
        {selectedWorkload && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-border bg-secondary/50 text-xs text-muted-foreground">
            <span className="font-mono text-foreground">{selectedWorkload.name}</span>
            {selectedWorkload.namespace && (
              <>
                <span className="text-border">·</span>
                <span className="font-mono">{selectedWorkload.namespace}</span>
              </>
            )}
            {selectedWorkload.status && (
              <>
                <span className="text-border">·</span>
                <WorkloadStatusBadge status={selectedWorkload.status} />
              </>
            )}
            <span className="ml-auto text-[10px] uppercase tracking-wider font-semibold">
              {selectedWorkload.runtime}
            </span>
          </div>
        )}

        {/* Empty state — no runtime selected */}
        {!runtime && !loadingProviders && (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 rounded-lg border border-dashed border-border">
            <div className="size-12 rounded-xl bg-secondary grid place-items-center">
              <ScrollText className="size-6 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium">
                {providers?.length === 0 ? "No runtime configured" : "No runtime selected"}
              </p>
              <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                {providers?.length === 0
                  ? "Go to Platform → Runtime to register a runtime provider for this environment."
                  : "Choose a runtime above to browse workloads and stream logs."}
              </p>
            </div>
          </div>
        )}

        {/* Terminal */}
        {runtime && (
          <div className="flex-1 flex flex-col rounded-lg border border-border overflow-hidden min-h-0">
            {/* Terminal toolbar */}
            <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-card shrink-0">
              <Terminal className="size-3.5 text-muted-foreground shrink-0" />
              <span className="text-xs text-muted-foreground font-mono truncate">
                {selectedWorkloadId
                  ? `${selectedWorkloadId}${container ? ` / ${container}` : ""}${task ? ` / ${task}` : ""}`
                  : "select a workload to begin"}
              </span>
              <div className="ml-auto flex items-center gap-2 shrink-0">
                {/* Search input */}
                <div className="flex items-center gap-1">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 size-3 text-muted-foreground" />
                    <input
                      type="text"
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") setActiveSearch(searchInput);
                        if (e.key === "Escape") {
                          setSearchInput("");
                          setActiveSearch("");
                        }
                      }}
                      placeholder="Search logs…"
                      className="h-6 pl-6 pr-2 text-[11px] rounded-md border border-border bg-background text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-ring w-40"
                    />
                    {searchInput && (
                      <button
                        onClick={() => {
                          setSearchInput("");
                          setActiveSearch("");
                        }}
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        <X className="size-2.5" />
                      </button>
                    )}
                  </div>
                  <button
                    onClick={() => setActiveSearch(searchInput)}
                    className="h-6 px-2 text-[11px] rounded-md border border-border bg-background text-muted-foreground hover:text-foreground hover:bg-accent transition"
                  >
                    Search
                  </button>
                </div>

                <StatusDot connected={connected} error={streamError} streaming={streaming} />

                <button
                  onClick={() => {
                    clear();
                    setSearchInput("");
                    setActiveSearch("");
                    atBottomRef.current = true;
                  }}
                  className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition px-1.5 py-0.5 rounded border border-border hover:bg-accent"
                  title="Clear logs"
                >
                  <Trash2 className="size-3" />
                  Clear
                </button>
                <span className="text-[10px] text-muted-foreground tabular-nums">
                  {lines.length > 0 &&
                    (activeSearch
                      ? `${filteredLines.length} / ${lines.length.toLocaleString()} lines`
                      : `${lines.length.toLocaleString()} lines`)}
                </span>
              </div>
            </div>

            {/* Log output */}
            <div
              ref={termRef}
              onScroll={handleScroll}
              className="flex-1 overflow-y-auto bg-[#0d0d0d] p-4 font-mono text-xs text-green-300 leading-relaxed"
            >
              {!streaming && lines.length === 0 ? (
                <span className="text-zinc-600 italic">
                  {canStream
                    ? "Click Stream to start tailing logs."
                    : "Configure runtime and workload above, then click Stream."}
                </span>
              ) : streaming && lines.length === 0 ? (
                <span className="text-zinc-600 italic">
                  {connected ? "Waiting for logs…" : "Connecting…"}
                </span>
              ) : filteredLines.length === 0 && activeSearch ? (
                <span className="text-zinc-600 italic">No lines match "{activeSearch}".</span>
              ) : (
                filteredLines.map((line, i) => (
                  <div
                    key={i}
                    className="whitespace-pre-wrap break-all hover:bg-white/5 px-1 -mx-1 rounded"
                  >
                    <HighlightedLine text={line} search={activeSearch} />
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </main>
    </>
  );
}
