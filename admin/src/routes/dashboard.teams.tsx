import { createFileRoute } from "@tanstack/react-router";
import { DashboardTopbar } from "@/components/DashboardTopbar";
import { useWorkspaceContext } from "@/lib/workspace-context";
import { useUsers } from "@/lib/queries";
import { useState } from "react";
import { Users, Search, Loader2, ShieldCheck, Building2 } from "lucide-react";
import { QueryError } from "@/components/QueryError";

export const Route = createFileRoute("/dashboard/teams")({
  head: () => ({ meta: [{ title: "Teams · TernakClouds" }] }),
  component: TeamsPage,
});

function TeamsPage() {
  const { selectedWorkspace } = useWorkspaceContext();
  const slug = selectedWorkspace?.slug ?? "";

  const [search, setSearch] = useState("");

  const { data, isLoading, isError, error } = useUsers({
    workspace: slug,
    limit: 100,
  });

  const members = (data?.items ?? []).filter((u) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      u.first_name.toLowerCase().includes(q) ||
      u.last_name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.department_name?.toLowerCase().includes(q) ||
      u.roles.some((r) => r.role_name.toLowerCase().includes(q))
    );
  });

  return (
    <>
      <DashboardTopbar
        title="Members"
        subtitle={
          selectedWorkspace ? `${selectedWorkspace.name} · workspace members` : "Workspace members"
        }
      />
      <main className="p-6 space-y-4 overflow-auto">
        {/* Search + count */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Search by name, email, role or department…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-sm bg-secondary border border-border rounded-lg outline-none focus:ring-1 focus:ring-primary/40 transition"
            />
          </div>
          {!isLoading && !isError && (
            <span className="text-xs text-muted-foreground shrink-0">
              {members.length} of {data?.total ?? 0} members
            </span>
          )}
        </div>

        {/* Table card */}
        <div className="glass rounded-xl overflow-hidden">
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground p-8 justify-center">
              <Loader2 className="size-4 animate-spin" /> Loading members…
            </div>
          ) : isError ? (
            <div className="p-6">
              <QueryError error={error} />
            </div>
          ) : members.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <div className="size-12 rounded-xl bg-secondary grid place-items-center">
                <Users className="size-5 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">
                {search ? "No members match your search." : "No members in this workspace."}
              </p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/40">
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Email
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Roles
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Department
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {members.map((u) => (
                  <tr
                    key={u.id}
                    className="border-b border-border last:border-0 hover:bg-muted/30 transition"
                  >
                    {/* Name */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="size-8 rounded-full bg-secondary grid place-items-center shrink-0 text-xs font-semibold text-muted-foreground">
                          {u.first_name.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-medium">
                          {u.first_name} {u.last_name}
                        </span>
                      </div>
                    </td>

                    {/* Email */}
                    <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{u.email}</td>

                    {/* Roles */}
                    <td className="px-4 py-3">
                      {u.roles.length === 0 ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {u.roles.map((r) => (
                            <span
                              key={r.role_id}
                              className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary"
                            >
                              <ShieldCheck className="size-2.5" />
                              {r.role_name}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>

                    {/* Department */}
                    <td className="px-4 py-3">
                      {u.department_name ? (
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <Building2 className="size-3" />
                          {u.department_name}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      {u.is_active ? (
                        <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600">
                          active
                        </span>
                      ) : (
                        <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-gray-400/10 text-gray-500">
                          inactive
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </>
  );
}
