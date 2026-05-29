import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Users,
  Building2,
  KeyRound,
  Rocket,
  Shield,
  LogOut,
  Activity,
  Loader2,
  Globe,
  Layers,
  Settings2,
  UsersRound,
  ChevronDown,
  Check,
  ArrowLeft,
  ScrollText,
  LineChart,
  Zap,
  HardDrive,
  Network,
  Database,
  Server,
  InboxIcon,
  Clock,
  Container,
  Package,
  Blocks,
  GitFork,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { tokenTTLSeconds } from "@/lib/auth";
import {
  useAccessRequestsPending,
  useCapabilities,
  useLogout,
  useMe,
  useWorkspaces,
  useWorkspacesMine,
} from "@/lib/queries";
import { useWorkspaceContext } from "@/lib/workspace-context";
import type { Workspace } from "@/lib/types";

// ─── Route helpers ────────────────────────────────────────────────────────────

function isAdminOrManager(roles: { role?: { name?: string } }[] | undefined): boolean {
  return (
    roles?.some((ur) => {
      const n = (ur.role?.name ?? "").toLowerCase();
      return n === "admin" || n === "manager";
    }) ?? false
  );
}

function getActiveEnvId(path: string): string | null {
  const m = path.match(/^\/dashboard\/environments\/([^/]+)/);
  const envId = m?.[1];
  return envId ? envId : null;
}

function formatEnvName(slug: string): string {
  return slug.charAt(0).toUpperCase() + slug.slice(1).replace(/-/g, " ");
}

// ─── Workspace switcher ───────────────────────────────────────────────────────

function WorkspaceSwitcher({
  name,
  slug,
  workspaces,
  canSwitch,
  onSelect,
}: {
  name: string;
  slug?: string;
  workspaces?: Workspace[];
  canSwitch: boolean;
  onSelect: (ws: Workspace) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} className="relative px-2 py-2">
      <button
        onClick={() => canSwitch && setOpen((v) => !v)}
        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition ${
          canSwitch ? "hover:bg-sidebar-accent/60 cursor-pointer" : "cursor-default"
        }`}
      >
        <div className="size-8 rounded-md bg-[image:var(--gradient-primary)] grid place-items-center shrink-0">
          <Building2 className="size-4 text-primary-foreground" />
        </div>
        <div className="flex-1 min-w-0 text-left">
          <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide leading-none mb-0.5">
            Workspace
          </div>
          <div className="font-semibold text-sm truncate leading-tight">{name}</div>
          {slug && (
            <div className="text-[10px] text-muted-foreground font-mono truncate leading-tight mt-0.5">
              {slug}
            </div>
          )}
        </div>
        {canSwitch && (
          <ChevronDown
            className={`size-3.5 text-muted-foreground shrink-0 transition-transform ${
              open ? "rotate-180" : ""
            }`}
          />
        )}
      </button>

      {open && canSwitch && workspaces && workspaces.length > 0 && (
        <div className="absolute left-2 right-2 top-full mt-1 z-50 rounded-lg border border-sidebar-border bg-sidebar shadow-lg overflow-hidden">
          <div className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
            Switch workspace
          </div>
          {workspaces.map((ws) => (
            <button
              key={ws.id}
              onClick={() => {
                onSelect(ws);
                setOpen(false);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm hover:bg-sidebar-accent/60 transition"
            >
              <div className="size-6 rounded-md bg-accent grid place-items-center shrink-0">
                <Building2 className="size-3 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0 text-left">
                <div className="font-medium truncate">{ws.name}</div>
                <div className="text-[10px] text-muted-foreground font-mono">{ws.slug}</div>
              </div>
              {ws.slug === slug && <Check className="size-3.5 text-primary shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Nav link ─────────────────────────────────────────────────────────────────

function NavLink({
  to,
  label,
  icon: Icon,
  active,
  badge,
}: {
  to: string;
  label: string;
  icon: React.ElementType;
  active: boolean;
  badge?: string;
}) {
  return (
    <Link
      to={to as never}
      className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition ${
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground border-l-2 border-primary"
          : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
      }`}
    >
      <Icon className="size-4 shrink-0" />
      <span className="flex-1">{label}</span>
      {badge && (
        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-secondary text-muted-foreground border border-border">
          {badge}
        </span>
      )}
    </Link>
  );
}

// ─── Nav section header ───────────────────────────────────────────────────────

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="px-3 mb-1 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
      {label}
    </div>
  );
}

// ─── Workspace nav ────────────────────────────────────────────────────────────

const WORKSPACE_NAV = [
  { to: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { to: "/dashboard/environments", label: "Environments", icon: Globe },
  { to: "/dashboard/registries", label: "Registries", icon: Container },
  { to: "/dashboard/repositories", label: "Repositories", icon: GitFork },
  { to: "/dashboard/teams", label: "Teams", icon: UsersRound },
  // { to: "/dashboard/policies", label: "Policies", icon: Shield },
  // { to: "/dashboard/settings", label: "Settings", icon: Settings2 },
] as const;

const ADMIN_NAV = [
  { to: "/dashboard/workspaces", label: "All Workspaces", icon: Building2 },
  { to: "/dashboard/departments", label: "All Departments", icon: Layers },
  { to: "/dashboard/users", label: "Members", icon: Users },
  { to: "/dashboard/roles", label: "Roles & Permissions", icon: KeyRound },
  { to: "/dashboard/access-requests", label: "Access Requests", icon: InboxIcon },
] as const;

// ─── Provider badge lookup ────────────────────────────────────────────────────

const PROVIDER_DISPLAY: Record<string, string> = {
  nomad: "Nomad",
  kubernetes: "K8s",
  docker: "Docker",
  vault: "Vault",
  consul: "Consul",
  prometheus: "Prometheus",
  minio: "MinIO",
  loki: "Loki",
  opensearch: "OpenSearch",
  elasticsearch: "Elasticsearch",
};

// ─── Sidebar ─────────────────────────────────────────────────────────────────

export function DashboardSidebar() {
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [hydrated, setHydrated] = useState(false);
  const { selectedWorkspace, setSelectedWorkspace, isHydrated } = useWorkspaceContext();

  useEffect(() => {
    setHydrated(true);
  }, []);

  const { data: me } = useMe();
  const logout = useLogout();
  const privileged = isAdminOrManager(me?.roles);

  const { data: pendingRequests } = useAccessRequestsPending();
  const pendingCount = privileged ? (pendingRequests?.length ?? 0) : 0;

  const { data: myWorkspaces } = useWorkspacesMine();
  const { data: allWorkspaces } = useWorkspaces();

  // Privileged users see all workspaces in the switcher; others see only their own.
  const availableWorkspaces = useMemo(
    () => (privileged ? (allWorkspaces ?? myWorkspaces) : myWorkspaces),
    [privileged, allWorkspaces, myWorkspaces],
  );

  useEffect(() => {
    if (!selectedWorkspace || !availableWorkspaces) return;
    const still = availableWorkspaces.some((w) => w.id === selectedWorkspace.id);
    if (!still) setSelectedWorkspace(null);
  }, [selectedWorkspace, availableWorkspaces, setSelectedWorkspace]);

  useEffect(() => {
    if (isHydrated && !selectedWorkspace && availableWorkspaces && availableWorkspaces.length > 0) {
      setSelectedWorkspace(availableWorkspaces[0]);
    }
  }, [isHydrated, selectedWorkspace, availableWorkspaces, setSelectedWorkspace]);

  const activeWorkspace = selectedWorkspace ?? availableWorkspaces?.[0] ?? null;
  const workspaceName = activeWorkspace?.name ?? "Workspace";
  const workspaceSlug = activeWorkspace?.slug;

  const activeEnvId = getActiveEnvId(path);
  const isEnvMode = activeEnvId !== null;

  // Capability data for provider badges
  const { data: capabilities } = useCapabilities(workspaceSlug ?? "", activeEnvId ?? "");

  const capMap = Object.fromEntries((capabilities ?? []).map((c) => [c.capability_name, c]));
  const runtimeProviders = capMap["runtime"]?.providers ?? [];
  const hasK8s = runtimeProviders.some((p) => p.provider_name === "kubernetes");
  const hasDocker = runtimeProviders.some((p) => p.provider_name === "docker");
  const hasNomadOrK8s = runtimeProviders.some(
    (p) => p.provider_name === "nomad" || p.provider_name === "kubernetes",
  );

  const handleLogout = async () => {
    await logout.mutateAsync();
    void navigate({ to: "/login" });
  };

  const displayName = me ? `${me.first_name} ${me.last_name}` : me === undefined ? "…" : "User";
  const subLabel = me?.roles?.[0]?.role?.name ?? me?.email ?? "";
  const initials = me ? `${me.first_name.charAt(0)}${me.last_name.charAt(0)}`.toUpperCase() : "U";
  const ttl = hydrated ? tokenTTLSeconds() : 0;
  const ttlLabel =
    ttl > 3600 ? `${Math.floor(ttl / 3600)}h` : ttl > 60 ? `${Math.floor(ttl / 60)}m` : `${ttl}s`;

  const wsActive = (to: string) =>
    to === "/dashboard" ? path === to : path === to || path.startsWith(to + "/");

  const envActive = (suffix: string) => {
    if (!activeEnvId) return false;
    const base = `/dashboard/environments/${activeEnvId}`;
    return suffix === ""
      ? path === base
      : path === `${base}/${suffix}` || path.startsWith(`${base}/${suffix}/`);
  };

  const providerBadge = (capName: string) => {
    const cap = capMap[capName];
    const count = cap?.providers?.length ?? 0;
    if (count === 0) return undefined;
    if (count === 1) {
      const p = cap.providers[0];
      return PROVIDER_DISPLAY[p.provider_name] ?? p.provider_name;
    }
    return `${count} providers`;
  };

  return (
    <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      {/* App header */}
      <div className="h-14 flex items-center gap-2 px-4 border-b border-sidebar-border">
        <div className="size-7 rounded-md bg-[image:var(--gradient-primary)] grid place-items-center">
          <Shield className="size-3.5 text-primary-foreground" />
        </div>
        <div className="font-semibold tracking-tight text-sm">
          Ternak<span className="text-primary">Clouds</span>
        </div>
      </div>

      {/* Workspace switcher */}
      <div className="border-b border-sidebar-border">
        <WorkspaceSwitcher
          name={workspaceName}
          slug={workspaceSlug}
          workspaces={availableWorkspaces}
          canSwitch={privileged || (availableWorkspaces?.length ?? 0) > 1}
          onSelect={setSelectedWorkspace}
        />
      </div>

      {/* Environment context bar */}
      {isEnvMode && activeEnvId && (
        <div className="border-b border-sidebar-border px-4 py-2">
          <Link
            to="/dashboard/environments"
            className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition mb-1.5"
          >
            <ArrowLeft className="size-3" /> Environments
          </Link>
          <div className="flex items-center gap-2">
            <div className="size-5 rounded bg-primary/20 grid place-items-center">
              <Globe className="size-3 text-primary" />
            </div>
            <span className="font-semibold text-sm">{formatEnvName(activeEnvId)}</span>
          </div>
        </div>
      )}

      {/* Nav */}
      <div className="px-2 py-3 flex-1 overflow-y-auto space-y-4">
        {isEnvMode && activeEnvId ? (
          /* ── Environment nav (capability-grouped) ── */
          <>
            {/* Overview */}
            <div>
              <nav className="flex flex-col gap-0.5">
                <NavLink
                  to={`/dashboard/environments/${activeEnvId}`}
                  label="Overview"
                  icon={LayoutDashboard}
                  active={envActive("")}
                />
              </nav>
            </div>

            {/* Applications */}
            <div>
              <SectionHeader label="Applications" />
              <nav className="flex flex-col gap-0.5">
                <NavLink
                  to={`/dashboard/environments/${activeEnvId}/applications`}
                  label="Applications"
                  icon={Layers}
                  active={envActive("applications")}
                />
                <NavLink
                  to={`/dashboard/environments/${activeEnvId}/blueprints`}
                  label="Blueprints"
                  icon={Blocks}
                  active={envActive("blueprints")}
                />
                {hasNomadOrK8s && (
                  <>
                    <NavLink
                      to={`/dashboard/environments/${activeEnvId}/services`}
                      label="Services"
                      icon={Layers}
                      active={envActive("services")}
                    />
                    <NavLink
                      to={`/dashboard/environments/${activeEnvId}/deployments`}
                      label="Deployments"
                      icon={Rocket}
                      active={envActive("deployments")}
                    />
                    {hasK8s && (
                      <NavLink
                        to={`/dashboard/environments/${activeEnvId}/pods`}
                        label="Pods"
                        icon={Server}
                        active={envActive("pods")}
                        badge="K8s"
                      />
                    )}
                  </>
                )}
                {hasDocker && (
                  <NavLink
                    to={`/dashboard/environments/${activeEnvId}/containers`}
                    label="Containers"
                    icon={Container}
                    active={envActive("containers")}
                    badge="Docker"
                  />
                )}
                <NavLink
                  to={`/dashboard/environments/${activeEnvId}/service-catalog`}
                  label="Service Catalog"
                  icon={Package}
                  active={envActive("service-catalog")}
                />
              </nav>
            </div>

            {/* Platform */}
            <div>
              <SectionHeader label="Platform" />
              <nav className="flex flex-col gap-0.5">
                <NavLink
                  to={`/dashboard/environments/${activeEnvId}/platform/runtime`}
                  label="Runtime"
                  icon={Server}
                  active={envActive("platform/runtime")}
                  badge={providerBadge("runtime")}
                />
                <NavLink
                  to={`/dashboard/environments/${activeEnvId}/platform/secrets`}
                  label="Secrets"
                  icon={KeyRound}
                  active={envActive("platform/secrets")}
                  badge={providerBadge("secrets")}
                />
                <NavLink
                  to={`/dashboard/environments/${activeEnvId}/platform/logs`}
                  label="Logs Backend"
                  icon={ScrollText}
                  active={envActive("platform/logs")}
                  badge={providerBadge("logs")}
                />
                {/* <NavLink
                  to={`/dashboard/environments/${activeEnvId}/platform/networking`}
                  label="Networking"
                  icon={Network}
                  active={envActive("platform/networking")}
                  badge={providerBadge("networking")}
                /> */}
                {/* <NavLink
                  to={`/dashboard/environments/${activeEnvId}/platform/storage`}
                  label="Storage"
                  icon={Database}
                  active={envActive("platform/storage")}
                  badge={providerBadge("storage")}
                /> */}
                <NavLink
                  to={`/dashboard/environments/${activeEnvId}/registries`}
                  label="Registries"
                  icon={Container}
                  active={envActive("registries")}
                />
              </nav>
            </div>

            {/* Observability */}
            <div>
              <SectionHeader label="Observability" />
              <nav className="flex flex-col gap-0.5">
                {/* <NavLink
                  to={`/dashboard/environments/${activeEnvId}/metrics`}
                  label="Metrics"
                  icon={LineChart}
                  active={envActive("metrics")}
                  badge={providerBadge("observability")}
                /> */}
                <NavLink
                  to={`/dashboard/environments/${activeEnvId}/logs`}
                  label="Logs"
                  icon={ScrollText}
                  active={envActive("logs")}
                />
              </nav>
            </div>

            {/* Access */}
            <div>
              <SectionHeader label="Access" />
              <nav className="flex flex-col gap-0.5">
                <NavLink
                  to={`/dashboard/environments/${activeEnvId}/secrets`}
                  label="Secret Access"
                  icon={HardDrive}
                  active={envActive("secrets")}
                />
                {/* <NavLink
                  to={`/dashboard/environments/${activeEnvId}/policies`}
                  label="Policies"
                  icon={Shield}
                  active={envActive("policies")}
                /> */}
              </nav>
            </div>

            {/* Settings */}
            <div>
              {/* <nav className="flex flex-col gap-0.5">
                <NavLink
                  to={`/dashboard/environments/${activeEnvId}/settings`}
                  label="Settings"
                  icon={Settings2}
                  active={envActive("settings")}
                />
              </nav> */}
            </div>
          </>
        ) : (
          /* ── Workspace nav ── */
          <>
            <div>
              <SectionHeader label="Workspace" />
              <nav className="flex flex-col gap-0.5">
                {WORKSPACE_NAV.map(({ to, label, icon }) => (
                  <NavLink key={to} to={to} label={label} icon={icon} active={wsActive(to)} />
                ))}
              </nav>
            </div>

            {privileged && (
              <div>
                <SectionHeader label="Admin" />
                <nav className="flex flex-col gap-0.5">
                  {ADMIN_NAV.map(({ to, label, icon }) => (
                    <NavLink
                      key={to}
                      to={to}
                      label={label}
                      icon={icon}
                      active={wsActive(to)}
                      badge={
                        to === "/dashboard/access-requests" && pendingCount > 0
                          ? String(pendingCount)
                          : undefined
                      }
                    />
                  ))}
                </nav>
              </div>
            )}

            {!privileged && (
              <div>
                <SectionHeader label="Access" />
                <nav className="flex flex-col gap-0.5">
                  <NavLink
                    to="/dashboard/no-access"
                    label="Request Access"
                    icon={Clock}
                    active={wsActive("/dashboard/no-access")}
                  />
                </nav>
              </div>
            )}
          </>
        )}

        {/* Session */}
        <div>
          <div className="px-3 mb-1 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
            Session
          </div>
          <div className="px-3 py-2.5 rounded-md bg-sidebar-accent/50 text-xs space-y-1">
            <div className="flex items-center gap-2 text-success">
              <Activity className="size-3.5" />
              <span className="font-medium">All systems operational</span>
            </div>
            <div className="text-muted-foreground font-mono">
              JWT expires in {hydrated ? ttlLabel : "--"}
            </div>
          </div>
        </div>
      </div>

      {/* User footer */}
      <div className="border-t border-sidebar-border p-3">
        <Link
          to="/dashboard/profile"
          className="flex items-center gap-3 px-2 py-2 rounded-md hover:bg-sidebar-accent/60 transition group"
        >
          <div className="size-8 rounded-full bg-accent grid place-items-center text-xs font-semibold shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate group-hover:text-foreground">
              {displayName}
            </div>
            <div className="text-[11px] text-muted-foreground truncate font-mono">
              {subLabel || "No role assigned"}
            </div>
          </div>
          <button
            onClick={(e) => {
              e.preventDefault();
              void handleLogout();
            }}
            disabled={logout.isPending}
            className="p-1.5 rounded hover:bg-sidebar-accent disabled:opacity-50 transition shrink-0"
            title="Sign out"
          >
            {logout.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <LogOut className="size-4" />
            )}
          </button>
        </Link>
      </div>
    </aside>
  );
}
