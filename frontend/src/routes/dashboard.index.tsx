import { createFileRoute, Link } from "@tanstack/react-router";
import { DashboardTopbar } from "@/components/DashboardTopbar";
import { useWorkspaceContext } from "@/lib/workspace-context";
import {
  useWorkspaceMembers,
  useEnvironments,
  useDepartments,
  useAccessRequestsPending,
} from "@/lib/queries";
import {
  Users,
  Layers,
  GitBranch,
  ClipboardList,
  Loader2,
  ChevronRight,
  ShieldCheck,
  Server,
  Crown,
  Clock,
} from "lucide-react";

export const Route = createFileRoute("/dashboard/")({
  head: () => ({ meta: [{ title: "Overview · TernakClouds" }] }),
  component: Overview,
});

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function StatCard({
  label,
  value,
  icon: Icon,
  loading,
}: {
  label: string;
  value: number | string;
  icon: React.ElementType;
  loading?: boolean;
}) {
  return (
    <div className="glass rounded-xl p-5">
      <div className="flex items-center justify-between text-muted-foreground text-xs">
        {label}
        <Icon className="size-4 text-primary" />
      </div>
      <div className="mt-3 text-3xl font-semibold font-mono">
        {loading ? (
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        ) : (
          value
        )}
      </div>
    </div>
  );
}

function SectionShell({
  title,
  icon: Icon,
  loading,
  children,
}: {
  title: string;
  icon: React.ElementType;
  loading?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="glass rounded-xl p-5">
      <h3 className="font-semibold text-sm flex items-center gap-2 mb-4">
        <Icon className="size-4 text-primary" />
        {title}
        {loading && <Loader2 className="size-3.5 animate-spin text-muted-foreground ml-1" />}
      </h3>
      {children}
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return <p className="text-xs text-muted-foreground py-2">{label}</p>;
}

function Overview() {
  const { selectedWorkspace } = useWorkspaceContext();
  const slug = selectedWorkspace?.slug ?? "";

  const { data: members, isLoading: membersLoading } = useWorkspaceMembers(slug);
  const { data: environments, isLoading: envsLoading } = useEnvironments(slug);
  const { data: deptData, isLoading: deptsLoading } = useDepartments(1, 100);
  const { data: pendingRequests, isLoading: requestsLoading } = useAccessRequestsPending();

  const departments = deptData?.items ?? [];

  return (
    <>
      <DashboardTopbar
        title={selectedWorkspace?.name ?? "Platform overview"}
        subtitle="Workspace overview · members, environments, and access"
      />
      <main className="p-6 space-y-6 overflow-auto">

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Members"
            value={(members ?? []).length}
            icon={Users}
            loading={membersLoading}
          />
          <StatCard
            label="Environments"
            value={(environments ?? []).length}
            icon={Layers}
            loading={envsLoading}
          />
          <StatCard
            label="Departments"
            value={deptData?.total ?? 0}
            icon={GitBranch}
            loading={deptsLoading}
          />
          <StatCard
            label="Pending requests"
            value={(pendingRequests ?? []).length}
            icon={ClipboardList}
            loading={requestsLoading}
          />
        </div>

        <div className="grid lg:grid-cols-3 gap-4">

          {/* Environments */}
          <div className="lg:col-span-2">
            <SectionShell title="Environments" icon={Server} loading={envsLoading}>
              {(environments ?? []).length === 0 && !envsLoading ? (
                <EmptyState label="No environments configured for this workspace." />
              ) : (
                <div className="divide-y divide-border">
                  {(environments ?? []).map((env) => (
                    <Link
                      key={env.id}
                      to="/dashboard/environments/$envId"
                      params={{ envId: env.slug }}
                      className="flex items-center gap-4 py-3 hover:bg-accent/30 -mx-1 px-1 rounded transition group"
                    >
                      <div className="size-8 rounded-lg bg-secondary grid place-items-center shrink-0">
                        <Server className="size-4 text-muted-foreground group-hover:text-primary transition" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{env.name}</div>
                        <div className="text-xs text-muted-foreground font-mono truncate">
                          {env.slug}
                          {env.description ? ` · ${env.description}` : ""}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                        <Clock className="size-3" />
                        {formatDate(env.created_at)}
                      </div>
                      <ChevronRight className="size-4 text-muted-foreground shrink-0" />
                    </Link>
                  ))}
                </div>
              )}
            </SectionShell>
          </div>

          {/* Members */}
          <SectionShell title="Workspace members" icon={ShieldCheck} loading={membersLoading}>
            {(members ?? []).length === 0 && !membersLoading ? (
              <EmptyState label="No members found." />
            ) : (
              <div className="space-y-3">
                {(members ?? []).slice(0, 8).map((m) => (
                  <div key={m.user_id} className="flex items-center gap-3">
                    <div className="size-7 rounded-full bg-secondary grid place-items-center shrink-0 text-xs font-semibold text-muted-foreground">
                      {m.first_name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">
                        {m.first_name} {m.last_name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        since {formatDate(m.joined_at)}
                      </div>
                    </div>
                    {m.role === "owner" ? (
                      <span className="flex items-center gap-1 text-[10px] font-medium text-amber-600 bg-amber-500/10 px-1.5 py-0.5 rounded-full shrink-0">
                        <Crown className="size-2.5" /> owner
                      </span>
                    ) : (
                      <span className="text-[10px] font-medium text-muted-foreground bg-secondary px-1.5 py-0.5 rounded-full shrink-0">
                        member
                      </span>
                    )}
                  </div>
                ))}
                {(members ?? []).length > 8 && (
                  <p className="text-xs text-muted-foreground pt-1">
                    +{(members ?? []).length - 8} more members
                  </p>
                )}
              </div>
            )}
          </SectionShell>

        </div>

        <div className="grid lg:grid-cols-2 gap-4">

          {/* Departments */}
          <SectionShell title="Departments" icon={GitBranch} loading={deptsLoading}>
            {departments.length === 0 && !deptsLoading ? (
              <EmptyState label="No departments configured." />
            ) : (
              <div className="space-y-2">
                {departments.slice(0, 8).map((d) => (
                  <div
                    key={d.id}
                    className="flex items-center gap-3 py-1.5 border-b border-border last:border-0"
                  >
                    <div className="size-6 rounded-md bg-secondary grid place-items-center shrink-0">
                      <GitBranch className="size-3 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{d.name}</div>
                      {d.description && (
                        <div className="text-xs text-muted-foreground truncate">{d.description}</div>
                      )}
                    </div>
                    <span className="text-[10px] font-mono text-muted-foreground shrink-0">
                      {d.slug}
                    </span>
                  </div>
                ))}
                {departments.length > 8 && (
                  <p className="text-xs text-muted-foreground pt-1">
                    +{departments.length - 8} more departments
                  </p>
                )}
              </div>
            )}
          </SectionShell>

          {/* Pending access requests */}
          <SectionShell title="Pending access requests" icon={ClipboardList} loading={requestsLoading}>
            {(pendingRequests ?? []).length === 0 && !requestsLoading ? (
              <EmptyState label="No pending requests." />
            ) : (
              <div className="space-y-0">
                {(pendingRequests ?? []).slice(0, 6).map((req) => (
                  <div
                    key={req.id}
                    className="flex items-start gap-3 py-2.5 border-b border-border last:border-0"
                  >
                    <div className="size-7 rounded-full bg-secondary grid place-items-center shrink-0 text-xs font-semibold text-muted-foreground mt-0.5">
                      {req.first_name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">
                        {req.first_name} {req.last_name}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {req.email}
                      </div>
                      {req.reason && (
                        <div className="text-[11px] text-muted-foreground truncate mt-0.5 italic">
                          "{req.reason}"
                        </div>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <span className="text-[10px] font-medium text-amber-600 bg-amber-500/10 px-1.5 py-0.5 rounded-full">
                        {req.requested_role}
                      </span>
                      <div className="text-[10px] text-muted-foreground mt-1">
                        {formatDate(req.created_at)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionShell>

        </div>

      </main>
    </>
  );
}
