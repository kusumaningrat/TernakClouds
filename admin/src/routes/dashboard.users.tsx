import { createFileRoute } from "@tanstack/react-router";
import { DashboardTopbar } from "@/components/DashboardTopbar";
import { QueryError } from "@/components/QueryError";
import {
  useMe,
  useRoles,
  useUsers,
  useDepartments,
  useWorkspacesMine,
  useAssignRole,
  useRevokeRole,
} from "@/lib/queries";
import { useState } from "react";
import { toast } from "sonner";
import {
  Loader2,
  AlertCircle,
  Lock,
  X,
  ShieldCheck,
  ChevronDown,
  ChevronRight,
  Plus,
  Minus,
  Users,
  Globe,
} from "lucide-react";
import type { UserSummary, UserListParams, Role } from "@/lib/types";

export const Route = createFileRoute("/dashboard/users")({
  head: () => ({ meta: [{ title: "Members · TernakClouds" }] }),
  component: UsersPage,
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function initials(firstName: string, lastName: string) {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

const roleColors: Record<string, string> = {
  admin: "bg-red-500/10 text-red-400 border-red-500/20",
  manager: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  developer: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  viewer: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
};

function RoleBadge({ name }: { name: string }) {
  const cls = roleColors[name.toLowerCase()] ?? "bg-secondary text-muted-foreground border-border";
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border capitalize ${cls}`}
    >
      {name}
    </span>
  );
}

function Avatar({
  firstName,
  lastName,
  size = "sm",
}: {
  firstName: string;
  lastName: string;
  size?: "sm" | "lg";
}) {
  const sz = size === "lg" ? "size-12 text-base" : "size-8 text-xs";
  return (
    <div
      className={`${sz} rounded-full bg-accent grid place-items-center font-bold shrink-0 select-none`}
    >
      {initials(firstName, lastName)}
    </div>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// ─── Skeleton rows ────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr className="border-b border-border animate-pulse">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="size-8 rounded-full bg-secondary" />
          <div className="space-y-1.5">
            <div className="h-3 w-28 bg-secondary rounded" />
            <div className="h-2.5 w-40 bg-secondary/70 rounded" />
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="h-3 w-24 bg-secondary rounded" />
      </td>
      <td className="px-4 py-3">
        <div className="h-3 w-20 bg-secondary rounded" />
      </td>
      <td className="px-4 py-3">
        <div className="flex gap-1">
          <div className="h-5 w-16 bg-secondary rounded" />
          <div className="h-5 w-20 bg-secondary rounded" />
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="h-3 w-20 bg-secondary rounded" />
      </td>
    </tr>
  );
}

// ─── Permission matrix (expandable per role) ──────────────────────────────────

function PermissionMatrix({ role }: { role: Role }) {
  const [open, setOpen] = useState(false);
  const groups: Record<string, string[]> = {};
  for (const rp of role.role_permissions ?? []) {
    if (!rp.permission) continue;
    const [resource, action] = rp.permission.name.split(":");
    if (!groups[resource]) groups[resource] = [];
    groups[resource].push(action);
  }
  const hasPerms = Object.keys(groups).length > 0;

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium hover:bg-secondary/50 transition"
      >
        <span className="flex items-center gap-2 min-w-0">
          <ShieldCheck className="size-3.5 text-primary shrink-0" />
          <span className="capitalize">{role.name}</span>
          {role.description && (
            <span className="text-xs text-muted-foreground font-normal truncate hidden sm:inline">
              — {role.description}
            </span>
          )}
        </span>
        <ChevronRight
          className={`size-3.5 text-muted-foreground transition-transform shrink-0 ${open ? "rotate-90" : ""}`}
        />
      </button>
      {open && (
        <div className="px-3 pb-3 pt-1 space-y-2 bg-secondary/30">
          {!hasPerms ? (
            <p className="text-xs text-muted-foreground italic">No permissions attached</p>
          ) : (
            Object.entries(groups).map(([resource, actions]) => (
              <div key={resource} className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-mono font-semibold text-foreground/80 w-24 shrink-0">
                  {resource}
                </span>
                {actions.map((a) => (
                  <span
                    key={a}
                    className="text-[11px] px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 font-mono"
                  >
                    {a}
                  </span>
                ))}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ─── User detail drawer ───────────────────────────────────────────────────────

function UserDrawer({
  user,
  allRoles,
  isPrivileged,
  onClose,
}: {
  user: UserSummary;
  allRoles: Role[];
  isPrivileged: boolean;
  onClose: () => void;
}) {
  const assignRole = useAssignRole();
  const revokeRole = useRevokeRole();

  const assignedRoleIds = new Set(user.roles.map((r) => r.role_id));
  const assignedFullRoles = allRoles.filter((r) => assignedRoleIds.has(r.id));

  const handleAssign = async (roleId: string) => {
    try {
      await assignRole.mutateAsync({ userId: user.id, roleId });
      toast.success("Role assigned");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to assign role");
    }
  };

  const handleRevoke = async (roleId: string) => {
    try {
      await revokeRole.mutateAsync({ userId: user.id, roleId });
      toast.success("Role revoked");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to revoke role");
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" onClick={onClose} />
      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-card border-l border-border z-50 flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <h2 className="font-semibold">Member Detail</h2>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-secondary transition">
            <X className="size-4" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Profile */}
          <div className="flex items-center gap-4">
            <Avatar firstName={user.first_name} lastName={user.last_name} size="lg" />
            <div className="flex-1 min-w-0">
              <div className="font-semibold">
                {user.first_name} {user.last_name}
              </div>
              <div className="text-xs text-muted-foreground font-mono truncate">{user.email}</div>
              <div className="mt-1.5">
                {user.is_active ? (
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                    Active
                  </span>
                ) : (
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-destructive/10 text-destructive border border-destructive/30 font-medium">
                    Inactive
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Meta grid */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="glass rounded-lg px-3 py-2.5">
              <div className="text-muted-foreground mb-0.5">Department</div>
              <div className="font-medium">{user.department_name || "—"}</div>
            </div>
            <div className="glass rounded-lg px-3 py-2.5">
              <div className="text-muted-foreground mb-0.5">Joined</div>
              <div className="font-medium">{formatDate(user.created_at)}</div>
            </div>
          </div>

          {/* Workspace memberships */}
          {user.workspaces.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                <Globe className="size-3.5" /> Workspaces
              </h3>
              <div className="space-y-2">
                {user.workspaces.map((ws) => (
                  <div
                    key={ws.workspace_id}
                    className="flex items-center justify-between glass rounded-lg px-3 py-2.5 text-sm"
                  >
                    <div>
                      <div className="font-medium">{ws.workspace_name}</div>
                      <div className="text-[11px] text-muted-foreground font-mono">
                        {ws.workspace_slug}
                      </div>
                    </div>
                    <span
                      className={`text-[11px] px-2 py-0.5 rounded border font-medium capitalize ${
                        ws.role === "owner"
                          ? "bg-primary/10 text-primary border-primary/20"
                          : "bg-secondary text-muted-foreground border-border"
                      }`}
                    >
                      {ws.role}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Roles summary */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
              <ShieldCheck className="size-3.5" /> Roles
            </h3>
            {user.roles.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">No roles assigned</p>
            ) : (
              <div className="flex flex-wrap gap-1.5 mb-4">
                {user.roles.map((r) => (
                  <RoleBadge key={r.role_id} name={r.role_name} />
                ))}
              </div>
            )}

            {/* Permission matrix (expandable per assigned role) */}
            {assignedFullRoles.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-2">
                  Permission matrix
                </p>
                {assignedFullRoles.map((role) => (
                  <PermissionMatrix key={role.id} role={role} />
                ))}
              </div>
            )}
          </div>

          {/* Role management (admins/managers only) */}
          {isPrivileged && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Manage roles
              </h3>
              <div className="space-y-2">
                {allRoles.map((role) => {
                  const assigned = assignedRoleIds.has(role.id);
                  const isPending =
                    (assignRole.isPending && assignRole.variables?.roleId === role.id) ||
                    (revokeRole.isPending && revokeRole.variables?.roleId === role.id);
                  return (
                    <div
                      key={role.id}
                      className={`flex items-center justify-between rounded-lg px-3 py-2.5 border text-sm transition ${
                        assigned
                          ? "border-primary/30 bg-primary/5"
                          : "border-border bg-secondary/30"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <ShieldCheck
                          className={`size-3.5 shrink-0 ${assigned ? "text-primary" : "text-muted-foreground"}`}
                        />
                        <span className="font-medium capitalize truncate">{role.name}</span>
                        {role.description && (
                          <span className="text-xs text-muted-foreground truncate hidden sm:inline">
                            — {role.description}
                          </span>
                        )}
                      </div>
                      <button
                        disabled={isPending}
                        onClick={() => {
                          if (assigned) void handleRevoke(role.id);
                          else void handleAssign(role.id);
                        }}
                        className={`shrink-0 ml-2 px-2.5 py-1 rounded text-xs font-medium transition disabled:opacity-50 inline-flex items-center gap-1 ${
                          assigned
                            ? "bg-destructive/10 text-destructive hover:bg-destructive/20"
                            : "bg-secondary hover:bg-accent text-foreground"
                        }`}
                      >
                        {isPending ? (
                          <Loader2 className="size-3 animate-spin" />
                        ) : assigned ? (
                          <Minus className="size-3" />
                        ) : (
                          <Plus className="size-3" />
                        )}
                        {assigned ? "Revoke" : "Assign"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Filter select ────────────────────────────────────────────────────────────

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { label: string; value: string }[];
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none pl-3 pr-8 py-2 rounded-md bg-secondary border border-border text-sm focus:border-primary outline-none cursor-pointer min-w-[140px]"
      >
        <option value="">{label}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
    </div>
  );
}

// ─── Members admin view ───────────────────────────────────────────────────────

function MembersAdminView({ isPrivileged }: { isPrivileged: boolean }) {
  const [filters, setFilters] = useState<UserListParams>({ status: "" });
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const { data: users, isLoading, error } = useUsers(filters);
  const { data: workspaces } = useWorkspacesMine();
  const { data: deptList } = useDepartments(1, 100);
  const { data: allRoles } = useRoles();

  const selectedUser =
    selectedUserId != null ? (users?.items.find((u) => u.id === selectedUserId) ?? null) : null;

  function setFilter<K extends keyof UserListParams>(key: K, value: UserListParams[K]) {
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }));
  }

  const workspaceOptions = (workspaces ?? []).map((w) => ({
    label: w.name,
    value: w.slug,
  }));
  const deptOptions = (deptList?.items ?? []).map((d) => ({
    label: d.name,
    value: d.id,
  }));
  const roleOptions = (allRoles ?? []).map((r) => ({
    label: r.name,
    value: r.id,
  }));

  const hasActiveFilter =
    !!filters.workspace || !!filters.department_id || !!filters.role_id || !!filters.status;

  const page = filters.page ?? 1;
  const limit = filters.limit ?? 20;

  return (
    <>
      <DashboardTopbar
        title="Members"
        subtitle="Manage workspace members, departments, and role assignments."
      />
      <main className="p-6 space-y-5">
        {/* Filter bar */}
        <div className="flex items-center gap-2 flex-wrap">
          <FilterSelect
            label="All workspaces"
            value={filters.workspace ?? ""}
            onChange={(v) => setFilter("workspace", v || undefined)}
            options={workspaceOptions}
          />
          <FilterSelect
            label="All departments"
            value={filters.department_id ?? ""}
            onChange={(v) => setFilter("department_id", v || undefined)}
            options={deptOptions}
          />
          <FilterSelect
            label="All roles"
            value={filters.role_id ?? ""}
            onChange={(v) => setFilter("role_id", v || undefined)}
            options={roleOptions}
          />
          <FilterSelect
            label="Any status"
            value={filters.status ?? ""}
            onChange={(v) => setFilter("status", (v as UserListParams["status"]) || "")}
            options={[
              { label: "Active", value: "active" },
              { label: "Inactive", value: "inactive" },
            ]}
          />
          {hasActiveFilter && (
            <button
              onClick={() => setFilters({ status: "" })}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition"
            >
              <X className="size-3.5" /> Clear
            </button>
          )}
          <div className="ml-auto text-xs text-muted-foreground">
            {!isLoading && users && (
              <span>
                {users.total} member{users.total !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="glass rounded-xl overflow-hidden border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/40">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground text-xs uppercase tracking-wider">
                  User
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground text-xs uppercase tracking-wider">
                  Workspace
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground text-xs uppercase tracking-wider">
                  Department
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground text-xs uppercase tracking-wider">
                  Roles
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground text-xs uppercase tracking-wider">
                  Joined
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <>
                  <SkeletonRow />
                  <SkeletonRow />
                  <SkeletonRow />
                  <SkeletonRow />
                  <SkeletonRow />
                </>
              ) : error ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6">
                    <QueryError error={error} />
                  </td>
                </tr>
              ) : !users?.items.length ? (
                <tr>
                  <td colSpan={5} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Users className="size-8 opacity-40" />
                      <span className="text-sm">No members found</span>
                      {hasActiveFilter && (
                        <button
                          onClick={() => setFilters({ status: "" })}
                          className="text-xs text-primary hover:underline"
                        >
                          Clear filters
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                users.items.map((user) => (
                  <tr
                    key={user.id}
                    onClick={() => setSelectedUserId(user.id)}
                    className="border-b border-border hover:bg-secondary/40 cursor-pointer transition last:border-0"
                  >
                    {/* User */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar firstName={user.first_name} lastName={user.last_name} />
                        <div>
                          <div className="font-medium">
                            {user.first_name} {user.last_name}
                          </div>
                          <div className="text-xs text-muted-foreground font-mono">
                            {user.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    {/* Workspace */}
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {user.workspaces.length === 0 ? (
                          <span className="text-muted-foreground text-xs">—</span>
                        ) : (
                          <>
                            {user.workspaces.slice(0, 2).map((ws) => (
                              <span
                                key={ws.workspace_id}
                                className="text-xs px-2 py-0.5 rounded bg-secondary border border-border font-mono"
                              >
                                {ws.workspace_slug}
                              </span>
                            ))}
                            {user.workspaces.length > 2 && (
                              <span className="text-xs text-muted-foreground self-center">
                                +{user.workspaces.length - 2}
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                    {/* Department */}
                    <td className="px-4 py-3">
                      <span className="text-sm">{user.department_name || "—"}</span>
                    </td>
                    {/* Roles */}
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {user.roles.length === 0 ? (
                          <span className="text-muted-foreground text-xs">No roles</span>
                        ) : (
                          user.roles.map((r) => <RoleBadge key={r.role_id} name={r.role_name} />)
                        )}
                      </div>
                    </td>
                    {/* Joined */}
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {formatDate(user.created_at)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {users && users.total > limit && (
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Showing {users.items.length} of {users.total} members
            </span>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setFilter("page", page - 1)}
                className="px-3 py-1.5 rounded-md bg-secondary hover:bg-accent disabled:opacity-40 transition"
              >
                ← Previous
              </button>
              <button
                disabled={page * limit >= users.total}
                onClick={() => setFilter("page", page + 1)}
                className="px-3 py-1.5 rounded-md bg-secondary hover:bg-accent disabled:opacity-40 transition"
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Detail drawer */}
      {selectedUser && (
        <UserDrawer
          user={selectedUser}
          allRoles={allRoles ?? []}
          isPrivileged={isPrivileged}
          onClose={() => setSelectedUserId(null)}
        />
      )}
    </>
  );
}

// ─── Entry point ──────────────────────────────────────────────────────────────

function UsersPage() {
  const { data: me, isLoading } = useMe();

  if (isLoading) {
    return (
      <>
        <DashboardTopbar title="Members" subtitle="" />
        <main className="p-6 flex items-center justify-center py-24 text-muted-foreground gap-2">
          <Loader2 className="size-5 animate-spin" />
          <span className="text-sm">Loading…</span>
        </main>
      </>
    );
  }

  const isPrivileged = (me?.roles ?? []).some((ur) => {
    const n = (ur.role?.name ?? "").toLowerCase();
    return n === "admin" || n === "manager";
  });

  if (!isPrivileged) {
    return (
      <>
        <DashboardTopbar title="Members" subtitle="" />
        <main className="p-6 flex flex-col items-center justify-center py-32 text-center gap-4">
          <div className="size-14 rounded-2xl bg-secondary grid place-items-center">
            <Lock className="size-7 text-muted-foreground" />
          </div>
          <div>
            <h2 className="font-semibold text-lg">Access restricted</h2>
            <p className="text-sm text-muted-foreground mt-1 max-w-xs">
              Only admins and managers can view and manage member roles.
            </p>
          </div>
        </main>
      </>
    );
  }

  return <MembersAdminView isPrivileged={isPrivileged} />;
}
