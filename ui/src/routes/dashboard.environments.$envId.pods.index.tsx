import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { DashboardTopbar } from "@/components/DashboardTopbar";
import { useWorkspaceContext } from "@/lib/workspace-context";
import { useCapability, useK8sNamespaces, useK8sPods } from "@/lib/queries";
import { useState } from "react";
import { Loader2, AlertTriangle, RefreshCw, Server } from "lucide-react";
import type { K8sPodStub } from "@/lib/types";

export const Route = createFileRoute("/dashboard/environments/$envId/pods/")({
  head: () => ({ meta: [{ title: "Pods · TernakClouds" }] }),
  component: PodsIndexPage,
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

// ─── Pod row ──────────────────────────────────────────────────────────────────

function PodRow({ pod, envId }: { pod: K8sPodStub; envId: string }) {
  const dotCls = PHASE_DOT[pod.phase] ?? "bg-muted-foreground";
  const textCls = PHASE_TEXT[pod.phase] ?? "text-muted-foreground";

  return (
    <tr className="border-b border-border hover:bg-accent/30 transition-colors">
      <td className="px-3 py-3">
        <Link
          to="/dashboard/environments/$envId/pods/$namespace/$name"
          params={{ envId, namespace: pod.namespace, name: pod.name }}
          className="font-medium text-sm hover:text-primary transition font-mono"
        >
          {pod.name}
        </Link>
        <div className="text-[11px] font-mono text-muted-foreground mt-0.5 truncate max-w-[220px]">
          {pod.namespace}
        </div>
      </td>
      <td className="px-3 py-3">
        <div className="flex items-center gap-1.5">
          <span className={`inline-block size-2 rounded-full shrink-0 ${dotCls}`} />
          <span className={`text-xs font-medium ${textCls}`}>{pod.phase}</span>
        </div>
      </td>
      <td className="px-3 py-3 text-xs text-muted-foreground font-mono truncate max-w-[180px]">
        {pod.nodeName || "—"}
      </td>
      <td className="px-3 py-3 text-xs text-muted-foreground">{pod.ready}</td>
      <td className="px-3 py-3">
        <span
          className={`text-xs font-mono ${pod.restarts > 0 ? "text-yellow-500" : "text-muted-foreground"}`}
        >
          {pod.restarts}
        </span>
      </td>
      <td className="px-3 py-3 text-xs text-muted-foreground whitespace-nowrap">
        {formatDate(pod.createdAt)}
      </td>
    </tr>
  );
}

// ─── Pods list view ───────────────────────────────────────────────────────────

function K8sPodsListView({ slug, envId }: { slug: string; envId: string }) {
  const [namespace, setNamespace] = useState("default");
  const { data: namespaces = [] } = useK8sNamespaces(slug, envId);
  const {
    data: pods = [],
    isLoading,
    isFetching,
    error,
    refetch,
    dataUpdatedAt,
  } = useK8sPods(slug, envId, namespace);

  return (
    <main className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
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
          {!isLoading && (
            <span className="text-xs text-muted-foreground">
              {pods.length} pod{pods.length !== 1 ? "s" : ""}
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
          <Loader2 className="size-4 animate-spin" /> Loading pods…
        </div>
      )}
      {error && !isLoading && (
        <div className="flex items-center gap-2 text-sm text-destructive py-4">
          <AlertTriangle className="size-4" /> Failed to fetch pods from Kubernetes
        </div>
      )}
      {!isLoading && !error && pods.length === 0 && (
        <div className="py-16 text-center text-sm text-muted-foreground">
          No pods found in this environment.
        </div>
      )}

      {!isLoading && !error && pods.length > 0 && (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/50">
                {["Pod", "Phase", "Node", "Ready", "Restarts", "Created"].map((h) => (
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
              {pods.map((pod) => (
                <PodRow key={`${pod.namespace}/${pod.name}`} pod={pod} envId={envId} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function PodsIndexPage() {
  const { envId } = useParams({ from: "/dashboard/environments/$envId/pods/" });
  const { selectedWorkspace } = useWorkspaceContext();
  const slug = selectedWorkspace?.slug ?? "";

  const { data: status, isLoading: capLoading } = useCapability(slug, envId, "runtime");
  const hasK8s = (status?.providers ?? []).some((p) => p.provider_name === "kubernetes");

  return (
    <>
      <DashboardTopbar title="Pods" subtitle="Kubernetes pods running in this environment." />

      {capLoading && (
        <main className="p-6 flex items-center justify-center py-32">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </main>
      )}

      {!capLoading && !hasK8s && (
        <main className="p-6 flex flex-col items-center justify-center py-32 text-center gap-4">
          <div className="size-12 rounded-2xl bg-secondary grid place-items-center">
            <Server className="size-6 text-muted-foreground" />
          </div>
          <div>
            <p className="font-semibold">No Kubernetes provider configured</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-xs">
              Bind a Kubernetes provider to the Runtime capability to view pods here.
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

      {!capLoading && hasK8s && slug && <K8sPodsListView slug={slug} envId={envId} />}
    </>
  );
}
