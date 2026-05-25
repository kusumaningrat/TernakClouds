import { createFileRoute, useParams } from "@tanstack/react-router";
import { createPortal } from "react-dom";
import { DashboardTopbar } from "@/components/DashboardTopbar";
import { useWorkspaceContext } from "@/lib/workspace-context";
import { useMe } from "@/lib/queries";
import {
  useSecretGrants,
  useSecretValue,
  useWriteSecretValue,
  useCreateSecretGrant,
  useUpdateSecretGrant,
  useDeleteSecretGrant,
} from "@/lib/queries";
import { useState } from "react";
import {
  KeyRound,
  Lock,
  Plus,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  Copy,
  Check,
  Loader2,
  AlertTriangle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  X,
  Save,
  ShieldAlert,
  CheckCircle2,
  ArrowRight,
  FileKey,
  FilePen,
} from "lucide-react";
import type {
  SecretGrant,
  SecretGrantAdminView,
  SecretGrantMemberView,
  SecretEntry,
} from "@/lib/types";
import { isAdminGrant } from "@/lib/types";

export const Route = createFileRoute("/dashboard/environments/$envId/secrets")({
  head: () => ({ meta: [{ title: "Secrets · TernakClouds" }] }),
  component: EnvSecretsPage,
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function isSensitiveKey(k: string) {
  const l = k.toLowerCase();
  return ["password", "pass", "secret", "token", "key", "auth", "credential", "private"].some((s) =>
    l.includes(s),
  );
}

type KVPair = { id: string; key: string; value: string; masked: boolean };

// ─── UI atoms ─────────────────────────────────────────────────────────────────

function Field({
  label,
  hint,
  placeholder,
  value,
  onChange,
  monospace = false,
}: {
  label: string;
  hint?: string;
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
  monospace?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        {label}
      </label>
      <input
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full px-3 py-2 rounded-md border border-border bg-background text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary/50 ${monospace ? "font-mono" : ""}`}
      />
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        void navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        });
      }}
      title="Copy"
      className="p-1 rounded hover:bg-accent transition text-muted-foreground shrink-0"
    >
      {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
    </button>
  );
}

// ─── KV editor rows (shared) ─────────────────────────────────────────────────

function KVEditorRows({
  pairs,
  onUpdate,
  onToggleMask,
  onRemove,
  onAdd,
}: {
  pairs: KVPair[];
  onUpdate: (id: string, field: "key" | "value", val: string) => void;
  onToggleMask: (id: string) => void;
  onRemove: (id: string) => void;
  onAdd: () => void;
}) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[1fr_1fr_28px_28px] gap-2 px-0.5">
        <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
          Key
        </span>
        <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
          Value
        </span>
        <span />
        <span />
      </div>

      {pairs.length === 0 && (
        <div className="rounded-lg border border-dashed border-border py-6 flex flex-col items-center gap-1.5 text-muted-foreground">
          <KeyRound className="size-5 opacity-30" />
          <p className="text-xs">No key-value pairs yet</p>
        </div>
      )}

      {pairs.map((pair) => (
        <div key={pair.id} className="grid grid-cols-[1fr_1fr_28px_28px] gap-2 items-center">
          <input
            type="text"
            placeholder="key"
            value={pair.key}
            onChange={(e) => onUpdate(pair.id, "key", e.target.value)}
            className="px-2.5 py-1.5 rounded-md border border-border bg-background text-xs font-mono placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
          <input
            type={pair.masked ? "password" : "text"}
            placeholder="value"
            value={pair.value}
            onChange={(e) => onUpdate(pair.id, "value", e.target.value)}
            className="px-2.5 py-1.5 rounded-md border border-border bg-background text-xs font-mono placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
          <button
            onClick={() => onToggleMask(pair.id)}
            title={pair.masked ? "Show" : "Mask"}
            className="p-1 rounded hover:bg-accent transition text-muted-foreground"
          >
            {pair.masked ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
          </button>
          <button
            onClick={() => onRemove(pair.id)}
            title="Remove"
            className="p-1 rounded hover:bg-destructive/10 transition text-muted-foreground hover:text-destructive"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ))}

      <button
        onClick={onAdd}
        className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 font-medium transition pt-1"
      >
        <Plus className="size-3.5" /> Add key-value pair
      </button>
    </div>
  );
}

// ─── Sub-secret row ───────────────────────────────────────────────────────────

function SubSecretRow({
  entry,
  vaultPath,
  isOwner,
  onClick,
}: {
  entry: SecretEntry;
  vaultPath: string;
  isOwner: boolean;
  onClick: () => void;
}) {
  const label = entry.path === "" ? "(root)" : (entry.path.split("/").pop() ?? entry.path);
  const subLabel = entry.path !== "" && entry.path.includes("/") ? entry.path : null;
  const fullPath =
    entry.path === "" ? vaultPath : vaultPath ? `${vaultPath}/${entry.path}` : entry.path;
  const keyCount = Object.keys(entry.data).length;

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-3 rounded-lg border border-border hover:border-primary/40 hover:bg-primary/5 transition text-left group"
    >
      <div className="size-8 rounded-md bg-secondary border border-border grid place-items-center shrink-0">
        <FileKey className="size-3.5 text-muted-foreground group-hover:text-primary transition" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium leading-tight">{label}</p>
        {subLabel && <p className="text-[11px] text-muted-foreground truncate">{subLabel}</p>}
        {isOwner && fullPath && (
          <p className="text-[11px] font-mono text-muted-foreground/70 truncate mt-0.5">
            {fullPath}
          </p>
        )}
      </div>

      <div className="flex items-center gap-2.5 shrink-0">
        <span className="text-xs font-mono text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">
          {keyCount} {keyCount === 1 ? "key" : "keys"}
        </span>
        <ArrowRight className="size-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
      </div>
    </button>
  );
}

// ─── Secret detail drawer ─────────────────────────────────────────────────────

function SecretDetailDrawer({
  grant,
  entry,
  slug,
  envId,
  isOwner,
  onClose,
}: {
  grant: SecretGrant;
  entry: SecretEntry;
  slug: string;
  envId: string;
  isOwner: boolean;
  onClose: () => void;
}) {
  const [editMode, setEditMode] = useState(false);
  const [pairs, setPairs] = useState<KVPair[]>([]);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const write = useWriteSecretValue();

  const vaultPath = isAdminGrant(grant) ? grant.vault_path : null;
  const label = entry.path === "" ? grant.name : (entry.path.split("/").pop() ?? entry.path);
  const fullPath = !vaultPath ? null : entry.path === "" ? vaultPath : `${vaultPath}/${entry.path}`;

  const startEdit = () => {
    setPairs(
      Object.entries(entry.data).map(([key, value]) => ({
        id: crypto.randomUUID(),
        key,
        value,
        masked: isSensitiveKey(key),
      })),
    );
    setSaveError(null);
    setEditMode(true);
  };

  const handleSave = async () => {
    setSaveError(null);
    const data = Object.fromEntries(
      pairs.filter((p) => p.key.trim()).map((p) => [p.key.trim(), p.value]),
    );
    try {
      await write.mutateAsync({ slug, envSlug: envId, id: grant.id, path: entry.path, data });
      setSaved(true);
      setTimeout(onClose, 1400);
    } catch (e) {
      setSaveError((e as { message?: string })?.message ?? "Failed to write to Vault.");
    }
  };

  const updatePair = (id: string, field: "key" | "value", val: string) =>
    setPairs((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        const next = { ...p, [field]: val };
        if (field === "key") next.masked = isSensitiveKey(val);
        return next;
      }),
    );

  const toggleReveal = (k: string) =>
    setRevealed((prev) => {
      const next = new Set(prev);
      next.has(k) ? next.delete(k) : next.add(k);
      return next;
    });

  const canSave = pairs.some((p) => p.key.trim()) && !write.isPending && !saved;

  return createPortal(
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="w-[520px] shrink-0 flex flex-col bg-background border-l border-border shadow-2xl">
        {/* Header */}
        <div className="px-5 py-4 border-b border-border bg-secondary/20 space-y-1">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div className="size-9 rounded-lg bg-primary/10 grid place-items-center shrink-0">
                <FileKey className="size-4 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-sm leading-tight">{label}</p>
                {fullPath ? (
                  <div className="flex items-center gap-1 mt-0.5">
                    <code className="text-[11px] font-mono text-muted-foreground bg-secondary px-1.5 py-0.5 rounded truncate max-w-[340px]">
                      {fullPath}
                    </code>
                    <CopyButton text={fullPath} />
                  </div>
                ) : (
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {entry.path || "Direct secret"}
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-md hover:bg-accent transition shrink-0"
            >
              <X className="size-4 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {/* ── Read-only view ── */}
          {!editMode && (
            <div className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Current data
                </h4>
                <span className="text-[11px] font-mono text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">
                  {Object.keys(entry.data).length}{" "}
                  {Object.keys(entry.data).length === 1 ? "key" : "keys"}
                </span>
              </div>

              {Object.keys(entry.data).length === 0 ? (
                <div className="rounded-lg border border-dashed border-border py-8 flex flex-col items-center gap-2 text-muted-foreground">
                  <KeyRound className="size-5 opacity-30" />
                  <p className="text-xs">No data at this path yet</p>
                </div>
              ) : (
                <div className="rounded-lg border border-border overflow-hidden">
                  {Object.entries(entry.data).map(([key, val], i, arr) => {
                    const isRevealed = revealed.has(key);
                    return (
                      <div
                        key={key}
                        className={`flex items-center gap-3 px-3 py-2.5 ${i < arr.length - 1 ? "border-b border-border/60" : ""}`}
                      >
                        <span className="text-xs font-mono font-medium text-foreground w-32 shrink-0 truncate">
                          {key}
                        </span>
                        <span
                          className={`flex-1 text-xs font-mono truncate ${isRevealed ? "text-foreground" : "text-muted-foreground tracking-widest"}`}
                        >
                          {isRevealed ? val : "••••••••••••"}
                        </span>
                        <button
                          onClick={() => toggleReveal(key)}
                          className="shrink-0 p-1 rounded hover:bg-accent transition text-muted-foreground"
                          title={isRevealed ? "Hide" : "Reveal"}
                        >
                          {isRevealed ? (
                            <EyeOff className="size-3.5" />
                          ) : (
                            <Eye className="size-3.5" />
                          )}
                        </button>
                        <CopyButton text={val} />
                      </div>
                    );
                  })}
                </div>
              )}

              <button
                onClick={startEdit}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-primary/30 bg-primary/5 text-primary text-sm font-medium hover:bg-primary/10 transition"
              >
                <FilePen className="size-4" /> Create new version
              </button>
            </div>
          )}

          {/* ── Version editor ── */}
          {editMode && (
            <div className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  New version
                </h4>
                <span className="text-[11px] text-muted-foreground">
                  Saving creates a new Vault KV version
                </span>
              </div>

              <KVEditorRows
                pairs={pairs}
                onUpdate={updatePair}
                onToggleMask={(id) =>
                  setPairs((p) => p.map((r) => (r.id === id ? { ...r, masked: !r.masked } : r)))
                }
                onRemove={(id) => setPairs((p) => p.filter((r) => r.id !== id))}
                onAdd={() =>
                  setPairs((p) => [
                    ...p,
                    { id: crypto.randomUUID(), key: "", value: "", masked: false },
                  ])
                }
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-border bg-secondary/10 space-y-3">
          {saveError && (
            <div className="flex items-center gap-2 text-xs text-destructive">
              <AlertCircle className="size-3.5 shrink-0" /> {saveError}
            </div>
          )}

          {saved ? (
            <div className="flex items-center justify-center gap-2 py-2.5 text-sm text-success font-medium rounded-md bg-success/10">
              <CheckCircle2 className="size-4" /> New version saved to Vault
            </div>
          ) : editMode ? (
            <div className="flex gap-2.5">
              <button
                onClick={() => setEditMode(false)}
                disabled={write.isPending}
                className="flex-1 py-2 rounded-md border border-border text-sm hover:bg-accent transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleSave()}
                disabled={!canSave}
                className="flex-1 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {write.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Save className="size-4" />
                )}
                Save version
              </button>
            </div>
          ) : (
            <button
              onClick={onClose}
              className="w-full py-2 rounded-md border border-border text-sm hover:bg-accent transition"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ─── Grant metadata forms ─────────────────────────────────────────────────────

function MemberEditGrantForm({
  grant,
  slug,
  envId,
  onDone,
}: {
  grant: SecretGrantMemberView;
  slug: string;
  envId: string;
  onDone: () => void;
}) {
  const [form, setForm] = useState({ name: grant.name, description: grant.description ?? "" });
  const [error, setError] = useState<string | null>(null);
  const update = useUpdateSecretGrant();

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      setError("Name is required.");
      return;
    }
    setError(null);
    try {
      await update.mutateAsync({
        slug,
        envSlug: envId,
        id: grant.id,
        input: { name: form.name.trim(), description: form.description.trim() || undefined },
      });
      onDone();
    } catch (e) {
      setError((e as { message?: string })?.message ?? "Failed to update.");
    }
  };

  return (
    <div className="mt-3 pt-3 border-t border-border space-y-3">
      <Field
        label="Name *"
        placeholder="database-password"
        value={form.name}
        onChange={(v) => setForm((f) => ({ ...f, name: v }))}
      />
      <Field
        label="Description"
        placeholder="Short description…"
        value={form.description}
        onChange={(v) => setForm((f) => ({ ...f, description: v }))}
      />
      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" /> {error}
        </div>
      )}
      <div className="flex gap-2">
        <button
          onClick={() => void handleSubmit()}
          disabled={update.isPending}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition disabled:opacity-50"
        >
          {update.isPending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Save className="size-3.5" />
          )}{" "}
          Save
        </button>
        <button
          onClick={onDone}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-xs text-muted-foreground hover:bg-accent transition"
        >
          <X className="size-3.5" /> Cancel
        </button>
      </div>
    </div>
  );
}

function EditGrantForm({
  grant,
  slug,
  envId,
  onDone,
}: {
  grant: SecretGrantAdminView;
  slug: string;
  envId: string;
  onDone: () => void;
}) {
  const [form, setForm] = useState({
    name: grant.name,
    vault_path: grant.vault_path,
    description: grant.description ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const update = useUpdateSecretGrant();

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      setError("Name is required.");
      return;
    }
    setError(null);
    try {
      await update.mutateAsync({
        slug,
        envSlug: envId,
        id: grant.id,
        input: {
          name: form.name.trim(),
          vault_path: form.vault_path.trim(),
          description: form.description.trim() || undefined,
        },
      });
      onDone();
    } catch (e) {
      setError((e as { message?: string })?.message ?? "Failed to update.");
    }
  };

  return (
    <div className="mt-3 pt-3 border-t border-border space-y-3">
      <Field
        label="Name *"
        placeholder="database-credentials"
        value={form.name}
        onChange={(v) => setForm((f) => ({ ...f, name: v }))}
      />
      <Field
        label="Vault path"
        placeholder="myapp/dev"
        hint="Path within your KV v2 mount. Do NOT include the mount name or /data/ prefix."
        value={form.vault_path}
        onChange={(v) => setForm((f) => ({ ...f, vault_path: v }))}
        monospace
      />
      <Field
        label="Description"
        placeholder="Short description…"
        value={form.description}
        onChange={(v) => setForm((f) => ({ ...f, description: v }))}
      />
      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" /> {error}
        </div>
      )}
      <div className="flex gap-2">
        <button
          onClick={() => void handleSubmit()}
          disabled={update.isPending}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition disabled:opacity-50"
        >
          {update.isPending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Save className="size-3.5" />
          )}{" "}
          Save
        </button>
        <button
          onClick={onDone}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-xs text-muted-foreground hover:bg-accent transition"
        >
          <X className="size-3.5" /> Cancel
        </button>
      </div>
    </div>
  );
}

// ─── Delete modal ─────────────────────────────────────────────────────────────

function DeleteModal({
  grantName,
  isPending,
  onConfirm,
  onCancel,
}: {
  grantName: string;
  isPending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="glass rounded-xl border border-border shadow-2xl w-full max-w-sm mx-4 p-6 space-y-5">
        <div className="flex items-start gap-3">
          <div className="size-10 rounded-full bg-destructive/15 grid place-items-center shrink-0">
            <AlertCircle className="size-5 text-destructive" />
          </div>
          <div>
            <p className="font-semibold">Remove secret grant?</p>
            <p className="text-sm text-muted-foreground mt-0.5">
              <span className="font-mono font-medium text-foreground">{grantName}</span> will be
              removed. Members will no longer be able to read these secrets.
            </p>
          </div>
        </div>
        <div className="flex gap-2 pt-1">
          <button
            onClick={onCancel}
            disabled={isPending}
            className="flex-1 py-2 rounded-md border border-border text-sm hover:bg-accent transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isPending}
            className="flex-1 py-2 rounded-md bg-destructive text-destructive-foreground text-sm font-medium hover:bg-destructive/90 transition disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            {isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Trash2 className="size-4" />
            )}
            Remove
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ─── Add grant form ───────────────────────────────────────────────────────────

function AddGrantForm({
  slug,
  envId,
  isOwner,
  onDone,
}: {
  slug: string;
  envId: string;
  isOwner: boolean;
  onDone: () => void;
}) {
  const [form, setForm] = useState({ name: "", vault_path: "", description: "" });
  const [error, setError] = useState<string | null>(null);
  const create = useCreateSecretGrant();

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      setError("Name is required.");
      return;
    }
    if (isOwner && !form.vault_path.trim()) {
      setError("Vault path is required.");
      return;
    }
    setError(null);
    try {
      await create.mutateAsync({
        slug,
        envSlug: envId,
        input: {
          name: form.name.trim(),
          vault_path: form.vault_path.trim(),
          description: form.description.trim() || undefined,
        },
      });
      onDone();
    } catch (e) {
      setError((e as { message?: string })?.message ?? "Failed to create grant.");
    }
  };

  return (
    <div className="rounded-xl border border-primary/30 bg-primary/5 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <KeyRound className="size-4 text-primary" />
          <h3 className="font-semibold text-sm">New secret grant</h3>
        </div>
        <button onClick={onDone} className="p-1 rounded hover:bg-accent transition">
          <X className="size-4 text-muted-foreground" />
        </button>
      </div>

      <Field
        label="Name *"
        placeholder="database-credentials"
        hint="A friendly name. Use lowercase with hyphens."
        value={form.name}
        onChange={(v) => setForm((f) => ({ ...f, name: v }))}
      />

      {isOwner ? (
        <Field
          label="Vault path *"
          placeholder="myapp/dev"
          hint='Path within your KV v2 mount — omit the mount name and /data/ prefix. E.g. "myapp/dev", not "secret/data/myapp/dev".'
          value={form.vault_path}
          onChange={(v) => setForm((f) => ({ ...f, vault_path: v }))}
          monospace
        />
      ) : (
        <div className="flex items-start gap-2 rounded-lg border border-border bg-secondary/40 px-3 py-2.5 text-xs text-muted-foreground">
          <ShieldAlert className="size-3.5 mt-0.5 shrink-0 text-yellow-500" />
          <span>
            The Vault path will be set by your admin. Create the grant now and they will link it.
          </span>
        </div>
      )}

      <Field
        label="Description"
        placeholder="Brief description for team members…"
        value={form.description}
        onChange={(v) => setForm((f) => ({ ...f, description: v }))}
      />

      {isOwner && (
        <div className="flex items-start gap-2 rounded-lg border border-border bg-secondary/40 px-3 py-2.5 text-xs text-muted-foreground">
          <ShieldAlert className="size-3.5 mt-0.5 shrink-0 text-yellow-500" />
          <span>Only admins see the Vault path. Members see the name and description only.</span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" /> {error}
        </div>
      )}

      <button
        onClick={() => void handleSubmit()}
        disabled={create.isPending}
        className="w-full flex items-center justify-center gap-2 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition disabled:opacity-50"
      >
        {create.isPending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Plus className="size-4" />
        )}
        Create grant
      </button>
    </div>
  );
}

// ─── Grant card ───────────────────────────────────────────────────────────────

function GrantCard({
  grant,
  slug,
  envId,
  isOwner,
  onOpenSecret,
}: {
  grant: SecretGrant;
  slug: string;
  envId: string;
  isOwner: boolean;
  onOpenSecret: (entry: SecretEntry) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editingMeta, setEditingMeta] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  const { data, isLoading, error: loadError } = useSecretValue(slug, envId, grant.id, expanded);
  const del = useDeleteSecretGrant();

  const vaultPath = isAdminGrant(grant) ? grant.vault_path : null;
  const entryCount = data?.entries.length ?? 0;

  const handleDelete = async () => {
    await del.mutateAsync({ slug, envSlug: envId, id: grant.id });
    setShowDelete(false);
  };

  return (
    <>
      <div className="rounded-xl border border-border bg-background overflow-hidden">
        {/* Card header */}
        <div className="p-4">
          <div className="flex items-start gap-3">
            <div className="size-9 rounded-lg bg-primary/10 grid place-items-center shrink-0 mt-0.5">
              <Lock className="size-4 text-primary" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div className="min-w-0">
                  <p className="font-semibold text-sm leading-tight">{grant.name}</p>
                  {grant.description && (
                    <p className="text-xs text-muted-foreground mt-0.5">{grant.description}</p>
                  )}
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => setEditingMeta((v) => !v)}
                    className="flex items-center gap-1 text-xs px-2 py-1.5 rounded-md border border-border hover:bg-accent transition"
                  >
                    <Pencil className="size-3.5" /> Grant
                  </button>
                  <button
                    onClick={() => setShowDelete(true)}
                    className="flex items-center gap-1 text-xs px-2 py-1.5 rounded-md border border-destructive/30 text-destructive hover:bg-destructive/10 transition"
                  >
                    <Trash2 className="size-3.5" /> Remove
                  </button>
                </div>
              </div>

              {/* Vault path (admin only) */}
              {vaultPath && (
                <div className="flex items-center gap-1.5 mt-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    path
                  </span>
                  <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-secondary border border-border min-w-0">
                    <span className="text-[11px] font-mono text-muted-foreground truncate max-w-[280px]">
                      {vaultPath}
                    </span>
                    <CopyButton text={vaultPath} />
                  </div>
                </div>
              )}

              <p className="text-[11px] text-muted-foreground/60 mt-1.5">
                Added {fmtDate(isAdminGrant(grant) ? grant.created_at : grant.created_at)}
              </p>
            </div>
          </div>

          {/* Inline metadata edit form */}
          {editingMeta && isAdminGrant(grant) && (
            <EditGrantForm
              grant={grant}
              slug={slug}
              envId={envId}
              onDone={() => setEditingMeta(false)}
            />
          )}
          {editingMeta && !isAdminGrant(grant) && (
            <MemberEditGrantForm
              grant={grant}
              slug={slug}
              envId={envId}
              onDone={() => setEditingMeta(false)}
            />
          )}
        </div>

        {/* Expand toggle strip */}
        <button
          onClick={() => setExpanded((v) => !v)}
          className="w-full flex items-center justify-between gap-2 px-4 py-2.5 border-t border-border bg-secondary/30 hover:bg-secondary/60 transition text-xs font-medium text-muted-foreground group"
        >
          <div className="flex items-center gap-1.5">
            {expanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
            {expanded ? "Hide secrets" : "View secrets"}
            {!expanded && data && entryCount > 0 && (
              <span className="font-mono bg-secondary px-1.5 py-0.5 rounded text-[10px]">
                {entryCount}
              </span>
            )}
          </div>
          {!expanded && (
            <span className="text-[11px] text-muted-foreground/60 group-hover:text-muted-foreground transition">
              Click to explore →
            </span>
          )}
        </button>

        {/* Expanded: secret list */}
        {expanded && (
          <div className="border-t border-border bg-secondary/10">
            {isLoading && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground p-4">
                <Loader2 className="size-3.5 animate-spin" /> Loading secrets from Vault…
              </div>
            )}

            {loadError && !isLoading && (
              <div className="p-4 space-y-2">
                <div className="flex items-center gap-2 text-xs text-destructive">
                  <AlertTriangle className="size-3.5 shrink-0" />
                  {isAdminGrant(grant) && !grant.vault_path
                    ? "Vault path is not configured yet. Edit the grant to set a path."
                    : "Could not load secrets. Check that the vault path exists."}
                </div>
              </div>
            )}

            {data && data.entries.length === 0 && (
              <div className="px-4 py-6 flex flex-col items-center gap-2 text-muted-foreground text-center">
                <FileKey className="size-5 opacity-30" />
                <p className="text-xs">No secrets found at this path.</p>
                {isAdminGrant(grant) && grant.vault_path && (
                  <p className="text-[11px] font-mono text-muted-foreground/60">
                    {grant.vault_path}
                  </p>
                )}
              </div>
            )}

            {data && data.entries.length > 0 && (
              <div className="p-3 space-y-2">
                {data.entries.map((entry) => (
                  <SubSecretRow
                    key={entry.path || "__root__"}
                    entry={entry}
                    vaultPath={vaultPath ?? ""}
                    isOwner={isOwner}
                    onClick={() => onOpenSecret(entry)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {showDelete && (
        <DeleteModal
          grantName={grant.name}
          isPending={del.isPending}
          onConfirm={() => void handleDelete()}
          onCancel={() => setShowDelete(false)}
        />
      )}
    </>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function EnvSecretsPage() {
  const { envId } = useParams({ from: "/dashboard/environments/$envId/secrets" });
  const { selectedWorkspace } = useWorkspaceContext();
  const slug = selectedWorkspace?.slug ?? "";

  const { data: me } = useMe();
  const isOwner = !!me && !!selectedWorkspace && me.id === selectedWorkspace.owner_id;

  const { data: grants = [], isLoading, error } = useSecretGrants(slug, envId);
  const [showAdd, setShowAdd] = useState(false);

  type OpenSecret = { grant: SecretGrant; entry: SecretEntry } | null;
  const [openSecret, setOpenSecret] = useState<OpenSecret>(null);

  const envName = envId.charAt(0).toUpperCase() + envId.slice(1).replace(/-/g, " ");

  return (
    <>
      <DashboardTopbar
        title="Secrets"
        subtitle={`Vault-backed secrets for the ${envName} environment.`}
      />

      <main className="p-6 space-y-5 max-w-2xl">
        {/* Header row */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold">Secret grants</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isOwner
                ? "Each grant maps a Vault parent path to a friendly name. Expand to browse secrets inside."
                : "Expand a grant to browse its secrets. Click a secret to view or create a new version."}
            </p>
          </div>
          {!showAdd && (
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition"
            >
              <Plus className="size-3.5" /> Add grant
            </button>
          )}
        </div>

        {/* Add form */}
        {showAdd && (
          <AddGrantForm
            slug={slug}
            envId={envId}
            isOwner={isOwner}
            onDone={() => setShowAdd(false)}
          />
        )}

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
            <Loader2 className="size-4 animate-spin" /> Loading grants…
          </div>
        )}

        {/* Error */}
        {error && !isLoading && (
          <div className="flex items-center gap-2 text-sm text-destructive py-4">
            <AlertTriangle className="size-4" /> Failed to load secret grants.
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !error && grants.length === 0 && !showAdd && (
          <div className="glass rounded-xl p-10 flex flex-col items-center text-center gap-4">
            <div className="size-12 rounded-2xl bg-secondary grid place-items-center">
              <Lock className="size-6 text-muted-foreground" />
            </div>
            <div>
              <p className="font-semibold">No secret grants yet</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-xs">
                {isOwner
                  ? "Create a grant to expose a Vault parent path to your team."
                  : "Create a grant — your admin will configure the Vault path."}
              </p>
            </div>
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition"
            >
              <Plus className="size-4" /> Create first grant
            </button>
          </div>
        )}

        {/* Grant list */}
        {!isLoading && !error && grants.length > 0 && (
          <div className="space-y-3">
            {grants.map((g: SecretGrant) => (
              <GrantCard
                key={g.id}
                grant={g}
                slug={slug}
                envId={envId}
                isOwner={isOwner}
                onOpenSecret={(entry) => setOpenSecret({ grant: g, entry })}
              />
            ))}
          </div>
        )}
      </main>

      {/* Secret detail drawer */}
      {openSecret && (
        <SecretDetailDrawer
          grant={openSecret.grant}
          entry={openSecret.entry}
          slug={slug}
          envId={envId}
          isOwner={isOwner}
          onClose={() => setOpenSecret(null)}
        />
      )}
    </>
  );
}
