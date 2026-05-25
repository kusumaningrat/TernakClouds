import { createFileRoute, useParams } from "@tanstack/react-router";
import { DashboardTopbar } from "@/components/DashboardTopbar";
import { useWorkspaceContext } from "@/lib/workspace-context";
import { QueryError } from "@/components/QueryError";
import {
  useMe,
  useRegistries,
  useEnvironmentRegistries,
  useCreateBinding,
  useDeleteBinding,
  useBoundRepos,
  useBoundTags,
  useWorkspaceMembers,
} from "@/lib/queries";
import { useState, useEffect } from "react";
import {
  Container,
  Plus,
  Trash2,
  Loader2,
  AlertCircle,
  FolderOpen,
  ShieldCheck,
  ArrowLeft,
  Copy,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import type { RegistryBinding, RegistryProvider, RegistryProviderType } from "@/lib/types";
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

export const Route = createFileRoute("/dashboard/environments/$envId/registries")({
  head: () => ({ meta: [{ title: "Registries · TernakClouds" }] }),
  component: EnvRegistriesPage,
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PROVIDER_LABELS: Record<RegistryProviderType, string> = {
  harbor: "Harbor",
  dockerhub: "Docker Hub",
  ghcr: "GHCR",
  ecr: "AWS ECR",
  gcr: "Google GCR",
};

const PROVIDER_COLORS: Record<RegistryProviderType, string> = {
  harbor: "from-blue-400 to-cyan-500",
  dockerhub: "from-sky-400 to-blue-500",
  ghcr: "from-gray-500 to-slate-600",
  ecr: "from-orange-400 to-amber-500",
  gcr: "from-red-400 to-rose-500",
};

function isAdminOrOwner(roles: { role?: { name?: string } }[] | undefined): boolean {
  return (
    roles?.some((ur) => {
      const n = (ur.role?.name ?? "").toLowerCase();
      return n === "admin" || n === "manager" || n === "owner";
    }) ?? false
  );
}

// ─── Bind registry dialog ─────────────────────────────────────────────────────

function BindRegistryDialog({
  open,
  onClose,
  workspaceSlug,
  envSlug,
  alreadyBound,
}: {
  open: boolean;
  onClose: () => void;
  workspaceSlug: string;
  envSlug: string;
  alreadyBound: string[];
}) {
  const { data: allRegistries } = useRegistries(workspaceSlug);
  const available = (allRegistries ?? []).filter((r) => !alreadyBound.includes(r.id));
  const [selectedId, setSelectedId] = useState("");
  const [allowedPaths, setAllowedPaths] = useState("");
  const createBinding = useCreateBinding(workspaceSlug, envSlug);

  const handleClose = () => {
    setSelectedId("");
    setAllowedPaths("");
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId) return;
    const paths = allowedPaths
      .split("\n")
      .map((p) => p.trim())
      .filter(Boolean);
    try {
      await createBinding.mutateAsync({
        registry_id: selectedId,
        allowed_paths: paths.length > 0 ? paths : undefined,
      });
      toast.success("Registry bound to environment");
      handleClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to bind registry");
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
          <DialogTitle>Bind registry to environment</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            void handleSubmit(e);
          }}
          className="space-y-4 mt-2"
        >
          {available.length === 0 ? (
            <div className="text-sm text-muted-foreground py-2">
              All workspace registries are already bound, or no registries exist. Add registries
              first from the workspace Registries page.
            </div>
          ) : (
            <>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Registry *</label>
                <select
                  required
                  value={selectedId}
                  onChange={(e) => setSelectedId(e.target.value)}
                  className="mt-1.5 w-full px-3 py-2.5 rounded-md bg-secondary border border-border focus:border-primary outline-none transition text-sm"
                >
                  <option value="">Select a registry…</option>
                  {available.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} (
                      {PROVIDER_LABELS[r.provider_type as RegistryProviderType] ?? r.provider_type})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Allowed paths</label>
                <textarea
                  value={allowedPaths}
                  onChange={(e) => setAllowedPaths(e.target.value)}
                  placeholder={"prod/*\nshared/*"}
                  rows={3}
                  className="mt-1.5 w-full px-3 py-2.5 rounded-md bg-secondary border border-border focus:border-primary outline-none transition text-sm font-mono resize-none"
                />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  One glob path per line. Leave blank to allow all repositories.
                </p>
              </div>
            </>
          )}
          <DialogFooter>
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 rounded-md bg-secondary hover:bg-accent text-sm transition"
            >
              Cancel
            </button>
            {available.length > 0 && (
              <button
                type="submit"
                disabled={createBinding.isPending || !selectedId}
                className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition disabled:opacity-60 inline-flex items-center gap-2"
              >
                {createBinding.isPending && <Loader2 className="size-3.5 animate-spin" />}
                Bind
              </button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

function formatSize(bytes?: number): string {
  if (!bytes) return "—";
  if (bytes < 1_024) return `${bytes} B`;
  if (bytes < 1_024 * 1_024) return `${(bytes / 1_024).toFixed(1)} KB`;
  return `${(bytes / 1_024 / 1_024).toFixed(1)} MB`;
}

function pullCmd(
  endpoint: string | undefined,
  repoName: string,
  tagName: string,
  repoUri?: string,
): string {
  const base =
    repoUri ?? (endpoint ? `${endpoint.replace(/^https?:\/\//, "")}/${repoName}` : repoName);
  return `docker pull ${base}:${tagName}`;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    void navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      className="shrink-0 p-1 rounded hover:bg-accent transition"
      title="Copy"
    >
      {copied ? (
        <Check className="size-3 text-emerald-500" />
      ) : (
        <Copy className="size-3 text-muted-foreground" />
      )}
    </button>
  );
}

// ─── Bound image browser panel (inline) ──────────────────────────────────────

const PAGE_SIZE = 20;

function BoundImageBrowserPanel({
  binding,
  selectedRepo,
  onSelectRepo,
  workspaceSlug,
  envSlug,
}: {
  binding: RegistryBinding | null;
  selectedRepo: string | null;
  onSelectRepo: (name: string | null) => void;
  workspaceSlug: string;
  envSlug: string;
}) {
  const [page, setPage] = useState(1);

  useEffect(() => { setPage(1); }, [binding?.id]);
  useEffect(() => { setPage(1); }, [selectedRepo]);

  const { data: repos, isLoading: reposLoading, error: reposError } = useBoundRepos(
    workspaceSlug, envSlug, binding?.registry_id ?? "", !!binding,
  );
  const { data: tags, isLoading: tagsLoading, error: tagsError } = useBoundTags(
    workspaceSlug, envSlug, binding?.registry_id ?? "",
    selectedRepo ?? "",
    !!binding && !!selectedRepo,
  );

  if (!binding) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card/50 flex flex-col items-center justify-center py-16 text-center">
        <FolderOpen className="size-8 text-muted-foreground/40 mb-3" />
        <p className="text-sm text-muted-foreground">
          Click <span className="font-medium text-foreground">Browse images</span> on a registry card to explore its accessible repositories.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Panel header / breadcrumb */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-secondary/40">
        {selectedRepo ? (
          <>
            <button
              onClick={() => onSelectRepo(null)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition"
            >
              <ArrowLeft className="size-3.5" /> Back
            </button>
            <span className="text-muted-foreground text-xs">·</span>
            <span className="text-xs text-muted-foreground">{binding.registry_name ?? "Registry"}</span>
            <span className="text-xs text-muted-foreground">/</span>
            <span className="text-xs font-mono font-medium">{selectedRepo}</span>
          </>
        ) : (
          <>
            <Container className="size-3.5 text-muted-foreground shrink-0" />
            <span className="text-xs font-medium">{binding.registry_name ?? "Registry"}</span>
            <span className="text-xs text-muted-foreground">— Accessible Repositories</span>
          </>
        )}
      </div>

      {selectedRepo ? (
        tagsLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-10 justify-center">
            <Loader2 className="size-4 animate-spin" /> Loading tags…
          </div>
        ) : tagsError ? (
          <div className="py-4 px-2"><QueryError error={tagsError} /></div>
        ) : !tags || tags.length === 0 ? (
          <div className="text-sm text-muted-foreground py-10 text-center">No tags found for this repository.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-secondary/60">
              <tr className="border-b border-border">
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tag</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Digest</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Size</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Pull Command</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {tags.map((tag) => {
                const cmd = pullCmd(binding.registry_endpoint, selectedRepo, tag.name);
                return (
                  <tr key={tag.name} className="hover:bg-accent/40 transition">
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs bg-secondary border border-border px-1.5 py-0.5 rounded">{tag.name}</span>
                    </td>
                    <td className="px-4 py-3">
                      {tag.digest ? (
                        <div className="flex items-center gap-1">
                          <span className="font-mono text-xs text-muted-foreground" title={tag.digest}>
                            {tag.digest.slice(0, 19)}…
                          </span>
                          <CopyButton text={tag.digest} />
                        </div>
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground font-mono whitespace-nowrap">{formatSize(tag.size)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <code className="text-xs font-mono text-muted-foreground truncate max-w-[320px]" title={cmd}>{cmd}</code>
                        <CopyButton text={cmd} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )
      ) : reposLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-10 justify-center">
          <Loader2 className="size-4 animate-spin" /> Loading repositories…
        </div>
      ) : reposError ? (
        <div className="py-4 px-2"><QueryError error={reposError} /></div>
      ) : !repos || repos.length === 0 ? (
        <div className="text-sm text-muted-foreground py-10 text-center">No repositories accessible in this environment.</div>
      ) : (() => {
        const totalPages = Math.ceil(repos.length / PAGE_SIZE);
        const paged = repos.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
        return (
          <>
            <table className="w-full text-sm">
              <thead className="bg-secondary/60">
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Repository</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">URI</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {paged.map((repo) => (
                  <tr
                    key={repo.name}
                    onClick={() => onSelectRepo(repo.name)}
                    className="hover:bg-accent/40 cursor-pointer transition"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <FolderOpen className="size-3.5 text-muted-foreground shrink-0" />
                        <span className="font-mono text-xs">{repo.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground font-mono">{repo.uri ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-secondary/30">
                <span className="text-xs text-muted-foreground">
                  {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, repos.length)} of {repos.length} repositories
                </span>
                <div className="flex items-center gap-2">
                  <button
                    disabled={page === 1}
                    onClick={() => setPage((p) => p - 1)}
                    className="px-2.5 py-1 rounded text-xs bg-secondary hover:bg-accent disabled:opacity-40 transition"
                  >
                    Previous
                  </button>
                  <span className="text-xs text-muted-foreground font-mono">{page} / {totalPages}</span>
                  <button
                    disabled={page === totalPages}
                    onClick={() => setPage((p) => p + 1)}
                    className="px-2.5 py-1 rounded text-xs bg-secondary hover:bg-accent disabled:opacity-40 transition"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        );
      })()}
    </div>
  );
}

// ─── Binding card ─────────────────────────────────────────────────────────────

function BindingCard({
  binding,
  canUnbind,
  onUnbind,
  onBrowse,
  isBrowsing,
}: {
  binding: RegistryBinding;
  canUnbind: boolean;
  onUnbind: (b: RegistryBinding) => void;
  onBrowse: (b: RegistryBinding) => void;
  isBrowsing: boolean;
}) {
  const providerType = (binding.registry_type ?? "") as RegistryProviderType;
  const gradient = PROVIDER_COLORS[providerType] ?? "from-slate-400 to-slate-600";
  const label = PROVIDER_LABELS[providerType] ?? binding.registry_type ?? "Registry";

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className={`h-1.5 bg-gradient-to-r ${gradient}`} />
      <div className="p-5">
        <div className="flex items-start gap-3">
          <div
            className={`size-10 rounded-lg bg-gradient-to-br ${gradient} grid place-items-center shrink-0`}
          >
            <Container className="size-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm truncate">
              {binding.registry_name ?? "Registry"}
            </div>
            <div className="text-[11px] text-muted-foreground font-mono mt-0.5">{label}</div>
            {binding.registry_endpoint && (
              <div className="text-[11px] text-muted-foreground font-mono truncate mt-0.5">
                {binding.registry_endpoint}
              </div>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-emerald-600 bg-emerald-500/10 px-2 py-1 rounded font-medium shrink-0">
            <ShieldCheck className="size-3" /> Bound
          </div>
        </div>

        {binding.allowed_paths && binding.allowed_paths.length > 0 && (
          <div className="mt-3">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-1.5">
              Allowed paths
            </div>
            <div className="flex flex-wrap gap-1.5">
              {binding.allowed_paths.map((p) => (
                <span
                  key={p}
                  className="px-2 py-0.5 rounded bg-secondary border border-border text-xs font-mono"
                >
                  {p}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={() => onBrowse(binding)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs transition ${
              isBrowsing
                ? "bg-primary/15 text-primary border border-primary/30"
                : "bg-secondary hover:bg-accent"
            }`}
          >
            <FolderOpen className="size-3.5" />
            Browse images
          </button>
          {canUnbind && (
            <button
              onClick={() => onUnbind(binding)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-secondary hover:bg-destructive/20 text-xs text-destructive transition"
            >
              <Trash2 className="size-3.5" /> Unbind
            </button>
          )}
        </div>
      </div>

    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function EnvRegistriesPage() {
  const { envId } = useParams({ from: "/dashboard/environments/$envId/registries" });
  const { selectedWorkspace } = useWorkspaceContext();
  const workspaceSlug = selectedWorkspace?.slug ?? "";

  const { data: me } = useMe();
  const { data: members } = useWorkspaceMembers(workspaceSlug);

  const isGlobalAdmin = isAdminOrOwner(me?.roles);
  const myMembership = members?.find((m) => m.user_id === me?.id);
  const isWorkspaceOwner = myMembership?.role === "owner";
  const canManage = isGlobalAdmin || isWorkspaceOwner;
  const canUnbind = isGlobalAdmin || isWorkspaceOwner;

  const { data: bindings, isLoading, error } = useEnvironmentRegistries(workspaceSlug, envId);
  const deleteBinding = useDeleteBinding(workspaceSlug, envId);

  const [showBind, setShowBind] = useState(false);
  const [unbinding, setUnbinding] = useState<RegistryBinding | null>(null);
  const [browsingBinding, setBrowsingBinding] = useState<RegistryBinding | null>(null);
  const [browsingRepo, setBrowsingRepo] = useState<string | null>(null);

  const alreadyBound = (bindings ?? []).map((b) => b.registry_id);

  const handleBrowse = (b: RegistryBinding) => {
    if (browsingBinding?.id === b.id) {
      setBrowsingBinding(null);
      setBrowsingRepo(null);
    } else {
      setBrowsingBinding(b);
      setBrowsingRepo(null);
    }
  };

  const handleUnbind = async () => {
    if (!unbinding) return;
    try {
      await deleteBinding.mutateAsync(unbinding.id);
      toast.success(`Registry unbound from environment`);
      setUnbinding(null);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to unbind registry");
    }
  };

  return (
    <div className="flex flex-col h-full">
      <DashboardTopbar
        title="Registries"
        subtitle="Container registries available in this environment"
      />

      <div className="flex-1 overflow-auto p-6">
        {!workspaceSlug ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <AlertCircle className="size-4" /> No workspace selected.
          </div>
        ) : isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading registries…
          </div>
        ) : error ? (
          <QueryError error={error} />
        ) : (
          <>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-semibold">Available Registries</h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Read-only view of registries bound to this environment. Credentials are managed at
                  workspace level.
                </p>
              </div>
              {canManage && (
                <button
                  onClick={() => setShowBind(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition"
                >
                  <Plus className="size-4" /> Bind registry
                </button>
              )}
            </div>

            {bindings && bindings.length > 0 ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {bindings.map((b) => (
                    <BindingCard
                      key={b.id}
                      binding={b}
                      canUnbind={canManage}
                      onUnbind={setUnbinding}
                      onBrowse={handleBrowse}
                      isBrowsing={browsingBinding?.id === b.id}
                    />
                  ))}
                </div>
                <div className="mt-6">
                  <BoundImageBrowserPanel
                    binding={browsingBinding}
                    selectedRepo={browsingRepo}
                    onSelectRepo={setBrowsingRepo}
                    workspaceSlug={workspaceSlug}
                    envSlug={envId}
                  />
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="size-14 rounded-xl bg-secondary grid place-items-center mb-4">
                  <Container className="size-7 text-muted-foreground" />
                </div>
                <div className="font-semibold text-sm">No registries bound</div>
                <p className="text-sm text-muted-foreground mt-1 max-w-xs">
                  {canManage
                    ? "Bind a workspace registry to make it available in this environment."
                    : "No registries have been bound to this environment yet."}
                </p>
                {canManage && (
                  <button
                    onClick={() => setShowBind(true)}
                    className="mt-4 flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition"
                  >
                    <Plus className="size-4" /> Bind registry
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {showBind && (
        <BindRegistryDialog
          open={showBind}
          onClose={() => setShowBind(false)}
          workspaceSlug={workspaceSlug}
          envSlug={envId}
          alreadyBound={alreadyBound}
        />
      )}

      <AlertDialog
        open={!!unbinding}
        onOpenChange={(v) => {
          if (!v) setUnbinding(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unbind registry?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{unbinding?.registry_name}</strong> will no longer be accessible from this
              environment. The registry itself will remain in the workspace.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                void handleUnbind();
              }}
              disabled={deleteBinding.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteBinding.isPending && <Loader2 className="size-3.5 animate-spin mr-1.5" />}
              Unbind
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
