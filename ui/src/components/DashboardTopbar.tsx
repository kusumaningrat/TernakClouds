import { Search, Bell, HelpCircle, LogOut, User } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useMe, useLogout } from "@/lib/queries";

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

  const initials = me ? `${me.first_name.charAt(0)}${me.last_name.charAt(0)}`.toUpperCase() : "?";
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

// ─── Topbar ───────────────────────────────────────────────────────────────────

export function DashboardTopbar({
  breadcrumbs,
  actions,
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
      {/* ── Breadcrumbs or page title ── */}
      {breadcrumbs && breadcrumbs.length > 0 ? (
        <div className="flex items-center gap-1 label-mono text-muted-foreground">
          {breadcrumbs.map((crumb, i) => (
            <span key={i} className="flex items-center gap-1">
              {i > 0 && <span className="text-border mx-0.5">›</span>}
              <span className={i === breadcrumbs.length - 1 ? "text-foreground" : ""}>{crumb}</span>
            </span>
          ))}
        </div>
      ) : title ? (
        <div className="label-mono text-muted-foreground">{title}</div>
      ) : null}

      {/* ── Spacer ── */}
      <div className="flex-1" />

      {/* ── Page-specific actions ── */}
      {actions && (
        <>
          <div className="flex items-center gap-2">{actions}</div>
          <div className="h-4 w-px bg-border mx-1" />
        </>
      )}

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
