import { createFileRoute } from "@tanstack/react-router";
import { DashboardTopbar } from "@/components/DashboardTopbar";
import { Building2, Plus, Loader2, Pencil, Trash2 } from "lucide-react";
import { QueryError } from "@/components/QueryError";
import { useState } from "react";
import { toast } from "sonner";
import {
  useDepartments,
  useCreateDepartment,
  useUpdateDepartment,
  useDeleteDepartment,
} from "@/lib/queries";
import type { Department } from "@/lib/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/dashboard/departments")({
  head: () => ({ meta: [{ title: "Departments · TernakClouds" }] }),
  component: DeptsPage,
});

const CARD_COLORS = [
  "from-emerald-400 to-cyan-400",
  "from-indigo-400 to-violet-400",
  "from-amber-400 to-rose-400",
  "from-cyan-400 to-blue-500",
  "from-pink-400 to-purple-500",
  "from-lime-400 to-emerald-500",
];

function colorFor(str: string): string {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return CARD_COLORS[Math.abs(h) % CARD_COLORS.length];
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

// ─── Create dialog ────────────────────────────────────────────────────────────

function CreateDeptDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const create = useCreateDepartment();

  const handleNameChange = (value: string) => {
    setName(value);
    if (!slugTouched) setSlug(slugify(value));
  };

  const handleClose = () => {
    setName("");
    setSlug("");
    setDescription("");
    setSlugTouched(false);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await create.mutateAsync({ name, slug, description: description || undefined });
      toast.success(`Department "${name}" created`);
      handleClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to create department");
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) handleClose();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New department</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            void handleSubmit(e);
          }}
          className="space-y-4 mt-2"
        >
          <div>
            <label className="text-xs font-medium text-muted-foreground">Name *</label>
            <input
              required
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Payments"
              className="mt-1.5 w-full px-3 py-2.5 rounded-md bg-secondary border border-border focus:border-primary outline-none transition text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Slug *</label>
            <input
              required
              value={slug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(e.target.value);
              }}
              placeholder="payments"
              className="mt-1.5 w-full px-3 py-2.5 rounded-md bg-secondary border border-border focus:border-primary outline-none transition text-sm font-mono"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              Unique identifier, auto-filled from name
            </p>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Description</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Handles payment processing and billing…"
              className="mt-1.5 w-full px-3 py-2.5 rounded-md bg-secondary border border-border focus:border-primary outline-none transition text-sm"
            />
          </div>
          <DialogFooter>
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 rounded-md bg-secondary hover:bg-accent text-sm transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={create.isPending}
              className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition disabled:opacity-60 inline-flex items-center gap-2"
            >
              {create.isPending && <Loader2 className="size-3.5 animate-spin" />}
              Create
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Edit dialog ──────────────────────────────────────────────────────────────

function EditDeptDialog({ dept, onClose }: { dept: Department; onClose: () => void }) {
  const [name, setName] = useState(dept.name);
  const [description, setDescription] = useState(dept.description ?? "");
  const update = useUpdateDepartment();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await update.mutateAsync({
        id: dept.id,
        input: {
          name: name || undefined,
          description: description || undefined,
        },
      });
      toast.success(`Department updated`);
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to update department");
    }
  };

  return (
    <Dialog
      open
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit department</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            void handleSubmit(e);
          }}
          className="space-y-4 mt-2"
        >
          <div>
            <label className="text-xs font-medium text-muted-foreground">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1.5 w-full px-3 py-2.5 rounded-md bg-secondary border border-border focus:border-primary outline-none transition text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Slug</label>
            <input
              disabled
              value={dept.slug}
              className="mt-1.5 w-full px-3 py-2.5 rounded-md bg-secondary/50 border border-border outline-none text-sm font-mono text-muted-foreground cursor-not-allowed"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              Slug cannot be changed after creation
            </p>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Description</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1.5 w-full px-3 py-2.5 rounded-md bg-secondary border border-border focus:border-primary outline-none transition text-sm"
            />
          </div>
          <DialogFooter>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-md bg-secondary hover:bg-accent text-sm transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={update.isPending}
              className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition disabled:opacity-60 inline-flex items-center gap-2"
            >
              {update.isPending && <Loader2 className="size-3.5 animate-spin" />}
              Save changes
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

function DeptsPage() {
  const [page] = useState(1);
  const { data, isLoading, error } = useDepartments(page);
  const deleteDept = useDeleteDepartment();

  const [createOpen, setCreateOpen] = useState(false);
  const [editDept, setEditDept] = useState<Department | null>(null);
  const [deletingDept, setDeletingDept] = useState<Department | null>(null);

  const handleDelete = async () => {
    if (!deletingDept) return;
    try {
      await deleteDept.mutateAsync(deletingDept.id);
      toast.success(`Department "${deletingDept.name}" deleted`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to delete department");
    } finally {
      setDeletingDept(null);
    }
  };

  return (
    <>
      <DashboardTopbar
        title="Departments"
        subtitle="Department-based access isolation. Members inherit dept-scoped permissions."
      />
      <main className="p-6 space-y-4">
        <div className="flex justify-end">
          <button
            onClick={() => setCreateOpen(true)}
            className="px-4 py-2 rounded-md bg-primary text-primary-foreground font-medium text-sm inline-flex items-center gap-2 shadow-[var(--shadow-glow)]"
          >
            <Plus className="size-4" /> New department
          </button>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-24 text-muted-foreground gap-2">
            <Loader2 className="size-5 animate-spin" />
            <span className="text-sm">Loading departments…</span>
          </div>
        )}

        {error && <QueryError error={error} />}

        {data && data.items.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-center gap-3">
            <Building2 className="size-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              No departments yet. Create your first one.
            </p>
          </div>
        )}

        {data && data.items.length > 0 && (
          <>
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
              {data.items.map((dept) => (
                <div
                  key={dept.id}
                  className="glass rounded-xl p-5 hover:border-primary/40 transition"
                >
                  <div className="flex items-center justify-between">
                    <div
                      className={`size-10 rounded-lg bg-gradient-to-br ${colorFor(dept.name)} grid place-items-center`}
                    >
                      <Building2 className="size-5 text-background" />
                    </div>
                    <span className="text-xs text-muted-foreground font-mono">{dept.slug}</span>
                  </div>
                  <h3 className="mt-4 text-lg font-semibold">{dept.name}</h3>
                  {dept.description ? (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {dept.description}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground/50 mt-1 italic">No description</p>
                  )}
                  <div className="mt-4 flex gap-2">
                    <button
                      onClick={() => setEditDept(dept)}
                      className="flex-1 py-2 rounded-md bg-secondary hover:bg-accent text-sm transition inline-flex items-center justify-center gap-1.5"
                    >
                      <Pencil className="size-3.5" /> Edit
                    </button>
                    <button
                      onClick={() => setDeletingDept(dept)}
                      className="py-2 px-3 rounded-md bg-destructive/10 hover:bg-destructive/20 text-destructive text-sm transition inline-flex items-center gap-1.5"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground text-right font-mono">
              {data.total} department{data.total !== 1 ? "s" : ""} total
            </p>
          </>
        )}
      </main>

      <CreateDeptDialog open={createOpen} onClose={() => setCreateOpen(false)} />
      {editDept && <EditDeptDialog dept={editDept} onClose={() => setEditDept(null)} />}

      <AlertDialog
        open={!!deletingDept}
        onOpenChange={(v) => {
          if (!v) setDeletingDept(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete department?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete{" "}
              <span className="font-semibold text-foreground">{deletingDept?.name}</span>. This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                void handleDelete();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteDept.isPending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
