import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { DashboardTopbar } from "@/components/DashboardTopbar";
import { Globe, ChevronRight, ArrowUpRight, Loader2, AlertCircle, Plus, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { extractError } from "@/lib/toast-helpers";
import { useMe, useWorkspacesMine, useEnvironments, useCreateEnvironment } from "@/lib/queries";
import { useWorkspaceContext } from "@/lib/workspace-context";

function isAdminOrManager(roles: { role?: { name?: string } }[] | undefined): boolean {
  return (
    roles?.some((ur) => {
      const n = (ur.role?.name ?? "").toLowerCase();
      return n === "admin" || n === "manager";
    }) ?? false
  );
}

// ─── Create environment modal ─────────────────────────────────────────────────

function CreateEnvironmentModal({
  workspaceSlug,
  onClose,
}: {
  workspaceSlug: string;
  onClose: () => void;
}) {
  const createEnv = useCreateEnvironment();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    setError("");
    try {
      await createEnv.mutateAsync({
        slug: workspaceSlug,
        input: { name: name.trim(), description: description.trim() || undefined },
      });
      toast.success(`Environment "${name.trim()}" created.`);
      onClose();
    } catch (err: unknown) {
      setError(extractError(err, "Failed to create environment."));
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <div className="flex items-center gap-2">
              <Globe className="size-4 text-primary" />
              <h2 className="font-semibold">New environment</h2>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-md hover:bg-secondary transition">
              <X className="size-4" />
            </button>
          </div>

          <form onSubmit={(e) => void handleSubmit(e)} className="p-6 space-y-4">
            <div>
              <label className="text-xs font-medium block mb-1.5">Name</label>
              <input
                required
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Production"
                className="w-full px-3 py-2 rounded-lg bg-input border border-border text-sm outline-none focus:border-primary/50 transition"
              />
            </div>
            <div>
              <label className="text-xs font-medium block mb-1.5 text-muted-foreground">
                Description <span className="font-normal">(optional)</span>
              </label>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Production environment"
                className="w-full px-3 py-2 rounded-lg bg-input border border-border text-sm outline-none focus:border-primary/50 transition"
              />
            </div>

            {error && (
              <p className="text-xs text-destructive flex items-center gap-1.5">
                <AlertCircle className="size-3.5 shrink-0" />
                {error}
              </p>
            )}

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 rounded-lg border border-border text-sm font-medium hover:bg-secondary transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createEnv.isPending || !name.trim()}
                className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {createEnv.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Plus className="size-4" />
                )}
                Create
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/dashboard/environments/")({
  head: () => ({ meta: [{ title: "Environments · TernakClouds" }] }),
  component: EnvironmentsPage,
});

function EnvironmentsPage() {
  const navigate = useNavigate();
  const { selectedWorkspace, isHydrated } = useWorkspaceContext();
  const { data: me } = useMe();
  const privileged = isAdminOrManager(me?.roles);
  const [showCreate, setShowCreate] = useState(false);
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
        actions={
          privileged && workspaceSlug ? (
            <button
              onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition"
            >
              <Plus className="size-3.5" />
              New environment
            </button>
          ) : undefined
        }
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
          <div className="glass rounded-xl border border-dashed border-border p-10 text-center space-y-3">
            <p className="text-sm text-muted-foreground">No environments yet.</p>
            {privileged && (
              <button
                onClick={() => setShowCreate(true)}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs hover:bg-primary/90 transition"
              >
                <Plus className="size-3.5" /> Create first environment
              </button>
            )}
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

      {showCreate && workspaceSlug && (
        <CreateEnvironmentModal
          workspaceSlug={workspaceSlug}
          onClose={() => setShowCreate(false)}
        />
      )}
    </>
  );
}
