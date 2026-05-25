import { createFileRoute, useParams } from "@tanstack/react-router";
import { CapabilityPage } from "@/components/CapabilityPage";
import { useWorkspaceContext } from "@/lib/workspace-context";
import { useCapability, useNomadNodes, useK8sNodes } from "@/lib/queries";
import { Loader2, AlertTriangle, RefreshCw, Server, Layers } from "lucide-react";
import type { NomadNodeStub, K8sNodeStub } from "@/lib/types";

export const Route = createFileRoute("/dashboard/environments/$envId/platform/runtime")({
  head: () => ({ meta: [{ title: "Runtime · TernakClouds" }] }),
  component: RuntimeCapabilityPage,
});

// ─── Nomad nodes ──────────────────────────────────────────────────────────────

function NomadNodeStatusDot({ status }: { status: string }) {
  const cls =
    status === "ready" ? "bg-success" : status === "down" ? "bg-destructive" : "bg-yellow-500";
  return <span className={`inline-block size-2 rounded-full ${cls} shrink-0`} />;
}

function NomadNodeCard({ node }: { node: NomadNodeStub }) {
  const healthyDrivers = Object.entries(node.Drivers ?? {})
    .filter(([, d]) => d.Detected && d.Healthy)
    .map(([name]) => name);
  const statusColor =
    node.Status === "ready"
      ? "text-success"
      : node.Status === "down"
        ? "text-destructive"
        : "text-yellow-500";
  return (
    <div className="rounded-lg border border-border bg-background/50 p-4 flex flex-col gap-3">
      <div className="flex items-start gap-2.5">
        <div className="size-8 rounded-md bg-secondary grid place-items-center shrink-0">
          <Server className="size-4 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm truncate">{node.Name}</div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <NomadNodeStatusDot status={node.Status} />
            <span className={`text-xs capitalize ${statusColor}`}>{node.Status}</span>
            {node.Drain && (
              <span className="text-[10px] px-1 py-px rounded bg-yellow-500/15 text-yellow-600 border border-yellow-500/30">
                draining
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="space-y-0.5 text-xs text-muted-foreground font-mono">
        <div className="truncate">{node.Address}</div>
        {node.Datacenter && (
          <div>
            {node.Datacenter}
            {node.NodeClass ? ` · ${node.NodeClass}` : ""}
          </div>
        )}
      </div>
      {healthyDrivers.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {healthyDrivers.map((d) => (
            <span
              key={d}
              className="text-[10px] px-1.5 py-0.5 rounded bg-secondary border border-border font-mono"
            >
              {d}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function NomadNodesView({ slug, envId }: { slug: string; envId: string }) {
  const { data: nodes = [], isLoading, error, refetch } = useNomadNodes(slug, envId);
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {isLoading ? "…" : `${nodes.length} node${nodes.length !== 1 ? "s" : ""} registered`}
        </p>
        <button
          onClick={() => void refetch()}
          className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md border border-border hover:bg-accent transition"
        >
          <RefreshCw className="size-3.5" /> Refresh
        </button>
      </div>
      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
          <Loader2 className="size-4 animate-spin" /> Loading nodes…
        </div>
      )}
      {error && !isLoading && (
        <div className="flex items-center gap-2 text-sm text-destructive py-2">
          <AlertTriangle className="size-4" /> Failed to reach Nomad cluster
        </div>
      )}
      {!isLoading && !error && nodes.length === 0 && (
        <p className="text-sm text-muted-foreground py-4">No nodes registered.</p>
      )}
      {nodes.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {nodes.map((node) => (
            <NomadNodeCard key={node.ID} node={node} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Kubernetes nodes ─────────────────────────────────────────────────────────

function K8sNodeStatusDot({ status }: { status: string }) {
  const cls = status === "Ready" ? "bg-success" : "bg-destructive";
  return <span className={`inline-block size-2 rounded-full ${cls} shrink-0`} />;
}

function K8sNodeCard({ node }: { node: K8sNodeStub }) {
  const statusColor = node.status === "Ready" ? "text-success" : "text-destructive";
  return (
    <div className="rounded-lg border border-border bg-background/50 p-4 flex flex-col gap-3">
      <div className="flex items-start gap-2.5">
        <div className="size-8 rounded-md bg-secondary grid place-items-center shrink-0">
          <Server className="size-4 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm truncate">{node.name}</div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <K8sNodeStatusDot status={node.status} />
            <span className={`text-xs ${statusColor}`}>{node.status}</span>
          </div>
        </div>
      </div>
      <div className="space-y-0.5 text-xs text-muted-foreground font-mono">
        {node.version && <div>{node.version}</div>}
      </div>
      {node.roles.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {node.roles.map((r) => (
            <span
              key={r}
              className="text-[10px] px-1.5 py-0.5 rounded bg-secondary border border-border font-mono"
            >
              {r}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function K8sNodesView({ slug, envId }: { slug: string; envId: string }) {
  const { data: nodes = [], isLoading, error, refetch } = useK8sNodes(slug, envId);
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {isLoading ? "…" : `${nodes.length} node${nodes.length !== 1 ? "s" : ""} registered`}
        </p>
        <button
          onClick={() => void refetch()}
          className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md border border-border hover:bg-accent transition"
        >
          <RefreshCw className="size-3.5" /> Refresh
        </button>
      </div>
      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
          <Loader2 className="size-4 animate-spin" /> Loading nodes…
        </div>
      )}
      {error && !isLoading && (
        <div className="flex items-center gap-2 text-sm text-destructive py-2">
          <AlertTriangle className="size-4" /> Failed to reach Kubernetes cluster
        </div>
      )}
      {!isLoading && !error && nodes.length === 0 && (
        <p className="text-sm text-muted-foreground py-4">No nodes registered.</p>
      )}
      {nodes.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {nodes.map((node) => (
            <K8sNodeCard key={node.name} node={node} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Provider dashboards ──────────────────────────────────────────────────────

function NomadRuntimeDashboard({ slug, envId }: { slug: string; envId: string }) {
  return (
    <section className="px-6 pb-8">
      <div className="border-t border-border pt-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="size-7 rounded-md bg-secondary grid place-items-center shrink-0">
            <Layers className="size-3.5 text-muted-foreground" />
          </div>
          <div>
            <h2 className="font-semibold text-sm">Nomad Cluster</h2>
            <p className="text-xs text-muted-foreground">Cluster nodes and health</p>
          </div>
        </div>
        <NomadNodesView slug={slug} envId={envId} />
      </div>
    </section>
  );
}

function K8sRuntimeDashboard({ slug, envId }: { slug: string; envId: string }) {
  return (
    <section className="px-6 pb-8">
      <div className="border-t border-border pt-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="size-7 rounded-md bg-secondary grid place-items-center shrink-0">
            <Layers className="size-3.5 text-muted-foreground" />
          </div>
          <div>
            <h2 className="font-semibold text-sm">Kubernetes Cluster</h2>
            <p className="text-xs text-muted-foreground">Cluster nodes and health</p>
          </div>
        </div>
        <K8sNodesView slug={slug} envId={envId} />
      </div>
    </section>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function RuntimeCapabilityPage() {
  const { envId } = useParams({ from: "/dashboard/environments/$envId/platform/runtime" });
  const { selectedWorkspace } = useWorkspaceContext();
  const slug = selectedWorkspace?.slug ?? "";

  const { data: status } = useCapability(slug, envId, "runtime");
  const providers = status?.providers ?? [];
  const hasNomad = providers.some((p) => p.provider_name === "nomad");
  const hasK8s = providers.some((p) => p.provider_name === "kubernetes");

  return (
    <CapabilityPage
      envId={envId}
      capName="runtime"
      title="Runtime"
      subtitle="Workload orchestration — Nomad, Kubernetes."
      endpointPlaceholders={{
        nomad: "https://nomad.internal:4646",
        kubernetes: "https://kubernetes.default.svc:6443",
      }}
      extraContent={
        slug && (hasNomad || hasK8s) ? (
          <>
            {hasNomad && <NomadRuntimeDashboard slug={slug} envId={envId} />}
            {hasK8s && <K8sRuntimeDashboard slug={slug} envId={envId} />}
          </>
        ) : null
      }
    />
  );
}
