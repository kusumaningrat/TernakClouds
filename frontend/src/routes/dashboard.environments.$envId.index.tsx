import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { DashboardTopbar } from "@/components/DashboardTopbar";
import { useWorkspaceContext } from "@/lib/workspace-context";
import {
  useCapabilities,
  useNomadNodes,
  useNomadNamespaces,
  useNomadJobs,
  useServiceDeployments,
  useEnvironmentRegistries,
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

const JOB_STATUS_COLORS: Record<string, string> = {
  running: "text-emerald-600 bg-emerald-500/10",
  pending: "text-amber-600 bg-amber-500/10",
  dead: "text-gray-500 bg-gray-400/10",
};

const CAP_ICONS: Record<string, React.ElementType> = {
  runtime: Server,
  secrets: KeyRound,
  networking: Network,
  storage: HardDrive,
  observability: Activity,
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

function NoProviderBanner({ capability, envId }: { capability: string; envId: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2.5 text-xs text-amber-700 dark:text-amber-400">
      <AlertTriangle className="size-3.5 shrink-0 mt-0.5" />
      <span>
        No {capability} provider configured.{" "}
        <Link
          to="/dashboard/environments/$envId/platform/runtime"
          params={{ envId }}
          className="underline underline-offset-2 hover:text-amber-900 dark:hover:text-amber-200 transition"
        >
          Bind one in Platform → Runtime
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

  // Only fire Nomad requests once we know a nomad provider is actually bound,
  // otherwise every page load generates console 503s for unconfigured environments.
  const hasNomadProvider = !capLoading && (capabilities ?? []).some(
    (c) => c.capability_name === "runtime" && c.providers.some((p) => p.provider_name === "nomad"),
  );

  const { data: nodes, isLoading: nodesLoading } = useNomadNodes(slug, envId, hasNomadProvider);
  const { data: namespaces } = useNomadNamespaces(slug, envId, hasNomadProvider);
  const defaultNs = namespaces?.[0]?.Name ?? "default";
  const { data: jobs, isLoading: jobsLoading } = useNomadJobs(slug, envId, defaultNs, hasNomadProvider);
  const nomadUnavailable = !capLoading && !hasNomadProvider;
  const { data: catalogDeployments, isLoading: catalogLoading } = useServiceDeployments(slug, envId);
  const { data: registries } = useEnvironmentRegistries(slug, envId);

  const healthyNodes = (nodes ?? []).filter((n) => n.Status === "ready").length;
  const runningJobs = (jobs ?? []).filter((j) => j.Status === "running").length;
  const enabledCaps = (capabilities ?? []).filter((c) => c.is_enabled).length;

  const recentJobs = [...(jobs ?? [])]
    .sort((a, b) => (b.SubmitTime ?? 0) - (a.SubmitTime ?? 0))
    .slice(0, 6);

  return (
    <>
      <DashboardTopbar
        title={envName}
        subtitle={`Environment overview · ${envId}`}
      />
      <main className="p-6 space-y-6 overflow-auto">

        {/* Stats */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard
            label="Nomad nodes"
            value={nomadUnavailable ? "—" : `${healthyNodes} / ${(nodes ?? []).length}`}
            icon={Server}
            loading={nodesLoading}
            colorClass={nomadUnavailable ? "text-muted-foreground" : healthyNodes === (nodes ?? []).length && (nodes ?? []).length > 0 ? "text-emerald-500" : "text-amber-500"}
          />
          <StatCard
            label="Running jobs"
            value={nomadUnavailable ? "—" : runningJobs}
            icon={Rocket}
            loading={jobsLoading}
            colorClass={nomadUnavailable ? "text-muted-foreground" : "text-primary"}
          />
          <StatCard
            label="Catalog deployments"
            value={(catalogDeployments ?? []).length}
            icon={Package}
            loading={catalogLoading}
            colorClass="text-primary"
          />
          <StatCard
            label="Capabilities enabled"
            value={`${enabledCaps} / ${(capabilities ?? []).length}`}
            icon={Layers}
            loading={capLoading}
            colorClass={enabledCaps === (capabilities ?? []).length && (capabilities ?? []).length > 0 ? "text-emerald-500" : "text-muted-foreground"}
          />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

          {/* Platform capabilities */}
          <div className="glass rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Activity className="size-4 text-primary" /> Platform capabilities
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

          {/* Recent Nomad jobs */}
          <div className="glass rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Rocket className="size-4 text-primary" /> Recent jobs
                <span className="text-[11px] font-mono text-muted-foreground font-normal">
                  ns: {defaultNs}
                </span>
              </h3>
              <Link
                to="/dashboard/environments/$envId/deployments"
                params={{ envId }}
                className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-0.5 transition"
              >
                All jobs <ChevronRight className="size-3" />
              </Link>
            </div>
            {jobsLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                <Loader2 className="size-4 animate-spin" /> Loading…
              </div>
            ) : nomadUnavailable ? (
              <NoProviderBanner capability="Nomad" envId={envId} />
            ) : recentJobs.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">No jobs in this namespace.</p>
            ) : (
              <div className="space-y-0">
                {recentJobs.map((job) => (
                  <div
                    key={job.ID}
                    className="flex items-center gap-3 py-2 border-b border-border last:border-0"
                  >
                    <span
                      className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0 ${JOB_STATUS_COLORS[job.Status] ?? "text-muted-foreground bg-muted"}`}
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
            )}
          </div>

        </div>

        {/* Quick links */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {(
            [
              { label: "Services", icon: Layers, to: "/dashboard/environments/$envId/services" },
              { label: "Deployments", icon: Rocket, to: "/dashboard/environments/$envId/deployments" },
              { label: "Service Catalog", icon: Package, to: "/dashboard/environments/$envId/service-catalog" },
              { label: `Registries (${(registries ?? []).length})`, icon: Container, to: "/dashboard/environments/$envId/registries" },
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

      </main>
    </>
  );
}
