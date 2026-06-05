import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { DashboardTopbar } from "@/components/DashboardTopbar";
import { useWorkspaceContext } from "@/lib/workspace-context";
import { useEnvironmentContext } from "@/lib/environment-context";
import { useCatalog, useEnvironments, useAllServiceDeployments } from "@/lib/queries";
import type { ServiceDeployment } from "@/lib/types";
import {
  Layers,
  Rocket,
  ScrollText,
  KeyRound,
  Settings2,
  Loader2,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Circle,
  Package,
  ExternalLink,
  GitFork,
  Users,
  BookOpen,
  Link2,
  ArrowRight,
  ArrowLeft,
  Database,
  Radio,
} from "lucide-react";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/dashboard/services/$serviceName")({
  head: ({ params }) => ({
    meta: [{ title: `${params.serviceName} · TernakClouds` }],
  }),
  component: ServiceDetailPage,
});

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab =
  | "overview"
  | "deployments"
  | "logs"
  | "secrets"
  | "dependencies"
  | "ownership"
  | "settings";
type ServiceStatus = "healthy" | "degraded" | "stopped" | "undeployed";

function deploymentStatus(d: ServiceDeployment | undefined): ServiceStatus {
  if (!d) return "undeployed";
  const s = d.status?.toLowerCase() ?? "";
  if (s === "running") return "healthy";
  if (s === "dead" || s === "stopped" || s === "failed") return "stopped";
  return "degraded";
}

function StatusBadge({ status }: { status: ServiceStatus }) {
  const map: Record<ServiceStatus, { icon: React.ElementType; label: string; cls: string }> = {
    healthy: { icon: CheckCircle2, label: "Healthy", cls: "text-emerald-600 bg-emerald-500/10" },
    degraded: { icon: AlertTriangle, label: "Degraded", cls: "text-amber-600 bg-amber-500/10" },
    stopped: { icon: XCircle, label: "Stopped", cls: "text-gray-500 bg-gray-400/10" },
    undeployed: { icon: Circle, label: "Not deployed", cls: "text-muted-foreground bg-secondary" },
  };
  const { icon: Icon, label, cls } = map[status];
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${cls}`}
    >
      <Icon className="size-3" />
      {label}
    </span>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function ServiceDetailPage() {
  const { serviceName } = useParams({ from: "/dashboard/services/$serviceName" });
  const { selectedWorkspace } = useWorkspaceContext();
  const { selectedEnvironment } = useEnvironmentContext();
  const slug = selectedWorkspace?.slug ?? "";

  const [tab, setTab] = useState<Tab>("overview");

  const { data: catalog, isLoading: catalogLoading } = useCatalog();
  const { data: environments } = useEnvironments(slug);

  const envSlugs = useMemo(() => (environments ?? []).map((e) => e.slug), [environments]);
  const deploymentQueries = useAllServiceDeployments(slug, envSlugs);

  // Build env → deployment map for this service
  const envDeployments = useMemo(() => {
    const visibleEnvs = selectedEnvironment ? [selectedEnvironment] : (environments ?? []);

    return visibleEnvs.map((env, i) => {
      const globalIdx = (environments ?? []).findIndex((e) => e.id === env.id);
      const deps = deploymentQueries[globalIdx]?.data ?? [];
      const deployment = deps.find((d) => d.catalog_name === serviceName);
      return { env, deployment };
    });
  }, [environments, selectedEnvironment, deploymentQueries, serviceName]);

  const catalogItem = (catalog ?? []).find((c) => c.name === serviceName);
  const allStatuses = envDeployments.map((e) => deploymentStatus(e.deployment));
  const hasAnyDeployment = envDeployments.some((e) => e.deployment);

  const overallStatus: ServiceStatus = allStatuses.some((s) => s === "degraded")
    ? "degraded"
    : allStatuses.some((s) => s === "stopped")
      ? "stopped"
      : allStatuses.every((s) => s === "healthy") && hasAnyDeployment
        ? "healthy"
        : hasAnyDeployment
          ? "degraded"
          : "undeployed";

  const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "overview", label: "Overview", icon: Layers },
    { id: "deployments", label: "Deployments", icon: Rocket },
    { id: "logs", label: "Logs", icon: ScrollText },
    { id: "secrets", label: "Secrets", icon: KeyRound },
    { id: "dependencies", label: "Dependencies", icon: Link2 },
    { id: "ownership", label: "Ownership", icon: Users },
    { id: "settings", label: "Settings", icon: Settings2 },
  ];

  if (catalogLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <DashboardTopbar
        title={serviceName}
        subtitle={catalogItem?.description ?? catalogItem?.display_name ?? "Service detail"}
      />

      <main className="flex-1 overflow-auto">
        {/* Service header */}
        <div className="px-6 py-4 border-b border-border">
          <Link
            to="/dashboard/services"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition mb-3"
          >
            <ChevronLeft className="size-3" /> Services
          </Link>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-xl font-bold font-mono">{serviceName}</h2>
                <StatusBadge status={overallStatus} />
              </div>
              {catalogItem?.description && (
                <p className="text-sm text-muted-foreground mt-1">{catalogItem.description}</p>
              )}
              <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
                {catalogItem && (
                  <>
                    <span className="font-mono bg-secondary px-1.5 py-0.5 rounded">
                      {catalogItem.default_cpu}MHz · {catalogItem.default_memory}MB
                    </span>
                    {catalogItem.default_container_port > 0 && (
                      <span className="font-mono bg-secondary px-1.5 py-0.5 rounded">
                        port :{catalogItem.default_container_port}
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {envDeployments[0] && (
                <Link
                  to="/dashboard/environments/$envId/service-catalog"
                  params={{ envId: envDeployments[0].env.slug }}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition"
                >
                  <Rocket className="size-3" /> Deploy
                </Link>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mt-4 -mb-4 border-b border-transparent">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm border-b-2 transition ${
                  tab === id
                    ? "border-primary text-foreground font-medium"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="size-3.5" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab content */}
        <div className="p-6">
          {tab === "overview" && (
            <OverviewTab envDeployments={envDeployments} serviceName={serviceName} />
          )}
          {tab === "deployments" && <DeploymentsTab envDeployments={envDeployments} />}
          {tab === "logs" && <LogsTab envDeployments={envDeployments} />}
          {tab === "secrets" && <SecretsTab slug={slug} envDeployments={envDeployments} />}
          {tab === "dependencies" && <DependenciesTab serviceName={serviceName} />}
          {tab === "ownership" && (
            <OwnershipTab serviceName={serviceName} catalogItem={catalogItem} />
          )}
          {tab === "settings" && catalogItem && <SettingsTab item={catalogItem} />}
        </div>
      </main>
    </>
  );
}

// ─── Overview tab ─────────────────────────────────────────────────────────────

type EnvDeployment = {
  env: { id: string; name: string; slug: string };
  deployment: ServiceDeployment | undefined;
};

function OverviewTab({
  envDeployments,
  serviceName,
}: {
  envDeployments: EnvDeployment[];
  serviceName: string;
}) {
  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <div className="space-y-6">
      <section>
        <h3 className="text-sm font-semibold mb-3">Deployed environments</h3>
        <div className="space-y-3">
          {envDeployments.map(({ env, deployment }) => {
            const status = deploymentStatus(deployment);
            return (
              <div key={env.id} className="glass rounded-xl p-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{env.name}</span>
                    <StatusBadge status={status} />
                    {deployment?.deployed_by && (
                      <span className="text-[11px] text-muted-foreground">
                        by {deployment.deployed_by}
                      </span>
                    )}
                  </div>
                  {deployment && (
                    <div className="text-xs text-muted-foreground mt-1 flex gap-3 flex-wrap">
                      <span className="font-mono">{deployment.image}</span>
                      <span>updated {formatDate(deployment.updated_at)}</span>
                    </div>
                  )}
                  {!deployment && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Not deployed in this environment
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {deployment && (
                    <>
                      <Link
                        to="/dashboard/environments/$envId/logs"
                        params={{ envId: env.slug }}
                        className="text-[11px] px-2 py-1 rounded bg-secondary text-muted-foreground hover:text-foreground transition flex items-center gap-1"
                      >
                        <ScrollText className="size-3" /> Logs
                      </Link>
                    </>
                  )}
                  <Link
                    to="/dashboard/environments/$envId/service-catalog"
                    params={{ envId: env.slug }}
                    className="text-[11px] px-2.5 py-1 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition flex items-center gap-1"
                  >
                    <Rocket className="size-3" /> Deploy
                  </Link>
                </div>
              </div>
            );
          })}
        </div>

        {envDeployments.every((e) => !e.deployment) && (
          <div className="glass rounded-xl p-8 text-center mt-2">
            <Package className="size-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm font-medium">{serviceName} hasn't been deployed yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Choose an environment to deploy it into.
            </p>
            <div className="flex items-center gap-2 justify-center mt-4 flex-wrap">
              {envDeployments.slice(0, 3).map(({ env }) => (
                <Link
                  key={env.id}
                  to="/dashboard/environments/$envId/service-catalog"
                  params={{ envId: env.slug }}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-accent transition"
                >
                  <Rocket className="size-3" /> Deploy to {env.name}
                </Link>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

// ─── Deployments tab ──────────────────────────────────────────────────────────

function DeploymentsTab({ envDeployments }: { envDeployments: EnvDeployment[] }) {
  const activeDeployments = envDeployments.filter((e) => e.deployment);

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold">Active deployments</h3>
      {activeDeployments.length === 0 ? (
        <div className="glass rounded-xl p-6 text-center">
          <p className="text-sm text-muted-foreground">No active deployments.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {activeDeployments.map(({ env, deployment: d }) => (
            <div key={env.id} className="glass rounded-xl p-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{env.name}</span>
                    <StatusBadge status={deploymentStatus(d)} />
                  </div>
                  {d && (
                    <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                      <div>
                        <span className="text-foreground font-medium">Image: </span>
                        <span className="font-mono">{d.image}</span>
                      </div>
                      <div>
                        <span className="text-foreground font-medium">Deployed by: </span>
                        {d.deployed_by}
                      </div>
                      <div>
                        <span className="text-foreground font-medium">Runtime: </span>
                        {d.runtime_provider}
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    to="/dashboard/environments/$envId/deployments"
                    params={{ envId: env.slug }}
                    className="text-[11px] px-2.5 py-1 rounded bg-secondary text-muted-foreground hover:text-foreground transition flex items-center gap-1"
                  >
                    <ExternalLink className="size-3" /> Full details
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Logs tab ─────────────────────────────────────────────────────────────────

function LogsTab({ envDeployments }: { envDeployments: EnvDeployment[] }) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold">Logs by environment</h3>
      <div className="space-y-3">
        {envDeployments.map(({ env, deployment }) => (
          <Link
            key={env.id}
            to="/dashboard/environments/$envId/logs"
            params={{ envId: env.slug }}
            className="glass rounded-xl p-4 flex items-center gap-3 hover:bg-accent/50 transition group"
          >
            <div className="size-8 rounded-lg bg-secondary grid place-items-center shrink-0">
              <ScrollText className="size-4 text-muted-foreground group-hover:text-primary transition" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm">{env.name}</div>
              <div className="text-xs text-muted-foreground">
                {deployment
                  ? "Streaming live · click to view"
                  : "No deployment in this environment"}
              </div>
            </div>
            <ChevronRight className="size-4 text-muted-foreground" />
          </Link>
        ))}
      </div>
    </div>
  );
}

// ─── Secrets tab ─────────────────────────────────────────────────────────────

function SecretsTab({ slug, envDeployments }: { slug: string; envDeployments: EnvDeployment[] }) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold">Secrets by environment</h3>
      <div className="space-y-3">
        {envDeployments.map(({ env }) => (
          <Link
            key={env.id}
            to="/dashboard/environments/$envId/secrets"
            params={{ envId: env.slug }}
            className="glass rounded-xl p-4 flex items-center gap-3 hover:bg-accent/50 transition group"
          >
            <div className="size-8 rounded-lg bg-secondary grid place-items-center shrink-0">
              <KeyRound className="size-4 text-muted-foreground group-hover:text-primary transition" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm">{env.name}</div>
              <div className="text-xs text-muted-foreground">View and manage secret grants</div>
            </div>
            <ChevronRight className="size-4 text-muted-foreground" />
          </Link>
        ))}
      </div>
    </div>
  );
}

// ─── Dependencies tab ─────────────────────────────────────────────────────────

const DEPENDENCY_TYPES = [
  { type: "service", icon: Layers, label: "Service", color: "text-primary bg-primary/10" },
  { type: "database", icon: Database, label: "Database", color: "text-success bg-success/10" },
  { type: "cache", icon: Radio, label: "Cache", color: "text-warning bg-warning/10" },
  {
    type: "external_api",
    icon: Link2,
    label: "External API",
    color: "text-muted-foreground bg-secondary",
  },
] as const;

function DependenciesTab({ serviceName }: { serviceName: string }) {
  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Service dependencies</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Services, databases, caches, and external APIs this service depends on at runtime.
          </p>
        </div>
        <button className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded bg-secondary border border-border text-muted-foreground hover:text-foreground transition">
          <Link2 className="size-3.5" /> Add dependency
        </button>
      </div>

      {/* Upstream */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <ArrowRight className="size-3.5 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground label-mono">
            UPSTREAM (dependencies of {serviceName})
          </span>
        </div>
        <div className="glass rounded-xl p-6 text-center border-dashed">
          <Link2 className="size-7 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm font-medium">No dependencies registered</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
            Register what this service depends on. This powers the dependency graph and incident
            impact analysis.
          </p>
          <div className="flex items-center justify-center gap-2 mt-4 flex-wrap">
            {DEPENDENCY_TYPES.map(({ type, icon: Icon, label, color }) => (
              <button
                key={type}
                className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded border border-border hover:bg-accent transition"
              >
                <span className={`size-4 rounded grid place-items-center ${color}`}>
                  <Icon className="size-2.5" />
                </span>
                {label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Downstream */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <ArrowLeft className="size-3.5 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground label-mono">
            DOWNSTREAM (services that call {serviceName})
          </span>
        </div>
        <div className="glass rounded-xl p-6 text-center border-dashed">
          <p className="text-sm text-muted-foreground">
            Downstream callers will appear here once other services register a dependency on{" "}
            <span className="font-mono">{serviceName}</span>.
          </p>
        </div>
      </section>

      <div className="glass rounded-xl p-4 bg-secondary/30">
        <p className="text-xs text-muted-foreground leading-relaxed">
          <span className="font-medium text-foreground">Why register dependencies?</span> The
          dependency graph powers incident blast-radius analysis, change risk scoring, and
          platform-level capacity planning. Dependencies are never enforced at deploy time — they
          are informational and used only for insights.
        </p>
      </div>
    </div>
  );
}

// ─── Ownership tab ────────────────────────────────────────────────────────────

type CatalogItem = {
  name: string;
  display_name: string;
  description: string;
  default_cpu: number;
  default_memory: number;
  default_container_port: number;
};

function OwnershipTab({
  serviceName,
  catalogItem,
}: {
  serviceName: string;
  catalogItem: CatalogItem | undefined;
}) {
  const readinessItems = [
    { label: "Owner team assigned", done: true },
    { label: "Repository linked", done: false },
    { label: "Incident runbook present", done: false },
    { label: "Production monitoring", done: true },
    { label: "Deployment automation", done: false },
    { label: "On-call assignment", done: false },
  ];

  const readinessScore = Math.round(
    (readinessItems.filter((r) => r.done).length / readinessItems.length) * 100,
  );

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="grid grid-cols-2 gap-4">
        {/* Ownership details */}
        <div className="glass rounded-xl p-5 space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Users className="size-3.5 text-muted-foreground" />
            Ownership
          </h3>
          <div className="space-y-2.5 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Owner team</span>
              <span className="text-xs bg-secondary px-2 py-0.5 rounded font-mono text-foreground">
                Platform
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Repository</span>
              <span className="text-xs text-muted-foreground italic">not linked</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Slack channel</span>
              <span className="text-xs text-muted-foreground italic">not set</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">On-call</span>
              <span className="text-xs text-muted-foreground italic">not configured</span>
            </div>
          </div>
          <button className="text-xs px-3 py-1.5 rounded bg-secondary border border-border text-muted-foreground hover:text-foreground transition w-full mt-1">
            Edit ownership
          </button>
        </div>

        {/* Readiness score */}
        <div className="glass rounded-xl p-5 space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <BookOpen className="size-3.5 text-muted-foreground" />
            Readiness
            <span
              className={`ml-auto text-xs font-bold font-mono ${
                readinessScore >= 80
                  ? "text-success"
                  : readinessScore >= 50
                    ? "text-warning"
                    : "text-destructive"
              }`}
            >
              {readinessScore}/100
            </span>
          </h3>
          <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                readinessScore >= 80
                  ? "bg-success"
                  : readinessScore >= 50
                    ? "bg-warning"
                    : "bg-destructive"
              }`}
              style={{ width: `${readinessScore}%` }}
            />
          </div>
          <div className="space-y-1.5">
            {readinessItems.map(({ label, done }) => (
              <div key={label} className="flex items-center gap-2 text-xs">
                {done ? (
                  <CheckCircle2 className="size-3.5 text-success shrink-0" />
                ) : (
                  <Circle className="size-3.5 text-muted-foreground/40 shrink-0" />
                )}
                <span className={done ? "text-foreground" : "text-muted-foreground"}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Runbooks */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">Runbooks</h3>
          <button className="text-xs px-2.5 py-1 rounded bg-secondary border border-border text-muted-foreground hover:text-foreground transition flex items-center gap-1.5">
            <BookOpen className="size-3" /> Add runbook
          </button>
        </div>
        <div className="glass rounded-xl p-6 text-center border-dashed">
          <BookOpen className="size-7 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm font-medium">No runbooks yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            Add incident, deployment, and maintenance runbooks so on-call engineers know what to do.
          </p>
          <div className="flex items-center justify-center gap-2 mt-4 flex-wrap">
            {(["Incident", "Deployment", "Maintenance"] as const).map((type) => (
              <button
                key={type}
                className="text-xs px-2.5 py-1.5 rounded border border-border hover:bg-accent transition text-muted-foreground hover:text-foreground"
              >
                + {type}
              </button>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

// ─── Settings tab ─────────────────────────────────────────────────────────────

function SettingsTab({
  item,
}: {
  item: {
    name: string;
    display_name: string;
    description: string;
    default_cpu: number;
    default_memory: number;
    default_container_port: number;
  };
}) {
  return (
    <div className="space-y-6 max-w-lg">
      <section className="glass rounded-xl p-5 space-y-3">
        <h3 className="text-sm font-semibold">Catalog item</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Name</span>
            <span className="font-mono">{item.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Display name</span>
            <span>{item.display_name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Default CPU</span>
            <span className="font-mono">{item.default_cpu} MHz</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Default memory</span>
            <span className="font-mono">{item.default_memory} MB</span>
          </div>
          {item.default_container_port > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Container port</span>
              <span className="font-mono">:{item.default_container_port}</span>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
