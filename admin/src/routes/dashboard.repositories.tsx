import { createFileRoute } from "@tanstack/react-router";
import { DashboardTopbar } from "@/components/DashboardTopbar";
import { QueryError } from "@/components/QueryError";
import {
  GitBranch,
  Plus,
  Loader2,
  AlertCircle,
  Pencil,
  Trash2,
  CheckCircle2,
  XCircle,
  RefreshCw,
  FolderOpen,
  ArrowLeft,
  GitFork,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  useRepoProviders,
  useCreateRepoProvider,
  useUpdateRepoProvider,
  useDeleteRepoProvider,
  useValidateRepoProvider,
  useRepoProviderRepos,
  useRepoProviderBranches,
} from "@/lib/queries";
import { useWorkspaceContext } from "@/lib/workspace-context";
import type { RepoProvider, RepoProviderType, SCMRepo } from "@/lib/types";
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

export const Route = createFileRoute("/dashboard/repositories")({
  head: () => ({ meta: [{ title: "Repository Providers · TernakClouds" }] }),
  component: RepositoriesPage,
});

// ─── Provider display helpers ─────────────────────────────────────────────────

const PROVIDER_LABELS: Record<RepoProviderType, string> = {
  github: "GitHub",
  gitlab: "GitLab",
};

const PROVIDER_COLORS: Record<RepoProviderType, string> = {
  github: "from-gray-600 to-slate-800",
  gitlab: "from-orange-500 to-red-500",
};

const PROVIDER_OPTIONS: RepoProviderType[] = ["github", "gitlab"];

// ─── Create dialog ────────────────────────────────────────────────────────────

function CreateProviderDialog({
  open,
  onClose,
  workspaceSlug,
}: {
  open: boolean;
  onClose: () => void;
  workspaceSlug: string;
}) {
  const [name, setName] = useState("");
  const [providerType, setProviderType] = useState<RepoProviderType>("github");
  const [baseURL, setBaseURL] = useState("");
  const [description, setDescription] = useState("");
  const [token, setToken] = useState("");
  const [allowedReposRaw, setAllowedReposRaw] = useState("");
  const create = useCreateRepoProvider(workspaceSlug);

  const handleClose = () => {
    setName("");
    setProviderType("github");
    setBaseURL("");
    setDescription("");
    setToken("");
    setAllowedReposRaw("");
    onClose();
  };

  const parseAllowedRepos = (raw: string) =>
    raw
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const allowedRepos = parseAllowedRepos(allowedReposRaw);
    try {
      await create.mutateAsync({
        name,
        provider_type: providerType,
        base_url: baseURL || undefined,
        description: description || undefined,
        credentials: token ? { token } : undefined,
        allowed_repos: allowedRepos.length > 0 ? allowedRepos : undefined,
      });
      toast.success(`Repository provider "${name}" created`);
      handleClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to create repository provider");
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) handleClose();
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add repository provider</DialogTitle>
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
              onChange={(e) => setName(e.target.value)}
              placeholder="GitHub Production"
              className="mt-1.5 w-full px-3 py-2.5 rounded-md bg-secondary border border-border focus:border-primary outline-none transition text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Provider *</label>
            <select
              value={providerType}
              onChange={(e) => setProviderType(e.target.value as RepoProviderType)}
              className="mt-1.5 w-full px-3 py-2.5 rounded-md bg-secondary border border-border focus:border-primary outline-none transition text-sm"
            >
              {PROVIDER_OPTIONS.map((p) => (
                <option key={p} value={p}>
                  {PROVIDER_LABELS[p]}
                </option>
              ))}
            </select>
          </div>
          {providerType === "gitlab" && (
            <div>
              <label className="text-xs font-medium text-muted-foreground">Base URL</label>
              <input
                value={baseURL}
                onChange={(e) => setBaseURL(e.target.value)}
                placeholder="https://gitlab.com"
                className="mt-1.5 w-full px-3 py-2.5 rounded-md bg-secondary border border-border focus:border-primary outline-none transition text-sm font-mono"
              />
              <p className="mt-1 text-xs text-muted-foreground">Leave blank for GitLab.com</p>
            </div>
          )}
          <div>
            <label className="text-xs font-medium text-muted-foreground">Description</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Production GitHub organisation…"
              className="mt-1.5 w-full px-3 py-2.5 rounded-md bg-secondary border border-border focus:border-primary outline-none transition text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              Allowed repositories
              <span className="ml-1.5 text-muted-foreground/60 font-normal">(optional)</span>
            </label>
            <textarea
              value={allowedReposRaw}
              onChange={(e) => setAllowedReposRaw(e.target.value)}
              placeholder={"kusumaningrat/my-repo\nmy-org/another-repo"}
              rows={3}
              className="mt-1.5 w-full px-3 py-2.5 rounded-md bg-secondary border border-border focus:border-primary outline-none transition text-sm font-mono resize-none"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              One <code>owner/repo</code> per line. When set, only these repos are shown — useful
              for fine-grained PATs scoped to specific repositories.
            </p>
          </div>
          <div className="border border-border rounded-md p-3 space-y-3">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Credentials (stored in Vault)
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Personal Access Token *</label>
              <input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="ghp_••••••••  /  glpat-••••••••"
                className="mt-1 w-full px-3 py-2 rounded-md bg-secondary border border-border focus:border-primary outline-none transition text-sm font-mono"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {providerType === "github"
                ? "Fine-grained PAT: Contents (read & write) + Metadata (read). Classic PAT: repo scope."
                : "Requires api, read_repository, write_repository scopes."}
            </p>
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
              Add provider
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Edit dialog ──────────────────────────────────────────────────────────────

function EditProviderDialog({
  provider,
  workspaceSlug,
  onClose,
}: {
  provider: RepoProvider;
  workspaceSlug: string;
  onClose: () => void;
}) {
  const [name, setName] = useState(provider.name);
  const [baseURL, setBaseURL] = useState(provider.base_url ?? "");
  const [description, setDescription] = useState(provider.description ?? "");
  const [token, setToken] = useState("");
  const [allowedReposRaw, setAllowedReposRaw] = useState((provider.allowed_repos ?? []).join("\n"));
  const update = useUpdateRepoProvider(workspaceSlug);

  const parseAllowedRepos = (raw: string) =>
    raw
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const allowedRepos = parseAllowedRepos(allowedReposRaw);
    try {
      await update.mutateAsync({
        id: provider.id,
        input: {
          name: name || undefined,
          base_url: baseURL || undefined,
          description: description || undefined,
          credentials: token ? { token } : undefined,
          allowed_repos: allowedRepos,
        },
      });
      toast.success("Repository provider updated");
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to update repository provider");
    }
  };

  return (
    <Dialog
      open
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit repository provider</DialogTitle>
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
            <label className="text-xs font-medium text-muted-foreground">Provider</label>
            <div className="mt-1.5 px-3 py-2.5 rounded-md bg-secondary border border-border text-sm text-muted-foreground">
              {PROVIDER_LABELS[provider.provider_type]}
            </div>
          </div>
          {provider.provider_type === "gitlab" && (
            <div>
              <label className="text-xs font-medium text-muted-foreground">Base URL</label>
              <input
                value={baseURL}
                onChange={(e) => setBaseURL(e.target.value)}
                placeholder="https://gitlab.com"
                className="mt-1.5 w-full px-3 py-2.5 rounded-md bg-secondary border border-border focus:border-primary outline-none transition text-sm font-mono"
              />
            </div>
          )}
          <div>
            <label className="text-xs font-medium text-muted-foreground">Description</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1.5 w-full px-3 py-2.5 rounded-md bg-secondary border border-border focus:border-primary outline-none transition text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              Allowed repositories
              <span className="ml-1.5 text-muted-foreground/60 font-normal">(optional)</span>
            </label>
            <textarea
              value={allowedReposRaw}
              onChange={(e) => setAllowedReposRaw(e.target.value)}
              placeholder={"kusumaningrat/my-repo\nmy-org/another-repo"}
              rows={3}
              className="mt-1.5 w-full px-3 py-2.5 rounded-md bg-secondary border border-border focus:border-primary outline-none transition text-sm font-mono resize-none"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              One <code>owner/repo</code> per line. Leave blank to show all accessible repos.
            </p>
          </div>
          <div className="border border-border rounded-md p-3 space-y-3">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Rotate token (leave blank to keep existing)
            </div>
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3 py-2 rounded-md bg-secondary border border-border focus:border-primary outline-none transition text-sm font-mono"
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
              Save
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Repository browser panel ─────────────────────────────────────────────────

const PAGE_SIZE = 20;

function RepoBrowserPanel({
  provider,
  selectedRepo,
  onSelectRepo,
  workspaceSlug,
}: {
  provider: RepoProvider | null;
  selectedRepo: SCMRepo | null;
  onSelectRepo: (r: SCMRepo | null) => void;
  workspaceSlug: string;
}) {
  const {
    data: repos,
    isLoading: reposLoading,
    error: reposError,
  } = useRepoProviderRepos(workspaceSlug, provider?.id ?? "", !!provider);
  const {
    data: branches,
    isLoading: branchesLoading,
    error: branchesError,
  } = useRepoProviderBranches(
    workspaceSlug,
    provider?.id ?? "",
    selectedRepo?.full_name ?? "",
    !!provider && !!selectedRepo,
  );

  const [page, setPage] = useState(1);

  if (!provider) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card/50 flex flex-col items-center justify-center py-16 text-center">
        <FolderOpen className="size-8 text-muted-foreground/40 mb-3" />
        <p className="text-sm text-muted-foreground">
          Click <span className="font-medium text-foreground">Browse repos</span> on a provider card
          to explore its repositories.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
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
            <span className="text-xs text-muted-foreground">{provider.name}</span>
            <span className="text-xs text-muted-foreground">/</span>
            <span className="text-xs font-mono font-medium">{selectedRepo.full_name}</span>
            <span className="text-xs text-muted-foreground">— Branches</span>
          </>
        ) : (
          <>
            <GitFork className="size-3.5 text-muted-foreground shrink-0" />
            <span className="text-xs font-medium">{provider.name}</span>
            <span className="text-xs text-muted-foreground">— Repositories</span>
          </>
        )}
      </div>

      {selectedRepo ? (
        branchesLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-10 justify-center">
            <Loader2 className="size-4 animate-spin" /> Loading branches…
          </div>
        ) : branchesError ? (
          <div className="py-4 px-2">
            <QueryError error={branchesError} />
          </div>
        ) : !branches || branches.length === 0 ? (
          <div className="text-sm text-muted-foreground py-10 text-center">No branches found.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-secondary/60">
              <tr className="border-b border-border">
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Branch
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  SHA
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Protected
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {branches.map((br) => (
                <tr key={br.name} className="hover:bg-accent/40 transition">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <GitBranch className="size-3.5 text-muted-foreground shrink-0" />
                      <span className="font-mono text-xs">{br.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {br.sha ? br.sha.slice(0, 10) : "—"}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {br.protected ? (
                      <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600 font-medium text-[11px]">
                        Protected
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      ) : reposLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-10 justify-center">
          <Loader2 className="size-4 animate-spin" /> Loading repositories…
        </div>
      ) : reposError ? (
        <div className="py-4 px-2">
          <QueryError error={reposError} />
        </div>
      ) : !repos || repos.length === 0 ? (
        <div className="text-sm text-muted-foreground py-10 text-center">
          No repositories found.
        </div>
      ) : (
        (() => {
          const totalPages = Math.ceil(repos.length / PAGE_SIZE);
          const paged = repos.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
          return (
            <>
              <table className="w-full text-sm">
                <thead className="bg-secondary/60">
                  <tr className="border-b border-border">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Repository
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Visibility
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Default Branch
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {paged.map((repo) => (
                    <tr
                      key={repo.full_name}
                      onClick={() => onSelectRepo(repo)}
                      className="hover:bg-accent/40 cursor-pointer transition"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <FolderOpen className="size-3.5 text-muted-foreground shrink-0" />
                          <span className="font-mono text-xs">{repo.full_name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[11px] font-medium ${
                            repo.visibility === "private"
                              ? "bg-secondary text-muted-foreground"
                              : "bg-emerald-500/10 text-emerald-600"
                          }`}
                        >
                          {repo.visibility ?? "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        {repo.default_branch ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-secondary/30">
                  <span className="text-xs text-muted-foreground">
                    {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, repos.length)} of{" "}
                    {repos.length} repositories
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      disabled={page === 1}
                      onClick={() => setPage((p) => p - 1)}
                      className="px-2.5 py-1 rounded text-xs bg-secondary hover:bg-accent disabled:opacity-40 transition"
                    >
                      Previous
                    </button>
                    <span className="text-xs text-muted-foreground font-mono">
                      {page} / {totalPages}
                    </span>
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
        })()
      )}
    </div>
  );
}

// ─── Provider card ────────────────────────────────────────────────────────────

function ProviderCard({
  provider,
  workspaceSlug,
  onEdit,
  onDelete,
  onBrowse,
  isBrowsing,
}: {
  provider: RepoProvider;
  workspaceSlug: string;
  onEdit: (p: RepoProvider) => void;
  onDelete: (p: RepoProvider) => void;
  onBrowse: (p: RepoProvider) => void;
  isBrowsing: boolean;
}) {
  const [validateResult, setValidateResult] = useState<"ok" | "fail" | null>(null);
  const validate = useValidateRepoProvider(workspaceSlug);
  const gradient = PROVIDER_COLORS[provider.provider_type] ?? "from-slate-400 to-slate-600";

  const handleValidate = async () => {
    setValidateResult(null);
    try {
      await validate.mutateAsync(provider.id);
      setValidateResult("ok");
      toast.success("Connection validated");
    } catch (err: unknown) {
      setValidateResult("fail");
      toast.error(err instanceof Error ? err.message : "Connection failed");
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className={`h-1.5 bg-gradient-to-r ${gradient}`} />
      <div className="p-5">
        <div className="flex items-start gap-3">
          <div
            className={`size-10 rounded-lg bg-gradient-to-br ${gradient} grid place-items-center shrink-0`}
          >
            <GitFork className="size-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm truncate">{provider.name}</div>
            <div className="text-[11px] text-muted-foreground font-mono mt-0.5">
              {PROVIDER_LABELS[provider.provider_type]}
            </div>
            {provider.base_url && (
              <div className="text-[11px] text-muted-foreground font-mono truncate mt-0.5">
                {provider.base_url}
              </div>
            )}
            {provider.description && (
              <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                {provider.description}
              </div>
            )}
          </div>
        </div>

        {validateResult && (
          <div
            className={`mt-3 flex items-center gap-2 text-xs px-2.5 py-1.5 rounded-md ${
              validateResult === "ok"
                ? "bg-emerald-500/10 text-emerald-600"
                : "bg-destructive/10 text-destructive"
            }`}
          >
            {validateResult === "ok" ? (
              <>
                <CheckCircle2 className="size-3.5" /> Connected
              </>
            ) : (
              <>
                <XCircle className="size-3.5" /> Connection failed
              </>
            )}
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={() => onBrowse(provider)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs transition ${
              isBrowsing
                ? "bg-primary/15 text-primary border border-primary/30"
                : "bg-secondary hover:bg-accent"
            }`}
          >
            <FolderOpen className="size-3.5" />
            Browse repos
          </button>
          <button
            onClick={() => {
              void handleValidate();
            }}
            disabled={validate.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-secondary hover:bg-accent text-xs transition disabled:opacity-60"
          >
            {validate.isPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <RefreshCw className="size-3.5" />
            )}
            Validate
          </button>
          <button
            onClick={() => onEdit(provider)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-secondary hover:bg-accent text-xs transition"
          >
            <Pencil className="size-3.5" /> Manage
          </button>
          <button
            onClick={() => onDelete(provider)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-secondary hover:bg-destructive/20 text-xs text-destructive transition"
          >
            <Trash2 className="size-3.5" /> Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function RepositoriesPage() {
  const { selectedWorkspace } = useWorkspaceContext();
  const workspaceSlug = selectedWorkspace?.slug ?? "";

  const { data: providers, isLoading, error } = useRepoProviders(workspaceSlug);
  const deleteProvider = useDeleteRepoProvider(workspaceSlug);

  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<RepoProvider | null>(null);
  const [deleting, setDeleting] = useState<RepoProvider | null>(null);
  const [browsingProvider, setBrowsingProvider] = useState<RepoProvider | null>(null);
  const [browsingRepo, setBrowsingRepo] = useState<SCMRepo | null>(null);

  const handleBrowse = (p: RepoProvider) => {
    if (browsingProvider?.id === p.id) {
      setBrowsingProvider(null);
      setBrowsingRepo(null);
    } else {
      setBrowsingProvider(p);
      setBrowsingRepo(null);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      await deleteProvider.mutateAsync(deleting.id);
      toast.success(`Repository provider "${deleting.name}" deleted`);
      setDeleting(null);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to delete repository provider");
    }
  };

  return (
    <div className="flex flex-col h-full">
      <DashboardTopbar
        title="Repository Providers"
        subtitle="Workspace-level SCM connections for GitHub and GitLab"
      />

      <div className="flex-1 overflow-auto p-6">
        {!workspaceSlug ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <AlertCircle className="size-4" /> No workspace selected.
          </div>
        ) : isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading repository providers…
          </div>
        ) : error ? (
          <QueryError error={error} />
        ) : (
          <>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-semibold">Repository Providers</h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Connect GitHub or GitLab to store generated manifests and automate GitOps
                  workflows.
                </p>
              </div>
              <button
                onClick={() => setShowCreate(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition"
              >
                <Plus className="size-4" /> Add provider
              </button>
            </div>

            {providers && providers.length > 0 ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {providers.map((p) => (
                    <ProviderCard
                      key={p.id}
                      provider={p}
                      workspaceSlug={workspaceSlug}
                      onEdit={setEditing}
                      onDelete={setDeleting}
                      onBrowse={handleBrowse}
                      isBrowsing={browsingProvider?.id === p.id}
                    />
                  ))}
                </div>
                <div className="mt-6">
                  <RepoBrowserPanel
                    provider={browsingProvider}
                    selectedRepo={browsingRepo}
                    onSelectRepo={setBrowsingRepo}
                    workspaceSlug={workspaceSlug}
                  />
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="size-14 rounded-xl bg-secondary grid place-items-center mb-4">
                  <GitFork className="size-7 text-muted-foreground" />
                </div>
                <div className="font-semibold text-sm">No repository providers yet</div>
                <p className="text-sm text-muted-foreground mt-1 max-w-xs">
                  Connect GitHub or GitLab to enable manifest storage and GitOps workflows.
                </p>
                <button
                  onClick={() => setShowCreate(true)}
                  className="mt-4 flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition"
                >
                  <Plus className="size-4" /> Add provider
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {showCreate && (
        <CreateProviderDialog
          open={showCreate}
          onClose={() => setShowCreate(false)}
          workspaceSlug={workspaceSlug}
        />
      )}

      {editing && (
        <EditProviderDialog
          provider={editing}
          workspaceSlug={workspaceSlug}
          onClose={() => setEditing(null)}
        />
      )}

      <AlertDialog
        open={!!deleting}
        onOpenChange={(v) => {
          if (!v) setDeleting(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete repository provider?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{deleting?.name}</strong> will be permanently removed along with its stored
              credentials. Any workflows that depend on this provider will stop working.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                void handleDelete();
              }}
              disabled={deleteProvider.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteProvider.isPending && <Loader2 className="size-3.5 animate-spin mr-1.5" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
