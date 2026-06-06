import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { createPortal } from "react-dom";
import { DashboardTopbar } from "@/components/DashboardTopbar";
import { useWorkspaceContext } from "@/lib/workspace-context";
import {
  useCapability,
  useNomadNamespaces,
  useNomadJobs,
  useNomadAllocations,
  useK8sDeployments,
  useK8sNamespaces,
  useK8sPods,
  useDockerContainers,
  useRemoveDockerContainer,
} from "@/lib/queries";
import { useState, useEffect, useRef } from "react";
import {
  Loader2,
  AlertTriangle,
  RefreshCw,
  Server,
  Terminal,
  X,
  Search,
  Settings2,
  Trash2,
} from "lucide-react";
import type {
  NomadJobStub,
  NomadAllocationStub,
  K8sDeploymentStub,
  DockerContainerStub,
} from "@/lib/types";
import { getAccessToken } from "@/lib/auth";

export const Route = createFileRoute("/dashboard/environments/$envId/deployments/")({
  head: () => ({ meta: [{ title: "Deployments · TernakClouds" }] }),
  component: EnvDeploymentsPage,
});

// ─── Constants ────────────────────────────────────────────────────────────────

const LOG_BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? "";
const MAX_LOG_LINES = 2000;

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

function formatDate(iso: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

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

// ─── Docker-specific helpers ─────────────────────────────────────────────────

const CONTAINER_STATE_DOT: Record<string, string> = {
  running: "bg-success",
  exited: "bg-muted-foreground",
  paused: "bg-yellow-500",
  restarting: "bg-warning",
  dead: "bg-destructive",
};
const CONTAINER_STATE_TEXT: Record<string, string> = {
  running: "text-success",
  exited: "text-muted-foreground",
  paused: "text-yellow-500",
  restarting: "text-warning",
  dead: "text-destructive",
};

function formatCreated(unix: number) {
  if (!unix) return "—";
  return new Date(unix * 1000).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatPorts(ports: DockerContainerStub["ports"]): string {
  if (!ports || ports.length === 0) return "—";
  return (
    ports
      .filter((p) => p.public_port)
      .map((p) => `${p.public_port}:${p.private_port}/${p.type}`)
      .join(", ") || ports.map((p) => `${p.private_port}/${p.type}`).join(", ")
  );
}

// ─── Log streaming hooks ──────────────────────────────────────────────────────

function useDockerLogStream({
  slug,
  envSlug,
  containerId,
  enabled,
}: {
  slug: string;
  envSlug: string;
  containerId: string;
  enabled: boolean;
}) {
  const [lines, setLines] = useState<string[]>([]);
  const [connected, setConnected] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !containerId) return;
    const ctrl = new AbortController();
    setLines([]);
    setConnected(false);
    setStreamError(null);
    const token = getAccessToken();
    const url =
      `${LOG_BASE_URL}/api/v1/workspaces/${slug}/environments/${encodeURIComponent(envSlug)}` +
      `/docker/containers/${encodeURIComponent(containerId)}/logs?follow=true`;
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    void (async () => {
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
            if ((eventType === "log" || eventType === "message") && data) {
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
  }, [slug, envSlug, containerId, enabled]);

  return { lines, connected, streamError, clear: () => setLines([]) };
}

function useNomadAllocLogStream({
  slug,
  envSlug,
  allocID,
  task,
  logType,
  enabled,
}: {
  slug: string;
  envSlug: string;
  allocID: string;
  task: string;
  logType: "stdout" | "stderr";
  enabled: boolean;
}) {
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
      `${LOG_BASE_URL}/api/v1/workspaces/${slug}/environments/${encodeURIComponent(envSlug)}` +
      `/nomad/allocations/${encodeURIComponent(allocID)}/logs` +
      `?task=${encodeURIComponent(task)}&type=${logType}&follow=true&origin=start`;
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    void (async () => {
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
            if ((eventType === "log" || eventType === "message") && data) {
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
  }, [slug, envSlug, allocID, task, logType, enabled]);

  return { lines, connected, streamError, clear: () => setLines([]) };
}

function useK8sPodLogStream({
  slug,
  envSlug,
  namespace,
  podName,
  container,
  enabled,
}: {
  slug: string;
  envSlug: string;
  namespace: string;
  podName: string;
  container: string;
  enabled: boolean;
}) {
  const [lines, setLines] = useState<string[]>([]);
  const [connected, setConnected] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !podName || !container) return;
    const ctrl = new AbortController();
    setLines([]);
    setConnected(false);
    setStreamError(null);
    const token = getAccessToken();
    const url =
      `${LOG_BASE_URL}/api/v1/workspaces/${slug}/environments/${encodeURIComponent(envSlug)}` +
      `/kubernetes/pods/${encodeURIComponent(namespace)}/${encodeURIComponent(podName)}/logs` +
      `?follow=true&container=${encodeURIComponent(container)}`;
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    void (async () => {
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
            if ((eventType === "log" || eventType === "message") && data) {
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
  }, [slug, envSlug, namespace, podName, container, enabled]);

  return { lines, connected, streamError, clear: () => setLines([]) };
}

// ─── Shared log terminal ──────────────────────────────────────────────────────

function LogTerminal({
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

// ─── Runtime-specific log panels ─────────────────────────────────────────────

function NomadLogsPanel({
  slug,
  envSlug,
  jobId,
  namespace,
}: {
  slug: string;
  envSlug: string;
  jobId: string;
  namespace: string;
}) {
  const { data: allocations = [], isLoading } = useNomadAllocations(
    slug,
    envSlug,
    jobId,
    namespace,
    true,
  );
  const termRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);

  const runningAlloc =
    [...allocations]
      .filter((a) => a.ClientStatus === "running")
      .sort((a, b) => b.ModifyTime - a.ModifyTime)[0] ??
    [...allocations].sort((a, b) => b.ModifyTime - a.ModifyTime)[0];

  const tasks = runningAlloc ? Object.keys(runningAlloc.TaskStates ?? {}) : [];
  const [task, setTask] = useState("");
  const [logType, setLogType] = useState<"stdout" | "stderr">("stdout");

  const taskKey = tasks.join(",");
  useEffect(() => {
    if (!task && tasks.length > 0) setTask(tasks[0] ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskKey]);

  const { lines, connected, streamError, clear } = useNomadAllocLogStream({
    slug,
    envSlug,
    allocID: runningAlloc?.ID ?? "",
    task,
    logType,
    enabled: !!runningAlloc?.ID && !!task,
  });

  useEffect(() => {
    if (termRef.current && atBottomRef.current)
      termRef.current.scrollTop = termRef.current.scrollHeight;
  }, [lines]);

  const handleScroll = () => {
    if (!termRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = termRef.current;
    atBottomRef.current = scrollHeight - scrollTop - clientHeight < 60;
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center gap-2 text-muted-foreground text-sm">
        <Loader2 className="size-4 animate-spin" /> Loading allocations…
      </div>
    );
  }
  if (!runningAlloc) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
        No allocations found for this job.
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border shrink-0 flex-wrap">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-muted-foreground">Alloc</span>
          <span className="font-mono text-[11px] bg-secondary px-1.5 py-0.5 rounded border border-border">
            {runningAlloc.ID.slice(0, 8)}
          </span>
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
              runningAlloc.ClientStatus === "running"
                ? "bg-success/10 text-success"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {runningAlloc.ClientStatus}
          </span>
        </div>
        {tasks.length > 0 && (
          <select
            value={task}
            onChange={(e) => setTask(e.target.value)}
            className="text-xs px-2 py-1 rounded border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary/50"
          >
            {tasks.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        )}
        <div className="flex rounded-md border border-border overflow-hidden text-[11px]">
          {(["stdout", "stderr"] as const).map((lt) => (
            <button
              key={lt}
              onClick={() => setLogType(lt)}
              className={`px-2 py-1 font-mono transition ${
                logType === lt
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-accent text-muted-foreground"
              }`}
            >
              {lt}
            </button>
          ))}
        </div>
      </div>
      <LogTerminal
        lines={lines}
        connected={connected}
        streamError={streamError}
        termRef={termRef}
        onScroll={handleScroll}
        onClear={() => {
          clear();
          atBottomRef.current = true;
        }}
      />
    </>
  );
}

function K8sLogsPanel({
  slug,
  envSlug,
  namespace,
  depName,
}: {
  slug: string;
  envSlug: string;
  namespace: string;
  depName: string;
}) {
  const { data: pods = [], isLoading } = useK8sPods(slug, envSlug, namespace, true);
  const termRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);

  const depPods = pods.filter((p) => p.name.startsWith(depName + "-"));
  const runningPods = depPods.filter((p) => p.phase === "Running");
  const candidates = runningPods.length > 0 ? runningPods : depPods;

  const [podName, setPodName] = useState("");
  const [container, setContainer] = useState("");

  const candidatesKey = candidates.map((p) => p.name).join(",");
  useEffect(() => {
    if (!podName && candidates.length > 0) setPodName(candidates[0]?.name ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidatesKey]);

  const selectedPod = pods.find((p) => p.name === podName);
  const containerKey = selectedPod?.containers.join(",") ?? "";
  useEffect(() => {
    if (selectedPod?.containers.length) setContainer(selectedPod.containers[0] ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [podName, containerKey]);

  const { lines, connected, streamError, clear } = useK8sPodLogStream({
    slug,
    envSlug,
    namespace,
    podName,
    container,
    enabled: !!podName && !!container,
  });

  useEffect(() => {
    if (termRef.current && atBottomRef.current)
      termRef.current.scrollTop = termRef.current.scrollHeight;
  }, [lines]);

  const handleScroll = () => {
    if (!termRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = termRef.current;
    atBottomRef.current = scrollHeight - scrollTop - clientHeight < 60;
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center gap-2 text-muted-foreground text-sm">
        <Loader2 className="size-4 animate-spin" /> Loading pods…
      </div>
    );
  }
  if (candidates.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
        No pods found for this deployment.
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border shrink-0 flex-wrap">
        <select
          value={podName}
          onChange={(e) => {
            setPodName(e.target.value);
            setContainer("");
          }}
          className="text-xs px-2 py-1 rounded border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary/50 font-mono flex-1 min-w-0"
        >
          {candidates.map((p) => (
            <option key={p.name} value={p.name}>
              {p.name}
            </option>
          ))}
        </select>
        {selectedPod && selectedPod.containers.length > 0 && (
          <select
            value={container}
            onChange={(e) => setContainer(e.target.value)}
            className="text-xs px-2 py-1 rounded border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary/50"
          >
            {selectedPod.containers.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        )}
      </div>
      <LogTerminal
        lines={lines}
        connected={connected}
        streamError={streamError}
        termRef={termRef}
        onScroll={handleScroll}
        onClear={() => {
          clear();
          atBottomRef.current = true;
        }}
      />
    </>
  );
}

function DockerLogsPanel({
  slug,
  envSlug,
  container,
}: {
  slug: string;
  envSlug: string;
  container: DockerContainerStub;
}) {
  const termRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);

  const { lines, connected, streamError, clear } = useDockerLogStream({
    slug,
    envSlug,
    containerId: container.id,
    enabled: true,
  });

  useEffect(() => {
    if (termRef.current && atBottomRef.current)
      termRef.current.scrollTop = termRef.current.scrollHeight;
  }, [lines]);

  const handleScroll = () => {
    if (!termRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = termRef.current;
    atBottomRef.current = scrollHeight - scrollTop - clientHeight < 60;
  };

  return (
    <LogTerminal
      lines={lines}
      connected={connected}
      streamError={streamError}
      termRef={termRef}
      onScroll={handleScroll}
      onClear={() => {
        clear();
        atBottomRef.current = true;
      }}
    />
  );
}

// ─── Drawer target types ──────────────────────────────────────────────────────

type DrawerTarget =
  | { kind: "nomad"; job: NomadJobStub; namespace: string }
  | { kind: "k8s"; dep: K8sDeploymentStub }
  | { kind: "docker"; container: DockerContainerStub };

// ─── Log drawer ───────────────────────────────────────────────────────────────

function LogDrawer({
  slug,
  envSlug,
  target,
  onClose,
}: {
  slug: string;
  envSlug: string;
  target: DrawerTarget;
  onClose: () => void;
}) {
  const title =
    target.kind === "nomad"
      ? target.job.Name
      : target.kind === "k8s"
        ? target.dep.name
        : target.container.name.replace(/^\//, "");

  const subtitle =
    target.kind === "nomad"
      ? `${target.namespace} · Nomad`
      : target.kind === "k8s"
        ? `${target.dep.namespace} · Kubernetes`
        : `${target.container.id.slice(0, 12)} · Docker`;

  return createPortal(
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute right-0 top-0 h-full w-[700px] max-w-[95vw] flex flex-col glass border-l border-border shadow-2xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <Terminal className="size-4 text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <p className="font-semibold text-sm leading-none truncate">{title}</p>
              <p className="text-xs font-mono text-muted-foreground mt-0.5">{subtitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-accent transition text-muted-foreground shrink-0"
          >
            <X className="size-4" />
          </button>
        </div>

        {target.kind === "nomad" && (
          <NomadLogsPanel
            slug={slug}
            envSlug={envSlug}
            jobId={target.job.ID}
            namespace={target.namespace}
          />
        )}
        {target.kind === "k8s" && (
          <K8sLogsPanel
            slug={slug}
            envSlug={envSlug}
            namespace={target.dep.namespace}
            depName={target.dep.name}
          />
        )}
        {target.kind === "docker" && (
          <DockerLogsPanel slug={slug} envSlug={envSlug} container={target.container} />
        )}
      </div>
    </div>,
    document.body,
  );
}

// ─── Details drawer ───────────────────────────────────────────────────────────

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

function DetailsDrawer({ target, onClose }: { target: DrawerTarget; onClose: () => void }) {
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

// ─── Action buttons ───────────────────────────────────────────────────────────

function ActionBtn({
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

function RowActions({ onLogs, onDetails }: { onLogs: () => void; onDetails: () => void }) {
  return (
    <div className="flex items-center gap-0.5">
      <ActionBtn onClick={onLogs} icon={Terminal} label="View logs" />
      <ActionBtn onClick={onDetails} icon={Settings2} label="Details" />
    </div>
  );
}

// ─── Nomad job row ────────────────────────────────────────────────────────────

function JobRow({
  job,
  envId,
  namespace,
  onLogs,
  onDetails,
}: {
  job: NomadJobStub;
  envId: string;
  namespace: string;
  onLogs: () => void;
  onDetails: () => void;
}) {
  const dotCls = JOB_STATUS_DOT[job.Status] ?? "bg-muted-foreground";
  const textCls = JOB_STATUS_TEXT[job.Status] ?? "text-muted-foreground";

  return (
    <tr className="border-b border-border hover:bg-accent/30 transition-colors">
      <td className="px-3 py-3">
        <Link
          to="/dashboard/environments/$envId/deployments/$jobId"
          params={{ envId, jobId: job.ID }}
          search={{ namespace }}
          className="font-medium text-sm hover:text-primary transition"
        >
          {job.Name}
        </Link>
        <div className="text-[11px] font-mono text-muted-foreground mt-0.5 truncate max-w-[220px]">
          {job.ID}
        </div>
      </td>
      <td className="px-3 py-3">
        <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-secondary border border-border text-muted-foreground">
          {job.Type}
        </span>
      </td>
      <td className="px-3 py-3">
        <div className="flex items-center gap-1.5">
          <span className={`inline-block size-2 rounded-full shrink-0 ${dotCls}`} />
          <span className={`text-xs capitalize font-medium ${textCls}`}>{job.Status}</span>
        </div>
      </td>
      <td className="px-3 py-3 text-xs text-muted-foreground font-mono">
        {(job.Datacenters ?? []).join(", ") || "—"}
      </td>
      <td className="px-3 py-3 text-xs text-muted-foreground whitespace-nowrap">
        {formatTime(job.SubmitTime)}
      </td>
      <td className="px-3 py-2">
        <RowActions onLogs={onLogs} onDetails={onDetails} />
      </td>
    </tr>
  );
}

// ─── Nomad jobs list view ─────────────────────────────────────────────────────

function JobsListView({ slug, envId }: { slug: string; envId: string }) {
  const [namespace, setNamespace] = useState("default");
  const [search, setSearch] = useState("");
  const [logTarget, setLogTarget] = useState<DrawerTarget | null>(null);
  const [detailsTarget, setDetailsTarget] = useState<DrawerTarget | null>(null);

  const { data: namespaces = [] } = useNomadNamespaces(slug, envId);
  const {
    data: jobs = [],
    isLoading,
    isFetching,
    error,
    refetch,
    dataUpdatedAt,
  } = useNomadJobs(slug, envId, namespace);

  const filtered = search
    ? jobs.filter(
        (j) =>
          j.Name.toLowerCase().includes(search.toLowerCase()) ||
          j.ID.toLowerCase().includes(search.toLowerCase()),
      )
    : jobs;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search jobs…"
            className="pl-8 pr-3 py-1.5 text-xs rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary/50 w-48"
          />
        </div>
        {/* Namespace selector */}
        {namespaces.length > 0 && (
          <select
            value={namespace}
            onChange={(e) => setNamespace(e.target.value)}
            className="text-xs px-2 py-1 rounded-md border border-border bg-background font-mono focus:outline-none focus:ring-1 focus:ring-primary/50"
          >
            {namespaces.map((ns) => (
              <option key={ns.Name} value={ns.Name}>
                {ns.Name}
              </option>
            ))}
          </select>
        )}
        {!isLoading && (
          <span className="text-xs text-muted-foreground">
            {filtered.length}
            {filtered.length !== jobs.length ? `/${jobs.length}` : ""} job
            {jobs.length !== 1 ? "s" : ""}
          </span>
        )}
        {dataUpdatedAt > 0 && !isLoading && (
          <span className="text-xs text-muted-foreground/60">
            · updated{" "}
            {new Date(dataUpdatedAt).toLocaleTimeString(undefined, {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })}
          </span>
        )}
        <div className="flex-1" />
        <button
          onClick={() => void refetch()}
          disabled={isFetching}
          className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md border border-border hover:bg-accent transition disabled:opacity-60"
        >
          <RefreshCw className={`size-3.5 ${isFetching ? "animate-spin" : ""}`} />
          {isFetching ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
          <Loader2 className="size-4 animate-spin" /> Loading jobs…
        </div>
      )}
      {error && !isLoading && (
        <div className="flex items-center gap-2 text-sm text-destructive py-4">
          <AlertTriangle className="size-4" /> Failed to fetch jobs from Nomad
        </div>
      )}
      {!isLoading && !error && filtered.length === 0 && (
        <div className="py-16 text-center text-sm text-muted-foreground">
          {jobs.length === 0 ? `No jobs in namespace ${namespace}.` : "No jobs match the search."}
        </div>
      )}

      {!isLoading && !error && filtered.length > 0 && (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/50">
                {["Job", "Type", "Status", "Datacenters", "Submitted", ""].map((h) => (
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
              {filtered.map((job) => (
                <JobRow
                  key={job.ID}
                  job={job}
                  envId={envId}
                  namespace={namespace}
                  onLogs={() => setLogTarget({ kind: "nomad", job, namespace })}
                  onDetails={() => setDetailsTarget({ kind: "nomad", job, namespace })}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {logTarget && (
        <LogDrawer
          slug={slug}
          envSlug={envId}
          target={logTarget}
          onClose={() => setLogTarget(null)}
        />
      )}
      {detailsTarget && (
        <DetailsDrawer target={detailsTarget} onClose={() => setDetailsTarget(null)} />
      )}
    </div>
  );
}

// ─── K8s deployment row ───────────────────────────────────────────────────────

function K8sDeploymentRow({
  dep,
  envId,
  onLogs,
  onDetails,
}: {
  dep: K8sDeploymentStub;
  envId: string;
  onLogs: () => void;
  onDetails: () => void;
}) {
  const isHealthy = dep.ready >= dep.desired && dep.desired > 0;
  const isScaledDown = dep.desired === 0;

  return (
    <tr className="border-b border-border hover:bg-accent/30 transition-colors">
      <td className="px-3 py-3">
        <Link
          to="/dashboard/environments/$envId/deployments/k8s/$namespace/$name"
          params={{ envId, namespace: dep.namespace, name: dep.name }}
          className="font-medium text-sm hover:text-primary transition font-mono"
        >
          {dep.name}
        </Link>
        <div className="text-[11px] font-mono text-muted-foreground mt-0.5">{dep.namespace}</div>
      </td>
      <td className="px-3 py-3">
        <div className="flex items-center gap-1.5">
          <span
            className={`inline-block size-2 rounded-full shrink-0 ${
              isScaledDown ? "bg-muted-foreground" : isHealthy ? "bg-success" : "bg-yellow-500"
            }`}
          />
          <span
            className={`text-xs font-medium ${
              isScaledDown
                ? "text-muted-foreground"
                : isHealthy
                  ? "text-success"
                  : "text-yellow-500"
            }`}
          >
            {isScaledDown ? "scaled down" : isHealthy ? "healthy" : "degraded"}
          </span>
        </div>
      </td>
      <td className="px-3 py-3 text-xs font-mono text-muted-foreground">
        {dep.ready}/{dep.desired}
      </td>
      <td className="px-3 py-3 text-xs font-mono text-muted-foreground">{dep.upToDate}</td>
      <td className="px-3 py-3 text-xs font-mono text-muted-foreground">{dep.available}</td>
      <td className="px-3 py-3 text-xs text-muted-foreground whitespace-nowrap">
        {formatDate(dep.createdAt)}
      </td>
      <td className="px-3 py-2">
        <RowActions onLogs={onLogs} onDetails={onDetails} />
      </td>
    </tr>
  );
}

// ─── K8s deployments list view ────────────────────────────────────────────────

type K8sFilter = "all" | "active" | "scaled-down";

function K8sDeploymentsListView({ slug, envId }: { slug: string; envId: string }) {
  const [filter, setFilter] = useState<K8sFilter>("all");
  const [namespace, setNamespace] = useState("default");
  const [search, setSearch] = useState("");
  const [logTarget, setLogTarget] = useState<DrawerTarget | null>(null);
  const [detailsTarget, setDetailsTarget] = useState<DrawerTarget | null>(null);

  const { data: namespaces = [] } = useK8sNamespaces(slug, envId);
  const {
    data: deployments = [],
    isLoading,
    isFetching,
    error,
    refetch,
    dataUpdatedAt,
  } = useK8sDeployments(slug, envId, namespace);

  const filtered = deployments
    .filter((d) => {
      if (filter === "active") return d.desired > 0;
      if (filter === "scaled-down") return d.desired === 0;
      return true;
    })
    .filter(
      (d) =>
        !search ||
        d.name.toLowerCase().includes(search.toLowerCase()) ||
        d.namespace.toLowerCase().includes(search.toLowerCase()),
    );

  const filterBtns: { key: K8sFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "active", label: "Active" },
    { key: "scaled-down", label: "Scaled down" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search deployments…"
            className="pl-8 pr-3 py-1.5 text-xs rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary/50 w-52"
          />
        </div>
        {/* Namespace */}
        {namespaces.length > 0 && (
          <select
            value={namespace}
            onChange={(e) => setNamespace(e.target.value)}
            className="text-xs px-2 py-1 rounded-md border border-border bg-background font-mono focus:outline-none focus:ring-1 focus:ring-primary/50"
          >
            {namespaces.map((ns) => (
              <option key={ns.name} value={ns.name}>
                {ns.name}
              </option>
            ))}
          </select>
        )}
        {/* Status filter */}
        <div className="flex rounded-md border border-border overflow-hidden text-xs">
          {filterBtns.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-2.5 py-1 transition ${
                filter === key
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-accent text-muted-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {!isLoading && (
          <span className="text-xs text-muted-foreground">
            {filtered.length}
            {filtered.length !== deployments.length ? `/${deployments.length}` : ""} deployment
            {deployments.length !== 1 ? "s" : ""}
          </span>
        )}
        {dataUpdatedAt > 0 && !isLoading && (
          <span className="text-xs text-muted-foreground/60">
            · updated{" "}
            {new Date(dataUpdatedAt).toLocaleTimeString(undefined, {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })}
          </span>
        )}
        <div className="flex-1" />
        <button
          onClick={() => void refetch()}
          disabled={isFetching}
          className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md border border-border hover:bg-accent transition disabled:opacity-60"
        >
          <RefreshCw className={`size-3.5 ${isFetching ? "animate-spin" : ""}`} />
          {isFetching ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
          <Loader2 className="size-4 animate-spin" /> Loading deployments…
        </div>
      )}
      {error && !isLoading && (
        <div className="flex items-center gap-2 text-sm text-destructive py-4">
          <AlertTriangle className="size-4" /> Failed to fetch deployments from Kubernetes
        </div>
      )}
      {!isLoading && !error && filtered.length === 0 && (
        <div className="py-16 text-center text-sm text-muted-foreground">
          {deployments.length === 0
            ? "No deployments found."
            : "No deployments match the current filter."}
        </div>
      )}

      {!isLoading && !error && filtered.length > 0 && (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/50">
                {["Deployment", "Status", "Ready", "Up-to-date", "Available", "Created", ""].map(
                  (h) => (
                    <th
                      key={h}
                      className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody className="bg-background">
              {filtered.map((dep) => (
                <K8sDeploymentRow
                  key={`${dep.namespace}/${dep.name}`}
                  dep={dep}
                  envId={envId}
                  onLogs={() => setLogTarget({ kind: "k8s", dep })}
                  onDetails={() => setDetailsTarget({ kind: "k8s", dep })}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {logTarget && (
        <LogDrawer
          slug={slug}
          envSlug={envId}
          target={logTarget}
          onClose={() => setLogTarget(null)}
        />
      )}
      {detailsTarget && (
        <DetailsDrawer target={detailsTarget} onClose={() => setDetailsTarget(null)} />
      )}
    </div>
  );
}

// ─── Docker container row ─────────────────────────────────────────────────────

function DockerContainerRow({
  container,
  slug,
  envId,
  onLogs,
  onDetails,
}: {
  container: DockerContainerStub;
  slug: string;
  envId: string;
  onLogs: () => void;
  onDetails: () => void;
}) {
  const state = container.state?.toLowerCase() ?? "";
  const dotCls = CONTAINER_STATE_DOT[state] ?? "bg-muted-foreground";
  const textCls = CONTAINER_STATE_TEXT[state] ?? "text-muted-foreground";
  const shortId = container.id.slice(0, 12);
  const imgTag = container.image.includes(":") ? container.image : `${container.image}:latest`;

  const [confirming, setConfirming] = useState(false);
  const remove = useRemoveDockerContainer();

  const handleDelete = () => {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    remove.mutate(
      { slug, envSlug: envId, id: container.id },
      { onSettled: () => setConfirming(false) },
    );
  };

  return (
    <tr className="border-b border-border hover:bg-accent/30 transition-colors">
      <td className="px-3 py-3">
        <div className="font-medium text-sm font-mono">{container.name.replace(/^\//, "")}</div>
        <div className="text-[11px] font-mono text-muted-foreground mt-0.5">{shortId}</div>
      </td>
      <td className="px-3 py-3 text-xs font-mono text-muted-foreground max-w-[200px]">
        <div className="truncate">{imgTag}</div>
      </td>
      <td className="px-3 py-3">
        <div className="flex items-center gap-1.5">
          <span className={`inline-block size-2 rounded-full shrink-0 ${dotCls}`} />
          <span className={`text-xs capitalize font-medium ${textCls}`}>{state || "—"}</span>
        </div>
      </td>
      <td className="px-3 py-3 text-xs text-muted-foreground">{container.status}</td>
      <td className="px-3 py-3 text-xs font-mono text-muted-foreground whitespace-nowrap">
        {formatPorts(container.ports)}
      </td>
      <td className="px-3 py-3 text-xs text-muted-foreground whitespace-nowrap">
        {formatCreated(container.created)}
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-0.5">
          <ActionBtn onClick={onLogs} icon={Terminal} label="View logs" />
          <ActionBtn onClick={onDetails} icon={Settings2} label="Details" />
          {confirming ? (
            <div className="flex items-center gap-1 ml-1">
              <button
                onClick={() => setConfirming(false)}
                className="text-[10px] px-1.5 py-0.5 rounded hover:bg-accent text-muted-foreground transition"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={remove.isPending}
                className="text-[10px] px-1.5 py-0.5 rounded bg-destructive/15 text-destructive hover:bg-destructive/25 transition flex items-center gap-1 disabled:opacity-60"
              >
                {remove.isPending && <Loader2 className="size-2.5 animate-spin" />}
                Confirm
              </button>
            </div>
          ) : (
            <ActionBtn onClick={handleDelete} icon={Trash2} label="Stop & remove" />
          )}
        </div>
      </td>
    </tr>
  );
}

// ─── Docker containers list view ──────────────────────────────────────────────

function DockerContainersListView({ slug, envId }: { slug: string; envId: string }) {
  const [search, setSearch] = useState("");
  const [logTarget, setLogTarget] = useState<DrawerTarget | null>(null);
  const [detailsTarget, setDetailsTarget] = useState<DrawerTarget | null>(null);

  const {
    data: containers = [],
    isLoading,
    isFetching,
    error,
    refetch,
    dataUpdatedAt,
  } = useDockerContainers(slug, envId, true);

  const filtered = search
    ? containers.filter(
        (c) =>
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          c.image.toLowerCase().includes(search.toLowerCase()) ||
          c.id.startsWith(search.toLowerCase()),
      )
    : containers;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search containers…"
            className="pl-8 pr-3 py-1.5 text-xs rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary/50 w-48"
          />
        </div>
        {!isLoading && (
          <span className="text-xs text-muted-foreground">
            {filtered.length}
            {filtered.length !== containers.length ? `/${containers.length}` : ""} container
            {containers.length !== 1 ? "s" : ""}
          </span>
        )}
        {dataUpdatedAt > 0 && !isLoading && (
          <span className="text-xs text-muted-foreground/60">
            · updated{" "}
            {new Date(dataUpdatedAt).toLocaleTimeString(undefined, {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })}
          </span>
        )}
        <div className="flex-1" />
        <button
          onClick={() => void refetch()}
          disabled={isFetching}
          className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md border border-border hover:bg-accent transition disabled:opacity-60"
        >
          <RefreshCw className={`size-3.5 ${isFetching ? "animate-spin" : ""}`} />
          {isFetching ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
          <Loader2 className="size-4 animate-spin" /> Loading containers…
        </div>
      )}
      {error && !isLoading && (
        <div className="flex items-center gap-2 text-sm text-destructive py-4">
          <AlertTriangle className="size-4" /> Failed to fetch containers from Docker
        </div>
      )}
      {!isLoading && !error && filtered.length === 0 && (
        <div className="py-16 text-center text-sm text-muted-foreground">
          {containers.length === 0 ? "No containers found." : "No containers match the search."}
        </div>
      )}
      {!isLoading && !error && filtered.length > 0 && (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/50">
                {["Container", "Image", "State", "Status", "Ports", "Created", ""].map((h) => (
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
              {filtered.map((c) => (
                <DockerContainerRow
                  key={c.id}
                  container={c}
                  slug={slug}
                  envId={envId}
                  onLogs={() => setLogTarget({ kind: "docker", container: c })}
                  onDetails={() => setDetailsTarget({ kind: "docker", container: c })}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {logTarget && (
        <LogDrawer
          slug={slug}
          envSlug={envId}
          target={logTarget}
          onClose={() => setLogTarget(null)}
        />
      )}
      {detailsTarget && (
        <DetailsDrawer target={detailsTarget} onClose={() => setDetailsTarget(null)} />
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function EnvDeploymentsPage() {
  const { envId } = useParams({
    from: "/dashboard/environments/$envId/deployments/",
  });
  const { selectedWorkspace } = useWorkspaceContext();
  const slug = selectedWorkspace?.slug ?? "";

  const { data: status, isLoading: capLoading } = useCapability(slug, envId, "runtime");
  const hasNomad = (status?.providers ?? []).some((p) => p.provider_name === "nomad");
  const hasK8s = (status?.providers ?? []).some((p) => p.provider_name === "kubernetes");
  const hasDocker = (status?.providers ?? []).some((p) => p.provider_name === "docker");
  const hasAny = hasNomad || hasK8s || hasDocker;

  type Tab = "nomad" | "k8s" | "docker";
  const [activeTab, setActiveTab] = useState<Tab>("nomad");

  useEffect(() => {
    if (capLoading) return;
    setActiveTab((prev) => {
      if (prev === "nomad" && hasNomad) return prev;
      if (prev === "k8s" && hasK8s) return prev;
      if (prev === "docker" && hasDocker) return prev;
      return hasNomad ? "nomad" : hasK8s ? "k8s" : "docker";
    });
  }, [hasNomad, hasK8s, hasDocker, capLoading]);

  const tabs: { key: Tab; label: string; enabled: boolean }[] = [
    { key: "nomad", label: "Nomad", enabled: hasNomad },
    { key: "k8s", label: "Kubernetes", enabled: hasK8s },
    { key: "docker", label: "Docker", enabled: hasDocker },
  ];

  return (
    <>
      <DashboardTopbar title="Deployments" subtitle="Release history for this environment." />

      {capLoading && (
        <main className="p-6 flex items-center justify-center py-32">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </main>
      )}

      {!capLoading && !hasAny && (
        <main className="p-6 flex flex-col items-center justify-center py-32 text-center gap-4">
          <div className="size-12 rounded-2xl bg-secondary grid place-items-center">
            <Server className="size-6 text-muted-foreground" />
          </div>
          <div>
            <p className="font-semibold">No runtime provider configured</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-xs">
              Bind a Nomad, Kubernetes, or Docker provider to the Runtime capability to view
              deployments.
            </p>
          </div>
          <Link
            to={`/dashboard/environments/${envId}/platform/runtime` as never}
            className="text-sm text-primary hover:underline"
          >
            Configure Runtime →
          </Link>
        </main>
      )}

      {!capLoading && hasAny && slug && (
        <main className="p-6 space-y-4">
          {tabs.filter((t) => t.enabled).length > 1 && (
            <div className="flex border-b border-border">
              {tabs.map(({ key, label, enabled }) =>
                enabled ? (
                  <button
                    key={key}
                    onClick={() => setActiveTab(key)}
                    className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition ${
                      activeTab === key
                        ? "border-primary text-foreground"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {label}
                  </button>
                ) : null,
              )}
            </div>
          )}

          {activeTab === "nomad" && hasNomad && (
            <JobsListView key={envId} slug={slug} envId={envId} />
          )}
          {activeTab === "k8s" && hasK8s && (
            <K8sDeploymentsListView key={envId} slug={slug} envId={envId} />
          )}
          {activeTab === "docker" && hasDocker && (
            <DockerContainersListView key={envId} slug={slug} envId={envId} />
          )}
        </main>
      )}
    </>
  );
}
