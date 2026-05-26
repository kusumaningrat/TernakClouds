import { DashboardTopbar } from "@/components/DashboardTopbar";
import {
  useCapability,
  useCapabilityProviders,
  useBindProvider,
  useUpdateProvider,
  useUnbindProvider,
  useVerifyProvider,
} from "@/lib/queries";
import { useWorkspaceContext } from "@/lib/workspace-context";
import { useState } from "react";
import {
  CheckCircle2,
  XCircle,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  AlertCircle,
  ChevronDown,
  X,
  Save,
  ServerCrash,
  ShieldCheck,
  ShieldX,
} from "lucide-react";
import type { CapabilityProvider, ProviderConfigResponse } from "@/lib/types";

interface Props {
  envId: string;
  capName: string;
  title: string;
  subtitle: string;
  endpointPlaceholders?: Record<string, string>;
  extraContent?: React.ReactNode;
}

// ─── Add-provider form ────────────────────────────────────────────────────────

function AddProviderForm({
  envId,
  capName,
  slug,
  providers,
  onDone,
  endpointPlaceholders,
}: {
  envId: string;
  capName: string;
  slug: string;
  providers: CapabilityProvider[];
  onDone: () => void;
  endpointPlaceholders?: Record<string, string>;
}) {
  const [selectedProvider, setSelectedProvider] = useState<CapabilityProvider | null>(null);
  const [dropOpen, setDropOpen] = useState(false);
  const [form, setForm] = useState({ endpoint: "", region: "", namespace: "", token: "" });
  const [error, setError] = useState<string | null>(null);
  const bind = useBindProvider();

  const isTokenOptional = selectedProvider?.name === "loki";

  const handleSubmit = async () => {
    if (!selectedProvider) {
      setError("Select a provider.");
      return;
    }
    if (!form.endpoint.trim()) {
      setError("Endpoint is required.");
      return;
    }
    if (!isTokenOptional && !form.token.trim()) {
      setError("Token is required.");
      return;
    }
    setError(null);
    try {
      await bind.mutateAsync({
        slug,
        envSlug: envId,
        cap: capName,
        input: {
          provider_name: selectedProvider.name,
          endpoint: form.endpoint.trim(),
          region: form.region.trim() || undefined,
          namespace: form.namespace.trim() || undefined,
          token: form.token.trim() || undefined,
        },
      });
      onDone();
    } catch (e: unknown) {
      const msg = (e as { message?: string })?.message;
      setError(msg ?? "Failed to add provider.");
    }
  };

  return (
    <div className="glass rounded-xl p-5 space-y-4 border border-primary/20">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">Add provider</h3>
        <button onClick={onDone} className="p-1 rounded hover:bg-accent transition">
          <X className="size-4 text-muted-foreground" />
        </button>
      </div>

      {/* Provider picker */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Provider
        </label>
        <div className="relative">
          <button
            type="button"
            onClick={() => setDropOpen((v) => !v)}
            className="w-full flex items-center justify-between px-3 py-2 rounded-md border border-border bg-background text-sm hover:border-primary/50 transition"
          >
            <span className={selectedProvider ? "" : "text-muted-foreground"}>
              {selectedProvider?.display_name ?? "Select a provider…"}
            </span>
            <ChevronDown
              className={`size-4 text-muted-foreground transition-transform ${dropOpen ? "rotate-180" : ""}`}
            />
          </button>
          {dropOpen && (
            <div className="absolute left-0 right-0 top-full mt-1 z-10 rounded-md border border-border bg-background shadow-lg overflow-hidden">
              {providers.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setSelectedProvider(p);
                    setDropOpen(false);
                  }}
                  className="w-full px-3 py-2.5 text-left text-sm hover:bg-accent transition"
                >
                  <div className="font-medium">{p.display_name}</div>
                  <div className="text-xs text-muted-foreground">{p.description}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <Field
        label="Endpoint *"
        type="url"
        placeholder={
          (selectedProvider && endpointPlaceholders?.[selectedProvider.name]) ??
          "https://provider.internal"
        }
        value={form.endpoint}
        onChange={(v) => setForm((f) => ({ ...f, endpoint: v }))}
      />

      <div className="grid grid-cols-2 gap-3">
        <Field
          label="Region"
          placeholder="us-east-1"
          value={form.region}
          onChange={(v) => setForm((f) => ({ ...f, region: v }))}
        />
        <Field
          label="Namespace"
          placeholder="default"
          value={form.namespace}
          onChange={(v) => setForm((f) => ({ ...f, namespace: v }))}
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Token {isTokenOptional ? <span className="normal-case text-muted-foreground/60">(optional)</span> : "*"}
        </label>
        <input
          type="password"
          placeholder={isTokenOptional ? "Leave blank for unauthenticated access" : "••••••••••••••••"}
          value={form.token}
          onChange={(e) => setForm((f) => ({ ...f, token: e.target.value }))}
          className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm font-mono placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary/50"
        />
        <p className="text-[11px] text-muted-foreground">
          Stored encrypted in Vault. Never displayed after submission.
        </p>
      </div>

      {error && <ErrorRow message={error} />}

      <button
        onClick={() => void handleSubmit()}
        disabled={bind.isPending}
        className="w-full flex items-center justify-center gap-2 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition disabled:opacity-50"
      >
        {bind.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
        Add provider
      </button>
    </div>
  );
}

// ─── Edit-provider form (inline card expansion) ───────────────────────────────

function EditProviderForm({
  envId,
  capName,
  slug,
  provider,
  onDone,
}: {
  envId: string;
  capName: string;
  slug: string;
  provider: ProviderConfigResponse;
  onDone: () => void;
}) {
  const [form, setForm] = useState({
    endpoint: provider.endpoint,
    region: provider.region ?? "",
    namespace: provider.namespace ?? "",
    token: "",
  });
  const [error, setError] = useState<string | null>(null);
  const update = useUpdateProvider();

  const handleSubmit = async () => {
    if (!form.endpoint.trim()) {
      setError("Endpoint is required.");
      return;
    }
    setError(null);
    try {
      await update.mutateAsync({
        slug,
        envSlug: envId,
        cap: capName,
        providerID: provider.id,
        input: {
          endpoint: form.endpoint.trim(),
          region: form.region.trim() || undefined,
          namespace: form.namespace.trim() || undefined,
          token: form.token.trim() || undefined,
        },
      });
      onDone();
    } catch (e: unknown) {
      setError((e as { message?: string })?.message ?? "Failed to update provider.");
    }
  };

  return (
    <div className="mt-3 pt-3 border-t border-border space-y-3">
      <Field
        label="Endpoint *"
        type="url"
        placeholder="https://provider.internal"
        value={form.endpoint}
        onChange={(v) => setForm((f) => ({ ...f, endpoint: v }))}
      />
      <div className="grid grid-cols-2 gap-3">
        <Field
          label="Region"
          placeholder="us-east-1"
          value={form.region}
          onChange={(v) => setForm((f) => ({ ...f, region: v }))}
        />
        <Field
          label="Namespace"
          placeholder="default"
          value={form.namespace}
          onChange={(v) => setForm((f) => ({ ...f, namespace: v }))}
        />
      </div>
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          New token
        </label>
        <input
          type="password"
          placeholder="Leave blank to keep existing token"
          value={form.token}
          onChange={(e) => setForm((f) => ({ ...f, token: e.target.value }))}
          className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm font-mono placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary/50"
        />
      </div>
      {error && <ErrorRow message={error} />}
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
          )}
          Save changes
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

// ─── Bound-provider card ──────────────────────────────────────────────────────

function ProviderCard({
  envId,
  capName,
  slug,
  provider,
}: {
  envId: string;
  capName: string;
  slug: string;
  provider: ProviderConfigResponse;
}) {
  const [editing, setEditing] = useState(false);
  const [verifyResult, setVerifyResult] = useState<{
    reachable: boolean;
    message: string;
  } | null>(null);
  const unbind = useUnbindProvider();
  const verify = useVerifyProvider();

  const handleRemove = async () => {
    if (!confirm(`Remove ${provider.display_name || provider.provider_name}?`)) return;
    await unbind.mutateAsync({ slug, envSlug: envId, cap: capName, providerID: provider.id });
  };

  const handleVerify = async () => {
    setVerifyResult(null);
    try {
      const result = await verify.mutateAsync({
        slug,
        envSlug: envId,
        cap: capName,
        providerID: provider.id,
      });
      setVerifyResult({ reachable: result.reachable, message: result.message });
    } catch {
      setVerifyResult({ reachable: false, message: "Request failed" });
    }
  };

  return (
    <div className="rounded-lg border border-border bg-background/50 p-4">
      <div className="flex items-start gap-3">
        <div className="size-8 rounded-md bg-success/15 grid place-items-center shrink-0 mt-0.5">
          <CheckCircle2 className="size-4 text-success" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm">
              {provider.display_name || provider.provider_name}
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-secondary border border-border text-muted-foreground">
              {provider.provider_name}
            </span>
            {verifyResult !== null && (
              <span
                className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded border ${
                  verifyResult.reachable
                    ? "bg-success/10 text-success border-success/20"
                    : "bg-destructive/10 text-destructive border-destructive/20"
                }`}
              >
                {verifyResult.reachable ? (
                  <ShieldCheck className="size-3" />
                ) : (
                  <ShieldX className="size-3" />
                )}
                {verifyResult.reachable ? "reachable" : "unreachable"}
              </span>
            )}
          </div>
          <div className="font-mono text-xs text-muted-foreground mt-0.5 truncate">
            {provider.endpoint}
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground/70">
            {provider.region && <span>Region: {provider.region}</span>}
            {provider.namespace && <span>Namespace: {provider.namespace}</span>}
            <span>Added {new Date(provider.created_at).toLocaleDateString()}</span>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => void handleVerify()}
            disabled={verify.isPending}
            className="flex items-center gap-1 text-xs px-2 py-1.5 rounded-md border border-border hover:bg-accent transition disabled:opacity-50"
            title="Check if provider endpoint is reachable"
          >
            {verify.isPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <ShieldCheck className="size-3.5" />
            )}
            Verify
          </button>
          <button
            onClick={() => setEditing((v) => !v)}
            className="flex items-center gap-1 text-xs px-2 py-1.5 rounded-md border border-border hover:bg-accent transition"
          >
            <Pencil className="size-3.5" /> Edit
          </button>
          <button
            onClick={() => void handleRemove()}
            disabled={unbind.isPending}
            className="flex items-center gap-1 text-xs px-2 py-1.5 rounded-md border border-destructive/30 text-destructive hover:bg-destructive/10 transition disabled:opacity-50"
          >
            {unbind.isPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Trash2 className="size-3.5" />
            )}
            Remove
          </button>
        </div>
      </div>

      {editing && (
        <EditProviderForm
          envId={envId}
          capName={capName}
          slug={slug}
          provider={provider}
          onDone={() => setEditing(false)}
        />
      )}
    </div>
  );
}

// ─── Shared field + error helpers ─────────────────────────────────────────────

function Field({
  label,
  type = "text",
  placeholder,
  value,
  onChange,
}: {
  label: string;
  type?: string;
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        {label}
      </label>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm font-mono placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary/50"
      />
    </div>
  );
}

function ErrorRow({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-destructive">
      <AlertCircle className="size-4 shrink-0" />
      {message}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function CapabilityPage({
  envId,
  capName,
  title,
  subtitle,
  endpointPlaceholders,
  extraContent,
}: Props) {
  const { selectedWorkspace } = useWorkspaceContext();
  const slug = selectedWorkspace?.slug ?? "";

  const { data: status, isLoading } = useCapability(slug, envId, capName);
  const { data: catalogueProviders = [] } = useCapabilityProviders(slug, envId, capName);

  const [showAddForm, setShowAddForm] = useState(false);

  if (isLoading) {
    return (
      <>
        <DashboardTopbar title={title} subtitle={subtitle} />
        <main className="p-6 flex items-center justify-center py-32">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </main>
      </>
    );
  }

  const boundProviders = status?.providers ?? [];
  // Filter out already-bound provider names from the catalogue picker
  const boundNames = new Set(boundProviders.map((p) => p.provider_name));
  const availableProviders = catalogueProviders.filter((p) => !boundNames.has(p.name));

  return (
    <>
      <DashboardTopbar title={title} subtitle={subtitle} />
      <main className="p-6 space-y-4 max-w-2xl">
        {/* Empty state */}
        {boundProviders.length === 0 && !showAddForm && (
          <div className="glass rounded-xl p-8 flex flex-col items-center text-center gap-3">
            <div className="size-12 rounded-2xl bg-secondary grid place-items-center">
              <ServerCrash className="size-6 text-muted-foreground" />
            </div>
            <div>
              <p className="font-semibold">No providers connected</p>
              <p className="text-sm text-muted-foreground mt-0.5">
                Bind a {title.toLowerCase()} provider to activate this capability.
              </p>
            </div>
            <button
              onClick={() => setShowAddForm(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition"
            >
              <Plus className="size-4" /> Add provider
            </button>
          </div>
        )}

        {/* Bound provider cards */}
        {boundProviders.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Connected providers
              </h3>
              {availableProviders.length > 0 && !showAddForm && (
                <button
                  onClick={() => setShowAddForm(true)}
                  className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md border border-border hover:bg-accent transition"
                >
                  <Plus className="size-3.5" /> Add provider
                </button>
              )}
            </div>
            {boundProviders.map((p) => (
              <ProviderCard key={p.id} envId={envId} capName={capName} slug={slug} provider={p} />
            ))}
          </div>
        )}

        {/* Add form */}
        {showAddForm && (
          <AddProviderForm
            envId={envId}
            capName={capName}
            slug={slug}
            providers={availableProviders}
            onDone={() => setShowAddForm(false)}
            endpointPlaceholders={endpointPlaceholders}
          />
        )}
      </main>
      {extraContent}
    </>
  );
}
