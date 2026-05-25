import { createFileRoute } from "@tanstack/react-router";
import { DashboardTopbar } from "@/components/DashboardTopbar";
import { ShieldCheck, KeyRound, Loader2 } from "lucide-react";
import { QueryError } from "@/components/QueryError";
import { useRoles, useMe } from "@/lib/queries";
import type { Permission, Role } from "@/lib/types";

export const Route = createFileRoute("/dashboard/roles")({
  head: () => ({ meta: [{ title: "Roles & Permissions · TernakClouds" }] }),
  component: RolesPage,
});

// ─── Permission badge ─────────────────────────────────────────────────────────

const RESOURCE_COLORS: Record<string, string> = {
  deployments: "bg-primary/10 text-primary border-primary/25",
  users: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  departments: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
};

function PermBadge({ perm }: { perm: Permission }) {
  const cls = RESOURCE_COLORS[perm.resource] ?? "bg-secondary text-muted-foreground border-border";
  return (
    <span
      title={perm.description}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono border ${cls}`}
    >
      {perm.name}
    </span>
  );
}

// ─── Role card ────────────────────────────────────────────────────────────────

function RoleCard({ role, isAssigned }: { role: Role; isAssigned: boolean }) {
  const perms = (role.role_permissions?.map((rp) => rp.permission).filter(Boolean) ??
    []) as Permission[];

  return (
    <div
      className={`glass rounded-xl p-5 transition border ${
        isAssigned ? "border-primary/40" : "border-border/60"
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`size-10 rounded-lg grid place-items-center shrink-0 ${
            isAssigned ? "bg-primary/20" : "bg-secondary"
          }`}
        >
          <ShieldCheck
            className={`size-5 ${isAssigned ? "text-primary" : "text-muted-foreground"}`}
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold capitalize">{role.name}</h3>
            {isAssigned && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/15 text-primary font-semibold uppercase tracking-wide">
                Your role
              </span>
            )}
          </div>
          {role.description && (
            <p className="text-xs text-muted-foreground mt-0.5">{role.description}</p>
          )}
        </div>
        <span className="text-xs text-muted-foreground font-mono shrink-0">
          {perms.length} perm{perms.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {perms.length > 0 ? (
          perms.map((p) => <PermBadge key={p.id} perm={p} />)
        ) : (
          <span className="text-xs text-muted-foreground italic">No permissions assigned</span>
        )}
      </div>
    </div>
  );
}

// ─── Permission catalog (right sidebar) ──────────────────────────────────────

function PermissionCatalog({ roles }: { roles: Role[] }) {
  const seen = new Set<string>();
  const allPerms: Permission[] = [];
  for (const role of roles) {
    for (const rp of role.role_permissions ?? []) {
      if (rp.permission && !seen.has(rp.permission.id)) {
        seen.add(rp.permission.id);
        allPerms.push(rp.permission);
      }
    }
  }

  const byResource = allPerms.reduce<Record<string, Permission[]>>((acc, p) => {
    (acc[p.resource] ??= []).push(p);
    return acc;
  }, {});

  return (
    <div className="glass rounded-xl p-5 h-fit sticky top-6">
      <h3 className="font-semibold flex items-center gap-2 mb-1">
        <KeyRound className="size-4 text-primary" /> Permission catalog
      </h3>
      <p className="text-xs text-muted-foreground mb-4">Atomic, server-enforced checks.</p>

      {Object.keys(byResource).length === 0 ? (
        <p className="text-xs text-muted-foreground italic">No permissions defined</p>
      ) : (
        <div className="space-y-4">
          {Object.entries(byResource).map(([resource, perms]) => (
            <div key={resource}>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                {resource}
              </div>
              <ul className="space-y-1 text-sm font-mono">
                {perms.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between py-1.5 border-b border-border last:border-0"
                  >
                    <span>{p.action}</span>
                    {p.description && (
                      <span
                        className="text-[11px] text-muted-foreground truncate max-w-28 text-right"
                        title={p.description}
                      >
                        {p.description}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

function RolesPage() {
  const { data: roles, isLoading, error } = useRoles();
  const { data: me } = useMe();

  const assignedRoleIds = new Set(me?.roles?.map((ur) => ur.role_id) ?? []);

  return (
    <>
      <DashboardTopbar
        title="Roles & Permissions"
        subtitle="Compose roles from atomic permissions. Department scope is always enforced."
      />
      <main className="p-6 grid lg:grid-cols-3 gap-4">
        {/* Left: role cards */}
        <div className="lg:col-span-2 space-y-4">
          {isLoading && (
            <div className="flex items-center gap-2 text-muted-foreground text-sm py-4">
              <Loader2 className="size-5 animate-spin" /> Loading roles…
            </div>
          )}

          {error && <QueryError error={error} />}

          {roles?.map((role) => (
            <RoleCard key={role.id} role={role} isAssigned={assignedRoleIds.has(role.id)} />
          ))}

          {!isLoading && !error && roles?.length === 0 && (
            <p className="text-sm text-muted-foreground py-4 text-center">No roles found.</p>
          )}
        </div>

        {/* Right: catalog + my roles */}
        <div className="space-y-4">
          {roles && roles.length > 0 ? (
            <PermissionCatalog roles={roles} />
          ) : (
            <div className="glass rounded-xl p-5">
              <h3 className="font-semibold flex items-center gap-2 mb-1">
                <KeyRound className="size-4 text-primary" /> Permission catalog
              </h3>
              <p className="text-xs text-muted-foreground">
                {isLoading ? "Loading…" : "No permissions to display."}
              </p>
            </div>
          )}

          {me && (
            <div className="glass rounded-xl p-5">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <ShieldCheck className="size-4 text-primary" /> My roles
              </h3>
              {!me.roles?.length ? (
                <p className="text-xs text-muted-foreground italic">No roles assigned yet</p>
              ) : (
                <ul className="space-y-2">
                  {me.roles.map((ur) => (
                    <li key={ur.role_id} className="flex items-center gap-2 text-sm">
                      <span className="size-2 rounded-full bg-primary shrink-0" />
                      <span className="font-medium capitalize">
                        {ur.role?.name ?? ur.role_id.slice(0, 8)}
                      </span>
                      {ur.role?.description && (
                        <span className="text-xs text-muted-foreground truncate">
                          · {ur.role.description}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-3 text-[11px] text-muted-foreground">
                Assign or revoke roles in{" "}
                <a href="/dashboard/users" className="text-primary hover:underline">
                  Users
                </a>
                .
              </p>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
