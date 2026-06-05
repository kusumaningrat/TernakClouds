import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useState } from "react";
import { DashboardTopbar } from "@/components/DashboardTopbar";
import { useWorkspaceContext } from "@/lib/workspace-context";
import {
  useCapabilities,
  useNomadNodes,
  useNomadNamespaces,
  useNomadJobs,
  useK8sNodes,
  useK8sDeployments,
  useDockerContainers,
  useServiceDeployments,
  useEnvironmentRegistries,
  useRepoProviders,
} from "@/lib/queries";
import {
  Activity,
  Rocket,
  Layers,
  Server,
  Package,
  Container,
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronRight,
  Database,
  Network,
  KeyRound,
  HardDrive,
  AlertTriangle,
  ScrollText,
  Box,
  GitFork,
  Zap,
} from "lucide-react";
import type { CapabilityStatusResponse } from "@/lib/types";

export const Route = createFileRoute("/dashboard/environments/$envId/")({
  head: () => ({ meta: [{ title: "Environment · TernakClouds" }] }),
  component: EnvOverviewPage,
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatSubmitTime(ns: number | undefined) {
  if (!ns) return "—";
  return new Date(ns / 1_000_000).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const DEPLOY_STATUS_COLORS: Record<string, string> = {
  running: "text-emerald-600 bg-emerald-500/10",
  pending: "text-amber-600 bg-amber-500/10",
  dead: "text-gray-500 bg-gray-400/10",
  stopped: "text-gray-500 bg-gray-400/10",
};

const CAP_ICONS: Record<string, React.ElementType> = {
  runtime: Server,
  secrets: KeyRound,
  networking: Network,
  storage: HardDrive,
  observability: Activity,
  logs: ScrollText,
};

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon: Icon,
  loading,
  colorClass = "text-primary",
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  loading?: boolean;
  colorClass?: string;
}) {
  return (
    <div className="glass rounded-xl p-4 flex items-center gap-3">
      <div className="size-9 rounded-lg bg-secondary grid place-items-center shrink-0">
        <Icon className={`size-4 ${colorClass}`} />
      </div>
      <div>
        <div className="text-xl font-bold font-mono">
          {loading ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : value}
        </div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}

// ─── No-provider banner ───────────────────────────────────────────────────────

function NoProviderBanner({ envId }: { envId: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2.5 text-xs text-amber-700 dark:text-amber-400">
      <AlertTriangle className="size-3.5 shrink-0 mt-0.5" />
      <span>
        No runtime provider configured.{" "}
        <Link
          to="/dashboard/environments/$envId/platform/runtime"
          params={{ envId }}
          className="underline underline-offset-2 hover:text-amber-900 dark:hover:text-amber-200 transition"
        >
          Bind one in Infrastructure → Runtime
        </Link>
      </span>
    </div>
  );
}

// ─── Capability card ──────────────────────────────────────────────────────────

function CapabilityCard({ cap }: { cap: CapabilityStatusResponse }) {
  const Icon = CAP_ICONS[cap.capability_name] ?? Database;
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-border last:border-0">
      <div className="size-7 rounded-md bg-secondary grid place-items-center shrink-0">
        <Icon className="size-3.5 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium">{cap.display_name}</div>
        {cap.providers.length > 0 ? (
          <div className="text-[11px] text-muted-foreground truncate">
            {cap.providers.map((p) => p.display_name || p.provider_name).join(", ")}
          </div>
        ) : (
          <div className="text-[11px] text-muted-foreground">No provider bound</div>
        )}
      </div>
      {cap.is_enabled ? (
        <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
      ) : (
        <XCircle className="size-4 text-muted-foreground shrink-0" />
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function EnvOverviewPage() {
  const { envId } = useParams({ from: "/dashboard/environments/$envId/" });
  const { selectedWorkspace } = useWorkspaceContext();
  const slug = selectedWorkspace?.slug ?? "";
  const envName = envId.charAt(0).toUpperCase() + envId.slice(1).replace(/-/g, " ");

  const { data: capabilities, isLoading: capLoading } = useCapabilities(slug, envId);

  const runtimeProviders =
    (capabilities ?? []).find((c) => c.capability_name === "runtime")?.providers ?? [];

  const hasNomadProvider = !capLoading && runtimeProviders.some((p) => p.provider_name === "nomad");
  const hasK8sProvider =
    !capLoading && runtimeProviders.some((p) => p.provider_name === "kubernetes");
  const hasDockerProvider =
    !capLoading && runtimeProviders.some((p) => p.provider_name === "docker");
  const noRuntimeProvider =
    !capLoading && !hasNomadProvider && !hasK8sProvider && !hasDockerProvider;

  // Runtime data
  const { data: nomadNodes, isLoading: nomadNodesLoading } = useNomadNodes(
    slug,
    envId,
    hasNomadProvider,
  );
  const { data: namespaces } = useNomadNamespaces(slug, envId, hasNomadProvider);
  const defaultNs = namespaces?.[0]?.Name ?? "default";
  const { data: jobs, isLoading: jobsLoading } = useNomadJobs(
    slug,
    envId,
    defaultNs,
    hasNomadProvider,
  );

  const { data: k8sNodes, isLoading: k8sNodesLoading } = useK8sNodes(slug, envId, hasK8sProvider);
  const { data: k8sDeployments, isLoading: k8sDeploymentsLoading } = useK8sDeployments(
    slug,
    envId,
    "default",
    hasK8sProvider,
  );
  const { data: dockerContainers, isLoading: dockerLoading } = useDockerContainers(
    slug,
    envId,
    hasDockerProvider,
  );

  const { data: catalogDeployments, isLoading: catalogLoading } = useServiceDeployments(
    slug,
    envId,
  );
  const { data: registries } = useEnvironmentRegistries(slug, envId);
  const { data: repoProviders } = useRepoProviders(slug);

  const nomadHealthyNodes = (nomadNodes ?? []).filter((n) => n.Status === "ready").length;
  const totalNomadNodes = (nomadNodes ?? []).length;
  const runningJobs = (jobs ?? []).filter((j) => j.Status === "running").length;
  const totalJobs = (jobs ?? []).length;

  const k8sReadyNodes = (k8sNodes ?? []).filter((n) => n.status === "Ready").length;
  const totalK8sNodes = (k8sNodes ?? []).length;
  const k8sReadyDeployments = (k8sDeployments ?? []).filter(
    (d) => d.ready >= d.desired && d.desired > 0,
  ).length;
  const totalK8sDeployments = (k8sDeployments ?? []).length;

  const runningContainers = (dockerContainers ?? []).filter((c) => c.state === "running").length;
  const totalContainers = (dockerContainers ?? []).length;

  const enabledCaps = (capabilities ?? []).filter((c) => c.is_enabled).length;

  const recentJobs = [...(jobs ?? [])]
    .sort((a, b) => (b.SubmitTime ?? 0) - (a.SubmitTime ?? 0))
    .slice(0, 6);

  const recentK8sDeployments = [...(k8sDeployments ?? [])]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 6);

  // Recent Docker containers (sorted by created desc)
  const recentContainers = [...(dockerContainers ?? [])]
    .sort((a, b) => (b.created ?? 0) - (a.created ?? 0))
    .slice(0, 6);

  // Resolve which runtime tab is shown in the "Recent deployments" section
  const multiRuntime =
    [hasNomadProvider, hasK8sProvider, hasDockerProvider].filter(Boolean).length > 1;
  const [workloadTab, setWorkloadTab] = useState<"primary" | "secondary" | "tertiary">("primary");

  const activeTab: "nomad" | "kubernetes" | "docker" = (() => {
    const providers = [
      hasNomadProvider && "nomad",
      hasK8sProvider && "kubernetes",
      hasDockerProvider && "docker",
    ].filter(Boolean) as ("nomad" | "kubernetes" | "docker")[];

    if (!multiRuntime) return providers[0] ?? "nomad";
    const idx = workloadTab === "primary" ? 0 : workloadTab === "secondary" ? 1 : 2;
    return providers[idx] ?? providers[0] ?? "nomad";
  })();

  const workloadLoading =
    activeTab === "nomad"
      ? jobsLoading
      : activeTab === "kubernetes"
        ? k8sDeploymentsLoading
        : dockerLoading;

  const noWorkloads =
    activeTab === "nomad"
      ? recentJobs.length === 0
      : activeTab === "kubernetes"
        ? recentK8sDeployments.length === 0
        : recentContainers.length === 0;

  return (
    <>
      <DashboardTopbar title={envName} subtitle={`Environment overview · ${envId}`} />
      <main className="p-6 space-y-6 overflow-auto">
        {/* Stats — service-centric labels */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {hasNomadProvider && (
            <>
              <StatCard
                label="Nodes"
                value={`${nomadHealthyNodes} / ${totalNomadNodes}`}
                icon={Server}
                loading={nomadNodesLoading}
                colorClass={
                  nomadHealthyNodes === totalNomadNodes && totalNomadNodes > 0
                    ? "text-emerald-500"
                    : "text-amber-500"
                }
              />
              <StatCard
                label="Active workloads"
                value={`${runningJobs} / ${totalJobs}`}
                icon={Rocket}
                loading={jobsLoading}
                colorClass="text-primary"
              />
            </>
          )}

          {hasK8sProvider && (
            <>
              <StatCard
                label="Cluster nodes"
                value={`${k8sReadyNodes} / ${totalK8sNodes}`}
                icon={Server}
                loading={k8sNodesLoading}
                colorClass={
                  k8sReadyNodes === totalK8sNodes && totalK8sNodes > 0
                    ? "text-emerald-500"
                    : "text-amber-500"
                }
              />
              <StatCard
                label="Healthy deployments"
                value={`${k8sReadyDeployments} / ${totalK8sDeployments}`}
                icon={Box}
                loading={k8sDeploymentsLoading}
                colorClass={
                  k8sReadyDeployments === totalK8sDeployments && totalK8sDeployments > 0
                    ? "text-emerald-500"
                    : "text-primary"
                }
              />
            </>
          )}

          {hasDockerProvider && (
            <>
              <StatCard
                label="Containers"
                value={`${runningContainers} / ${totalContainers}`}
                icon={Container}
                loading={dockerLoading}
                colorClass={
                  runningContainers === totalContainers && totalContainers > 0
                    ? "text-emerald-500"
                    : "text-primary"
                }
              />
            </>
          )}

          {noRuntimeProvider && (
            <>
              <StatCard label="Nodes" value="—" icon={Server} colorClass="text-muted-foreground" />
              <StatCard
                label="Active workloads"
                value="—"
                icon={Rocket}
                colorClass="text-muted-foreground"
              />
            </>
          )}

          <StatCard
            label="Catalog deployments"
            value={(catalogDeployments ?? []).length}
            icon={Package}
            loading={catalogLoading}
            colorClass="text-primary"
          />
          <StatCard
            label="Capabilities active"
            value={`${enabledCaps} / ${(capabilities ?? []).length}`}
            icon={Zap}
            loading={capLoading}
            colorClass={
              enabledCaps === (capabilities ?? []).length && (capabilities ?? []).length > 0
                ? "text-emerald-500"
                : "text-muted-foreground"
            }
          />
        </div>

        {/* Recent deployments — hero section */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div className="glass rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <Rocket className="size-4 text-primary" /> Recent deployments
                </h3>
              </div>
              <div className="flex items-center gap-2">
                {/* Runtime toggle — only when multiple providers are active */}
                {multiRuntime && (
                  <div className="flex rounded-md border border-border overflow-hidden text-[11px]">
                    {(
                      [
                        hasNomadProvider && { key: "primary" as const, label: "Nomad" },
                        hasK8sProvider && { key: "secondary" as const, label: "K8s" },
                        hasDockerProvider && { key: "tertiary" as const, label: "Docker" },
                      ].filter(Boolean) as {
                        key: "primary" | "secondary" | "tertiary";
                        label: string;
                      }[]
                    ).map(({ key, label }) => (
                      <button
                        key={key}
                        onClick={() => setWorkloadTab(key)}
                        className={`px-2 py-0.5 transition ${workloadTab === key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}
                <Link
                  to="/dashboard/environments/$envId/deployments"
                  params={{ envId }}
                  className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-0.5 transition"
                >
                  All deployments <ChevronRight className="size-3" />
                </Link>
              </div>
            </div>

            {workloadLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                <Loader2 className="size-4 animate-spin" /> Loading…
              </div>
            ) : noRuntimeProvider ? (
              <NoProviderBanner envId={envId} />
            ) : noWorkloads ? (
              <p className="text-xs text-muted-foreground py-2">No active deployments.</p>
            ) : activeTab === "nomad" ? (
              <div className="space-y-0">
                {recentJobs.map((job) => (
                  <div
                    key={job.ID}
                    className="flex items-center gap-3 py-2 border-b border-border last:border-0"
                  >
                    <span
                      className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0 ${DEPLOY_STATUS_COLORS[job.Status] ?? "text-muted-foreground bg-muted"}`}
                    >
                      {job.Status}
                    </span>
                    <span className="font-mono text-xs font-medium flex-1 truncate">{job.ID}</span>
                    <span className="text-[11px] text-muted-foreground shrink-0">
                      {formatSubmitTime(job.SubmitTime)}
                    </span>
                  </div>
                ))}
              </div>
            ) : activeTab === "kubernetes" ? (
              <div className="space-y-0">
                {recentK8sDeployments.map((dep) => (
                  <div
                    key={`${dep.namespace}/${dep.name}`}
                    className="flex items-center gap-3 py-2 border-b border-border last:border-0"
                  >
                    <span
                      className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0 ${
                        dep.ready >= dep.desired && dep.desired > 0
                          ? "text-emerald-600 bg-emerald-500/10"
                          : dep.ready === 0
                            ? "text-gray-500 bg-gray-400/10"
                            : "text-amber-600 bg-amber-500/10"
                      }`}
                    >
                      {dep.ready}/{dep.desired} ready
                    </span>
                    <span className="font-mono text-xs font-medium flex-1 truncate">
                      {dep.name}
                    </span>
                    <span className="text-[11px] text-muted-foreground shrink-0">
                      {dep.namespace}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              /* Docker containers */
              <div className="space-y-0">
                {recentContainers.map((c) => {
                  const isRunning = c.state === "running";
                  return (
                    <div
                      key={c.id}
                      className="flex items-center gap-3 py-2 border-b border-border last:border-0"
                    >
                      <span
                        className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0 ${
                          isRunning
                            ? "text-emerald-600 bg-emerald-500/10"
                            : "text-gray-500 bg-gray-400/10"
                        }`}
                      >
                        {c.state}
                      </span>
                      <span className="font-mono text-xs font-medium flex-1 truncate">
                        {c.name.replace(/^\//, "")}
                      </span>
                      <span className="text-[11px] text-muted-foreground shrink-0 truncate max-w-[120px]">
                        {c.image.split(":")[0].split("/").pop()}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Registered repositories */}
          <div className="glass rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <GitFork className="size-4 text-primary" /> Registered repositories
              </h3>
              <Link
                to="/dashboard/repositories"
                className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-0.5 transition"
              >
                Manage <ChevronRight className="size-3" />
              </Link>
            </div>
            {(repoProviders ?? []).length === 0 ? (
              <p className="text-xs text-muted-foreground py-1">
                No repository providers registered in this workspace.{" "}
                <Link
                  to="/dashboard/repositories"
                  className="underline underline-offset-2 hover:text-foreground transition"
                >
                  Add one
                </Link>
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {(repoProviders ?? []).map((rp) => (
                  <div
                    key={rp.id}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary border border-border"
                  >
                    <GitFork className="size-3.5 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <div className="text-xs font-medium truncate">{rp.name}</div>
                      <div className="text-[10px] text-muted-foreground font-mono">
                        {rp.provider_type === "github" ? "GitHub" : "GitLab"}
                        {rp.allowed_repos && rp.allowed_repos.length > 0 && (
                          <span className="ml-1 text-muted-foreground/60">
                            · {rp.allowed_repos.length} repo
                            {rp.allowed_repos.length !== 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Quick links */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {(
            [
              {
                label: "Service Catalog",
                icon: Package,
                to: "/dashboard/environments/$envId/service-catalog",
              },
              {
                label: "Deployments",
                icon: Rocket,
                to: "/dashboard/environments/$envId/deployments",
              },
              {
                label: "Logs",
                icon: ScrollText,
                to: "/dashboard/environments/$envId/logs",
              },
              {
                label: `Registries (${(registries ?? []).length})`,
                icon: Container,
                to: "/dashboard/environments/$envId/registries",
              },
            ] as const
          ).map(({ label, icon: Icon, to }) => (
            <Link
              key={label}
              to={to}
              params={{ envId }}
              className="glass rounded-xl p-4 flex items-center gap-3 hover:bg-accent/50 transition group"
            >
              <div className="size-8 rounded-lg bg-secondary grid place-items-center shrink-0">
                <Icon className="size-4 text-muted-foreground group-hover:text-primary transition" />
              </div>
              <span className="text-sm font-medium">{label}</span>
              <ChevronRight className="size-4 text-muted-foreground ml-auto shrink-0" />
            </Link>
          ))}
        </div>

        {/* Platform capabilities — moved to bottom as infrastructure detail */}
        <div className="glass rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <Activity className="size-4 text-primary" /> Infrastructure capabilities
            </h3>
            <Link
              to="/dashboard/environments/$envId/platform/runtime"
              params={{ envId }}
              className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-0.5 transition"
            >
              Manage <ChevronRight className="size-3" />
            </Link>
          </div>
          {capLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
              <Loader2 className="size-4 animate-spin" /> Loading…
            </div>
          ) : (capabilities ?? []).length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">No capabilities configured.</p>
          ) : (
            <div>
              {(capabilities ?? []).map((cap) => (
                <CapabilityCard key={cap.capability_name} cap={cap} />
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
