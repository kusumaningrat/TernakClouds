import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { DashboardTopbar } from "@/components/DashboardTopbar";
import { useWorkspaceContext } from "@/lib/workspace-context";
import {
  useCapability,
  useNomadNamespaces,
  useNomadJobs,
  useK8sDeployments,
  useK8sNamespaces,
  useMe,
  useStopJob,
  useScaleK8sDeployment,
} from "@/lib/queries";
import { useState } from "react";
import {
  Loader2,
  AlertTriangle,
  RefreshCw,
  Server,
  Info,
  Terminal,
  Trash2,
  Square,
} from "lucide-react";
import { toast } from "sonner";
import { toastError, extractError } from "@/lib/toast-helpers";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { NomadJobStub, K8sDeploymentStub } from "@/lib/types";

export const Route = createFileRoute("/dashboard/environments/$envId/deployments/")({
  head: () => ({ meta: [{ title: "Workloads · TernakClouds" }] }),
  component: EnvDeploymentsPage,
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isAdminOrManager(roles: { role?: { name?: string } }[] | undefined): boolean {
  return (
    roles?.some((ur) => {
      const n = (ur.role?.name ?? "").toLowerCase();
      return n === "admin" || n === "manager";
    }) ?? false
  );
}

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
  isAdmin,
  onDelete,
}: {
  job: NomadJobStub;
  envId: string;
  namespace: string;
  isAdmin: boolean;
  onDelete: (job: NomadJobStub) => void;
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
      <td className="px-3 py-3">
        <div className="flex items-center gap-1">
          <Link
            to="/dashboard/environments/$envId/deployments/$jobId"
            params={{ envId, jobId: job.ID }}
            search={{ namespace }}
            title="View details"
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition"
          >
            <Info className="size-3.5" />
          </Link>
          <Link
            to="/dashboard/environments/$envId/deployments/$jobId"
            params={{ envId, jobId: job.ID }}
            search={{ namespace }}
            title="View logs"
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition"
          >
            <Terminal className="size-3.5" />
          </Link>
          {isAdmin && (
            <button
              onClick={() => onDelete(job)}
              title="Delete job (admin)"
              className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition"
            >
              <Trash2 className="size-3.5" />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

// ─── Nomad jobs list view ─────────────────────────────────────────────────────

function JobsListView({ slug, envId }: { slug: string; envId: string }) {
  const [namespace, setNamespace] = useState("default");
  const [deletingJob, setDeletingJob] = useState<NomadJobStub | null>(null);
  const [purge, setPurge] = useState(true);

  const { data: namespaces = [] } = useNomadNamespaces(slug, envId);
  const {
    data: jobs = [],
    isLoading,
    isFetching,
    error,
    refetch,
    dataUpdatedAt,
  } = useNomadJobs(slug, envId, namespace);
  const { data: me } = useMe();
  const isAdmin = isAdminOrManager(me?.roles);
  const stopJob = useStopJob();

  const handleDelete = async () => {
    if (!deletingJob) return;
    try {
      await stopJob.mutateAsync({
        slug,
        envSlug: envId,
        jobID: deletingJob.ID,
        namespace,
        purge,
      });
      toast.success(`Job "${deletingJob.Name}" ${purge ? "deleted" : "stopped"}`);
      setDeletingJob(null);
      setPurge(true);
    } catch (err: unknown) {
      toastError(extractError(err, "Failed to delete job"));
    }
  };

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
      {!isLoading && !error && jobs.length === 0 && (
        <div className="py-16 text-center text-sm text-muted-foreground">
          No jobs in namespace <span className="font-mono">{namespace}</span>.
        </div>
      )}

      {!isLoading && !error && jobs.length > 0 && (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/50">
                {["Job", "Type", "Status", "Datacenters", "Submitted", "Actions"].map((h) => (
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
              {jobs.map((job) => (
                <JobRow
                  key={job.ID}
                  job={job}
                  envId={envId}
                  namespace={namespace}
                  isAdmin={isAdmin}
                  onDelete={setDeletingJob}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AlertDialog
        open={!!deletingJob}
        onOpenChange={(open) => {
          if (!open) {
            setDeletingJob(null);
            setPurge(true);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete job?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{deletingJob?.Name}</strong> will be deregistered and all running allocations
              stopped.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <label className="flex items-start gap-2.5 cursor-pointer group px-1 pb-1">
            <input
              type="checkbox"
              checked={purge}
              onChange={(e) => setPurge(e.target.checked)}
              className="mt-0.5 accent-destructive cursor-pointer"
            />
            <div>
              <span className="text-sm font-medium">Purge job</span>
              <p className="text-xs text-muted-foreground mt-0.5">
                Permanently remove the job from Nomad state. Cannot be restarted later.
              </p>
            </div>
          </label>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={stopJob.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void handleDelete()}
              disabled={stopJob.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {stopJob.isPending ? (
                <Loader2 className="size-3.5 animate-spin mr-1.5" />
              ) : (
                <Trash2 className="size-3.5 mr-1.5" />
              )}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── K8s deployment row ───────────────────────────────────────────────────────

function K8sDeploymentRow({
  dep,
  envId,
  isAdmin,
  onStop,
}: {
  dep: K8sDeploymentStub;
  envId: string;
  isAdmin: boolean;
  onStop: (dep: K8sDeploymentStub) => void;
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
      <td className="px-3 py-3">
        <div className="flex items-center gap-1">
          <Link
            to="/dashboard/environments/$envId/deployments/k8s/$namespace/$name"
            params={{ envId, namespace: dep.namespace, name: dep.name }}
            title="View details"
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition"
          >
            <Info className="size-3.5" />
          </Link>
          <Link
            to="/dashboard/environments/$envId/deployments/k8s/$namespace/$name"
            params={{ envId, namespace: dep.namespace, name: dep.name }}
            title="View logs"
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition"
          >
            <Terminal className="size-3.5" />
          </Link>
          {isAdmin && !isScaledDown && (
            <button
              onClick={() => onStop(dep)}
              title="Scale down to 0 (admin)"
              className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition"
            >
              <Square className="size-3.5" />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

// ─── K8s deployments list view ────────────────────────────────────────────────

type K8sFilter = "all" | "active" | "scaled-down";

function K8sDeploymentsListView({ slug, envId }: { slug: string; envId: string }) {
  const [filter, setFilter] = useState<K8sFilter>("all");
  const [namespace, setNamespace] = useState("default");
  const [stoppingDep, setStoppingDep] = useState<K8sDeploymentStub | null>(null);

  const { data: namespaces = [] } = useK8sNamespaces(slug, envId);
  const {
    data: deployments = [],
    isLoading,
    isFetching,
    error,
    refetch,
    dataUpdatedAt,
  } = useK8sDeployments(slug, envId, namespace);
  const { data: me } = useMe();
  const isAdmin = isAdminOrManager(me?.roles);
  const scaleDeployment = useScaleK8sDeployment();

  const handleStop = async () => {
    if (!stoppingDep) return;
    try {
      await scaleDeployment.mutateAsync({
        slug,
        envSlug: envId,
        namespace: stoppingDep.namespace,
        name: stoppingDep.name,
        replicas: 0,
      });
      toast.success(`Workload "${stoppingDep.name}" scaled down to 0`);
      setStoppingDep(null);
    } catch (err: unknown) {
      toastError(extractError(err, "Failed to scale down workload"));
    }
  };

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
              {filtered.length} workload
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
          <RefreshCw className={`size-3.5 ${isFetching ? "animate-spin" : ""}`} />
          {isFetching ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
          <Loader2 className="size-4 animate-spin" /> Loading workloads…
        </div>
      )}
      {error && !isLoading && (
        <div className="flex items-center gap-2 text-sm text-destructive py-4">
          <AlertTriangle className="size-4" /> Failed to fetch workloads from Kubernetes
        </div>
      )}
      {!isLoading && !error && filtered.length === 0 && (
        <div className="py-16 text-center text-sm text-muted-foreground">
          {deployments.length === 0
            ? "No workloads found."
            : "No workloads match the current filter."}
        </div>
      )}

      {!isLoading && !error && filtered.length > 0 && (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/50">
                {[
                  "Workload",
                  "Status",
                  "Ready",
                  "Up-to-date",
                  "Available",
                  "Created",
                  "Actions",
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
                  isAdmin={isAdmin}
                  onStop={setStoppingDep}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AlertDialog
        open={!!stoppingDep}
        onOpenChange={(open) => {
          if (!open) setStoppingDep(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Scale down workload?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{stoppingDep?.name}</strong> will be scaled to 0 replicas. You can scale it
              back up from the workload detail page.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={scaleDeployment.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void handleStop()}
              disabled={scaleDeployment.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {scaleDeployment.isPending ? (
                <Loader2 className="size-3.5 animate-spin mr-1.5" />
              ) : (
                <Square className="size-3.5 mr-1.5" />
              )}
              Scale Down
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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

  type Tab = "nomad" | "k8s";
  const [activeTab, setActiveTab] = useState<Tab>("nomad");

  const tabs: { key: Tab; label: string; enabled: boolean }[] = [
    { key: "nomad", label: "Nomad", enabled: hasNomad },
    { key: "k8s", label: "Kubernetes", enabled: hasK8s },
  ];

  return (
    <>
      <DashboardTopbar title="Workloads" subtitle="Workloads running in this environment." />

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
              Bind a Nomad or Kubernetes provider to the Runtime capability to view workloads.
            </p>
          </div>
          <Link
            to={`/dashboard/environments/${envId}/platform/infrastructure` as never}
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
                ) : null,
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
