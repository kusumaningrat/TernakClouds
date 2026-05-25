import { createFileRoute } from "@tanstack/react-router";
import { DashboardTopbar } from "@/components/DashboardTopbar";
import { QueryError } from "@/components/QueryError";
import {
  Container,
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
  Copy,
  Check,
} from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  useRegistries,
  useCreateRegistry,
  useUpdateRegistry,
  useDeleteRegistry,
  useValidateRegistry,
  useRegistryRepos,
  useRegistryTags,
} from "@/lib/queries";
import { useWorkspaceContext } from "@/lib/workspace-context";
import type { RegistryProvider, RegistryProviderType } from "@/lib/types";
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

export const Route = createFileRoute("/dashboard/registries")({
  head: () => ({ meta: [{ title: "Registries · TernakClouds" }] }),
  component: RegistriesPage,
});

// ─── Provider display helpers ─────────────────────────────────────────────────

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

const PROVIDER_OPTIONS: RegistryProviderType[] = ["harbor", "dockerhub", "ghcr", "ecr", "gcr"];

// ─── Create dialog ────────────────────────────────────────────────────────────

function CreateRegistryDialog({
  open,
  onClose,
  workspaceSlug,
}: {
  open: boolean;
  onClose: () => void;
  workspaceSlug: string;
}) {
  const [name, setName] = useState("");
  const [providerType, setProviderType] = useState<RegistryProviderType>("harbor");
  const [endpoint, setEndpoint] = useState("");
  const [description, setDescription] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const create = useCreateRegistry(workspaceSlug);

  const handleClose = () => {
    setName("");
    setProviderType("harbor");
    setEndpoint("");
    setDescription("");
    setUsername("");
    setPassword("");
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const credentials: Record<string, string> = {};
    if (username) credentials.username = username;
    if (password) credentials.password = password;
    try {
      await create.mutateAsync({
        name,
        provider_type: providerType,
        endpoint: endpoint || undefined,
        description: description || undefined,
        credentials: Object.keys(credentials).length > 0 ? credentials : undefined,
      });
      toast.success(`Registry "${name}" created`);
      handleClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to create registry");
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
          <DialogTitle>Add registry</DialogTitle>
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
              placeholder="Harbor Production"
              className="mt-1.5 w-full px-3 py-2.5 rounded-md bg-secondary border border-border focus:border-primary outline-none transition text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Provider *</label>
            <select
              value={providerType}
              onChange={(e) => setProviderType(e.target.value as RegistryProviderType)}
              className="mt-1.5 w-full px-3 py-2.5 rounded-md bg-secondary border border-border focus:border-primary outline-none transition text-sm"
            >
              {PROVIDER_OPTIONS.map((p) => (
                <option key={p} value={p}>
                  {PROVIDER_LABELS[p]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Endpoint</label>
            <input
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
              placeholder="https://registry.example.com"
              className="mt-1.5 w-full px-3 py-2.5 rounded-md bg-secondary border border-border focus:border-primary outline-none transition text-sm font-mono"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Description</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Production Harbor instance…"
              className="mt-1.5 w-full px-3 py-2.5 rounded-md bg-secondary border border-border focus:border-primary outline-none transition text-sm"
            />
          </div>
          <div className="border border-border rounded-md p-3 space-y-3">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Credentials (stored in Vault)
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Username</label>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                className="mt-1 w-full px-3 py-2 rounded-md bg-secondary border border-border focus:border-primary outline-none transition text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Password / Token</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="mt-1 w-full px-3 py-2 rounded-md bg-secondary border border-border focus:border-primary outline-none transition text-sm"
              />
            </div>
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
              Add registry
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Edit dialog ──────────────────────────────────────────────────────────────

function EditRegistryDialog({
  registry,
  workspaceSlug,
  onClose,
}: {
  registry: RegistryProvider;
  workspaceSlug: string;
  onClose: () => void;
}) {
  const [name, setName] = useState(registry.name);
  const [endpoint, setEndpoint] = useState(registry.endpoint ?? "");
  const [description, setDescription] = useState(registry.description ?? "");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const update = useUpdateRegistry(workspaceSlug);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const credentials: Record<string, string> = {};
    if (username) credentials.username = username;
    if (password) credentials.password = password;
    try {
      await update.mutateAsync({
        id: registry.id,
        input: {
          name: name || undefined,
          endpoint: endpoint || undefined,
          description: description || undefined,
          credentials: Object.keys(credentials).length > 0 ? credentials : undefined,
        },
      });
      toast.success("Registry updated");
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to update registry");
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
          <DialogTitle>Edit registry</DialogTitle>
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
              {PROVIDER_LABELS[registry.provider_type as RegistryProviderType] ??
                registry.provider_type}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Endpoint</label>
            <input
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
              placeholder="https://registry.example.com"
              className="mt-1.5 w-full px-3 py-2.5 rounded-md bg-secondary border border-border focus:border-primary outline-none transition text-sm font-mono"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Description</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1.5 w-full px-3 py-2.5 rounded-md bg-secondary border border-border focus:border-primary outline-none transition text-sm"
            />
          </div>
          <div className="border border-border rounded-md p-3 space-y-3">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Rotate credentials (leave blank to keep existing)
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Username</label>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                className="mt-1 w-full px-3 py-2 rounded-md bg-secondary border border-border focus:border-primary outline-none transition text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Password / Token</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="mt-1 w-full px-3 py-2 rounded-md bg-secondary border border-border focus:border-primary outline-none transition text-sm"
              />
            </div>
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

// ─── Image browser panel (inline) ────────────────────────────────────────────

const PAGE_SIZE = 20;

function ImageBrowserPanel({
  registry,
  selectedRepo,
  onSelectRepo,
  workspaceSlug,
}: {
  registry: RegistryProvider | null;
  selectedRepo: string | null;
  onSelectRepo: (name: string | null) => void;
  workspaceSlug: string;
}) {
  const [page, setPage] = useState(1);

  useEffect(() => { setPage(1); }, [registry?.id]);
  useEffect(() => { setPage(1); }, [selectedRepo]);

  const { data: repos, isLoading: reposLoading, error: reposError } = useRegistryRepos(
    workspaceSlug,
    registry?.id ?? "",
    !!registry,
  );
  const { data: tags, isLoading: tagsLoading, error: tagsError } = useRegistryTags(
    workspaceSlug,
    registry?.id ?? "",
    selectedRepo ?? "",
    !!registry && !!selectedRepo,
  );

  if (!registry) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card/50 flex flex-col items-center justify-center py-16 text-center">
        <FolderOpen className="size-8 text-muted-foreground/40 mb-3" />
        <p className="text-sm text-muted-foreground">
          Click <span className="font-medium text-foreground">Browse images</span> on a registry card to explore its repositories.
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
            <span className="text-xs text-muted-foreground">{registry.name}</span>
            <span className="text-xs text-muted-foreground">/</span>
            <span className="text-xs font-mono font-medium">{selectedRepo}</span>
          </>
        ) : (
          <>
            <Container className="size-3.5 text-muted-foreground shrink-0" />
            <span className="text-xs font-medium">{registry.name}</span>
            <span className="text-xs text-muted-foreground">— Repositories</span>
          </>
        )}
      </div>

      {/* Table content */}
      {selectedRepo ? (
        tagsLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-10 justify-center">
            <Loader2 className="size-4 animate-spin" /> Loading tags…
          </div>
        ) : tagsError ? (
          <div className="py-4 px-2">
            <QueryError error={tagsError} />
          </div>
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
                const cmd = pullCmd(registry.endpoint, selectedRepo, tag.name);
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
        <div className="py-4 px-2">
          <QueryError error={reposError} />
        </div>
      ) : !repos || repos.length === 0 ? (
        <div className="text-sm text-muted-foreground py-10 text-center">No repositories found in this registry.</div>
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

// ─── Registry card ────────────────────────────────────────────────────────────

function RegistryCard({
  registry,
  workspaceSlug,
  onEdit,
  onDelete,
  onBrowse,
  isBrowsing,
}: {
  registry: RegistryProvider;
  workspaceSlug: string;
  onEdit: (r: RegistryProvider) => void;
  onDelete: (r: RegistryProvider) => void;
  onBrowse: (r: RegistryProvider) => void;
  isBrowsing: boolean;
}) {
  const [validateResult, setValidateResult] = useState<"ok" | "fail" | null>(null);
  const validate = useValidateRegistry(workspaceSlug);
  const gradient =
    PROVIDER_COLORS[registry.provider_type as RegistryProviderType] ??
    "from-slate-400 to-slate-600";

  const handleValidate = async () => {
    setValidateResult(null);
    try {
      await validate.mutateAsync(registry.id);
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
            <Container className="size-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm truncate">{registry.name}</div>
            <div className="text-[11px] text-muted-foreground font-mono mt-0.5">
              {PROVIDER_LABELS[registry.provider_type as RegistryProviderType] ??
                registry.provider_type}
            </div>
            {registry.endpoint && (
              <div className="text-[11px] text-muted-foreground font-mono truncate mt-0.5">
                {registry.endpoint}
              </div>
            )}
            {registry.description && (
              <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                {registry.description}
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
            onClick={() => onBrowse(registry)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs transition ${
              isBrowsing
                ? "bg-primary/15 text-primary border border-primary/30"
                : "bg-secondary hover:bg-accent"
            }`}
          >
            <FolderOpen className="size-3.5" />
            Browse images
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
            onClick={() => onEdit(registry)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-secondary hover:bg-accent text-xs transition"
          >
            <Pencil className="size-3.5" /> Manage
          </button>
          <button
            onClick={() => onDelete(registry)}
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

function RegistriesPage() {
  const { selectedWorkspace } = useWorkspaceContext();
  const workspaceSlug = selectedWorkspace?.slug ?? "";

  const { data: registries, isLoading, error } = useRegistries(workspaceSlug);
  const deleteRegistry = useDeleteRegistry(workspaceSlug);

  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<RegistryProvider | null>(null);
  const [deleting, setDeleting] = useState<RegistryProvider | null>(null);
  const [browsingRegistry, setBrowsingRegistry] = useState<RegistryProvider | null>(null);
  const [browsingRepo, setBrowsingRepo] = useState<string | null>(null);

  const handleBrowse = (r: RegistryProvider) => {
    if (browsingRegistry?.id === r.id) {
      setBrowsingRegistry(null);
      setBrowsingRepo(null);
    } else {
      setBrowsingRegistry(r);
      setBrowsingRepo(null);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      await deleteRegistry.mutateAsync(deleting.id);
      toast.success(`Registry "${deleting.name}" deleted`);
      setDeleting(null);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to delete registry");
    }
  };

  return (
    <div className="flex flex-col h-full">
      <DashboardTopbar
        title="Registries"
        subtitle="Workspace-level container registry connections"
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
                <h2 className="text-lg font-semibold">Container Registries</h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Shared registry connections available to all environments in this workspace.
                </p>
              </div>
              <button
                onClick={() => setShowCreate(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition"
              >
                <Plus className="size-4" /> Add registry
              </button>
            </div>

            {registries && registries.length > 0 ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {registries.map((r) => (
                    <RegistryCard
                      key={r.id}
                      registry={r}
                      workspaceSlug={workspaceSlug}
                      onEdit={setEditing}
                      onDelete={setDeleting}
                      onBrowse={handleBrowse}
                      isBrowsing={browsingRegistry?.id === r.id}
                    />
                  ))}
                </div>
                <div className="mt-6">
                  <ImageBrowserPanel
                    registry={browsingRegistry}
                    selectedRepo={browsingRepo}
                    onSelectRepo={setBrowsingRepo}
                    workspaceSlug={workspaceSlug}
                  />
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="size-14 rounded-xl bg-secondary grid place-items-center mb-4">
                  <Container className="size-7 text-muted-foreground" />
                </div>
                <div className="font-semibold text-sm">No registries yet</div>
                <p className="text-sm text-muted-foreground mt-1 max-w-xs">
                  Add a container registry to share it across all environments in this workspace.
                </p>
                <button
                  onClick={() => setShowCreate(true)}
                  className="mt-4 flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition"
                >
                  <Plus className="size-4" /> Add registry
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {showCreate && (
        <CreateRegistryDialog
          open={showCreate}
          onClose={() => setShowCreate(false)}
          workspaceSlug={workspaceSlug}
        />
      )}

      {editing && (
        <EditRegistryDialog
          registry={editing}
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
            <AlertDialogTitle>Delete registry?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{deleting?.name}</strong> will be permanently removed. Any environment
              bindings that reference this registry will stop working.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                void handleDelete();
              }}
              disabled={deleteRegistry.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteRegistry.isPending && <Loader2 className="size-3.5 animate-spin mr-1.5" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
