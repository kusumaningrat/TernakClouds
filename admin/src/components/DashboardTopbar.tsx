import { Search, Bell, ShieldCheck } from "lucide-react";

export function DashboardTopbar({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="h-16 border-b border-border bg-card/40 backdrop-blur flex items-center justify-between px-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-3">
        {actions}
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-md bg-secondary text-sm text-muted-foreground w-72">
          <Search className="size-4" />
          <input
            className="bg-transparent outline-none flex-1 placeholder:text-muted-foreground/70"
            placeholder="Search users, services, roles…"
          />
          <kbd className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-background border border-border">
            ⌘K
          </kbd>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-secondary text-xs">
          <ShieldCheck className="size-3.5 text-success" />
          <span className="font-mono">JWT · session 23m</span>
        </div>
        <button className="p-2 rounded-md hover:bg-secondary relative">
          <Bell className="size-4" />
          <span className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-primary" />
        </button>
      </div>
    </header>
  );
}
