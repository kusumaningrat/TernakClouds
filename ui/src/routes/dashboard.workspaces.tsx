import { createFileRoute } from "@tanstack/react-router";
import { DashboardTopbar } from "@/components/DashboardTopbar";
import { QueryError } from "@/components/QueryError";
import {
  Layers,
  Plus,
  Trash2,
  Pencil,
  Users,
  Globe,
  Loader2,
  X,
  Crown,
  UserCircle,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  useMe,
  useWorkspaces,
  useWorkspace,
  useCreateWorkspace,
  useUpdateWorkspace,
  useDeleteWorkspace,
  useWorkspaceMembers,
  useAddMember,
  useRemoveMember,
  useEnvironments,
  useCreateEnvironment,
  useDeleteEnvironment,
} from "@/lib/queries";
import type { Workspace, WorkspaceEnvironment, WorkspaceMember } from "@/lib/types";

export const Route = createFileRoute("/dashboard/workspaces")({
  head: () => ({ meta: [{ title: "Workspaces · TernakClouds" }] }),
  component: WorkspacesPage,
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isAdminOrManager(roles: { role?: { name?: string } }[] | undefined): boolean {
  return (
    roles?.some((ur) => {
      const n = (ur.role?.name ?? "").toLowerCase();
      return n === "admin" || n === "manager";
    }) ?? false
  );
}

const ENV_ORDER_COLORS = [
  "bg-primary/10 text-primary border-primary/20",
  "bg-amber-500/10 text-amber-400 border-amber-500/20",
  "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
];

function envColor(order: number) {
  return ENV_ORDER_COLORS[order] ?? "bg-secondary text-muted-foreground border-border";
}

// ─── Simple modal wrapper ─────────────────────────────────────────────────────

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm">
      <div className="glass rounded-xl border border-border w-full max-w-md p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">{title}</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-accent transition">
            <X className="size-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── Workspace list item ──────────────────────────────────────────────────────

function WorkspaceItem({
  ws,
  selected,
  isOwner,
  onClick,
}: {
  ws: Workspace;
  selected: boolean;
  isOwner: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-3 rounded-lg transition border ${
        selected
          ? "bg-primary/10 border-primary/40 text-foreground"
          : "border-transparent hover:bg-sidebar-accent/50 text-sidebar-foreground/80"
      }`}
    >
      <div className="flex items-center gap-2">
        <div
          className={`size-7 rounded-md grid place-items-center shrink-0 ${selected ? "bg-primary/20" : "bg-secondary"}`}
        >
          <Layers className={`size-3.5 ${selected ? "text-primary" : "text-muted-foreground"}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">{ws.name}</div>
          <div className="text-[11px] font-mono text-muted-foreground">{ws.slug}</div>
        </div>
        {isOwner && <Crown className="size-3 text-amber-400 shrink-0" />}
      </div>
    </button>
  );
}

// ─── Environment row ──────────────────────────────────────────────────────────

function EnvironmentRow({
  env,
  canManage,
  onDelete,
  isDeleting,
}: {
  env: WorkspaceEnvironment;
  canManage: boolean;
  onDelete: () => void;
  isDeleting: boolean;
}) {
  return (
    <div className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-secondary/50 border border-border">
      <div className="flex items-center gap-2.5 min-w-0">
        <span className={`text-[11px] font-mono px-2 py-0.5 rounded border ${envColor(env.order)}`}>
          {env.slug}
        </span>
        <span className="text-sm font-medium truncate">{env.name}</span>
        {env.description && (
          <span className="text-xs text-muted-foreground truncate hidden sm:block">
            {env.description}
          </span>
        )}
      </div>
      {canManage && (
        <button
          onClick={onDelete}
          disabled={isDeleting}
          className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition disabled:opacity-50 shrink-0"
          title="Delete environment"
        >
          {isDeleting ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Trash2 className="size-3.5" />
          )}
        </button>
      )}
    </div>
  );
}

// ─── Member row ───────────────────────────────────────────────────────────────

function MemberRow({
  member,
  canManage,
  onRemove,
  isRemoving,
}: {
  member: WorkspaceMember;
  canManage: boolean;
  onRemove: () => void;
  isRemoving: boolean;
}) {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-secondary/50 border border-border">
      <div className="size-8 rounded-full bg-accent grid place-items-center text-xs font-semibold shrink-0">
        {member.first_name ? (
          `${member.first_name.charAt(0)}${member.last_name.charAt(0)}`.toUpperCase()
        ) : (
          <UserCircle className="size-4 text-muted-foreground" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">
          {member.first_name ? `${member.first_name} ${member.last_name}` : "Unknown user"}
        </div>
        <div className="text-[11px] font-mono text-muted-foreground truncate">
          {member.user_id.slice(0, 8)}…
        </div>
      </div>
      <span
        className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wide shrink-0 ${
          member.role === "owner"
            ? "bg-amber-500/15 text-amber-400"
            : "bg-secondary text-muted-foreground border border-border"
        }`}
      >
        {member.role}
      </span>
      {canManage && member.role !== "owner" && (
        <button
          onClick={onRemove}
          disabled={isRemoving}
          className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition disabled:opacity-50 shrink-0"
          title="Remove member"
        >
          {isRemoving ? <Loader2 className="size-3.5 animate-spin" /> : <X className="size-3.5" />}
        </button>
      )}
    </div>
  );
}

// ─── Workspace detail panel ───────────────────────────────────────────────────

function WorkspaceDetail({
  slug,
  meId,
  privileged,
}: {
  slug: string;
  meId: string;
  privileged: boolean;
}) {
  const { data: ws, isLoading: wsLoading, error: wsError } = useWorkspace(slug);
  const { data: members, isLoading: membersLoading } = useWorkspaceMembers(slug);
  const { data: envs, isLoading: envsLoading } = useEnvironments(slug);

  const updateWs = useUpdateWorkspace();
  const deleteWs = useDeleteWorkspace();
  const addMember = useAddMember();
  const removeMember = useRemoveMember();
  const createEnv = useCreateEnvironment();
  const deleteEnv = useDeleteEnvironment();

  const [showEdit, setShowEdit] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [showAddEnv, setShowAddEnv] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [memberInput, setMemberInput] = useState("");
  const [envName, setEnvName] = useState("");
  const [envDesc, setEnvDesc] = useState("");

  const [deletingMember, setDeletingMember] = useState<string | null>(null);
  const [deletingEnv, setDeletingEnv] = useState<string | null>(null);

  if (wsLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground gap-2">
        <Loader2 className="size-5 animate-spin" />
        <span className="text-sm">Loading workspace…</span>
      </div>
    );
  }

  if (wsError || !ws) {
    return <QueryError error={wsError ?? new Error("Workspace not found")} className="m-4" />;
  }

  const isOwner = ws.owner_id === meId;
  const canManage = isOwner || privileged;

  const openEdit = () => {
    setEditName(ws.name);
    setEditDesc(ws.description ?? "");
    setShowEdit(true);
  };

  const handleEdit = async () => {
    try {
      await updateWs.mutateAsync({ slug, input: { name: editName, description: editDesc } });
      toast.success("Workspace updated");
      setShowEdit(false);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to update workspace");
    }
  };

  const handleDelete = async () => {
    try {
      await deleteWs.mutateAsync(slug);
      toast.success("Workspace deleted");
      setShowDeleteConfirm(false);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to delete workspace");
    }
  };

  const handleAddMember = async () => {
    const id = memberInput.trim();
    if (!id) return;
    try {
      await addMember.mutateAsync({ slug, userId: id });
      toast.success("Member added");
      setMemberInput("");
      setShowAddMember(false);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to add member");
    }
  };

  const handleRemoveMember = async (userId: string) => {
    setDeletingMember(userId);
    try {
      await removeMember.mutateAsync({ slug, userId });
      toast.success("Member removed");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to remove member");
    } finally {
      setDeletingMember(null);
    }
  };

  const handleAddEnv = async () => {
    const name = envName.trim();
    if (!name) return;
    try {
      await createEnv.mutateAsync({
        slug,
        input: { name, description: envDesc.trim() || undefined },
      });
      toast.success("Environment created");
      setEnvName("");
      setEnvDesc("");
      setShowAddEnv(false);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to create environment");
    }
  };

  const handleDeleteEnv = async (envSlug: string) => {
    setDeletingEnv(envSlug);
    try {
      await deleteEnv.mutateAsync({ slug, envSlug });
      toast.success("Environment deleted");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to delete environment");
    } finally {
      setDeletingEnv(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="glass rounded-xl p-5 border border-border">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="size-10 rounded-lg grid place-items-center bg-primary/15 shrink-0">
              <Layers className="size-5 text-primary" />
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-base truncate">{ws.name}</div>
              <div className="text-xs font-mono text-muted-foreground">{ws.slug}</div>
            </div>
          </div>
          {canManage && (
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={openEdit}
                className="p-1.5 rounded hover:bg-accent transition text-muted-foreground hover:text-foreground"
                title="Edit workspace"
              >
                <Pencil className="size-4" />
              </button>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="p-1.5 rounded hover:bg-destructive/10 transition text-muted-foreground hover:text-destructive"
                title="Delete workspace"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          )}
        </div>
        {ws.description && <p className="mt-3 text-sm text-muted-foreground">{ws.description}</p>}
        <div className="mt-3 flex gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Users className="size-3.5" />
            {members?.length ?? "—"} member{members?.length !== 1 ? "s" : ""}
          </span>
          <span className="flex items-center gap-1">
            <Globe className="size-3.5" />
            {envs?.length ?? "—"} environment{envs?.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Environments */}
      <div className="glass rounded-xl p-5 border border-border">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Globe className="size-4 text-primary" /> Environments
          </h3>
          {canManage && (
            <button
              onClick={() => setShowAddEnv(true)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-secondary hover:bg-accent text-xs font-medium transition"
            >
              <Plus className="size-3.5" /> Add
            </button>
          )}
        </div>
        {envsLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm py-2">
            <Loader2 className="size-3.5 animate-spin" /> Loading…
          </div>
        ) : !envs?.length ? (
          <p className="text-xs text-muted-foreground italic py-1">No environments yet.</p>
        ) : (
          <div className="space-y-1.5">
            {[...envs]
              .sort((a, b) => a.order - b.order)
              .map((env) => (
                <EnvironmentRow
                  key={env.id}
                  env={env}
                  canManage={canManage}
                  onDelete={() => void handleDeleteEnv(env.slug)}
                  isDeleting={deletingEnv === env.slug}
                />
              ))}
          </div>
        )}
      </div>

      {/* Members */}
      <div className="glass rounded-xl p-5 border border-border">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Users className="size-4 text-primary" /> Members
          </h3>
          {canManage && (
            <button
              onClick={() => setShowAddMember(true)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-secondary hover:bg-accent text-xs font-medium transition"
            >
              <Plus className="size-3.5" /> Add
            </button>
          )}
        </div>
        {membersLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm py-2">
            <Loader2 className="size-3.5 animate-spin" /> Loading…
          </div>
        ) : !members?.length ? (
          <p className="text-xs text-muted-foreground italic py-1">No members.</p>
        ) : (
          <div className="space-y-1.5">
            {members.map((m: WorkspaceMember) => (
              <MemberRow
                key={m.user_id}
                member={m}
                canManage={canManage}
                onRemove={() => void handleRemoveMember(m.user_id)}
                isRemoving={deletingMember === m.user_id}
              />
            ))}
          </div>
        )}
      </div>

      {/* Edit modal */}
      {showEdit && (
        <Modal title="Edit workspace" onClose={() => setShowEdit(false)}>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Name</label>
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full px-3 py-2 rounded-md bg-secondary border border-border focus:border-primary outline-none text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Description</label>
              <input
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                placeholder="Optional"
                className="w-full px-3 py-2 rounded-md bg-secondary border border-border focus:border-primary outline-none text-sm"
              />
            </div>
            <div className="flex gap-2 justify-end pt-1">
              <button
                onClick={() => setShowEdit(false)}
                className="px-3 py-1.5 rounded-md bg-secondary text-sm hover:bg-accent transition"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleEdit()}
                disabled={!editName.trim() || updateWs.isPending}
                className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm hover:opacity-90 transition disabled:opacity-60 inline-flex items-center gap-2"
              >
                {updateWs.isPending && <Loader2 className="size-3.5 animate-spin" />}
                Save
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Add member modal */}
      {showAddMember && (
        <Modal title="Add member" onClose={() => setShowAddMember(false)}>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">User ID</label>
              <input
                value={memberInput}
                onChange={(e) => setMemberInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleAddMember();
                }}
                placeholder="Paste user UUID…"
                className="w-full px-3 py-2 rounded-md bg-secondary border border-border focus:border-primary outline-none text-sm font-mono"
              />
            </div>
            <div className="flex gap-2 justify-end pt-1">
              <button
                onClick={() => setShowAddMember(false)}
                className="px-3 py-1.5 rounded-md bg-secondary text-sm hover:bg-accent transition"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleAddMember()}
                disabled={!memberInput.trim() || addMember.isPending}
                className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm hover:opacity-90 transition disabled:opacity-60 inline-flex items-center gap-2"
              >
                {addMember.isPending && <Loader2 className="size-3.5 animate-spin" />}
                Add member
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Add environment modal */}
      {showAddEnv && (
        <Modal title="New environment" onClose={() => setShowAddEnv(false)}>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Name</label>
              <input
                value={envName}
                onChange={(e) => setEnvName(e.target.value)}
                placeholder="e.g. qa"
                className="w-full px-3 py-2 rounded-md bg-secondary border border-border focus:border-primary outline-none text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Description</label>
              <input
                value={envDesc}
                onChange={(e) => setEnvDesc(e.target.value)}
                placeholder="Optional"
                className="w-full px-3 py-2 rounded-md bg-secondary border border-border focus:border-primary outline-none text-sm"
              />
            </div>
            <div className="flex gap-2 justify-end pt-1">
              <button
                onClick={() => setShowAddEnv(false)}
                className="px-3 py-1.5 rounded-md bg-secondary text-sm hover:bg-accent transition"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleAddEnv()}
                disabled={!envName.trim() || createEnv.isPending}
                className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm hover:opacity-90 transition disabled:opacity-60 inline-flex items-center gap-2"
              >
                {createEnv.isPending && <Loader2 className="size-3.5 animate-spin" />}
                Create
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete confirm modal */}
      {showDeleteConfirm && (
        <Modal title="Delete workspace" onClose={() => setShowDeleteConfirm(false)}>
          <p className="text-sm text-muted-foreground mb-4">
            This will permanently delete{" "}
            <span className="font-semibold text-foreground">{ws.name}</span> and all its
            environments. This cannot be undone.
          </p>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="px-3 py-1.5 rounded-md bg-secondary text-sm hover:bg-accent transition"
            >
              Cancel
            </button>
            <button
              onClick={() => void handleDelete()}
              disabled={deleteWs.isPending}
              className="px-3 py-1.5 rounded-md bg-destructive text-destructive-foreground text-sm hover:opacity-90 transition disabled:opacity-60 inline-flex items-center gap-2"
            >
              {deleteWs.isPending && <Loader2 className="size-3.5 animate-spin" />}
              Delete
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

function WorkspacesPage() {
  const { data: me } = useMe();
  const { data: workspaces, isLoading, error } = useWorkspaces();
  const createWs = useCreateWorkspace();

  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createDesc, setCreateDesc] = useState("");

  const privileged = isAdminOrManager(me?.roles);
  const meId = me?.id ?? "";

  const handleCreate = async () => {
    const name = createName.trim();
    if (!name) return;
    try {
      const ws = await createWs.mutateAsync({ name, description: createDesc.trim() || undefined });
      toast.success("Workspace created");
      setCreateName("");
      setCreateDesc("");
      setShowCreate(false);
      setSelectedSlug(ws.slug);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to create workspace");
    }
  };

  const selected = workspaces?.find((w) => w.slug === selectedSlug);

  return (
    <>
      <DashboardTopbar
        title="Workspaces"
        subtitle="Isolated environments for your teams and projects."
      />
      <main className="p-6 flex gap-5 h-[calc(100vh-4rem)] overflow-hidden">
        {/* Left: workspace list */}
        <div className="w-60 shrink-0 flex flex-col gap-2">
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition w-full"
          >
            <Plus className="size-4" /> New workspace
          </button>

          {isLoading && (
            <div className="flex items-center gap-2 text-muted-foreground text-sm px-3 py-2">
              <Loader2 className="size-4 animate-spin" /> Loading…
            </div>
          )}

          {error && <QueryError error={error} className="mx-3 my-2" />}

          {!isLoading && !error && workspaces?.length === 0 && (
            <p className="text-xs text-muted-foreground px-3 py-2 italic">No workspaces yet.</p>
          )}

          <div className="flex flex-col gap-0.5 overflow-y-auto flex-1">
            {workspaces?.map((ws) => (
              <WorkspaceItem
                key={ws.id}
                ws={ws}
                selected={selectedSlug === ws.slug}
                isOwner={ws.owner_id === meId}
                onClick={() => setSelectedSlug(ws.slug)}
              />
            ))}
          </div>
        </div>

        {/* Right: detail panel */}
        <div className="flex-1 overflow-y-auto">
          {selectedSlug && selected ? (
            <WorkspaceDetail
              key={selectedSlug}
              slug={selectedSlug}
              meId={meId}
              privileged={privileged}
            />
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-3">
              <div className="size-14 rounded-xl bg-secondary grid place-items-center">
                <Layers className="size-6" />
              </div>
              <p className="text-sm">Select a workspace to view details</p>
            </div>
          )}
        </div>
      </main>

      {/* Create workspace modal */}
      {showCreate && (
        <Modal title="New workspace" onClose={() => setShowCreate(false)}>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Name</label>
              <input
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleCreate();
                }}
                placeholder="e.g. Acme Corp"
                className="w-full px-3 py-2 rounded-md bg-secondary border border-border focus:border-primary outline-none text-sm"
                autoFocus
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Description</label>
              <input
                value={createDesc}
                onChange={(e) => setCreateDesc(e.target.value)}
                placeholder="Optional"
                className="w-full px-3 py-2 rounded-md bg-secondary border border-border focus:border-primary outline-none text-sm"
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              A slug is auto-generated from the name. You become the owner. Default environments
              (dev, staging, production) are created automatically.
            </p>
            <div className="flex gap-2 justify-end pt-1">
              <button
                onClick={() => setShowCreate(false)}
                className="px-3 py-1.5 rounded-md bg-secondary text-sm hover:bg-accent transition"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleCreate()}
                disabled={!createName.trim() || createWs.isPending}
                className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm hover:opacity-90 transition disabled:opacity-60 inline-flex items-center gap-2"
              >
                {createWs.isPending && <Loader2 className="size-3.5 animate-spin" />}
                Create
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
