import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { createPortal } from "react-dom";
import { DashboardTopbar } from "@/components/DashboardTopbar";
import { useWorkspaceContext } from "@/lib/workspace-context";
import { useK8sPodDetail } from "@/lib/queries";
import { useState, useEffect, useRef } from "react";
import { Loader2, AlertTriangle, ArrowLeft, Terminal, X } from "lucide-react";
import type { K8sContainerDetail } from "@/lib/types";
import { getAccessToken } from "@/lib/auth";

export const Route = createFileRoute(
  "/dashboard/environments/$envId/pods/$namespace/$name"
)({
  head: () => ({ meta: [{ title: "Pod · TernakClouds" }] }),
  component: PodDetailPage,
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const PHASE_DOT: Record<string, string> = {
  Running: "bg-success",
  Pending: "bg-yellow-500",
  Succeeded: "bg-blue-500",
  Failed: "bg-destructive",
  Unknown: "bg-muted-foreground",
};
const PHASE_TEXT: Record<string, string> = {
  Running: "text-success",
  Pending: "text-yellow-500",
  Succeeded: "text-blue-500",
  Failed: "text-destructive",
  Unknown: "text-muted-foreground",
};

// ─── Log streaming hook ───────────────────────────────────────────────────────

const LOG_BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? "";
const MAX_LOG_LINES = 2000;

interface K8sLogStreamParams {
  slug: string;
  envSlug: string;
  namespace: string;
  podName: string;
  containerName: string;
  enabled: boolean;
}

function useK8sLogStream({
  slug,
  envSlug,
  namespace,
  podName,
  containerName,
  enabled,
}: K8sLogStreamParams) {
  const [lines, setLines] = useState<string[]>([]);
  const [connected, setConnected] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !podName || !containerName) return;
    const ctrl = new AbortController();
    setLines([]);
    setConnected(false);
    setStreamError(null);
    const token = getAccessToken();
    const url =
      `${LOG_BASE_URL}/api/v1/workspaces/${slug}/environments/${encodeURIComponent(envSlug)}/kubernetes/pods/${encodeURIComponent(namespace)}/${encodeURIComponent(podName)}/logs` +
      `?container=${encodeURIComponent(containerName)}&follow=true`;
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
                return next.length > MAX_LOG_LINES
                  ? next.slice(next.length - MAX_LOG_LINES)
                  : next;
              });
            }
          }
        }
        setConnected(false);
      } catch (err) {
        if ((err as Error).name !== "AbortError")
          setStreamError(String(err));
        setConnected(false);
      }
    })();
    return () => ctrl.abort();
  }, [slug, envSlug, namespace, podName, containerName, enabled]);

  return { lines, connected, streamError, clear: () => setLines([]) };
}

// ─── Logs drawer ─────────────────────────────────────────────────────────────

function LogsDrawer({
  slug,
  envSlug,
  namespace,
  podName,
  containerName,
  onClose,
}: {
  slug: string;
  envSlug: string;
  namespace: string;
  podName: string;
  containerName: string;
  onClose: () => void;
}) {
  const termRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);

  const { lines, connected, streamError, clear } = useK8sLogStream({
    slug,
    envSlug,
    namespace,
    podName,
    containerName,
    enabled: true,
  });

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

  return createPortal(
    <div className="fixed inset-0 z-50 flex">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="absolute right-0 top-0 h-full w-[700px] max-w-[95vw] flex flex-col glass border-l border-border shadow-2xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <Terminal className="size-4 text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <p className="font-semibold text-sm leading-none">Logs</p>
              <p className="text-xs font-mono text-muted-foreground truncate mt-0.5">
                {podName} / {containerName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-accent transition text-muted-foreground shrink-0"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex items-center gap-2 px-3 py-2 border-b border-border shrink-0">
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
                className="text-[11px] text-destructive truncate max-w-[200px]"
                title={streamError}
              >
                {streamError}
              </span>
            ) : (
              <>
                <span className="size-1.5 rounded-full bg-muted-foreground" />
                <span className="text-[11px] text-muted-foreground">
                  connecting…
                </span>
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
      </div>
    </div>,
    document.body
  );
}

// ─── Container state badge ────────────────────────────────────────────────────

function ContainerStateBadge({ container }: { container: K8sContainerDetail }) {
  const { state } = container;
  if (state.running) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded bg-success/10 text-success border border-success/20">
        <span className="size-1.5 rounded-full bg-success" />
        running
      </span>
    );
  }
  if (state.waiting) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded bg-yellow-500/10 text-yellow-500 border border-yellow-500/20">
        <span className="size-1.5 rounded-full bg-yellow-500" />
        waiting: {state.waiting.reason}
      </span>
    );
  }
  if (state.terminated) {
    const isOk = state.terminated.exitCode === 0;
    return (
      <span
        className={`inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded border ${
          isOk
            ? "bg-muted text-muted-foreground border-border"
            : "bg-destructive/10 text-destructive border-destructive/20"
        }`}
      >
        <span
          className={`size-1.5 rounded-full ${isOk ? "bg-muted-foreground" : "bg-destructive"}`}
        />
        terminated: exit {state.terminated.exitCode}
        {state.terminated.reason ? ` (${state.terminated.reason})` : ""}
      </span>
    );
  }
  return (
    <span className="text-[11px] text-muted-foreground px-1.5 py-0.5 rounded bg-secondary border border-border">
      unknown
    </span>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function PodDetailPage() {
  const { envId, namespace, name } = useParams({
    from: "/dashboard/environments/$envId/pods/$namespace/$name",
  });
  const { selectedWorkspace } = useWorkspaceContext();
  const slug = selectedWorkspace?.slug ?? "";

  const [logsContainer, setLogsContainer] = useState<string | null>(null);

  const {
    data: detail,
    isLoading,
    error,
  } = useK8sPodDetail(slug, envId, namespace, name);

  const dotCls = PHASE_DOT[detail?.phase ?? ""] ?? "bg-muted-foreground";
  const textCls = PHASE_TEXT[detail?.phase ?? ""] ?? "text-muted-foreground";

  return (
    <>
      <DashboardTopbar
        title={name}
        subtitle={`Pod · namespace: ${namespace}`}
      />

      <main className="p-6 space-y-8">
        {/* Back */}
        <Link
          to="/dashboard/environments/$envId/pods"
          params={{ envId }}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition"
        >
          <ArrowLeft className="size-3.5" /> Pods
        </Link>

        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
            <Loader2 className="size-4 animate-spin" /> Loading pod…
          </div>
        )}
        {error && !isLoading && (
          <div className="flex items-center gap-2 text-sm text-destructive py-4">
            <AlertTriangle className="size-4" /> Failed to load pod details
          </div>
        )}

        {!isLoading && detail && (
          <>
            {/* Overview */}
            <section className="space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Overview
              </p>
              <div className="rounded-lg border border-border bg-card p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                    Phase
                  </p>
                  <div className="flex items-center gap-1.5">
                    <span className={`size-2 rounded-full shrink-0 ${dotCls}`} />
                    <span className={`text-sm font-medium ${textCls}`}>
                      {detail.phase}
                    </span>
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                    Node
                  </p>
                  <span className="text-sm font-mono text-foreground">
                    {detail.nodeName || "—"}
                  </span>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                    Namespace
                  </p>
                  <span className="text-sm font-mono text-foreground">
                    {detail.namespace}
                  </span>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                    Created
                  </p>
                  <span className="text-sm text-foreground">
                    {formatDate(detail.createdAt)}
                  </span>
                </div>
                {Object.keys(detail.labels ?? {}).length > 0 && (
                  <div className="col-span-full">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                      Labels
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(detail.labels).map(([k, v]) => (
                        <span
                          key={k}
                          className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-secondary border border-border text-muted-foreground"
                        >
                          {k}=<span className="text-foreground">{v}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* Conditions */}
            {detail.conditions && detail.conditions.length > 0 && (
              <section className="space-y-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Conditions
                </p>
                <div className="flex flex-wrap gap-2">
                  {detail.conditions.map((c) => (
                    <span
                      key={c.type}
                      className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-1 rounded border ${
                        c.status === "True"
                          ? "bg-success/10 text-success border-success/20"
                          : "bg-muted text-muted-foreground border-border"
                      }`}
                    >
                      <span
                        className={`size-1.5 rounded-full ${c.status === "True" ? "bg-success" : "bg-muted-foreground"}`}
                      />
                      {c.type}
                    </span>
                  ))}
                </div>
              </section>
            )}

            {/* Containers */}
            <section className="space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Containers ({detail.containers.length})
              </p>
              <div className="space-y-3">
                {detail.containers.map((c: K8sContainerDetail) => (
                  <div
                    key={c.name}
                    className="rounded-lg border border-border bg-card p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm">{c.name}</span>
                          <ContainerStateBadge container={c} />
                          {c.ready && (
                            <span className="text-[10px] text-success font-medium px-1.5 py-0.5 rounded bg-success/10 border border-success/20">
                              Ready
                            </span>
                          )}
                          {c.restartCount > 0 && (
                            <span className="text-[10px] text-yellow-500 font-medium px-1.5 py-0.5 rounded bg-yellow-500/10 border border-yellow-500/20">
                              {c.restartCount} restart{c.restartCount !== 1 ? "s" : ""}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] font-mono text-muted-foreground mt-1 truncate">
                          {c.image}
                        </div>
                      </div>
                      <button
                        onClick={() => setLogsContainer(c.name)}
                        className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md border border-border text-muted-foreground hover:bg-accent transition shrink-0"
                      >
                        <Terminal className="size-3.5" /> Logs
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </main>

      {logsContainer && detail && (
        <LogsDrawer
          slug={slug}
          envSlug={envId}
          namespace={namespace}
          podName={name}
          containerName={logsContainer}
          onClose={() => setLogsContainer(null)}
        />
      )}
    </>
  );
}
