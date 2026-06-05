import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { hasSetupBeenVisited } from "@/lib/setup-visited";
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
  BarChart3,
  Users,
  Server,
  Globe,
  Layers,
  KeyRound,
  Clock,
  Database,
  Terminal,
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

function formatRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function formatRuntime(provider: string): string {
  if (!provider) return "—";
  const map: Record<string, string> = {
    kubernetes: "K8s",
    nomad: "Nomad",
    docker: "Docker",
  };
  return map[provider.toLowerCase()] ?? provider;
}

function statusBadge(status: string): { label: string; cls: string } {
  const s = status.toLowerCase();
  if (s === "running")
    return { label: "RUNNING", cls: "text-success bg-success/10 border-success/20" };
  if (s === "failed" || s === "dead")
    return { label: "FAILED", cls: "text-destructive bg-destructive/10 border-destructive/20" };
  if (s === "pending")
    return { label: "PENDING", cls: "text-warning bg-warning/10 border-warning/20" };
  if (s === "stopped")
    return { label: "STOPPED", cls: "text-muted-foreground bg-secondary border-border" };
  return { label: s.toUpperCase(), cls: "text-muted-foreground bg-secondary border-border" };
}

// ─── Dashboard root ────────────────────────────────────────────────────────────

function Dashboard() {
  const navigate = useNavigate();
  const { selectedWorkspace, setSelectedWorkspace } = useWorkspaceContext();
  const { selectedEnvironment } = useEnvironmentContext();

  const { data: workspaces, isLoading: workspacesLoading } = useWorkspacesMine();
  const hasWorkspace = (workspaces?.length ?? 0) > 0;

  useEffect(() => {
    if (workspaces?.length && !selectedWorkspace) {
      setSelectedWorkspace(workspaces[0]);
    }
  }, [workspaces, selectedWorkspace, setSelectedWorkspace]);

  const slug = workspaces?.[0]?.slug ?? "";

  const { data: me, isLoading: meLoading } = useMe();
  const { data: environments, isLoading: envsLoading } = useEnvironments(slug);
  const { data: catalog } = useCatalog();

  const envSlugs = useMemo(() => (environments ?? []).map((e) => e.slug), [environments]);
  const deploymentQueries = useAllServiceDeployments(slug, envSlugs);

  const firstEnvSlug = envSlugs[0] ?? "";
  const { data: firstEnvCaps, isLoading: capsLoading } = useCapabilities(slug, firstEnvSlug);
  const hasRuntime = firstEnvCaps
    ? firstEnvCaps.some((c) => c.capability_name === "runtime" && (c.providers ?? []).length > 0)
    : null;

  const isPrivileged = isAdminOrManager(me?.roles);

  const isLoading =
    meLoading || workspacesLoading || (!!slug && envsLoading) || (!!firstEnvSlug && capsLoading);

  const allDeployments = useMemo(
    () => (environments ?? []).flatMap((_, i) => deploymentQueries[i]?.data ?? []),
    [environments, deploymentQueries],
  );

  const hasDeployments = allDeployments.some(
    (d) => d.status === "running" || d.status === "pending",
  );

  useEffect(() => {
    if (isLoading || !isPrivileged) return;
    if (!hasWorkspace) {
      try {
        localStorage.removeItem("tc_setup_visited");
      } catch {
        /* ignore */
      }
      void navigate({ to: "/setup" });
      return;
    }
    if (hasRuntime === false && !hasSetupBeenVisited()) {
      void navigate({ to: "/setup" });
    }
  }, [isLoading, isPrivileged, hasWorkspace, hasRuntime, navigate]);

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
        {" — "}services cannot be deployed until a runtime is configured.{" "}
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

// ─── Scenario A: No environments ──────────────────────────────────────────────

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
            <h1 className="text-2xl font-bold tracking-tight">Welcome, {firstName}</h1>
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
              <div className="glass rounded-xl p-4 text-left space-y-2.5">
                {[
                  {
                    icon: Globe,
                    label: "Create an environment",
                    desc: "Where your services will run",
                  },
                  {
                    icon: Server,
                    label: "Connect a runtime",
                    desc: "Kubernetes, Nomad, Docker, or ECS",
                  },
                  {
                    icon: Layers,
                    label: "Deploy your first service",
                    desc: "From a ready-made template",
                  },
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

// ─── Scenario: Environments exist, nothing deployed yet ───────────────────────

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
    {
      id: "env",
      label: "Create an environment",
      done: environments.length > 0,
      link: "/dashboard/platform",
    },
    {
      id: "registry",
      label: "Connect a container registry",
      done: (registries ?? []).length > 0,
      link: "/dashboard/registries",
    },
    {
      id: "repo",
      label: "Connect a repository",
      done: (repoProviders ?? []).length > 0,
      link: "/dashboard/repositories",
    },
    {
      id: "service",
      label: "Deploy your first service",
      done: false,
      link: `/dashboard/environments/${environments[0]?.slug}/service-catalog`,
    },
    { id: "team", label: "Invite a team member", done: false, link: "/dashboard/teams" },
    {
      id: "secret",
      label: "Set up a secret",
      done: false,
      link: `/dashboard/environments/${environments[0]?.slug}/secrets`,
    },
  ];

  return (
    <>
      <DashboardTopbar />
      {!hasRuntime && <SetupWarningBanner isAdmin={isAdmin} />}
      <div className="flex flex-col h-full overflow-auto">
        <div className="px-6 pt-5 pb-4 border-b border-border">
          <h1 className="text-2xl font-bold tracking-tight">Good to go, {firstName}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Your platform is set up. Time to deploy your first service.
          </p>
        </div>
        <div className="flex flex-1 min-h-0">
          <div className="flex-1 p-6 space-y-6 overflow-auto">
            <section>
              <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Globe className="size-3.5 text-muted-foreground" /> Environments ready
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

            {catalog.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Layers className="size-3.5 text-muted-foreground" /> Available services
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {catalog.slice(0, 3).map((item) => (
                    <div key={item.id} className="glass rounded-xl p-4 space-y-2">
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
          <div className="w-72 shrink-0 border-l border-border p-4 space-y-4 overflow-auto">
            <GettingStartedChecklist items={checklistItems} />
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Scenario: Fully operational home ─────────────────────────────────────────

type RichDeployment = ServiceDeployment & { envName: string; envSlug: string };

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
  catalog: {
    id: string;
    name: string;
    display_name: string;
    description: string;
    default_cpu: number;
    default_memory: number;
  }[];
  deploymentQueries: ReturnType<typeof useAllServiceDeployments>;
  selectedEnvironment: { id: string; name: string; slug: string } | null;
  isPrivileged: boolean;
  hasRuntime: boolean;
}) {
  const { data: pendingRequests, isLoading: pendingLoading } = useAccessRequestsPending();
  const approve = useApproveAccessRequest();
  const deny = useDenyAccessRequest();
  const [processingId, setProcessingId] = useState<string | null>(null);

  const pendingCount = isPrivileged ? (pendingRequests?.length ?? 0) : 0;
  const firstName = me?.first_name ?? "Developer";
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  // All deployments enriched with env context
  const allDeployments = useMemo<RichDeployment[]>(
    () =>
      (environments ?? []).flatMap((env, i) =>
        (deploymentQueries[i]?.data ?? []).map((d) => ({
          ...d,
          envName: env.name,
          envSlug: env.slug,
        })),
      ),
    [environments, deploymentQueries],
  );

  // Scope to selected env when set
  const scopedDeployments = useMemo<RichDeployment[]>(() => {
    if (!selectedEnvironment) return allDeployments;
    return allDeployments.filter((d) => d.envSlug === selectedEnvironment.slug);
  }, [allDeployments, selectedEnvironment]);

  // Health counts
  const health = useMemo(() => {
    const running = scopedDeployments.filter((d) => d.status === "running").length;
    const failed = scopedDeployments.filter(
      (d) => d.status === "failed" || d.status === "dead",
    ).length;
    const pending = scopedDeployments.filter((d) => d.status === "pending").length;
    const healthy = catalog.filter((item) => {
      const deps = scopedDeployments.filter((d) => d.catalog_name === item.name);
      return deps.length > 0 && deps.every((d) => d.status === "running");
    }).length;
    return { running, failed, pending, healthy };
  }, [scopedDeployments, catalog]);

  // Recent activity — chronological, most recent first
  const recentActivity = useMemo<RichDeployment[]>(
    () =>
      [...scopedDeployments]
        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
        .slice(0, 6),
    [scopedDeployments],
  );

  // My deployments — failures first, then pending, then running
  const myDeployments = useMemo<RichDeployment[]>(() => {
    const priority = (s: string) =>
      s === "failed" || s === "dead" ? 0 : s === "pending" ? 1 : s === "running" ? 2 : 3;
    return [...scopedDeployments]
      .sort((a, b) => {
        const pp = priority(a.status) - priority(b.status);
        if (pp !== 0) return pp;
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      })
      .slice(0, 8);
  }, [scopedDeployments]);

  const currentEnv = selectedEnvironment ?? environments[0] ?? null;

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
        {/* ── Header: environment context + health summary ── */}
        <div className="px-6 pt-5 pb-4 border-b border-border shrink-0">
          {/* Row 1: env badge + greeting + shortcuts */}
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              {/* Environment context */}
              <div className="flex items-center gap-2 mb-2">
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20">
                  <Globe className="size-3 text-primary" />
                  <span className="text-xs font-semibold text-primary">
                    {currentEnv?.name ?? "All Environments"}
                  </span>
                </div>
                <Link
                  to="/dashboard/environments"
                  className="text-[11px] label-mono text-muted-foreground hover:text-primary transition"
                >
                  SWITCH →
                </Link>
              </div>
              {/* Greeting */}
              <h1 className="text-xl font-bold tracking-tight">
                {greeting}, {firstName}
              </h1>
              <p className="text-[11px] label-mono text-muted-foreground mt-0.5">{today}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0 pt-1">
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

          {/* Health summary — 4 stat chips */}
          <div className="grid grid-cols-4 gap-2">
            {[
              {
                count: health.running,
                label: "RUNNING",
                active: health.running > 0,
                activeCls: "bg-success/5 border-success/20",
                dotCls: "bg-success",
                textCls: "text-success",
              },
              {
                count: health.failed,
                label: "FAILED",
                active: health.failed > 0,
                activeCls: "bg-destructive/5 border-destructive/20",
                dotCls: "bg-destructive animate-pulse",
                textCls: "text-destructive",
              },
              {
                count: health.healthy,
                label: "HEALTHY SVCS",
                active: health.healthy > 0,
                activeCls: "bg-success/5 border-success/20",
                dotCls: "bg-success",
                textCls: "text-success",
              },
              {
                count: health.pending,
                label: "PENDING",
                active: health.pending > 0,
                activeCls: "bg-warning/5 border-warning/20",
                dotCls: "bg-warning animate-pulse",
                textCls: "text-warning",
              },
            ].map(({ count, label, active, activeCls, dotCls, textCls }) => (
              <div
                key={label}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg border transition ${
                  active ? activeCls : "bg-secondary/50 border-border"
                }`}
              >
                <span
                  className={`size-2.5 rounded-full shrink-0 ${active ? dotCls : "bg-muted-foreground/30"}`}
                />
                <div>
                  <div
                    className={`text-xl font-bold font-mono leading-none ${active ? textCls : "text-muted-foreground"}`}
                  >
                    {count}
                  </div>
                  <div className="text-[9px] label-mono text-muted-foreground mt-0.5">{label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Body: main content + sidebar ── */}
        <div className="flex flex-1 min-h-0 overflow-auto">
          {/* Main */}
          <div className="flex-1 min-w-0 p-6 space-y-6 overflow-auto">
            {/* ── Recent Activity ── */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-sm flex items-center gap-2">
                  <span className="size-1.5 rounded-full bg-primary inline-block" />
                  Recent Activity
                </h2>
                <Link
                  to="/dashboard/deployments"
                  className="text-xs text-muted-foreground hover:text-primary transition flex items-center gap-1"
                >
                  View all <ArrowRight className="size-3" />
                </Link>
              </div>

              <div className="glass rounded-lg divide-y divide-border">
                {recentActivity.length === 0 ? (
                  <div className="p-8 text-center">
                    <Clock className="size-7 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">No recent activity.</p>
                  </div>
                ) : (
                  recentActivity.map((item) => {
                    const isRunning = item.status === "running";
                    const isFailed = item.status === "failed" || item.status === "dead";
                    const isPending = item.status === "pending";
                    return (
                      <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                        <div
                          className={`size-7 rounded grid place-items-center shrink-0 ${
                            isRunning
                              ? "bg-success/10"
                              : isFailed
                                ? "bg-destructive/10"
                                : isPending
                                  ? "bg-warning/10"
                                  : "bg-secondary"
                          }`}
                        >
                          {isRunning ? (
                            <CheckCircle2 className="size-3.5 text-success" />
                          ) : isFailed ? (
                            <XCircle className="size-3.5 text-destructive" />
                          ) : isPending ? (
                            <Loader2 className="size-3.5 text-warning animate-spin" />
                          ) : (
                            <Rocket className="size-3.5 text-muted-foreground" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold font-mono">
                              {item.catalog_name}
                            </span>
                            <span className="text-muted-foreground text-xs">in</span>
                            <span className="text-xs font-medium text-primary">{item.envName}</span>
                          </div>
                          <div className="text-[11px] text-muted-foreground mt-0.5">
                            {isRunning
                              ? "Deployment completed successfully"
                              : isFailed
                                ? "Deployment failed"
                                : isPending
                                  ? "Deployment in progress"
                                  : `Status: ${item.status}`}
                            {" · "}
                            <span className="label-mono text-muted-foreground/60">
                              {formatRuntime(item.runtime_provider)}
                            </span>
                          </div>
                        </div>
                        <span className="text-[11px] text-muted-foreground shrink-0 tabular-nums">
                          {formatRelative(item.updated_at)}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </section>

            {/* ── My Deployments ── */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-sm flex items-center gap-2">
                  <span
                    className={`size-1.5 rounded-full inline-block ${
                      health.pending > 0 ? "bg-warning animate-pulse" : "bg-muted-foreground"
                    }`}
                  />
                  My Deployments
                  {myDeployments.length > 0 && (
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-secondary text-muted-foreground label-mono">
                      {myDeployments.length}
                    </span>
                  )}
                </h2>
                <Link
                  to="/dashboard/deployments"
                  className="text-xs text-muted-foreground hover:text-primary transition flex items-center gap-1"
                >
                  View all <ArrowRight className="size-3" />
                </Link>
              </div>

              <div className="glass rounded-lg overflow-hidden">
                {myDeployments.length === 0 ? (
                  <div className="p-8 text-center">
                    <Rocket className="size-7 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">No active deployments.</p>
                    {currentEnv && (
                      <Link
                        to="/dashboard/environments/$envId/service-catalog"
                        params={{ envId: currentEnv.slug }}
                        className="inline-flex items-center gap-1.5 mt-3 text-xs text-primary hover:underline"
                      >
                        <Plus className="size-3" /> Deploy a service
                      </Link>
                    )}
                  </div>
                ) : (
                  <>
                    {/* Table header */}
                    <div className="grid grid-cols-[1fr_76px_64px_80px_72px] gap-3 px-4 py-2 border-b border-border bg-secondary/30">
                      <span className="text-[10px] label-mono text-muted-foreground">SERVICE</span>
                      <span className="text-[10px] label-mono text-muted-foreground">STATUS</span>
                      <span className="text-[10px] label-mono text-muted-foreground">RUNTIME</span>
                      <span className="text-[10px] label-mono text-muted-foreground">
                        ENVIRONMENT
                      </span>
                      <span className="text-[10px] label-mono text-muted-foreground text-right">
                        UPDATED
                      </span>
                    </div>
                    {/* Table rows */}
                    {myDeployments.map((dep) => {
                      const { label, cls } = statusBadge(dep.status);
                      return (
                        <div
                          key={dep.id}
                          className="grid grid-cols-[1fr_76px_64px_80px_72px] gap-3 px-4 py-2.5 border-b border-border last:border-0 hover:bg-accent/40 transition-colors items-center"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="size-6 rounded bg-secondary grid place-items-center shrink-0">
                              <Layers className="size-3 text-muted-foreground" />
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs font-semibold font-mono truncate">
                                {dep.catalog_name}
                              </div>
                              {dep.image && (
                                <div className="text-[10px] text-muted-foreground font-mono truncate">
                                  {dep.image.includes(":") ? dep.image.split(":").pop() : dep.image}
                                </div>
                              )}
                            </div>
                          </div>
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.5 rounded border label-mono w-fit ${cls}`}
                          >
                            {label}
                          </span>
                          <span className="text-xs text-muted-foreground font-mono">
                            {formatRuntime(dep.runtime_provider)}
                          </span>
                          <span className="text-xs text-muted-foreground truncate">
                            {dep.envName}
                          </span>
                          <span className="text-[11px] text-muted-foreground text-right tabular-nums">
                            {formatRelative(dep.updated_at)}
                          </span>
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            </section>
          </div>

          {/* ── Sidebar ── */}
          <div className="w-72 shrink-0 border-l border-border p-4 space-y-4 overflow-auto">
            {/* Quick Actions */}
            <div className="glass rounded-lg overflow-hidden">
              <div className="px-4 py-3 border-b border-border">
                <h3 className="text-sm font-semibold">Quick Actions</h3>
              </div>
              <div className="divide-y divide-border">
                {[
                  {
                    icon: Rocket,
                    label: "Deploy Service",
                    desc: "Pick a service and environment",
                    to: currentEnv
                      ? `/dashboard/environments/${currentEnv.slug}/service-catalog`
                      : "/dashboard/services",
                  },
                  {
                    icon: Database,
                    label: "Create from Blueprint",
                    desc: "Databases, queues, pipelines",
                    to: currentEnv
                      ? `/dashboard/environments/${currentEnv.slug}/blueprints`
                      : "/dashboard/services",
                  },
                  {
                    icon: Terminal,
                    label: "View Logs",
                    desc: "Stream and search service logs",
                    to: "/dashboard/logs",
                  },
                  {
                    icon: KeyRound,
                    label: "Manage Secrets",
                    desc: "View and update service secrets",
                    to: currentEnv
                      ? `/dashboard/environments/${currentEnv.slug}/secrets`
                      : "/dashboard/access",
                  },
                ].map(({ icon: Icon, label, desc, to }) => (
                  <Link
                    key={label}
                    to={to as never}
                    className="flex items-start gap-3 px-4 py-3 hover:bg-accent transition-colors group"
                  >
                    <div className="size-8 rounded bg-secondary grid place-items-center shrink-0 mt-0.5 group-hover:bg-primary/10 transition-colors">
                      <Icon className="size-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                    <div>
                      <div className="text-sm font-medium">{label}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{desc}</div>
                    </div>
                  </Link>
                ))}
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
                          <span className="font-semibold">
                            {req.first_name} {req.last_name}
                          </span>
                          {" — "}
                          <span className="text-muted-foreground">{req.requested_role}</span>
                        </div>
                        {req.reason && (
                          <div className="text-[10px] text-muted-foreground italic">
                            "{req.reason}"
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => void handleApproval(req.id, "approve")}
                            disabled={processingId === req.id}
                            className="flex-1 text-xs py-1 rounded bg-primary/10 text-primary hover:bg-primary/20 transition text-center disabled:opacity-50"
                          >
                            {processingId === req.id ? (
                              <Loader2 className="size-3 animate-spin mx-auto" />
                            ) : (
                              "Approve"
                            )}
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

            {/* Platform overview */}
            <div className="glass rounded-lg overflow-hidden">
              <div className="px-4 py-3 border-b border-border">
                <h3 className="text-xs font-medium label-mono text-muted-foreground">PLATFORM</h3>
              </div>
              <div className="px-4 py-3 space-y-3">
                {[
                  { label: "Environments", value: environments.length },
                  { label: "Services in catalog", value: catalog.length },
                  { label: "Running", value: health.running },
                  { label: "Failed", value: health.failed, highlight: health.failed > 0 },
                ].map(({ label, value, highlight }) => (
                  <div key={label} className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{label}</span>
                    <span
                      className={`font-mono font-medium ${highlight ? "text-destructive" : ""}`}
                    >
                      {value}
                    </span>
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
