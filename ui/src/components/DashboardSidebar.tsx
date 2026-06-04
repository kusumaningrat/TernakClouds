import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Layers,
  Users,
  BarChart3,
  Server,
  Settings2,
  Plus,
  ShieldCheck,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useAccessRequestsPending, useMe } from "@/lib/queries";

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
  const [hovered, setHovered] = useState(false);

  return (
    <div className="relative" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <Link
        to={to as never}
        className={`relative flex items-center justify-center w-10 h-10 rounded-lg transition-colors ${
          active
            ? "bg-sidebar-accent text-primary"
            : "text-sidebar-foreground/60 hover:bg-sidebar-accent/80 hover:text-sidebar-foreground"
        }`}
      >
        {active && (
          <span className="absolute left-0 top-2 bottom-2 w-0.5 bg-primary rounded-r-full" />
        )}
        <Icon className="size-4.5" strokeWidth={active ? 2.2 : 1.8} />
        {badge !== undefined && badge > 0 && (
          <span className="absolute -top-0.5 -right-0.5 size-4 rounded-full bg-warning text-[9px] font-bold text-warning-foreground flex items-center justify-center">
            {badge > 9 ? "9+" : badge}
          </span>
        )}
      </Link>

      {hovered && (
        <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 z-50 pointer-events-none">
          <div className="bg-popover border border-border text-foreground text-xs font-medium px-2.5 py-1 rounded shadow-lg whitespace-nowrap">
            {label}
            <span className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-border" />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Navigation config ────────────────────────────────────────────────────────

// Developer nav — what every user sees
const DEV_NAV = [
  { to: "/dashboard",          label: "Home",     icon: LayoutDashboard },
  { to: "/dashboard/services", label: "Services", icon: Layers },
  { to: "/dashboard/teams",    label: "Teams",    icon: Users },
  { to: "/dashboard/insights", label: "Insights", icon: BarChart3 },
] as const;

// ─── Sidebar ─────────────────────────────────────────────────────────────────

export function DashboardSidebar() {
  const path = useRouterState({ select: (s) => s.location.pathname });

  const { data: me } = useMe();
  const privileged    = isAdminOrManager(me?.roles);
  const isPlatformEng = isPlatformEngineer(me?.roles);

  const { data: pendingRequests } = useAccessRequestsPending();
  const pendingCount = privileged ? (pendingRequests?.length ?? 0) : 0;

  const active = (to: string) =>
    to === "/dashboard" ? path === to : path === to || path.startsWith(to + "/");

  return (
    <aside className="hidden md:flex w-16 shrink-0 flex-col items-center border-r border-sidebar-border bg-sidebar py-3 gap-1">
      {/* Primary navigation — developer-facing */}
      <nav className="flex flex-col items-center gap-1 flex-1">
        {DEV_NAV.map(({ to, label, icon }) => (
          <NavItem
            key={to}
            to={to}
            icon={icon}
            label={label}
            active={active(to)}
          />
        ))}

        {/* Platform separator — platform engineers + admins only */}
        {isPlatformEng && (
          <>
            <div className="h-px w-8 bg-sidebar-border my-2" />
            <NavItem
              to="/dashboard/platform"
              icon={Server}
              label="Platform"
              active={active("/dashboard/platform")}
            />
          </>
        )}

        {/* Access badge — admins see pending request count */}
        {privileged && (
          <NavItem
            to="/dashboard/access"
            icon={ShieldCheck}
            label="Access"
            active={active("/dashboard/access")}
            badge={pendingCount}
          />
        )}

        {/* Settings — always last */}
        {privileged && (
          <NavItem
            to="/dashboard/settings"
            icon={Settings2}
            label="Settings"
            active={active("/dashboard/settings")}
          />
        )}
      </nav>

      {/* FAB — create new service */}
      <div className="relative group">
        <Link
          to="/dashboard/services"
          className="flex items-center justify-center w-9 h-9 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition shadow-md"
        >
          <Plus className="size-4" strokeWidth={2.5} />
        </Link>
        <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="bg-popover border border-border text-foreground text-xs font-medium px-2.5 py-1 rounded shadow-lg whitespace-nowrap">
            New service
            <span className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-border" />
          </div>
        </div>
      </div>
    </aside>
  );
}
