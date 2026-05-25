import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { DashboardTopbar } from "@/components/DashboardTopbar";
import { useWorkspaceContext } from "@/lib/workspace-context";
import {
  useK8sDeploymentDetail,
  useK8sPods,
  useScaleK8sDeployment,
} from "@/lib/queries";
import { useState } from "react";
import { Loader2, AlertTriangle, ArrowLeft } from "lucide-react";
import type { K8sPodStub } from "@/lib/types";

export const Route = createFileRoute(
  "/dashboard/environments/$envId/deployments/k8s/$namespace/$name"
)({
  head: () => ({ meta: [{ title: "K8s Deployment · TernakClouds" }] }),
  component: K8sDeploymentDetailPage,
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

// ─── Pods section ─────────────────────────────────────────────────────────────

function PodsSection({
  pods,
  isLoading,
  selector,
  envId,
}: {
  pods: K8sPodStub[];
  isLoading: boolean;
  selector: Record<string, string>;
  envId: string;
}) {
  // Filter pods client-side to those matching the deployment selector labels
  const filtered = pods.filter((pod) =>
    Object.entries(selector).every(
      ([k, v]) => pod.name.includes(k) || pod.name.includes(v)
    )
  );

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
        <Loader2 className="size-4 animate-spin" /> Loading pods…
      </div>
    );
  }
  if (filtered.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4">
        No pods found for this deployment.
      </p>
    );
  }
  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-secondary/50">
            {["Pod", "Phase", "Node", "Ready", "Restarts", "Created"].map(
              (h) => (
                <th
                  key={h}
                  className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  {h}
                </th>
              )
            )}
          </tr>
        </thead>
        <tbody className="bg-background">
          {filtered.map((pod) => {
            const dotCls = PHASE_DOT[pod.phase] ?? "bg-muted-foreground";
            const textCls = PHASE_TEXT[pod.phase] ?? "text-muted-foreground";
            return (
              <tr
                key={`${pod.namespace}/${pod.name}`}
                className="border-b border-border last:border-0 hover:bg-accent/20 transition"
              >
                <td className="px-3 py-2.5">
                  <Link
                    to="/dashboard/environments/$envId/pods/$namespace/$name"
                    params={{ envId, namespace: pod.namespace, name: pod.name }}
                    className="font-medium text-sm hover:text-primary transition font-mono"
                  >
                    {pod.name}
                  </Link>
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`inline-block size-2 rounded-full shrink-0 ${dotCls}`}
                    />
                    <span className={`text-xs font-medium ${textCls}`}>
                      {pod.phase}
                    </span>
                  </div>
                </td>
                <td className="px-3 py-2.5 text-xs text-muted-foreground font-mono truncate max-w-[180px]">
                  {pod.nodeName || "—"}
                </td>
                <td className="px-3 py-2.5 text-xs text-muted-foreground">
                  {pod.ready}
                </td>
                <td className="px-3 py-2.5">
                  <span
                    className={`text-xs font-mono ${pod.restarts > 0 ? "text-yellow-500" : "text-muted-foreground"}`}
                  >
                    {pod.restarts}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                  {formatDate(pod.createdAt)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function K8sDeploymentDetailPage() {
  const { envId, namespace, name } = useParams({
    from: "/dashboard/environments/$envId/deployments/k8s/$namespace/$name",
  });
  const { selectedWorkspace } = useWorkspaceContext();
  const slug = selectedWorkspace?.slug ?? "";

  const {
    data: detail,
    isLoading,
    error,
  } = useK8sDeploymentDetail(slug, envId, namespace, name);

  const { data: pods = [], isLoading: podsLoading } = useK8sPods(
    slug,
    envId,
    namespace
  );

  const scaleDeployment = useScaleK8sDeployment();
  const [replicaInput, setReplicaInput] = useState<number | null>(null);

  const currentReplicas = replicaInput ?? detail?.desired ?? 0;

  const isHealthy =
    detail != null &&
    detail.ready >= detail.desired &&
    detail.desired > 0;
  const isScaledDown = detail?.desired === 0;

  const handleScale = async () => {
    if (replicaInput === null) return;
    await scaleDeployment.mutateAsync({
      slug,
      envSlug: envId,
      namespace,
      name,
      replicas: replicaInput,
    });
    setReplicaInput(null);
  };

  return (
    <>
      <DashboardTopbar
        title={name}
        subtitle={`K8s Deployment · namespace: ${namespace}`}
      />

      <main className="p-6 space-y-8">
        {/* Back */}
        <Link
          to="/dashboard/environments/$envId/deployments"
          params={{ envId }}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition"
        >
          <ArrowLeft className="size-3.5" /> Deployments
        </Link>

        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
            <Loader2 className="size-4 animate-spin" /> Loading deployment…
          </div>
        )}
        {error && !isLoading && (
          <div className="flex items-center gap-2 text-sm text-destructive py-4">
            <AlertTriangle className="size-4" /> Failed to load deployment
            details
          </div>
        )}

        {!isLoading && detail && (
          <>
            {/* Status badge */}
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded border ${
                  isScaledDown
                    ? "bg-secondary text-muted-foreground border-border"
                    : isHealthy
                      ? "bg-success/10 text-success border-success/20"
                      : "bg-yellow-500/10 text-yellow-500 border-yellow-500/20"
                }`}
              >
                <span
                  className={`size-1.5 rounded-full ${
                    isScaledDown
                      ? "bg-muted-foreground"
                      : isHealthy
                        ? "bg-success"
                        : "bg-yellow-500"
                  }`}
                />
                {isScaledDown
                  ? "Scaled down"
                  : isHealthy
                    ? "Healthy"
                    : "Degraded"}
              </span>
            </div>

            {/* Overview */}
            <section className="space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Overview
              </p>
              <div className="rounded-lg border border-border bg-card p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                    Desired
                  </p>
                  <span className="text-lg font-mono font-semibold text-foreground">
                    {detail.desired}
                  </span>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                    Ready
                  </p>
                  <span
                    className={`text-lg font-mono font-semibold ${detail.ready >= detail.desired && detail.desired > 0 ? "text-success" : "text-yellow-500"}`}
                  >
                    {detail.ready}
                  </span>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                    Up-to-date
                  </p>
                  <span className="text-lg font-mono font-semibold text-foreground">
                    {detail.upToDate}
                  </span>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                    Available
                  </p>
                  <span className="text-lg font-mono font-semibold text-success">
                    {detail.available}
                  </span>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                    Unavailable
                  </p>
                  <span
                    className={`text-lg font-mono font-semibold ${detail.unavailable > 0 ? "text-destructive" : "text-muted-foreground"}`}
                  >
                    {detail.unavailable}
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
              </div>
            </section>

            {/* Scale control */}
            <section className="space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Scale
              </p>
              <div className="rounded-lg border border-border bg-card p-4 flex items-center gap-4">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                    Replicas
                  </p>
                  <span className="text-sm font-mono text-foreground">
                    Currently: {detail.desired}
                  </span>
                </div>
                <div className="flex items-center gap-2 ml-auto">
                  <input
                    type="number"
                    min={0}
                    value={currentReplicas}
                    onChange={(e) =>
                      setReplicaInput(parseInt(e.target.value, 10))
                    }
                    className="w-20 text-sm font-mono px-2 py-1.5 rounded border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary/50"
                  />
                  <button
                    onClick={() => void handleScale()}
                    disabled={
                      scaleDeployment.isPending ||
                      replicaInput === null ||
                      replicaInput === detail.desired
                    }
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-border text-foreground hover:bg-accent transition disabled:opacity-50"
                  >
                    {scaleDeployment.isPending ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : null}
                    Scale
                  </button>
                  {replicaInput !== null && (
                    <button
                      onClick={() => setReplicaInput(null)}
                      className="text-xs text-muted-foreground hover:text-foreground transition"
                    >
                      Reset
                    </button>
                  )}
                </div>
                {scaleDeployment.isSuccess && (
                  <span className="text-xs text-success">Scaled!</span>
                )}
                {scaleDeployment.isError && (
                  <span className="text-xs text-destructive">
                    {(scaleDeployment.error as Error).message}
                  </span>
                )}
              </div>
            </section>

            {/* Labels */}
            {Object.keys(detail.labels ?? {}).length > 0 && (
              <section className="space-y-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Labels
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(detail.labels).map(([k, v]) => (
                    <span
                      key={k}
                      className="text-[11px] font-mono px-2 py-0.5 rounded bg-secondary border border-border text-muted-foreground"
                    >
                      {k}=<span className="text-foreground">{v}</span>
                    </span>
                  ))}
                </div>
              </section>
            )}

            {/* Selector */}
            {Object.keys(detail.selector ?? {}).length > 0 && (
              <section className="space-y-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Selector
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(detail.selector).map(([k, v]) => (
                    <span
                      key={k}
                      className="text-[11px] font-mono px-2 py-0.5 rounded bg-secondary border border-border text-muted-foreground"
                    >
                      {k}=<span className="text-foreground">{v}</span>
                    </span>
                  ))}
                </div>
              </section>
            )}

            {/* Containers */}
            {detail.containers && detail.containers.length > 0 && (
              <section className="space-y-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Containers
                </p>
                <div className="rounded-lg border border-border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-secondary/50">
                        {["Name", "Image", "Ports"].map((h) => (
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
                      {detail.containers.map((c) => (
                        <tr
                          key={c.name}
                          className="border-b border-border last:border-0"
                        >
                          <td className="px-3 py-2.5 font-medium text-sm">
                            {c.name}
                          </td>
                          <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground truncate max-w-[280px]">
                            {c.image}
                          </td>
                          <td className="px-3 py-2.5">
                            {c.ports && c.ports.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {c.ports.map((p, i) => (
                                  <span
                                    key={i}
                                    className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-secondary border border-border text-muted-foreground"
                                  >
                                    {p.containerPort}/{p.protocol}
                                    {p.name ? ` (${p.name})` : ""}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                —
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

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
                      title={c.message ?? c.reason}
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

            {/* Pods */}
            <section className="space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Pods
              </p>
              <PodsSection
                pods={pods}
                isLoading={podsLoading}
                selector={detail.selector ?? {}}
                envId={envId}
              />
            </section>
          </>
        )}
      </main>
    </>
  );
}
