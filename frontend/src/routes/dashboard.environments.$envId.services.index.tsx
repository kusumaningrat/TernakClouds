import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { DashboardTopbar } from "@/components/DashboardTopbar";
import { useWorkspaceContext } from "@/lib/workspace-context";
import {
  useCapability,
  useNomadJobs,
  useNomadNamespaces,
  useK8sDeployments,
  useK8sServices,
  useK8sNamespaces,
} from "@/lib/queries";
import { useState } from "react";
import {
  Loader2,
  AlertTriangle,
  Server,
  Layers,
  FlaskConical,
  RefreshCw,
} from "lucide-react";
import type { NomadJobStub, K8sDeploymentStub, K8sServiceStub } from "@/lib/types";

export const Route = createFileRoute(
  "/dashboard/environments/$envId/services/"
)({
  head: () => ({ meta: [{ title: "Services · TernakClouds" }] }),
  component: EnvServicesPage,
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function allocTotals(job: NomadJobStub) {
  let running = 0,
    queued = 0,
    failed = 0;
  for (const tg of Object.values(job.JobSummary?.Summary ?? {})) {
    running += tg.Running;
    queued += tg.Queued;
    failed += tg.Failed;
  }
  return { running, queued, failed };
}

const STATUS_DOT: Record<string, string> = {
  running: "bg-success",
  pending: "bg-yellow-500",
  dead: "bg-muted-foreground",
};
const STATUS_TEXT: Record<string, string> = {
  running: "text-success",
  pending: "text-yellow-500",
  dead: "text-muted-foreground",
};

// ─── Nomad service card ───────────────────────────────────────────────────────

function ServiceCard({
  job,
  envId,
  namespace,
}: {
  job: NomadJobStub;
  envId: string;
  namespace: string;
}) {
  const { running, queued, failed } = allocTotals(job);
  const dotCls = STATUS_DOT[job.Status] ?? "bg-muted-foreground";
  const textCls = STATUS_TEXT[job.Status] ?? "text-muted-foreground";
  const taskGroupCount = Object.keys(job.JobSummary?.Summary ?? {}).length;

  return (
    <div className="rounded-xl border border-border bg-card p-5 flex flex-col gap-4 hover:shadow-sm transition">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="size-10 rounded-lg bg-secondary grid place-items-center shrink-0">
          <Layers className="size-5 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm truncate">{job.Name}</div>
          <div className="text-[11px] font-mono text-muted-foreground mt-0.5 truncate">
            {job.ID}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className={`size-2 rounded-full ${dotCls}`} />
          <span className={`text-xs capitalize font-medium ${textCls}`}>
            {job.Status}
          </span>
        </div>
      </div>

      {/* Allocation stats */}
      <div className="flex items-center gap-4 text-xs">
        <span className="flex items-center gap-1.5 text-success">
          <span className="size-1.5 rounded-full bg-success" />
          {running} running
        </span>
        {queued > 0 && (
          <span className="flex items-center gap-1.5 text-yellow-500">
            <span className="size-1.5 rounded-full bg-yellow-500" />
            {queued} queued
          </span>
        )}
        {failed > 0 && (
          <span className="flex items-center gap-1.5 text-destructive">
            <span className="size-1.5 rounded-full bg-destructive" />
            {failed} failed
          </span>
        )}
      </div>

      {/* Meta row */}
      <div className="flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap">
        <span>
          {taskGroupCount} task group{taskGroupCount !== 1 ? "s" : ""}
        </span>
        {(job.Datacenters?.length ?? 0) > 0 && (
          <span className="font-mono">{job.Datacenters.join(", ")}</span>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-1 border-t border-border">
        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-secondary border border-border text-muted-foreground">
          {job.Type}
        </span>
        <Link
          to="/dashboard/environments/$envId/deployments/$jobId"
          params={{ envId, jobId: job.ID }}
          search={{ namespace }}
          className="text-[11px] text-muted-foreground hover:text-primary transition"
        >
          View in Deployments →
        </Link>
      </div>
    </div>
  );
}

// ─── K8s deployment card ──────────────────────────────────────────────────────

function K8sDeploymentCard({
  dep,
  envId,
}: {
  dep: K8sDeploymentStub;
  envId: string;
}) {
  const isHealthy = dep.ready >= dep.desired && dep.desired > 0;
  const isScaledDown = dep.desired === 0;

  return (
    <div className="rounded-xl border border-border bg-card p-5 flex flex-col gap-4 hover:shadow-sm transition">
      <div className="flex items-start gap-3">
        <div className="size-10 rounded-lg bg-secondary grid place-items-center shrink-0">
          <Layers className="size-5 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm truncate font-mono">{dep.name}</div>
          <div className="text-[11px] font-mono text-muted-foreground mt-0.5 truncate">
            {dep.namespace}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span
            className={`size-2 rounded-full ${
              isScaledDown
                ? "bg-muted-foreground"
                : isHealthy
                  ? "bg-success"
                  : "bg-yellow-500"
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
      </div>

      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span>
          <span className="font-mono font-medium text-foreground">
            {dep.ready}
          </span>
          /{dep.desired} ready
        </span>
        <span>
          <span className="font-mono font-medium text-foreground">
            {dep.upToDate}
          </span>{" "}
          up-to-date
        </span>
        <span>
          <span className="font-mono font-medium text-foreground">
            {dep.available}
          </span>{" "}
          available
        </span>
      </div>

      <div className="flex items-center justify-between pt-1 border-t border-border">
        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-secondary border border-border text-muted-foreground">
          k8s/deploy
        </span>
        <Link
          to="/dashboard/environments/$envId/services/k8s/$namespace/$name"
          params={{ envId, namespace: dep.namespace, name: dep.name }}
          className="text-[11px] text-muted-foreground hover:text-primary transition"
        >
          View detail →
        </Link>
      </div>
    </div>
  );
}

// ─── K8s service catalog view ─────────────────────────────────────────────────

function K8sServiceCatalogView({
  slug,
  envId,
}: {
  slug: string;
  envId: string;
}) {
  const [namespace, setNamespace] = useState("default");
  const { data: namespaces = [] } = useK8sNamespaces(slug, envId);
  const {
    data: deployments = [],
    isLoading: deploymentsLoading,
    isFetching: deploymentsFetching,
    error: deploymentsError,
    refetch: refetchDeployments,
  } = useK8sDeployments(slug, envId, namespace);

  const {
    data: services = [],
    isLoading: servicesLoading,
    refetch: refetchServices,
  } = useK8sServices(slug, envId, namespace);

  const isLoading = deploymentsLoading || servicesLoading;
  const isFetching = deploymentsFetching;
  const error = deploymentsError;

  return (
    <main className="p-6 space-y-6">
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
              {deployments.length} deployment
              {deployments.length !== 1 ? "s" : ""}
              {services.length > 0
                ? ` · ${services.length} service${services.length !== 1 ? "s" : ""}`
                : ""}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-[10px] text-muted-foreground px-2 py-1 rounded-full border border-border bg-secondary">
            <FlaskConical className="size-3" /> Preview
          </span>
          <button
            onClick={() => {
              void refetchDeployments();
              void refetchServices();
            }}
            disabled={isFetching}
            className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md border border-border hover:bg-accent transition disabled:opacity-60"
          >
            <RefreshCw
              className={`size-3.5 ${isFetching ? "animate-spin" : ""}`}
            />
            {isFetching ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
          <Loader2 className="size-4 animate-spin" /> Loading…
        </div>
      )}
      {error && !isLoading && (
        <div className="flex items-center gap-2 text-sm text-destructive py-4">
          <AlertTriangle className="size-4" /> Failed to fetch from Kubernetes
        </div>
      )}

      {!isLoading && !error && deployments.length === 0 && services.length === 0 && (
        <div className="py-16 text-center text-sm text-muted-foreground">
          No Kubernetes workloads found in this environment.
        </div>
      )}

      {!isLoading && !error && deployments.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Deployments
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {deployments.map((dep) => (
              <K8sDeploymentCard
                key={`${dep.namespace}/${dep.name}`}
                dep={dep}
                envId={envId}
              />
            ))}
          </div>
        </div>
      )}

      {!isLoading && !error && services.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Services
          </p>
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/50">
                  {["Name", "Namespace", "Type", "ClusterIP", ""].map((h) => (
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
                {services.map((svc: K8sServiceStub) => (
                  <tr
                    key={`${svc.namespace}/${svc.name}`}
                    className="border-b border-border last:border-0 hover:bg-accent/20 transition"
                  >
                    <td className="px-3 py-2.5 font-medium text-sm font-mono">
                      {svc.name}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground font-mono">
                      {svc.namespace}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-secondary border border-border text-muted-foreground">
                        {svc.type}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-xs font-mono text-muted-foreground">
                      {svc.clusterIP}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <Link
                        to="/dashboard/environments/$envId/services/k8s/$namespace/$name"
                        params={{
                          envId,
                          namespace: svc.namespace,
                          name: svc.name,
                        }}
                        className="text-[11px] text-muted-foreground hover:text-primary transition"
                      >
                        View detail →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </main>
  );
}

// ─── Nomad service catalog view ───────────────────────────────────────────────

function NomadServiceCatalogView({
  slug,
  envId,
}: {
  slug: string;
  envId: string;
}) {
  const [namespace, setNamespace] = useState("default");
  const { data: namespaces = [] } = useNomadNamespaces(slug, envId);
  const {
    data: jobs = [],
    isLoading,
    isFetching,
    error,
    refetch,
  } = useNomadJobs(slug, envId, namespace);

  const serviceJobs = jobs.filter((j) => j.Type === "service");
  const otherJobs = jobs.filter((j) => j.Type !== "service");

  return (
    <main className="p-6 space-y-6">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
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
              {serviceJobs.length} service
              {serviceJobs.length !== 1 ? "s" : ""}
              {otherJobs.length > 0
                ? ` · ${otherJobs.length} platform job${otherJobs.length !== 1 ? "s" : ""}`
                : ""}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-[10px] text-muted-foreground px-2 py-1 rounded-full border border-border bg-secondary">
            <FlaskConical className="size-3" /> Preview
          </span>
          <button
            onClick={() => void refetch()}
            disabled={isFetching}
            className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md border border-border hover:bg-accent transition disabled:opacity-60"
          >
            <RefreshCw
              className={`size-3.5 ${isFetching ? "animate-spin" : ""}`}
            />
            {isFetching ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      {/* Preview notice */}
      <div className="rounded-lg border border-border bg-secondary/30 px-4 py-2.5 text-xs text-muted-foreground leading-relaxed">
        Services are currently sourced from Nomad jobs. A first-class service
        registry with independent lifecycle management is coming soon — this
        view reflects the live runtime state.
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
          <Loader2 className="size-4 animate-spin" /> Loading services…
        </div>
      )}
      {error && !isLoading && (
        <div className="flex items-center gap-2 text-sm text-destructive py-4">
          <AlertTriangle className="size-4" /> Failed to fetch services from
          Nomad
        </div>
      )}

      {!isLoading && !error && serviceJobs.length === 0 && otherJobs.length === 0 && (
        <div className="py-16 text-center text-sm text-muted-foreground">
          No jobs in namespace <span className="font-mono">{namespace}</span>.
        </div>
      )}

      {/* Application services */}
      {!isLoading && !error && serviceJobs.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Application Services
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {serviceJobs.map((job) => (
              <ServiceCard
                key={job.ID}
                job={job}
                envId={envId}
                namespace={namespace}
              />
            ))}
          </div>
        </div>
      )}

      {/* No service jobs but has others */}
      {!isLoading && !error && serviceJobs.length === 0 && otherJobs.length > 0 && (
        <div className="rounded-xl border border-dashed border-border bg-card/50 flex flex-col items-center justify-center py-12 text-center gap-3">
          <Layers className="size-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            No <span className="font-mono">service</span> type jobs found in
            this namespace.
          </p>
          <p className="text-xs text-muted-foreground/70">
            Batch and system jobs are listed below under Platform Jobs.
          </p>
        </div>
      )}

      {/* Platform (batch/system) jobs */}
      {!isLoading && !error && otherJobs.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Platform Jobs
          </p>
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/50">
                  {["Job", "Type", "Status"].map((h) => (
                    <th
                      key={h}
                      className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-background">
                {otherJobs.map((job) => {
                  const dotCls =
                    STATUS_DOT[job.Status] ?? "bg-muted-foreground";
                  const textCls =
                    STATUS_TEXT[job.Status] ?? "text-muted-foreground";
                  return (
                    <tr
                      key={job.ID}
                      className="border-b border-border last:border-0 hover:bg-accent/20 transition"
                    >
                      <td className="px-3 py-2.5">
                        <div className="font-medium text-sm">{job.Name}</div>
                        <div className="text-[11px] font-mono text-muted-foreground mt-0.5 truncate max-w-[240px]">
                          {job.ID}
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-secondary border border-border text-muted-foreground">
                          {job.Type}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <span className={`size-2 rounded-full ${dotCls}`} />
                          <span
                            className={`text-xs capitalize font-medium ${textCls}`}
                          >
                            {job.Status}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </main>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function EnvServicesPage() {
  const { envId } = useParams({
    from: "/dashboard/environments/$envId/services/",
  });
  const { selectedWorkspace } = useWorkspaceContext();
  const slug = selectedWorkspace?.slug ?? "";

  const { data: status, isLoading: capLoading } = useCapability(
    slug,
    envId,
    "runtime"
  );
  const hasNomad = (status?.providers ?? []).some(
    (p) => p.provider_name === "nomad"
  );
  const hasK8s = (status?.providers ?? []).some(
    (p) => p.provider_name === "kubernetes"
  );

  return (
    <>
      <DashboardTopbar
        title="Services"
        subtitle="Application services running in this environment."
      />

      {capLoading && (
        <main className="p-6 flex items-center justify-center py-32">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </main>
      )}

      {!capLoading && !hasNomad && !hasK8s && (
        <main className="p-6 flex flex-col items-center justify-center py-32 text-center gap-4">
          <div className="size-12 rounded-2xl bg-secondary grid place-items-center">
            <Server className="size-6 text-muted-foreground" />
          </div>
          <div>
            <p className="font-semibold">No runtime provider configured</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-xs">
              Bind a Nomad or Kubernetes provider to the Runtime capability to
              view services here.
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

      {!capLoading && hasK8s && slug && (
        <K8sServiceCatalogView slug={slug} envId={envId} />
      )}

      {!capLoading && !hasK8s && hasNomad && slug && (
        <NomadServiceCatalogView slug={slug} envId={envId} />
      )}
    </>
  );
}
