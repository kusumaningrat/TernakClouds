import { createFileRoute, Link } from "@tanstack/react-router";
import { DashboardTopbar } from "@/components/DashboardTopbar";
import { useWorkspaceContext } from "@/lib/workspace-context";
import { useEnvironmentContext } from "@/lib/environment-context";
import {
  useDepartments,
  useWorkspaceMembers,
  useCatalog,
  useEnvironments,
  useAllServiceDeployments,
} from "@/lib/queries";
import {
  Users,
  Layers,
  ChevronRight,
  Plus,
  Crown,
  Search,
  ShieldCheck,
  Loader2,
} from "lucide-react";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/dashboard/teams")({
  head: () => ({ meta: [{ title: "Teams · TernakClouds" }] }),
  component: TeamsPage,
});

// ─── Page ─────────────────────────────────────────────────────────────────────

function TeamsPage() {
  const { selectedWorkspace } = useWorkspaceContext();
  const slug = selectedWorkspace?.slug ?? "";
  const [search, setSearch] = useState("");

  const { data: departments, isLoading: deptsLoading } = useDepartments(1, 50);
  const { data: members, isLoading: membersLoading } = useWorkspaceMembers(slug);
  const { data: catalog } = useCatalog();

  const teams = (departments?.items ?? []).filter(
    (d) => !search.trim() || d.name.toLowerCase().includes(search.toLowerCase()),
  );

  const totalMembers = members?.length ?? 0;
  const totalTeams = departments?.items?.length ?? 0;

  return (
    <div className="flex flex-col h-full">
      <DashboardTopbar breadcrumbs={["Teams"]} />
      {/* Header */}
      <div className="px-6 pt-5 pb-4 border-b border-border">
        <div className="label-mono text-muted-foreground mb-1">Teams</div>
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Teams</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {totalTeams} team{totalTeams !== 1 ? "s" : ""} · {totalMembers} workspace member
              {totalMembers !== 1 ? "s" : ""}
            </p>
          </div>
          <button className="flex items-center gap-1.5 text-xs px-3 py-2 rounded bg-secondary border border-border text-muted-foreground hover:text-foreground transition font-medium">
            <Plus className="size-3.5" /> New team
          </button>
        </div>

        {/* Search */}
        <div className="mt-3 relative w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search teams…"
            className="w-full pl-8 pr-3 py-1.5 text-sm bg-input border border-border rounded outline-none focus:border-primary/50 transition placeholder:text-muted-foreground/60"
          />
        </div>
      </div>

      {/* Two-column layout */}
      <div className="flex flex-1 min-h-0 overflow-auto">
        {/* Teams list */}
        <div className="flex-1 p-6 space-y-3 overflow-auto">
          <div className="label-mono text-muted-foreground mb-2">ALL TEAMS ({teams.length})</div>

          {deptsLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Loader2 className="size-4 animate-spin" /> Loading teams…
            </div>
          ) : teams.length === 0 ? (
            <div className="glass rounded-xl p-8 text-center">
              <Users className="size-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm font-medium">No teams yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                {search
                  ? "No teams match your search."
                  : "Create a team to organize service ownership."}
              </p>
            </div>
          ) : (
            teams.map((dept) => (
              <div
                key={dept.id}
                className="glass rounded-xl p-4 flex items-center gap-4 hover:border-primary/30 transition-colors group cursor-pointer"
              >
                <div className="size-10 rounded-lg bg-secondary grid place-items-center shrink-0 group-hover:bg-primary/10 transition-colors">
                  <Users className="size-5 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm">{dept.name}</div>
                  {dept.description && (
                    <div className="text-xs text-muted-foreground mt-0.5 truncate">
                      {dept.description}
                    </div>
                  )}
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className="text-[10px] label-mono text-muted-foreground/70 flex items-center gap-1">
                      <Layers className="size-2.5" />
                      {catalog?.length ?? 0} services
                    </span>
                  </div>
                </div>
                <ChevronRight className="size-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
              </div>
            ))
          )}

          {/* Services without a team — ownership health */}
          <div className="pt-4 border-t border-border mt-6">
            <h3 className="text-sm font-semibold mb-3">Ownership health</h3>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Owned services", value: catalog?.length ?? 0, good: true },
                { label: "Unowned services", value: 0, good: true },
                { label: "Teams active", value: totalTeams, good: true },
              ].map(({ label, value, good }) => (
                <div key={label} className="glass rounded-lg p-3">
                  <div className="text-xl font-bold font-mono text-foreground">{value}</div>
                  <div className="text-[10px] label-mono text-muted-foreground mt-1">
                    {label.toUpperCase()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Workspace members panel */}
        <div className="w-72 shrink-0 border-l border-border p-4 overflow-auto space-y-4">
          <div className="glass rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <h3 className="text-sm font-semibold">Workspace Members</h3>
              <span className="label-mono text-muted-foreground" style={{ fontSize: "10px" }}>
                {totalMembers}
              </span>
            </div>

            {membersLoading ? (
              <div className="p-4 flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="size-3 animate-spin" /> Loading…
              </div>
            ) : (members ?? []).length === 0 ? (
              <div className="p-4 text-xs text-muted-foreground text-center">No members.</div>
            ) : (
              <div className="divide-y divide-border">
                {(members ?? []).map((m) => (
                  <div key={m.user_id} className="flex items-center gap-2.5 px-4 py-2.5">
                    <div className="size-7 rounded-full bg-secondary grid place-items-center text-[10px] font-semibold text-muted-foreground shrink-0">
                      {m.first_name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium truncate">
                        {m.first_name} {m.last_name}
                      </div>
                    </div>
                    {m.role === "owner" && <Crown className="size-3 text-warning shrink-0" />}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Admin links */}
          <div className="glass rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <h3 className="text-xs font-medium label-mono text-muted-foreground">ADMIN</h3>
            </div>
            <div className="divide-y divide-border">
              {(
                [
                  { to: "/dashboard/departments", label: "Manage Departments" },
                  { to: "/dashboard/roles", label: "Roles & Permissions" },
                  { to: "/dashboard/users", label: "All Platform Users" },
                ] as const
              ).map(({ to, label }) => (
                <Link
                  key={to}
                  to={to}
                  className="flex items-center justify-between px-4 py-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition"
                >
                  {label}
                  <ChevronRight className="size-3" />
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
