import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { createPortal } from "react-dom";
import { DashboardTopbar } from "@/components/DashboardTopbar";
import { useWorkspaceContext } from "@/lib/workspace-context";
import {
  useCapability,
  useDockerContainers,
  useDockerContainerAction,
  useRemoveDockerContainer,
} from "@/lib/queries";
import { useState, useEffect, useRef } from "react";
import {
  Loader2,
  AlertTriangle,
  RefreshCw,
  Box,
  Play,
  Square,
  RotateCw,
  Trash2,
  Terminal,
  X,
} from "lucide-react";
import type { DockerContainerStub } from "@/lib/types";
import { toast } from "sonner";
import { getAccessToken } from "@/lib/auth";

export const Route = createFileRoute("/dashboard/environments/$envId/containers")({
  head: () => ({ meta: [{ title: "Containers · TernakClouds" }] }),
  component: ContainersPage,
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

const LOG_BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? "";
const MAX_LOG_LINES = 2000;

const STATE_DOT: Record<string, string> = {
  running: "bg-success",
  paused: "bg-yellow-500",
  restarting: "bg-blue-500",
  exited: "bg-destructive",
};

const STATE_TEXT: Record<string, string> = {
  running: "text-success",
  paused: "text-yellow-500",
  restarting: "text-blue-500",
  exited: "text-destructive",
};

// ─── Log streaming hook ───────────────────────────────────────────────────────

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

// ─── Logs drawer ─────────────────────────────────────────────────────────────

function ContainerLogsDrawer({
  slug,
  envSlug,
  container,
  onClose,
}: {
  slug: string;
  envSlug: string;
  container: DockerContainerStub;
  onClose: () => void;
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
    if (termRef.current && atBottomRef.current) {
      termRef.current.scrollTop = termRef.current.scrollHeight;
    }
  }, [lines]);

  const handleScroll = () => {
    if (!termRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = termRef.current;
    atBottomRef.current = scrollHeight - scrollTop - clientHeight < 60;
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute right-0 top-0 h-full w-[700px] max-w-[95vw] flex flex-col glass border-l border-border shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <Terminal className="size-4 text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <p className="font-semibold text-sm leading-none">Container Logs</p>
              <p className="text-xs font-mono text-muted-foreground truncate mt-0.5">
                {container.name} <span className="text-muted-foreground/50">·</span> {container.id}
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

        {/* Toolbar */}
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
          <div className="ml-auto flex items-center gap-1.5">
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
                <span className="text-[11px] text-muted-foreground">connecting…</span>
              </>
            )}
          </div>
        </div>

        {/* Log output */}
        <div
          ref={termRef}
          onScroll={handleScroll}
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
    document.body,
  );
}

// ─── Container row ─────────────────────────────────────────────────────────────

function ContainerRow({
  container,
  slug,
  envId,
  onLogs,
}: {
  container: DockerContainerStub;
  slug: string;
  envId: string;
  onLogs: (container: DockerContainerStub) => void;
}) {
  const dotCls = STATE_DOT[container.state] ?? "bg-muted-foreground";
  const textCls = STATE_TEXT[container.state] ?? "text-muted-foreground";
  const action = useDockerContainerAction();
  const remove = useRemoveDockerContainer();

  const exposedPorts = container.ports.filter((p) => p.public_port);

  const handleAction = async (a: "start" | "stop" | "restart") => {
    try {
      await action.mutateAsync({ slug, envSlug: envId, id: container.id, action: a });
      toast.success(`Container ${a}ed`);
    } catch (e: unknown) {
      toast.error((e as { message?: string })?.message ?? `Failed to ${a} container`);
    }
  };

  const handleRemove = async () => {
    if (!confirm(`Remove container "${container.name}"? This cannot be undone.`)) return;
    try {
      await remove.mutateAsync({ slug, envSlug: envId, id: container.id });
      toast.success("Container removed");
    } catch (e: unknown) {
      toast.error((e as { message?: string })?.message ?? "Failed to remove container");
    }
  };

  const busy = action.isPending || remove.isPending;

  return (
    <tr className="border-b border-border hover:bg-accent/30 transition-colors">
      <td className="px-3 py-3">
        <div className="font-medium text-sm font-mono">{container.name}</div>
        <div className="text-[11px] font-mono text-muted-foreground mt-0.5">{container.id}</div>
      </td>
      <td className="px-3 py-3 text-xs text-muted-foreground font-mono truncate max-w-[200px]">
        {container.image}
      </td>
      <td className="px-3 py-3">
        <div className="flex items-center gap-1.5">
          <span className={`inline-block size-2 rounded-full shrink-0 ${dotCls}`} />
          <span className={`text-xs font-medium capitalize ${textCls}`}>{container.state}</span>
        </div>
        <div className="text-[11px] text-muted-foreground mt-0.5 truncate max-w-[160px]">
          {container.status}
        </div>
      </td>
      <td className="px-3 py-3">
        {exposedPorts.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {exposedPorts.map((p, i) => (
              <span
                key={i}
                className="text-[10px] px-1.5 py-0.5 rounded bg-secondary border border-border font-mono"
              >
                {p.public_port}:{p.private_port}
              </span>
            ))}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-3 py-3">
        <div className="flex items-center gap-1">
          {/* Logs */}
          <button
            onClick={() => onLogs(container)}
            title="View logs"
            className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition"
          >
            <Terminal className="size-3.5" />
          </button>

          {/* Start / Stop */}
          {container.state !== "running" ? (
            <button
              onClick={() => void handleAction("start")}
              disabled={busy}
              title="Start"
              className="p-1.5 rounded hover:bg-success/10 text-muted-foreground hover:text-success transition disabled:opacity-40"
            >
              <Play className="size-3.5" />
            </button>
          ) : (
            <button
              onClick={() => void handleAction("stop")}
              disabled={busy}
              title="Stop"
              className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition disabled:opacity-40"
            >
              <Square className="size-3.5" />
            </button>
          )}

          {/* Restart */}
          <button
            onClick={() => void handleAction("restart")}
            disabled={busy}
            title="Restart"
            className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition disabled:opacity-40"
          >
            <RotateCw className="size-3.5" />
          </button>

          {/* Remove */}
          <button
            onClick={() => void handleRemove()}
            disabled={busy || container.state === "running"}
            title={container.state === "running" ? "Stop the container before removing" : "Remove"}
            className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition disabled:opacity-40"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
}

// ─── Containers list ──────────────────────────────────────────────────────────

function DockerContainersListView({ slug, envId }: { slug: string; envId: string }) {
  const [logsTarget, setLogsTarget] = useState<DockerContainerStub | null>(null);

  const {
    data: containers = [],
    isLoading,
    isFetching,
    error,
    refetch,
    dataUpdatedAt,
  } = useDockerContainers(slug, envId);

  const running = containers.filter((c) => c.state === "running").length;

  return (
    <main className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {!isLoading && (
            <span className="text-xs text-muted-foreground">
              {containers.length} container{containers.length !== 1 ? "s" : ""} · {running} running
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
        </div>
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
          <AlertTriangle className="size-4" /> Failed to reach Docker daemon
        </div>
      )}
      {!isLoading && !error && containers.length === 0 && (
        <div className="py-16 text-center text-sm text-muted-foreground">
          No containers found on this Docker host.
        </div>
      )}

      {!isLoading && !error && containers.length > 0 && (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/50">
                {["Container", "Image", "State", "Ports", "Actions"].map((h) => (
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
              {containers.map((c) => (
                <ContainerRow
                  key={c.id}
                  container={c}
                  slug={slug}
                  envId={envId}
                  onLogs={setLogsTarget}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {logsTarget && (
        <ContainerLogsDrawer
          slug={slug}
          envSlug={envId}
          container={logsTarget}
          onClose={() => setLogsTarget(null)}
        />
      )}
    </main>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function ContainersPage() {
  const { envId } = useParams({ from: "/dashboard/environments/$envId/containers" });
  const { selectedWorkspace } = useWorkspaceContext();
  const slug = selectedWorkspace?.slug ?? "";

  const { data: status, isLoading: capLoading } = useCapability(slug, envId, "runtime");
  const hasDocker = (status?.providers ?? []).some((p) => p.provider_name === "docker");

  return (
    <>
      <DashboardTopbar title="Containers" subtitle="Docker containers running on this host." />

      {capLoading && (
        <main className="p-6 flex items-center justify-center py-32">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </main>
      )}

      {!capLoading && !hasDocker && (
        <main className="p-6 flex flex-col items-center justify-center py-32 text-center gap-4">
          <div className="size-12 rounded-2xl bg-secondary grid place-items-center">
            <Box className="size-6 text-muted-foreground" />
          </div>
          <div>
            <p className="font-semibold">No Docker provider configured</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-xs">
              Bind a Docker Engine provider to the Runtime capability to view containers here.
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

      {!capLoading && hasDocker && slug && <DockerContainersListView slug={slug} envId={envId} />}
    </>
  );
}
