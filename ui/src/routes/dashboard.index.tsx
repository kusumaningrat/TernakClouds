import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { hasSetupBeenVisited } from "@/routes/setup";
import { DashboardTopbar } from "@/components/DashboardTopbar";
import { GettingStartedChecklist } from "@/components/GettingStartedChecklist";
import { useWorkspaceContext } from "@/lib/workspace-context";
import { useEnvironmentContext } from "@/lib/environment-context";
import {
  useMe,
  useWorkspacesMine,
  useAccessRequestsPending,
  useApproveAccessRequest,
  useDenyAccessRequest,
  useEnvironments,
  useCatalog,
  useAllServiceDeployments,
  useCapabilities,
  useRegistries,
  useRepoProviders,
} from "@/lib/queries";
import type { ServiceDeployment } from "@/lib/types";
import {
  Rocket,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ChevronRight,
  Plus,
  Loader2,
  ArrowRight,
  LayoutGrid,
  BarChart3,
  Users,
  Server,
  Globe,
  Layers,
  KeyRound,
} from "lucide-react";
import { useMemo, useState, useEffect } from "react";

export const Route = createFileRoute("/dashboard/")({
  head: () => ({ meta: [{ title: "Home · TernakClouds" }] }),
  component: Dashboard,
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

type ServiceStatus = "healthy" | "degraded" | "stopped" | "undeployed";

function deployStatus(d: ServiceDeployment | undefined): ServiceStatus {
  if (!d) return "undeployed";
  const s = d.status?.toLowerCase() ?? "";
  if (s === "running") return "healthy";
  if (s === "dead" || s === "stopped" || s === "failed") return "stopped";
  return "degraded";
}

function StatusDot({ status }: { status: ServiceStatus }) {
  const colors: Record<ServiceStatus, string> = {
    healthy:    "bg-success",
    degraded:   "bg-warning",
    stopped:    "bg-destructive",
    undeployed: "bg-muted-foreground/25",
  };
  return <span className={`inline-block size-2 rounded-full shrink-0 ${colors[status]}`} />;
}

function formatRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ─── Dashboard root ────────────────────────────────────────────────────────────

function Dashboard() {
  const navigate = useNavigate();
  const { selectedWorkspace, setSelectedWorkspace } = useWorkspaceContext();
  const { selectedEnvironment } = useEnvironmentContext();

  // Always load the user's workspaces so we can detect "no workspace" even when
  // the workspace context hasn't hydrated from localStorage yet.
  const { data: workspaces, isLoading: workspacesLoading } = useWorkspacesMine();
  const hasWorkspace = (workspaces?.length ?? 0) > 0;

  // Keep context in sync with fresh API data.
  useEffect(() => {
    if (workspaces?.length && !selectedWorkspace) {
      setSelectedWorkspace(workspaces[0]);
    }
  }, [workspaces, selectedWorkspace, setSelectedWorkspace]);

  // Derive slug only from the live API response. Do NOT fall back to localStorage
  // — a stale cached slug (e.g. "platform" from a wiped DB) causes spurious 404s
  // and prevents the "no workspace" detection from triggering.
  const slug = workspaces?.[0]?.slug ?? "";

  const { data: me, isLoading: meLoading } = useMe();
  const { data: environments, isLoading: envsLoading } = useEnvironments(slug);
  const { data: catalog } = useCatalog();

  const envSlugs = useMemo(() => (environments ?? []).map((e) => e.slug), [environments]);
  const deploymentQueries = useAllServiceDeployments(slug, envSlugs);

  // Check if any environment has a runtime provider connected.
  const firstEnvSlug = envSlugs[0] ?? "";
  const { data: firstEnvCaps, isLoading: capsLoading } = useCapabilities(slug, firstEnvSlug);
  const hasRuntime = firstEnvCaps
    ? firstEnvCaps.some((c) => c.capability_name === "runtime" && (c.providers ?? []).length > 0)
    : null;

  const isPrivileged = isAdminOrManager(me?.roles);

  // Loading is done when: user loaded + workspaces resolved +
  // environments resolved (if we have a workspace) + caps resolved (if we have an env).
  const isLoading =
    meLoading ||
    workspacesLoading ||
    (!!slug && envsLoading) ||
    (!!firstEnvSlug && capsLoading);

  const allDeployments = useMemo(
    () => (environments ?? []).flatMap((_, i) => deploymentQueries[i]?.data ?? []),
    [environments, deploymentQueries],
  );

  const hasDeployments = allDeployments.some((d) => d.status === "running" || d.status === "pending");

  // Redirect to /setup when the platform needs configuration.
  // Two distinct cases with different rules:
  //
  // 1. No workspace at all → ALWAYS redirect (even if localStorage flag is set,
  //    because the DB was wiped and the flag is stale).
  //
  // 2. Workspace exists but no runtime → redirect only on the first visit.
  //    After the user visits /setup (even skipping), the flag suppresses this.
  useEffect(() => {
    if (isLoading || !isPrivileged) return;

    if (!hasWorkspace) {
      // DB is empty — clear any stale visited flag so setup shows correctly.
      try { localStorage.removeItem("tc_setup_visited"); } catch { /* ignore */ }
      void navigate({ to: "/setup" });
      return;
    }

    if (hasRuntime === false && !hasSetupBeenVisited()) {
      void navigate({ to: "/setup" });
    }
  }, [isLoading, isPrivileged, hasWorkspace, hasRuntime, navigate]);

  // ── Scenario detection ──────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <>
        <DashboardTopbar />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      </>
    );
  }

  // Scenario between A and B: has environments but nothing deployed yet
  if (!hasDeployments) {
    return (
      <ScenarioFirstDeploy
        slug={slug}
        environments={environments ?? []}
        catalog={catalog ?? []}
        firstName={me?.first_name ?? "Developer"}
        isAdmin={isPrivileged}
        deploymentQueries={deploymentQueries}
        envSlugs={envSlugs}
        hasRuntime={hasRuntime ?? false}
      />
    );
  }

  // Scenario B/C: fully operational (may still show setup banner if runtime missing)
  return (
    <ScenarioOperational
      slug={slug}
      me={me}
      environments={environments ?? []}
      catalog={catalog ?? []}
      deploymentQueries={deploymentQueries}
      selectedEnvironment={selectedEnvironment}
      isPrivileged={isPrivileged}
      hasRuntime={hasRuntime ?? true}
    />
  );
}

// ─── Setup warning banner ─────────────────────────────────────────────────────

function SetupWarningBanner({ isAdmin }: { isAdmin: boolean }) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <div className="mx-6 mt-4 flex items-center gap-3 px-4 py-3 rounded-lg border border-warning/30 bg-warning/8 text-warning text-sm">
      <AlertTriangle className="size-4 shrink-0" />
      <span className="flex-1">
        <span className="font-semibold">Runtime not connected</span>
        {" — "}services cannot be deployed until a runtime is configured.
        {" "}
        {isAdmin && (
          <Link to="/setup" className="underline underline-offset-2 hover:no-underline">
            Complete setup →
          </Link>
        )}
      </span>
      <button
        onClick={() => setDismissed(true)}
        className="p-0.5 rounded hover:bg-warning/20 transition shrink-0 text-warning/70 hover:text-warning"
      >
        <XCircle className="size-4" />
      </button>
    </div>
  );
}

// ─── Scenario A: No environments (platform not set up) ────────────────────────

function ScenarioA({
  slug,
  isAdmin,
  firstName,
}: {
  slug: string;
  isAdmin: boolean;
  firstName: string;
}) {
  return (
    <>
      <DashboardTopbar />
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="max-w-lg w-full text-center space-y-6">
          <div className="size-20 rounded-2xl bg-[image:var(--gradient-primary)] grid place-items-center mx-auto">
            <Rocket className="size-10 text-white" />
          </div>

          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Welcome, {firstName}
            </h1>
            <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
              {isAdmin
                ? "Your platform isn't configured yet. Complete setup to start deploying services in about 3 minutes."
                : "Your platform is being set up by an admin. Check back soon or ask your platform engineer to complete the configuration."}
            </p>
          </div>

          {isAdmin ? (
            <div className="space-y-3">
              <Link
                to="/setup"
                className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition font-medium"
              >
                <Rocket className="size-4" /> Start platform setup
              </Link>

              {/* What you'll configure */}
              <div className="glass rounded-xl p-4 text-left space-y-2.5">
                {[
                  { icon: Globe,  label: "Create an environment",    desc: "Where your services will run" },
                  { icon: Server, label: "Connect a runtime",         desc: "Kubernetes, Nomad, Docker, or ECS" },
                  { icon: Layers, label: "Deploy your first service", desc: "From a ready-made template" },
                ].map(({ icon: Icon, label, desc }) => (
                  <div key={label} className="flex items-center gap-3">
                    <div className="size-7 rounded bg-secondary grid place-items-center shrink-0">
                      <Icon className="size-3.5 text-muted-foreground" />
                    </div>
                    <div>
                      <div className="text-sm font-medium">{label}</div>
                      <div className="text-[11px] text-muted-foreground">{desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="glass rounded-xl p-6">
              <p className="text-sm text-muted-foreground">
                Contact your platform engineer or workspace admin to complete the setup.
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Scenario between A and B: Environments exist, nothing deployed ────────────

function ScenarioFirstDeploy({
  slug,
  environments,
  catalog,
  firstName,
  isAdmin,
  deploymentQueries,
  envSlugs,
  hasRuntime,
}: {
  slug: string;
  environments: { id: string; name: string; slug: string }[];
  catalog: { id: string; name: string; display_name: string; description: string }[];
  firstName: string;
  isAdmin: boolean;
  deploymentQueries: ReturnType<typeof useAllServiceDeployments>;
  envSlugs: string[];
  hasRuntime: boolean;
}) {
  const { data: registries } = useRegistries(slug);
  const { data: repoProviders } = useRepoProviders(slug);

  const checklistItems = [
    { id: "env",      label: "Create an environment",     done: environments.length > 0,   link: "/dashboard/platform" },
    { id: "registry", label: "Connect a container registry", done: (registries ?? []).length > 0, link: "/dashboard/registries" },
    { id: "repo",     label: "Connect a repository provider", done: (repoProviders ?? []).length > 0, link: "/dashboard/repositories" },
    { id: "service",  label: "Deploy your first service",  done: false,                     link: `/dashboard/environments/${environments[0]?.slug}/service-catalog` },
    { id: "team",     label: "Invite a team member",       done: false,                     link: "/dashboard/teams" },
    { id: "secret",   label: "Set up a secret",            done: false,                     link: `/dashboard/environments/${environments[0]?.slug}/secrets` },
  ];

  return (
    <>
      <DashboardTopbar />
      {!hasRuntime && <SetupWarningBanner isAdmin={isAdmin} />}
      <div className="flex flex-col h-full overflow-auto">
        <div className="px-6 pt-5 pb-4 border-b border-border">
          <h1 className="text-2xl font-bold tracking-tight">
            Good to go, {firstName}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Your platform is set up. Time to deploy your first service.
          </p>
        </div>

        <div className="flex flex-1 min-h-0">
          {/* Main */}
          <div className="flex-1 p-6 space-y-6 overflow-auto">
            {/* Environments */}
            <section>
              <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Globe className="size-3.5 text-muted-foreground" />
                Environments ready
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {environments.map((env) => (
                  <Link
                    key={env.id}
                    to="/dashboard/environments/$envId/service-catalog"
                    params={{ envId: env.slug }}
                    className="glass rounded-xl p-4 flex items-center gap-3 hover:border-primary/30 transition group"
                  >
                    <div className="size-9 rounded-lg bg-secondary grid place-items-center shrink-0 group-hover:bg-primary/10 transition">
                      <Globe className="size-4 text-muted-foreground group-hover:text-primary transition" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{env.name}</div>
                      <div className="text-xs text-muted-foreground">Ready for deployments</div>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] label-mono text-primary">
                      DEPLOY <ChevronRight className="size-3" />
                    </div>
                  </Link>
                ))}
              </div>
            </section>

            {/* Service catalog preview */}
            {catalog.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Layers className="size-3.5 text-muted-foreground" />
                  Available services
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {catalog.slice(0, 3).map((item) => (
                    <div
                      key={item.id}
                      className="glass rounded-xl p-4 space-y-2"
                    >
                      <div className="flex items-center gap-2">
                        <div className="size-7 rounded bg-secondary grid place-items-center shrink-0">
                          <Layers className="size-3.5 text-muted-foreground" />
                        </div>
                        <div className="font-medium text-sm truncate">{item.display_name}</div>
                      </div>
                      <div className="text-xs text-muted-foreground line-clamp-2">
                        {item.description}
                      </div>
                      {environments[0] && (
                        <Link
                          to="/dashboard/environments/$envId/service-catalog"
                          params={{ envId: environments[0].slug }}
                          className="flex items-center gap-1 text-[11px] text-primary hover:underline"
                        >
                          <Rocket className="size-3" /> Deploy
                        </Link>
                      )}
                    </div>
                  ))}
                </div>
                <Link
                  to="/dashboard/services"
                  className="mt-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition"
                >
                  View all {catalog.length} services <ArrowRight className="size-3" />
                </Link>
              </section>
            )}
          </div>

          {/* Checklist sidebar */}
          <div className="w-72 shrink-0 border-l border-border p-4 space-y-4 overflow-auto">
            <GettingStartedChecklist items={checklistItems} />
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Scenario B/C: Operational home ───────────────────────────────────────────

type ServiceCardData = {
  name: string;
  displayName: string;
  type: string;
  overallStatus: ServiceStatus;
  envStatuses: { label: string; status: ServiceStatus }[];
  lastDeployedAt?: string;
};

function ServiceCard({ s }: { s: ServiceCardData }) {
  const statusConfig: Record<ServiceStatus, { label: string; cls: string }> = {
    healthy:    { label: "HEALTHY",  cls: "text-success bg-success/10 border-success/20" },
    degraded:   { label: "DEGRADED", cls: "text-warning bg-warning/10 border-warning/20" },
    stopped:    { label: "FAILED",   cls: "text-destructive bg-destructive/10 border-destructive/20" },
    undeployed: { label: "IDLE",     cls: "text-muted-foreground bg-secondary border-border" },
  };
  const { label: statusLabel, cls: statusCls } = statusConfig[s.overallStatus];

  return (
    <Link
      to="/dashboard/services/$serviceName"
      params={{ serviceName: s.name }}
      className={`glass rounded-lg p-4 hover:border-primary/40 transition-colors flex flex-col gap-3 group ${
        s.overallStatus === "degraded" ? "border-warning/30" :
        s.overallStatus === "stopped"  ? "border-destructive/30" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="size-8 rounded bg-secondary grid place-items-center shrink-0">
            <LayoutGrid className="size-4 text-muted-foreground" />
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-sm font-mono truncate">{s.name}</div>
            <div className="text-[10px] text-muted-foreground label-mono">{s.type}</div>
          </div>
        </div>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border label-mono shrink-0 ${statusCls}`}>
          {statusLabel}
        </span>
      </div>

      <div className="flex items-center gap-2">
        {s.envStatuses.map(({ label, status }) => (
          <div key={label} className="flex flex-col items-center gap-0.5">
            <StatusDot status={status} />
            <span className="label-mono text-muted-foreground" style={{ fontSize: "9px" }}>
              {label.slice(0, 3).toUpperCase()}
            </span>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground">
          {s.lastDeployedAt ? `Last deployed ${formatRelative(s.lastDeployedAt)}` : "Never deployed"}
        </span>
        <ChevronRight className="size-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
      </div>
    </Link>
  );
}

function ActiveDeploymentRow({
  dep,
}: {
  dep: ServiceDeployment & { envName: string };
}) {
  const isRunning = dep.status === "running";
  const isFailed  = dep.status === "failed" || dep.status === "dead";

  return (
    <div className="flex items-center gap-3 py-3 border-b border-border last:border-0">
      <div className="size-7 rounded bg-secondary grid place-items-center shrink-0">
        <Rocket className={`size-3.5 ${isRunning ? "text-success" : isFailed ? "text-destructive" : "text-warning animate-pulse"}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-sm font-medium font-mono">{dep.catalog_name}</span>
          <span className="text-muted-foreground text-xs">→</span>
          <span className={`text-xs font-medium ${isRunning ? "text-success" : isFailed ? "text-destructive" : "text-warning"}`}>
            {dep.envName}
          </span>
        </div>
        <div className="text-[10px] text-muted-foreground font-mono truncate">{dep.image}</div>
      </div>
      <div className="shrink-0 flex flex-col items-end gap-1">
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded label-mono border ${
          isRunning  ? "text-success bg-success/10 border-success/20" :
          isFailed   ? "text-destructive bg-destructive/10 border-destructive/20" :
          "text-warning bg-warning/10 border-warning/20"
        }`}>
          {dep.status.toUpperCase()}
        </span>
        <span className="text-[10px] text-muted-foreground">{formatRelative(dep.updated_at)}</span>
      </div>
    </div>
  );
}

function QuickAction({
  icon: Icon,
  label,
  desc,
  to,
}: {
  icon: React.ElementType;
  label: string;
  desc: string;
  to: string;
}) {
  return (
    <Link
      to={to as never}
      className="flex items-start gap-3 px-4 py-3 hover:bg-accent rounded transition-colors group"
    >
      <div className="size-8 rounded bg-secondary grid place-items-center shrink-0 group-hover:bg-primary/10 transition-colors">
        <Icon className="size-4 text-muted-foreground group-hover:text-primary transition-colors" />
      </div>
      <div>
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{desc}</div>
      </div>
    </Link>
  );
}

function ScenarioOperational({
  slug,
  me,
  environments,
  catalog,
  deploymentQueries,
  selectedEnvironment,
  isPrivileged,
  hasRuntime,
}: {
  slug: string;
  me: { first_name?: string; roles?: { role?: { name?: string } }[] } | undefined;
  environments: { id: string; name: string; slug: string }[];
  catalog: { id: string; name: string; display_name: string; description: string; default_cpu: number; default_memory: number }[];
  deploymentQueries: ReturnType<typeof useAllServiceDeployments>;
  selectedEnvironment: { id: string; name: string; slug: string } | null;
  isPrivileged: boolean;
  hasRuntime: boolean;
}) {
  const { data: pendingRequests, isLoading: pendingLoading } = useAccessRequestsPending();
  const approve = useApproveAccessRequest();
  const deny    = useDenyAccessRequest();
  const [processingId, setProcessingId] = useState<string | null>(null);

  const pendingCount = isPrivileged ? (pendingRequests?.length ?? 0) : 0;
  const firstName    = me?.first_name ?? "Developer";
  const hour         = new Date().getHours();
  const greeting     = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const today        = new Date().toLocaleDateString("en-US", {
    weekday: "long", month: "short", day: "numeric",
  });

  // Build service cards
  const serviceCards: ServiceCardData[] = useMemo(() => {
    const visibleEnvs = selectedEnvironment
      ? [selectedEnvironment]
      : environments.slice(0, 4);

    return catalog.slice(0, 6).map((item) => {
      const envStatuses = visibleEnvs.map((env) => {
        const globalIdx = environments.findIndex((e) => e.id === env.id);
        const deps = deploymentQueries[globalIdx]?.data ?? [];
        const dep  = deps.find((d) => d.catalog_name === item.name);
        return { label: env.slug, status: deployStatus(dep) };
      });

      const overallStatus: ServiceStatus =
        envStatuses.some((s) => s.status === "stopped")    ? "stopped"    :
        envStatuses.some((s) => s.status === "degraded")   ? "degraded"   :
        envStatuses.some((s) => s.status === "healthy")    ? "healthy"    :
        "undeployed";

      const allDeps   = environments.flatMap((_, i) => deploymentQueries[i]?.data ?? []);
      const myDeps    = allDeps.filter((d) => d.catalog_name === item.name);
      const lastAt    = myDeps.map((d) => d.updated_at).sort().pop();

      return {
        name: item.name,
        displayName: item.display_name,
        type: "microservice",
        overallStatus,
        envStatuses,
        lastDeployedAt: lastAt,
      };
    });
  }, [catalog, environments, selectedEnvironment, deploymentQueries]);

  // Active deployments
  const activeDeployments = useMemo(() => {
    const visibleEnvs = selectedEnvironment ? [selectedEnvironment] : environments;
    return visibleEnvs
      .flatMap((env) => {
        const globalIdx = environments.findIndex((e) => e.id === env.id);
        const deps = deploymentQueries[globalIdx]?.data ?? [];
        return deps
          .filter((d) => d.status === "running" || d.status === "pending" || d.status === "failed")
          .map((d) => ({ ...d, envName: env.name }));
      })
      .slice(0, 5);
  }, [environments, selectedEnvironment, deploymentQueries]);

  // Health summary
  const healthSummary = useMemo(() => {
    return serviceCards.reduce(
      (acc, s) => {
        if (s.overallStatus === "healthy")    acc.healthy++;
        else if (s.overallStatus === "stopped" || s.overallStatus === "degraded") acc.issues++;
        else acc.undeployed++;
        return acc;
      },
      { healthy: 0, issues: 0, undeployed: 0 },
    );
  }, [serviceCards]);

  const handleApproval = async (id: string, action: "approve" | "deny") => {
    setProcessingId(id);
    try {
      if (action === "approve") await approve.mutateAsync({ id });
      else await deny.mutateAsync(id);
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <>
      <DashboardTopbar />
      {!hasRuntime && <SetupWarningBanner isAdmin={isPrivileged} />}
      <div className="flex flex-col h-full overflow-auto">
        {/* Page header */}
        <div className="px-6 pt-5 pb-4 border-b border-border">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground label-mono mb-1">{today}</div>
              <h1 className="text-2xl font-bold tracking-tight">
                {greeting}, {firstName}
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {activeDeployments.filter((d) => d.status === "running").length} running
                {activeDeployments.some((d) => d.status === "failed") && (
                  <span className="text-destructive"> · {activeDeployments.filter((d) => d.status === "failed").length} failed</span>
                )}
                {pendingCount > 0 && (
                  <span className="text-warning"> · {pendingCount} pending approval{pendingCount !== 1 ? "s" : ""}</span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Link
                to="/dashboard/insights"
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded border border-border hover:bg-accent transition text-muted-foreground"
              >
                <BarChart3 className="size-3.5" /> Insights
              </Link>
              <Link
                to="/dashboard/teams"
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded border border-border hover:bg-accent transition text-muted-foreground"
              >
                <Users className="size-3.5" /> Teams
              </Link>
            </div>
          </div>

          {/* Workspace health summary */}
          <div className="grid grid-cols-3 gap-2 mt-4">
            {[
              { label: "HEALTHY",     value: healthSummary.healthy,    dot: "bg-success",             text: "text-success" },
              { label: "ISSUES",      value: healthSummary.issues,     dot: "bg-warning",             text: healthSummary.issues > 0 ? "text-warning" : "text-muted-foreground" },
              { label: "NOT DEPLOYED", value: healthSummary.undeployed, dot: "bg-muted-foreground/30", text: "text-muted-foreground" },
            ].map(({ label, value, dot, text }) => (
              <Link
                key={label}
                to="/dashboard/insights"
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-secondary/50 hover:bg-secondary transition"
              >
                <span className={`size-2 rounded-full shrink-0 ${dot}`} />
                <div className="min-w-0">
                  <div className={`text-xl font-bold font-mono leading-none ${text}`}>{value}</div>
                  <div className="text-[9px] label-mono text-muted-foreground mt-0.5">{label}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Two-column layout */}
        <div className="flex flex-1 min-h-0 overflow-auto">
          {/* Main */}
          <div className="flex-1 min-w-0 p-6 space-y-6 overflow-auto">
            {/* My Services */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-sm flex items-center gap-2">
                  <span className="size-1.5 rounded-full bg-primary inline-block" />
                  Services
                </h2>
                <Link
                  to="/dashboard/services"
                  className="text-xs text-muted-foreground hover:text-primary transition flex items-center gap-1"
                >
                  View all <ArrowRight className="size-3" />
                </Link>
              </div>

              {serviceCards.length === 0 ? (
                <div className="glass rounded-lg p-8 text-center">
                  <Layers className="size-8 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm font-medium">No services yet</p>
                  <p className="text-xs text-muted-foreground mt-1">Deploy a service to see it here.</p>
                  {environments[0] && (
                    <Link
                      to="/dashboard/environments/$envId/service-catalog"
                      params={{ envId: environments[0].slug }}
                      className="inline-flex items-center gap-1.5 mt-3 text-xs text-primary hover:underline"
                    >
                      <Plus className="size-3" /> Deploy first service
                    </Link>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {serviceCards.map((s) => (
                    <ServiceCard key={s.name} s={s} />
                  ))}
                </div>
              )}
            </section>

            {/* Active Deployments */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-sm flex items-center gap-2">
                  <span className={`size-1.5 rounded-full inline-block ${
                    activeDeployments.some((d) => d.status === "pending") ? "bg-warning animate-pulse" : "bg-muted-foreground"
                  }`} />
                  Recent Deployments
                  {activeDeployments.length > 0 && (
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-secondary text-muted-foreground label-mono">
                      {activeDeployments.length}
                    </span>
                  )}
                </h2>
              </div>

              <div className="glass rounded-lg overflow-hidden">
                {activeDeployments.length === 0 ? (
                  <div className="p-6 text-center">
                    <p className="text-sm text-muted-foreground">No recent deployments.</p>
                  </div>
                ) : (
                  <div className="px-4">
                    {activeDeployments.map((dep) => (
                      <ActiveDeploymentRow key={dep.id} dep={dep} />
                    ))}
                  </div>
                )}
              </div>
            </section>
          </div>

          {/* Right sidebar */}
          <div className="w-72 shrink-0 border-l border-border p-4 space-y-4 overflow-auto">
            {/* Quick Actions */}
            <div className="glass rounded-lg overflow-hidden">
              <div className="px-4 py-3 border-b border-border">
                <h3 className="text-sm font-semibold text-primary">Quick Actions</h3>
              </div>
              <div className="divide-y divide-border">
                <QuickAction icon={Plus}       label="Create Service"   desc="From pre-approved blueprints" to="/dashboard/services" />
                <QuickAction icon={Rocket}     label="Deploy Service"   desc="Pick a service and environment" to="/dashboard/services" />
                <QuickAction icon={KeyRound}   label="Manage Secrets"   desc="View and update service secrets" to="/dashboard/access" />
              </div>
            </div>

            {/* Pending Approvals */}
            {isPrivileged && pendingCount > 0 && (
              <div className="glass rounded-lg overflow-hidden">
                <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <AlertTriangle className="size-3.5 text-warning" />
                    Pending Approvals
                  </h3>
                  <span className="size-5 rounded-full bg-warning text-warning-foreground text-[10px] font-bold grid place-items-center">
                    {pendingCount}
                  </span>
                </div>
                {pendingLoading ? (
                  <div className="p-4 flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="size-3 animate-spin" /> Loading…
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {(pendingRequests ?? []).slice(0, 3).map((req) => (
                      <div key={req.id} className="px-4 py-3 space-y-2">
                        <div className="text-[10px] label-mono text-warning">RBAC ACCESS</div>
                        <div className="text-xs">
                          <span className="font-semibold">{req.first_name} {req.last_name}</span>
                          {" — "}
                          <span className="text-muted-foreground">{req.requested_role}</span>
                        </div>
                        {req.reason && (
                          <div className="text-[10px] text-muted-foreground italic">"{req.reason}"</div>
                        )}
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => void handleApproval(req.id, "approve")}
                            disabled={processingId === req.id}
                            className="flex-1 text-xs py-1 rounded bg-primary/10 text-primary hover:bg-primary/20 transition text-center disabled:opacity-50"
                          >
                            {processingId === req.id ? <Loader2 className="size-3 animate-spin mx-auto" /> : "Approve"}
                          </button>
                          <button
                            onClick={() => void handleApproval(req.id, "deny")}
                            disabled={processingId === req.id}
                            className="text-xs px-3 py-1 rounded text-muted-foreground hover:text-foreground transition disabled:opacity-50"
                          >
                            Deny
                          </button>
                        </div>
                      </div>
                    ))}
                    {(pendingRequests ?? []).length > 3 && (
                      <Link
                        to="/dashboard/access"
                        className="block px-4 py-2.5 text-xs text-center text-primary hover:bg-accent transition"
                      >
                        View all {pendingRequests?.length} requests →
                      </Link>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Platform summary */}
            <div className="glass rounded-lg overflow-hidden">
              <div className="px-4 py-3 border-b border-border">
                <h3 className="text-xs font-medium label-mono text-muted-foreground">PLATFORM SUMMARY</h3>
              </div>
              <div className="px-4 py-3 space-y-3">
                {[
                  { label: "Environments", value: environments.length },
                  { label: "Services in catalog", value: catalog.length },
                  { label: "Active deployments", value: activeDeployments.filter((d) => d.status === "running").length },
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-mono font-medium">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
