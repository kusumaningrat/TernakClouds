import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { DashboardTopbar } from "@/components/DashboardTopbar";
import { Globe, ChevronRight, ArrowUpRight, Loader2, AlertCircle } from "lucide-react";
import { useMe, useWorkspacesMine, useEnvironments } from "@/lib/queries";
import { useWorkspaceContext } from "@/lib/workspace-context";

function isAdminOrManager(roles: { role?: { name?: string } }[] | undefined): boolean {
  return (
    roles?.some((ur) => {
      const n = (ur.role?.name ?? "").toLowerCase();
      return n === "admin" || n === "manager";
    }) ?? false
  );
}

export const Route = createFileRoute("/dashboard/environments/")({
  head: () => ({ meta: [{ title: "Environments · TernakClouds" }] }),
  component: EnvironmentsPage,
});

function EnvironmentsPage() {
  const navigate = useNavigate();
  const { selectedWorkspace, isHydrated } = useWorkspaceContext();
  const { data: me } = useMe();
  const privileged = isAdminOrManager(me?.roles);
  const {
    data: myWorkspaces,
    isLoading: isWorkspacesLoading,
    isError: isWorkspacesError,
    error: workspacesError,
  } = useWorkspacesMine();

  const validSelectedWorkspace =
    selectedWorkspace && myWorkspaces?.some((ws) => ws.id === selectedWorkspace.id)
      ? selectedWorkspace
      : null;

  const workspace = isHydrated ? (validSelectedWorkspace ?? myWorkspaces?.[0] ?? null) : null;
  const workspaceSlug = workspace?.slug ?? "";
  const hasWorkspaces = (myWorkspaces?.length ?? 0) > 0;

  const {
    data: envs,
    isLoading: isEnvironmentsLoading,
    isError: isEnvironmentsError,
    error: environmentsError,
  } = useEnvironments(workspaceSlug);

  const sorted = envs ? [...envs].sort((a, b) => a.order - b.order) : [];

  return (
    <>
      <DashboardTopbar
        title="Environments"
        subtitle="Select an environment to manage its services, deployments and configuration."
      />
      <main className="p-6 space-y-4">
        {!isHydrated || isWorkspacesLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm py-8 justify-center">
            <Loader2 className="size-4 animate-spin" /> Loading workspace…
          </div>
        ) : isWorkspacesError ? (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-sm">
            <AlertCircle className="size-4 shrink-0" />
            {workspacesError?.message ?? "Failed to load workspaces"}
          </div>
        ) : !hasWorkspaces ? (
          privileged ? (
            <div className="glass rounded-xl border border-dashed border-border p-10 text-center space-y-3">
              <p className="text-sm text-muted-foreground">No workspaces yet.</p>
              <button
                onClick={() => void navigate({ to: "/dashboard/workspaces" })}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-secondary text-xs hover:bg-accent transition"
              >
                Create your first workspace
              </button>
            </div>
          ) : (
            <div className="glass rounded-xl border border-dashed border-border p-10 text-center space-y-3">
              <p className="text-sm text-muted-foreground">
                You don't have access to any workspace.
              </p>
              <button
                onClick={() => void navigate({ to: "/dashboard/no-access" })}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs hover:bg-primary/90 transition"
              >
                Request Workspace Access
              </button>
            </div>
          )
        ) : isEnvironmentsLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm py-8 justify-center">
            <Loader2 className="size-4 animate-spin" /> Loading environments…
          </div>
        ) : isEnvironmentsError ? (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-sm">
            <AlertCircle className="size-4 shrink-0" />
            {environmentsError?.message ?? "Failed to load environments"}
          </div>
        ) : sorted.length === 0 ? (
          <div className="glass rounded-xl border border-dashed border-border p-10 text-center">
            <p className="text-sm text-muted-foreground">No environments yet.</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {sorted.map((env) => (
              <button
                key={env.id}
                onClick={() =>
                  void navigate({
                    to: `/dashboard/environments/${env.slug}` as never,
                  })
                }
                className="glass rounded-xl p-5 text-left border border-border hover:border-primary/40 hover:bg-primary/3 transition group"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded-lg bg-secondary grid place-items-center">
                      <Globe className="size-5 text-muted-foreground" />
                    </div>
                    <div>
                      <div className="font-semibold capitalize">{env.name}</div>
                      <div className="text-xs text-muted-foreground font-mono">{env.slug}</div>
                    </div>
                  </div>
                  <ChevronRight className="size-4 text-muted-foreground mt-1 shrink-0 opacity-0 group-hover:opacity-100 transition" />
                </div>

                {env.description && (
                  <p className="mt-3 text-xs text-muted-foreground">{env.description}</p>
                )}

                <div className="mt-4">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-secondary text-xs group-hover:bg-accent transition">
                    Open full overview <ArrowUpRight className="size-3.5" />
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
