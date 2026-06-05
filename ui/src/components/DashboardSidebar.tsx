import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Rocket,
  ScrollText,
  KeyRound,
  Package,
  Server,
  Settings2,
  ShieldCheck,
  ChevronDown,
  Globe,
  Plus,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useAccessRequestsPending, useMe, useEnvironments } from "@/lib/queries";
import { useEnvironmentContext } from "@/lib/environment-context";
import { useWorkspaceContext } from "@/lib/workspace-context";

// ─── Role helpers ─────────────────────────────────────────────────────────────

function isAdminOrManager(roles: { role?: { name?: string } }[] | undefined): boolean {
  return (
    roles?.some((ur) => {
      const n = (ur.role?.name ?? "").toLowerCase();
      return n === "admin" || n === "manager";
    }) ?? false
  );
}

function isPlatformEngineer(roles: { role?: { name?: string } }[] | undefined): boolean {
  return (
    roles?.some((ur) => {
      const n = (ur.role?.name ?? "").toLowerCase();
      return n === "admin" || n === "platform_engineer" || n === "manager";
    }) ?? false
  );
}

// ─── Environment switcher ─────────────────────────────────────────────────────

function EnvSwitcher() {
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { selectedWorkspace } = useWorkspaceContext();
  const { selectedEnvironment, setSelectedEnvironment } = useEnvironmentContext();
  const { data: environments } = useEnvironments(selectedWorkspace?.slug ?? "");
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

  if (!environments || environments.length === 0) return null;

  return (
    <div ref={ref} className="relative px-3">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-sidebar-border bg-sidebar-accent/40 text-sm hover:bg-sidebar-accent transition-colors"
      >
        <Globe className="size-3.5 text-primary shrink-0" />
        <span className="flex-1 text-left truncate font-medium leading-tight">
          {selectedEnvironment?.name ?? "All Environments"}
        </span>
        <ChevronDown
          className={`size-3.5 text-sidebar-foreground/50 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute left-3 right-3 top-full mt-1.5 z-50 rounded-lg border border-border bg-popover shadow-lg overflow-hidden py-1">
          <button
            onClick={() => {
              setSelectedEnvironment(null);
              setOpen(false);
              if (path.startsWith("/dashboard/environments/")) {
                navigate({ to: "/dashboard/environments" as never });
              }
            }}
            className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-sm transition-colors hover:bg-accent ${
              !selectedEnvironment ? "text-primary font-medium" : "text-muted-foreground"
            }`}
          >
            <span
              className={`size-1.5 rounded-full shrink-0 ${!selectedEnvironment ? "bg-primary" : "bg-muted-foreground/30"}`}
            />
            All Environments
          </button>
          {environments.map((env) => (
            <button
              key={env.id}
              onClick={() => {
                setSelectedEnvironment(env);
                setOpen(false);
                if (path.startsWith("/dashboard/environments/")) {
                  const match = path.match(/^\/dashboard\/environments\/[^/]+(\/.*)?$/);
                  const suffix = match?.[1] ?? "";
                  navigate({ to: `/dashboard/environments/${env.slug}${suffix}` as never });
                } else if (
                  path === "/dashboard/environments" ||
                  path === "/dashboard/environments/"
                ) {
                  navigate({ to: `/dashboard/environments/${env.slug}` as never });
                }
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-sm transition-colors hover:bg-accent ${
                selectedEnvironment?.id === env.id
                  ? "text-primary font-medium"
                  : "text-muted-foreground"
              }`}
            >
              <span
                className={`size-1.5 rounded-full shrink-0 ${
                  selectedEnvironment?.id === env.id ? "bg-primary" : "bg-muted-foreground/30"
                }`}
              />
              {env.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Nav item ─────────────────────────────────────────────────────────────────

function NavItem({
  to,
  icon: Icon,
  label,
  active,
  badge,
}: {
  to: string;
  icon: React.ElementType;
  label: string;
  active: boolean;
  badge?: number;
}) {
  return (
    <Link
      to={to as never}
      className={`relative flex items-center gap-2.5 px-3 py-2 mx-3 rounded-lg text-sm transition-colors ${
        active
          ? "bg-sidebar-accent text-primary font-medium"
          : "text-sidebar-foreground/65 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
      }`}
    >
      {active && (
        <span className="absolute left-0 top-2 bottom-2 w-0.5 bg-primary rounded-r-full" />
      )}
      <Icon className="size-4 shrink-0" strokeWidth={active ? 2.2 : 1.8} />
      <span className="flex-1 truncate">{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className="size-4 rounded-full bg-warning text-[9px] font-bold text-warning-foreground flex items-center justify-center shrink-0">
          {badge > 9 ? "9+" : badge}
        </span>
      )}
    </Link>
  );
}

// ─── Nav section ──────────────────────────────────────────────────────────────

function NavSection({ label, children }: { label?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      {label && (
        <div className="px-6 mb-1">
          <span className="text-[10px] font-semibold label-mono text-sidebar-foreground/40 tracking-widest">
            {label}
          </span>
        </div>
      )}
      {children}
    </div>
  );
}

// ─── Sidebar ─────────────────────────────────────────────────────────────────

export function DashboardSidebar() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { selectedEnvironment } = useEnvironmentContext();

  const { data: me } = useMe();
  const privileged = isAdminOrManager(me?.roles);
  const isPlatformEng = isPlatformEngineer(me?.roles);

  const { data: pendingRequests } = useAccessRequestsPending();
  const pendingCount = privileged ? (pendingRequests?.length ?? 0) : 0;

  const envSlug = selectedEnvironment?.slug;
  const envBase = envSlug ? `/dashboard/environments/${envSlug}` : null;

  const active = (to: string) =>
    to === "/dashboard" ? path === to : path === to || path.startsWith(to + "/");

  // Environment-scoped nav targets
  const deploymentsTo = envBase ? `${envBase}/deployments` : "/dashboard/deployments";
  const deploymentsActive = active(envBase ? `${envBase}/deployments` : "/dashboard/deployments");

  const secretsTo = envBase ? `${envBase}/secrets` : "/dashboard/environments";
  const secretsActive = envBase ? active(`${envBase}/secrets`) : active("/dashboard/environments");

  // Overview: env home but not any sub-path (deployments, secrets, etc.)
  const overviewTo = envBase ?? "/dashboard/environments";
  const overviewActive = envBase
    ? path === envBase || path === `${envBase}/`
    : active("/dashboard/environments");

  // Deploy CTA destination
  const deployTo = (envBase ? `${envBase}/service-catalog` : "/dashboard/services") as never;

  return (
    <aside className="hidden md:flex w-52 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
      {/* ── Logo header ── */}
      <div className="h-12 shrink-0 flex items-center px-4 border-b border-sidebar-border">
        <Link to="/dashboard" className="flex items-center gap-2 min-w-0">
          <div className="size-6 rounded bg-[image:var(--gradient-primary)] grid place-items-center shrink-0">
            <svg viewBox="0 0 16 16" className="size-3.5 text-white fill-current">
              <path d="M8 2C5.8 2 4 3.8 4 6c0 .4.1.8.2 1.1C2.9 7.5 2 8.6 2 10c0 1.7 1.3 3 3 3h7c1.7 0 3-1.3 3-3 0-1.4-.9-2.5-2.2-2.9C12.9 6.8 13 6.4 13 6c0-2.2-1.8-4-4-4zm0 1.5c1.4 0 2.5 1.1 2.5 2.5 0 .3-.1.6-.2.8l-.3.7.7.2c.9.3 1.5 1.1 1.5 2C12.2 10.9 11.3 11.5 10.2 11.5H5C4.1 11.5 3.5 10.8 3.5 10c0-.8.5-1.6 1.3-1.8l.8-.2-.3-.8C5.1 6.9 5 6.5 5 6c0-1.4 1.1-2.5 3-2.5z" />
            </svg>
          </div>
          <span className="font-semibold text-sm tracking-tight truncate">
            Ternak<span className="text-primary">Clouds</span>
          </span>
        </Link>
      </div>

      {/* ── Scrollable nav body ── */}
      <div className="flex-1 overflow-y-auto py-4 flex flex-col gap-5">
        {/* Environment switcher */}
        <EnvSwitcher />

        {/* Home */}
        <NavSection>
          <NavItem
            to="/dashboard"
            icon={LayoutDashboard}
            label="Home"
            active={path === "/dashboard"}
          />
        </NavSection>

        {/* Environment-scoped */}
        <NavSection label="ENVIRONMENT">
          <NavItem to={overviewTo} icon={Globe} label="Overview" active={overviewActive} />
          <NavItem
            to={deploymentsTo}
            icon={Rocket}
            label="Deployments"
            active={deploymentsActive}
          />
          {/* <NavItem
            to="/dashboard/logs"
            icon={ScrollText}
            label="Logs"
            active={active("/dashboard/logs")}
          /> */}
          <NavItem to={secretsTo} icon={KeyRound} label="Secrets" active={secretsActive} />
        </NavSection>

        {/* Catalog */}
        <NavSection label="CATALOG">
          <NavItem
            to="/dashboard/services"
            icon={Package}
            label="Catalog"
            active={active("/dashboard/services")}
          />
        </NavSection>

        {/* Platform — platform engineers + admins only */}
        {isPlatformEng && (
          <NavSection label="PLATFORM">
            <NavItem
              to="/dashboard/platform"
              icon={Server}
              label="Runtimes"
              active={active("/dashboard/platform")}
            />
            {privileged && (
              <NavItem
                to="/dashboard/access"
                icon={ShieldCheck}
                label="Access"
                active={active("/dashboard/access")}
                badge={pendingCount}
              />
            )}
            {privileged && (
              <NavItem
                to="/dashboard/settings"
                icon={Settings2}
                label="Settings"
                active={active("/dashboard/settings")}
              />
            )}
          </NavSection>
        )}
      </div>

      {/* ── Deploy CTA ──
      <div className="shrink-0 px-3 py-4 border-t border-sidebar-border">
        <Link
          to={deployTo}
          className="flex items-center justify-center gap-2 w-full py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm font-medium"
        >
          <Plus className="size-3.5" strokeWidth={2.5} />
          Deploy Service
        </Link>
      </div> */}
    </aside>
  );
}
