import { Search, Bell, HelpCircle, ChevronDown, Check, Globe, LogOut, User } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useWorkspaceContext } from "@/lib/workspace-context";
import { useEnvironmentContext } from "@/lib/environment-context";
import { useEnvironments, useMe, useLogout } from "@/lib/queries";
import { useNavigate } from "@tanstack/react-router";
import type { WorkspaceEnvironment } from "@/lib/types";

// ─── Environment tabs ─────────────────────────────────────────────────────────

function EnvTabs() {
  const { selectedWorkspace } = useWorkspaceContext();
  const { selectedEnvironment, setSelectedEnvironment } = useEnvironmentContext();
  const { data: environments } = useEnvironments(selectedWorkspace?.slug ?? "");

  if (!environments || environments.length === 0) return null;

  return (
    <div className="flex items-center gap-px">
      {/* "All" option */}
      <button
        onClick={() => setSelectedEnvironment(null)}
        className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
          !selectedEnvironment
            ? "text-foreground bg-accent"
            : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
        }`}
      >
        All
      </button>
      {environments.map((env) => (
        <button
          key={env.id}
          onClick={() => setSelectedEnvironment(env)}
          className={`relative px-3 py-1 text-xs font-medium rounded transition-colors ${
            selectedEnvironment?.id === env.id
              ? "text-primary"
              : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
          }`}
        >
          {env.name}
          {selectedEnvironment?.id === env.id && (
            <span className="absolute bottom-0 left-2 right-2 h-px bg-primary rounded-full" />
          )}
        </button>
      ))}
    </div>
  );
}

// ─── User menu ────────────────────────────────────────────────────────────────

function UserMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { data: me } = useMe();
  const logout = useLogout();
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const initials = me
    ? `${me.first_name.charAt(0)}${me.last_name.charAt(0)}`.toUpperCase()
    : "?";
  const displayName = me ? `${me.first_name} ${me.last_name}` : "User";
  const roleName = me?.roles?.[0]?.role?.name ?? me?.email ?? "";

  const handleLogout = async () => {
    await logout.mutateAsync();
    void navigate({ to: "/login" });
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-center size-8 rounded-full bg-sidebar-accent text-xs font-semibold text-foreground hover:ring-2 hover:ring-primary/40 transition"
      >
        {initials}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-52 rounded-lg border border-border bg-popover shadow-lg z-50 overflow-hidden">
          <div className="px-3 py-2.5 border-b border-border">
            <div className="font-medium text-sm">{displayName}</div>
            <div className="text-[11px] text-muted-foreground font-mono truncate">{roleName}</div>
          </div>
          <Link
            to="/dashboard/profile"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition"
          >
            <User className="size-3.5" /> Profile
          </Link>
          <button
            onClick={() => void handleLogout()}
            disabled={logout.isPending}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition disabled:opacity-50"
          >
            <LogOut className="size-3.5" /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Context (workspace + env) pill ──────────────────────────────────────────

function ContextPill() {
  const { selectedWorkspace } = useWorkspaceContext();
  const { selectedEnvironment } = useEnvironmentContext();

  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-border bg-secondary text-xs font-mono text-muted-foreground">
      <Globe className="size-3 shrink-0" />
      <span className="uppercase tracking-wide label-mono text-[10px]">Context</span>
      <span className="text-foreground font-medium ml-0.5">
        {selectedEnvironment?.name ?? "All Environments"}
      </span>
    </div>
  );
}

// ─── Topbar ───────────────────────────────────────────────────────────────────

export function DashboardTopbar({
  breadcrumbs,
  actions,
  // Legacy props — kept for backward compatibility with env-scoped pages
  title,
  subtitle,
}: {
  breadcrumbs?: string[];
  actions?: React.ReactNode;
  title?: string;
  subtitle?: string;
}) {
  return (
    <header className="h-12 shrink-0 flex items-center border-b border-sidebar-border bg-sidebar px-4 gap-3">
      {/* ── Logo ── */}
      <Link
        to="/dashboard"
        className="flex items-center gap-2 shrink-0 mr-2"
      >
        <div className="size-6 rounded bg-[image:var(--gradient-primary)] grid place-items-center">
          <svg viewBox="0 0 16 16" className="size-3.5 text-white fill-current">
            <path d="M8 2C5.8 2 4 3.8 4 6c0 .4.1.8.2 1.1C2.9 7.5 2 8.6 2 10c0 1.7 1.3 3 3 3h7c1.7 0 3-1.3 3-3 0-1.4-.9-2.5-2.2-2.9C12.9 6.8 13 6.4 13 6c0-2.2-1.8-4-4-4zm0 1.5c1.4 0 2.5 1.1 2.5 2.5 0 .3-.1.6-.2.8l-.3.7.7.2c.9.3 1.5 1.1 1.5 2C12.2 10.9 11.3 11.5 10.2 11.5H5C4.1 11.5 3.5 10.8 3.5 10c0-.8.5-1.6 1.3-1.8l.8-.2-.3-.8C5.1 6.9 5 6.5 5 6c0-1.4 1.1-2.5 3-2.5z"/>
          </svg>
        </div>
        <span className="font-semibold text-sm tracking-tight text-foreground">
          Ternak<span className="text-primary">Clouds</span>
        </span>
      </Link>

      {/* ── Workspace / context pill ── */}
      <ContextPill />

      {/* ── Breadcrumbs or page title ── */}
      {(breadcrumbs && breadcrumbs.length > 0) ? (
        <div className="flex items-center gap-1 label-mono text-muted-foreground">
          {breadcrumbs.map((crumb, i) => (
            <span key={i} className="flex items-center gap-1">
              {i > 0 && <span className="text-border mx-0.5">›</span>}
              <span className={i === breadcrumbs.length - 1 ? "text-foreground" : ""}>
                {crumb}
              </span>
            </span>
          ))}
        </div>
      ) : title ? (
        <div className="label-mono text-muted-foreground">
          {title}
        </div>
      ) : null}

      {/* ── Spacer ── */}
      <div className="flex-1" />

      {/* ── Environment tabs ── */}
      <EnvTabs />

      {/* ── Page-specific actions ── */}
      {actions && (
        <>
          <div className="h-4 w-px bg-border mx-1" />
          <div className="flex items-center gap-2">{actions}</div>
        </>
      )}

      <div className="h-4 w-px bg-border mx-1" />

      {/* ── Search ── */}
      <div className="hidden md:flex items-center gap-2 px-2.5 py-1.5 rounded bg-secondary border border-border text-sm text-muted-foreground w-48 focus-within:border-primary/50 transition-colors">
        <Search className="size-3.5 shrink-0" />
        <input
          className="bg-transparent outline-none flex-1 placeholder:text-muted-foreground/60 text-xs"
          placeholder="Search…"
        />
        <kbd className="font-mono text-[9px] px-1 py-0.5 rounded bg-background border border-border shrink-0">
          ⌘K
        </kbd>
      </div>

      {/* ── Bell ── */}
      <button className="p-1.5 rounded hover:bg-accent relative transition">
        <Bell className="size-4 text-muted-foreground" />
        <span className="absolute top-1 right-1 size-1.5 rounded-full bg-warning" />
      </button>

      {/* ── Help ── */}
      <button className="p-1.5 rounded hover:bg-accent transition">
        <HelpCircle className="size-4 text-muted-foreground" />
      </button>

      {/* ── User ── */}
      <UserMenu />
    </header>
  );
}
