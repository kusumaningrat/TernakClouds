import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { DashboardTopbar } from "@/components/DashboardTopbar";
import { useWorkspaceContext } from "@/lib/workspace-context";
import {
  useCapability,
  useNomadNamespaces,
  useNomadJobs,
  useK8sDeployments,
  useK8sNamespaces,
} from "@/lib/queries";
import { useState } from "react";
import {
  Loader2,
  AlertTriangle,
  RefreshCw,
  Server,
} from "lucide-react";
import type { NomadJobStub, K8sDeploymentStub } from "@/lib/types";

export const Route = createFileRoute(
  "/dashboard/environments/$envId/deployments/"
)({
  head: () => ({ meta: [{ title: "Deployments · TernakClouds" }] }),
  component: EnvDeploymentsPage,
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

// ─── Nomad job row ────────────────────────────────────────────────────────────

function JobRow({
  job,
  envId,
  namespace,
}: {
  job: NomadJobStub;
  envId: string;
  namespace: string;
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
          <span
            className={`inline-block size-2 rounded-full shrink-0 ${dotCls}`}
          />
          <span className={`text-xs capitalize font-medium ${textCls}`}>
            {job.Status}
          </span>
        </div>
      </td>
      <td className="px-3 py-3 text-xs text-muted-foreground font-mono">
        {(job.Datacenters ?? []).join(", ") || "—"}
      </td>
      <td className="px-3 py-3 text-xs text-muted-foreground whitespace-nowrap">
        {formatTime(job.SubmitTime)}
      </td>
    </tr>
  );
}

// ─── Nomad jobs list view ─────────────────────────────────────────────────────

function JobsListView({ slug, envId }: { slug: string; envId: string }) {
  const [namespace, setNamespace] = useState("default");
  const { data: namespaces = [] } = useNomadNamespaces(slug, envId);
  const {
    data: jobs = [],
    isLoading,
    isFetching,
    error,
    refetch,
    dataUpdatedAt,
  } = useNomadJobs(slug, envId, namespace);

  return (
    <div className="space-y-4">
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
              {jobs.length} job{jobs.length !== 1 ? "s" : ""}
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
          <RefreshCw
            className={`size-3.5 ${isFetching ? "animate-spin" : ""}`}
          />
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
      {!isLoading && !error && jobs.length === 0 && (
        <div className="py-16 text-center text-sm text-muted-foreground">
          No jobs in namespace{" "}
          <span className="font-mono">{namespace}</span>.
        </div>
      )}

      {!isLoading && !error && jobs.length > 0 && (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/50">
                {["Job", "Type", "Status", "Datacenters", "Submitted"].map(
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
              {jobs.map((job) => (
                <JobRow
                  key={job.ID}
                  job={job}
                  envId={envId}
                  namespace={namespace}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── K8s deployment row ───────────────────────────────────────────────────────

function K8sDeploymentRow({
  dep,
  envId,
}: {
  dep: K8sDeploymentStub;
  envId: string;
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
        <div className="text-[11px] font-mono text-muted-foreground mt-0.5">
          {dep.namespace}
        </div>
      </td>
      <td className="px-3 py-3">
        <div className="flex items-center gap-1.5">
          <span
            className={`inline-block size-2 rounded-full shrink-0 ${
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
      </td>
      <td className="px-3 py-3 text-xs font-mono text-muted-foreground">
        {dep.ready}/{dep.desired}
      </td>
      <td className="px-3 py-3 text-xs font-mono text-muted-foreground">
        {dep.upToDate}
      </td>
      <td className="px-3 py-3 text-xs font-mono text-muted-foreground">
        {dep.available}
      </td>
      <td className="px-3 py-3 text-xs text-muted-foreground whitespace-nowrap">
        {formatDate(dep.createdAt)}
      </td>
    </tr>
  );
}

// ─── K8s deployments list view ────────────────────────────────────────────────

type K8sFilter = "all" | "active" | "scaled-down";

function K8sDeploymentsListView({
  slug,
  envId,
}: {
  slug: string;
  envId: string;
}) {
  const [filter, setFilter] = useState<K8sFilter>("all");
  const [namespace, setNamespace] = useState("default");
  const { data: namespaces = [] } = useK8sNamespaces(slug, envId);
  const {
    data: deployments = [],
    isLoading,
    isFetching,
    error,
    refetch,
    dataUpdatedAt,
  } = useK8sDeployments(slug, envId, namespace);

  const filtered = deployments.filter((d) => {
    if (filter === "active") return d.desired > 0;
    if (filter === "scaled-down") return d.desired === 0;
    return true;
  });

  const filterBtns: { key: K8sFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "active", label: "Active" },
    { key: "scaled-down", label: "Scaled down" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Namespace selector */}
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
          {/* Filter toggle */}
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
              {filtered.length} deployment
              {filtered.length !== 1 ? "s" : ""}
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
          <RefreshCw
            className={`size-3.5 ${isFetching ? "animate-spin" : ""}`}
          />
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
          <AlertTriangle className="size-4" /> Failed to fetch deployments from
          Kubernetes
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
                {[
                  "Deployment",
                  "Status",
                  "Ready",
                  "Up-to-date",
                  "Available",
                  "Created",
                ].map((h) => (
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
              {filtered.map((dep) => (
                <K8sDeploymentRow
                  key={`${dep.namespace}/${dep.name}`}
                  dep={dep}
                  envId={envId}
                />
              ))}
            </tbody>
          </table>
        </div>
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

  type Tab = "nomad" | "k8s";
  const [activeTab, setActiveTab] = useState<Tab>("nomad");

  const tabs: { key: Tab; label: string; enabled: boolean }[] = [
    { key: "nomad", label: "Nomad", enabled: hasNomad },
    { key: "k8s", label: "Kubernetes", enabled: hasK8s },
  ];

  return (
    <>
      <DashboardTopbar
        title="Deployments"
        subtitle="Release history for this environment."
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
              view deployment history.
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

      {!capLoading && (hasNomad || hasK8s) && slug && (
        <main className="p-6 space-y-4">
          {/* Tabs — only show when both providers are present */}
          {hasNomad && hasK8s && (
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
                ) : null
              )}
            </div>
          )}

          {(activeTab === "nomad" || !hasK8s) && hasNomad && (
            <JobsListView slug={slug} envId={envId} />
          )}
          {(activeTab === "k8s" || !hasNomad) && hasK8s && (
            <K8sDeploymentsListView slug={slug} envId={envId} />
          )}
        </main>
      )}
    </>
  );
}
