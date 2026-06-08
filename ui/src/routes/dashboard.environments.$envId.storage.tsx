import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { useState } from "react";
import { DashboardTopbar } from "@/components/DashboardTopbar";
import { useWorkspaceContext } from "@/lib/workspace-context";
import { useMe } from "@/lib/queries";
import {
  useStorageProvider,
  useStorageBuckets,
  useCreateBucket,
  useDeleteBucket,
} from "@/modules/storage/queries";
import {
  Database,
  HardDrive,
  RefreshCw,
  AlertTriangle,
  Settings2,
  Loader2,
  Plus,
  Trash2,
  X,
} from "lucide-react";

export const Route = createFileRoute("/dashboard/environments/$envId/storage")({
  head: () => ({ meta: [{ title: "Storage · TernakClouds" }] }),
  component: StorageBucketsPage,
});

// ─── permission helpers ──────────────────────────────────────────────────────

type UserRole = { role?: { name?: string } };

function hasRole(roles: UserRole[] | undefined, ...names: string[]): boolean {
  const set = new Set(names.map((n) => n.toLowerCase()));
  return roles?.some((ur) => set.has((ur.role?.name ?? "").toLowerCase())) ?? false;
}

// ─── Create bucket dialog ────────────────────────────────────────────────────

interface CreateBucketDialogProps {
  onClose: () => void;
  onCreate: (name: string, region: string) => void;
  isPending: boolean;
  error?: string | null;
}

function CreateBucketDialog({ onClose, onCreate, isPending, error }: CreateBucketDialogProps) {
  const [name, setName] = useState("");
  const [region, setRegion] = useState("");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-sm rounded-xl bg-card border border-border shadow-lg p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Create bucket</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-accent transition">
            <X className="size-4 text-muted-foreground" />
          </button>
        </div>

        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Bucket name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="my-bucket"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-mono placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Region <span className="text-muted-foreground/60">(optional)</span>
            </label>
            <input
              type="text"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              placeholder="us-east-1"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-mono placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        {error && (
          <p className="flex items-start gap-2 text-xs text-destructive">
            <AlertTriangle className="size-3.5 shrink-0 mt-0.5" />
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button
            onClick={onClose}
            disabled={isPending}
            className="px-3 py-1.5 text-xs rounded-md border border-border hover:bg-accent transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={() => onCreate(name.trim(), region.trim())}
            disabled={isPending || !name.trim()}
            className="px-3 py-1.5 text-xs rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition disabled:opacity-50 flex items-center gap-1.5"
          >
            {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
            Create
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────

function StorageBucketsPage() {
  const { envId } = useParams({ from: "/dashboard/environments/$envId/storage" });
  const { selectedWorkspace } = useWorkspaceContext();
  const slug = selectedWorkspace?.slug ?? "";

  const { data: me } = useMe();
  const { data: provider, isLoading: providerLoading, error: providerError } = useStorageProvider(slug, envId);
  const { data: buckets, isLoading: bucketsLoading, error: bucketsError, refetch } = useStorageBuckets(slug, envId);
  const createBucket = useCreateBucket(slug, envId);
  const deleteBucket = useDeleteBucket(slug, envId);

  const [showCreate, setShowCreate] = useState(false);
  const [deletingName, setDeletingName] = useState<string | null>(null);

  const roles = me?.roles as UserRole[] | undefined;
  const canWrite = hasRole(roles, "admin", "manager", "developer");
  const canDelete = hasRole(roles, "admin", "manager");

  const isLoading = providerLoading || bucketsLoading;
  const noProvider = providerError?.status === 503 || (!providerLoading && !provider);

  function handleCreate(name: string, region: string) {
    createBucket.mutate(
      { name, region: region || undefined },
      {
        onSuccess: () => {
          setShowCreate(false);
          createBucket.reset();
        },
      },
    );
  }

  function handleDelete(name: string) {
    setDeletingName(name);
    deleteBucket.mutate(name, {
      onSettled: () => setDeletingName(null),
    });
  }

  return (
    <div className="flex flex-col h-full">
      <DashboardTopbar
        title="Storage"
        subtitle={provider ? `${provider.display_name} · ${provider.endpoint}` : "Object storage buckets"}
      />

      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* Provider header */}
        {provider && (
          <div className="flex items-center justify-between bg-card border border-border rounded-lg px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="size-8 rounded-md bg-secondary grid place-items-center shrink-0">
                <Database className="size-4 text-muted-foreground" />
              </div>
              <div>
                <div className="text-sm font-medium">{provider.display_name}</div>
                <div className="text-xs text-muted-foreground font-mono">{provider.endpoint}</div>
              </div>
              {provider.region && (
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-secondary text-muted-foreground border border-border">
                  {provider.region}
                </span>
              )}
            </div>
            <button
              onClick={() => void refetch()}
              disabled={isLoading}
              className="p-1.5 rounded hover:bg-accent transition disabled:opacity-50"
              title="Refresh buckets"
            >
              <RefreshCw className={`size-4 text-muted-foreground ${isLoading ? "animate-spin" : ""}`} />
            </button>
          </div>
        )}

        {/* No provider configured */}
        {noProvider && (
          <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
            <div className="size-14 rounded-xl bg-secondary grid place-items-center">
              <HardDrive className="size-6 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium mb-1">No storage provider configured</p>
              <p className="text-xs text-muted-foreground max-w-xs">
                Bind a storage provider in Platform → Storage to browse buckets.
              </p>
            </div>
            <Link
              to="/dashboard/environments/$envId/platform/storage"
              params={{ envId }}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition"
            >
              <Settings2 className="size-3.5" />
              Configure storage
            </Link>
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="size-6 text-muted-foreground animate-spin" />
          </div>
        )}

        {/* Error (not "no provider") */}
        {bucketsError && !noProvider && (
          <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <AlertTriangle className="size-4 mt-0.5 shrink-0" />
            <span>{bucketsError.message ?? "Failed to load buckets."}</span>
          </div>
        )}

        {/* Bucket list */}
        {!isLoading && buckets && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">
                Buckets
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  {buckets.length} {buckets.length === 1 ? "bucket" : "buckets"}
                </span>
              </h2>
              {canWrite && (
                <button
                  onClick={() => setShowCreate(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition"
                >
                  <Plus className="size-3.5" />
                  New bucket
                </button>
              )}
            </div>

            {buckets.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 text-center gap-3 border border-border rounded-lg bg-background/50">
                <Database className="size-8 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">No buckets found</p>
              </div>
            ) : (
              <div className="rounded-lg border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Name
                      </th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Region
                      </th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Created
                      </th>
                      {canDelete && (
                        <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground uppercase tracking-wide">
                          Actions
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {buckets.map((bucket, i) => (
                      <tr
                        key={bucket.name}
                        className={`border-b border-border last:border-0 hover:bg-accent/40 transition ${
                          i % 2 === 0 ? "bg-background" : "bg-muted/10"
                        }`}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <HardDrive className="size-3.5 text-muted-foreground shrink-0" />
                            <span className="font-mono text-xs font-medium">{bucket.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground font-mono">
                          {bucket.region ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {bucket.created_at
                            ? new Date(bucket.created_at).toLocaleDateString(undefined, {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                              })
                            : "—"}
                        </td>
                        {canDelete && (
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => handleDelete(bucket.name)}
                              disabled={deletingName === bucket.name}
                              className="p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition disabled:opacity-40"
                              title={`Delete ${bucket.name}`}
                            >
                              {deletingName === bucket.name ? (
                                <Loader2 className="size-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="size-3.5" />
                              )}
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {showCreate && (
        <CreateBucketDialog
          onClose={() => {
            setShowCreate(false);
            createBucket.reset();
          }}
          onCreate={handleCreate}
          isPending={createBucket.isPending}
          error={createBucket.error?.message ?? null}
        />
      )}
    </div>
  );
}
