import { useState } from "react";
import { Loader2, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import type { PlatformSpec, RepositoryProvisionConfig, SecretGrantAdminView } from "@/lib/types";
import { isAdminGrant } from "@/lib/types";
import {
  useSecretGrants,
  useCreateSecretGrant,
  useRepoProviders,
  useRepoProviderRepos,
  useRepoProviderContents,
} from "@/lib/queries";

type SecretMode = "none" | "existing" | "new";

function RepoSection({
  appName,
  workspaceSlug,
  repoConfig,
  onRepoConfigChange,
  buildContext,
  onBuildContextChange,
}: {
  appName: string;
  workspaceSlug: string;
  repoConfig: RepositoryProvisionConfig | null;
  onRepoConfigChange: (cfg: RepositoryProvisionConfig | null) => void;
  buildContext: string;
  onBuildContextChange: (v: string) => void;
}) {
  const enabled = repoConfig !== null;
  const { data: providers = [] } = useRepoProviders(workspaceSlug);
  const providerId = repoConfig?.provider_id ?? "";
  const selectedRepo = repoConfig?.repository ?? "";
  const selectedBranch = repoConfig?.base_branch ?? "main";

  const { data: repos = [], isLoading: reposLoading } = useRepoProviderRepos(
    workspaceSlug,
    providerId,
    !!providerId,
  );

  const { data: contents = [], isLoading: contentsLoading } = useRepoProviderContents(
    workspaceSlug,
    providerId,
    selectedRepo,
    selectedBranch,
    "",
    !!providerId && !!selectedRepo,
  );
  const dirs = contents.filter((e) => e.type === "dir");

  const [customContext, setCustomContext] = useState("");
  const [isCustomMode, setIsCustomMode] = useState(false);
  const showCustomInput =
    isCustomMode || (buildContext !== "" && !dirs.some((d) => d.path === buildContext));

  const toggle = (on: boolean) => {
    if (!on) {
      onRepoConfigChange(null);
      onBuildContextChange("");
    } else {
      onRepoConfigChange({ provider_id: "", repository: "", base_branch: "main" });
    }
  };

  const patch = (p: Partial<RepositoryProvisionConfig>) =>
    onRepoConfigChange({
      ...(repoConfig ?? { provider_id: "", repository: "", base_branch: "main" }),
      ...p,
    });

  const headBranch = appName ? `idp/deploy/${appName}` : "idp/deploy/app";

  return (
    <div className="space-y-3 border-t border-border pt-4">
      <div className="flex items-center gap-3">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex-1">
          Repository
        </h3>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => toggle(e.target.checked)}
            className="rounded"
          />
          Commit manifests to repo
        </label>
      </div>

      {enabled && (
        <div className="space-y-3">
          {providers.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No repository providers registered. Add one from the workspace{" "}
              <strong>Repositories</strong> page.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                    Provider
                  </label>
                  <select
                    value={providerId}
                    onChange={(e) => {
                      patch({ provider_id: e.target.value, repository: "" });
                      onBuildContextChange("");
                    }}
                    className="w-full px-3 py-2.5 rounded-md bg-secondary border border-border focus:border-primary outline-none transition text-sm"
                  >
                    <option value="">Select provider…</option>
                    {providers.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.provider_type === "github" ? "GitHub" : "GitLab"})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                    Base branch (PR target)
                  </label>
                  <input
                    value={repoConfig?.base_branch ?? "main"}
                    onChange={(e) => patch({ base_branch: e.target.value || "main" })}
                    placeholder="main"
                    className="w-full px-3 py-2.5 rounded-md bg-secondary border border-border focus:border-primary outline-none transition text-sm font-mono"
                  />
                </div>
              </div>

              {providerId && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                    Repository
                  </label>
                  {reposLoading ? (
                    <div className="flex items-center gap-2 h-10 text-xs text-muted-foreground">
                      <Loader2 className="size-3.5 animate-spin" /> Loading repositories…
                    </div>
                  ) : (
                    <select
                      value={selectedRepo}
                      onChange={(e) => {
                        patch({ repository: e.target.value });
                        onBuildContextChange("");
                      }}
                      className="w-full px-3 py-2.5 rounded-md bg-secondary border border-border focus:border-primary outline-none transition text-sm"
                    >
                      <option value="">Select repository…</option>
                      {repos.map((r) => (
                        <option key={r.full_name} value={r.full_name}>
                          {r.full_name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              {/* Build context — only shown once a repo is selected */}
              {selectedRepo && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                    Build context (Dockerfile location)
                  </label>
                  {contentsLoading ? (
                    <div className="flex items-center gap-2 h-10 text-xs text-muted-foreground">
                      <Loader2 className="size-3.5 animate-spin" /> Loading directories…
                    </div>
                  ) : (
                    <select
                      value={showCustomInput ? "__custom__" : buildContext}
                      onChange={(e) => {
                        if (e.target.value === "__custom__") {
                          setIsCustomMode(true);
                        } else {
                          setIsCustomMode(false);
                          setCustomContext("");
                          onBuildContextChange(e.target.value);
                        }
                      }}
                      className="w-full px-3 py-2.5 rounded-md bg-secondary border border-border focus:border-primary outline-none transition text-sm font-mono"
                    >
                      <option value="">Repository root (Dockerfile at /)</option>
                      {dirs.map((d) => (
                        <option key={d.path} value={d.path}>
                          {d.path}/
                        </option>
                      ))}
                      <option value="__custom__">Custom path…</option>
                    </select>
                  )}
                  {showCustomInput && (
                    <input
                      autoFocus
                      value={customContext || buildContext}
                      onChange={(e) => {
                        setCustomContext(e.target.value);
                        onBuildContextChange(e.target.value);
                      }}
                      placeholder="services/api"
                      className="mt-2 w-full px-3 py-2.5 rounded-md bg-secondary border border-border focus:border-primary outline-none transition text-sm font-mono"
                    />
                  )}
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Select the directory that contains the{" "}
                    <code className="font-mono">Dockerfile</code>. Leave blank if it&apos;s at the
                    repo root.
                  </p>
                </div>
              )}

              {repoConfig?.repository && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-primary/5 border border-primary/20 text-xs font-mono text-muted-foreground">
                  <span className="text-muted-foreground/50 shrink-0">PR</span>
                  <span className="text-foreground font-medium">{headBranch}</span>
                  <span className="text-muted-foreground/50">→</span>
                  <span>{repoConfig.base_branch || "main"}</span>
                  {buildContext && (
                    <>
                      <span className="text-muted-foreground/50 ml-2">context</span>
                      <span className="text-foreground">./{buildContext}</span>
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function Step4SecretsCICD({
  spec,
  onChange,
  workspaceSlug,
  envSlug,
  onGrantIdChange,
  initialSecretsRaw,
  onInitialSecretsChange,
  repoConfig,
  onRepoConfigChange,
  buildContext,
  onBuildContextChange,
}: {
  spec: PlatformSpec;
  onChange: (patch: Partial<PlatformSpec>) => void;
  workspaceSlug: string;
  envSlug: string;
  onGrantIdChange: (id: string) => void;
  initialSecretsRaw: string;
  onInitialSecretsChange: (v: string) => void;
  repoConfig: RepositoryProvisionConfig | null;
  onRepoConfigChange: (cfg: RepositoryProvisionConfig | null) => void;
  buildContext: string;
  onBuildContextChange: (v: string) => void;
}) {
  const updateSecrets = (patch: Partial<PlatformSpec["secrets"]>) =>
    onChange({ secrets: { ...spec.secrets, ...patch } });
  const updateCICD = (patch: Partial<PlatformSpec["cicd"]>) =>
    onChange({ cicd: { ...spec.cicd, ...patch } });

  const [secretMode, setSecretMode] = useState<SecretMode>("none");
  const [selectedGrantId, setSelectedGrantId] = useState("");
  const [newName, setNewName] = useState("");
  const [newPath, setNewPath] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [createdGrant, setCreatedGrant] = useState<SecretGrantAdminView | null>(null);

  const { data: grants = [] } = useSecretGrants(workspaceSlug, envSlug);
  const createGrant = useCreateSecretGrant();

  const handleModeChange = (mode: SecretMode) => {
    setSecretMode(mode);
    setSelectedGrantId("");
    setCreatedGrant(null);
    onGrantIdChange("");
    if (mode === "none") {
      updateSecrets({ vault_role: undefined, vault_path: undefined });
    } else {
      updateSecrets({ vault_path: undefined });
    }
  };

  const handleSelectGrant = (id: string) => {
    setSelectedGrantId(id);
    onGrantIdChange(id);
    const grant = grants.find((g) => g.id === id);
    if (!grant) return;
    updateSecrets({ vault_path: isAdminGrant(grant) ? grant.vault_path : undefined });
  };

  const handleCreateGrant = async () => {
    if (!newName.trim() || !newPath.trim()) return;
    try {
      const result = await createGrant.mutateAsync({
        slug: workspaceSlug,
        envSlug,
        input: {
          name: newName.trim(),
          vault_path: newPath.trim(),
          description: newDesc.trim() || undefined,
        },
      });
      setCreatedGrant(result);
      onGrantIdChange(result.id);
      updateSecrets({ vault_path: result.vault_path });
      toast.success("Secret grant created", { description: result.name });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to create secret grant");
    }
  };

  const MODE_BUTTONS: { key: SecretMode; label: string }[] = [
    { key: "none", label: "None" },
    { key: "existing", label: "Use existing" },
    { key: "new", label: "Create new" },
  ];

  const selectedGrant = grants.find((g) => g.id === selectedGrantId);

  return (
    <div className="space-y-6">
      {/* ── Vault Secrets ──────────────────────────────────────────── */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Vault Secrets
        </h3>

        {/* Mode picker */}
        <div className="flex rounded-md border border-border overflow-hidden text-xs w-fit">
          {MODE_BUTTONS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => handleModeChange(key)}
              className={`px-3 py-1.5 transition ${
                secretMode === key
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground hover:bg-accent"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Use existing grant */}
        {secretMode === "existing" && (
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                Secret grant
              </label>
              {grants.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No secret grants found in this environment. Switch to{" "}
                  <button
                    type="button"
                    className="underline hover:text-foreground transition"
                    onClick={() => handleModeChange("new")}
                  >
                    Create new
                  </button>{" "}
                  to add one.
                </p>
              ) : (
                <select
                  value={selectedGrantId}
                  onChange={(e) => handleSelectGrant(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-md bg-secondary border border-border focus:border-primary outline-none transition text-sm"
                >
                  <option value="">Select secret grant…</option>
                  {grants.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                      {isAdminGrant(g) ? ` — ${g.vault_path}` : ""}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {selectedGrant && (
              <>
                {/* Path badge */}
                {isAdminGrant(selectedGrant) ? (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-primary/5 border border-primary/20 text-xs font-mono text-muted-foreground">
                    <span className="text-muted-foreground/50 shrink-0">Vault path</span>
                    <span className="text-foreground">{selectedGrant.vault_path}</span>
                  </div>
                ) : (
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                      Vault path
                    </label>
                    <input
                      value={spec.secrets.vault_path ?? ""}
                      onChange={(e) => updateSecrets({ vault_path: e.target.value })}
                      placeholder="myapp/env"
                      className="w-full px-3 py-2.5 rounded-md bg-secondary border border-border focus:border-primary outline-none transition text-sm font-mono"
                    />
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Vault path not visible — enter it manually.
                    </p>
                  </div>
                )}

                {/* Vault role */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                    Vault role
                  </label>
                  <input
                    value={spec.secrets.vault_role ?? ""}
                    onChange={(e) => updateSecrets({ vault_role: e.target.value })}
                    placeholder="my-app-role"
                    className="w-full px-3 py-2.5 rounded-md bg-secondary border border-border focus:border-primary outline-none transition text-sm font-mono"
                  />
                </div>
              </>
            )}
          </div>
        )}

        {/* Create new grant */}
        {secretMode === "new" && (
          <div className="space-y-3">
            {createdGrant ? (
              /* Success state — grant was created */
              <>
                <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-600">
                  <CheckCircle className="size-3.5 shrink-0" />
                  <span>
                    <span className="font-medium">{createdGrant.name}</span> created —{" "}
                    <span className="font-mono">{createdGrant.vault_path}</span>
                  </span>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                    Vault role
                  </label>
                  <input
                    value={spec.secrets.vault_role ?? ""}
                    onChange={(e) => updateSecrets({ vault_role: e.target.value })}
                    placeholder="my-app-role"
                    className="w-full px-3 py-2.5 rounded-md bg-secondary border border-border focus:border-primary outline-none transition text-sm font-mono"
                  />
                </div>
              </>
            ) : (
              /* Create form */
              <>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                    Grant name *
                  </label>
                  <input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="my-app-secrets"
                    className="w-full px-3 py-2.5 rounded-md bg-secondary border border-border focus:border-primary outline-none transition text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                    Vault path *
                  </label>
                  <input
                    value={newPath}
                    onChange={(e) => setNewPath(e.target.value)}
                    placeholder="myapp/env"
                    className="w-full px-3 py-2.5 rounded-md bg-secondary border border-border focus:border-primary outline-none transition text-sm font-mono"
                  />
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Relative path within the KV engine (e.g.{" "}
                    <span className="font-mono">myapp/env</span>).
                  </p>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                    Description{" "}
                    <span className="font-normal text-muted-foreground/60">optional</span>
                  </label>
                  <input
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    placeholder="Runtime secrets for my-app"
                    className="w-full px-3 py-2.5 rounded-md bg-secondary border border-border focus:border-primary outline-none transition text-sm"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => void handleCreateGrant()}
                  disabled={!newName.trim() || !newPath.trim() || createGrant.isPending}
                  className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition disabled:opacity-50"
                >
                  {createGrant.isPending && <Loader2 className="size-3.5 animate-spin" />}
                  Create secret grant
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Initial secrets ────────────────────────────────────────── */}
      {secretMode !== "none" && (
        <div className="space-y-2 border-t border-border pt-4">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Initial secrets
          </h3>
          <textarea
            value={initialSecretsRaw}
            onChange={(e) => onInitialSecretsChange(e.target.value)}
            placeholder={"DB_PASSWORD=mysecret\nAPI_KEY=abc123\n# comments are ignored"}
            rows={5}
            className="w-full px-3 py-2.5 rounded-md bg-secondary border border-border focus:border-primary outline-none transition text-sm font-mono resize-none"
          />
          <p className="text-[11px] text-muted-foreground">
            One <code>KEY=VALUE</code> per line. These will be written to the grant&apos;s Vault
            path before the runtime job starts.
          </p>
        </div>
      )}

      {/* ── Repository ─────────────────────────────────────────────── */}
      <RepoSection
        appName={spec.service.name}
        workspaceSlug={workspaceSlug}
        repoConfig={repoConfig}
        onRepoConfigChange={onRepoConfigChange}
        buildContext={buildContext}
        onBuildContextChange={onBuildContextChange}
      />

      {/* ── CI/CD ──────────────────────────────────────────────────── */}
      <div className="space-y-3 border-t border-border pt-4">
        <div className="flex items-center gap-3">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex-1">
            CI/CD Generation
          </h3>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={spec.cicd.enabled}
              onChange={(e) => updateCICD({ enabled: e.target.checked })}
              className="rounded"
            />
            Generate workflow
          </label>
        </div>

        {spec.cicd.enabled && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  Provider
                </label>
                <select
                  value={spec.cicd.provider}
                  onChange={(e) => updateCICD({ provider: e.target.value, style: "" })}
                  className="w-full px-3 py-2.5 rounded-md bg-secondary border border-border focus:border-primary outline-none transition text-sm"
                >
                  <option value="github-actions">GitHub Actions</option>
                  <option value="gitlab-ci">GitLab CI</option>
                  <option value="jenkins">Jenkins</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  Trigger branch
                </label>
                <input
                  value={spec.cicd.branch ?? "main"}
                  onChange={(e) => updateCICD({ branch: e.target.value })}
                  placeholder="main"
                  className="w-full px-3 py-2.5 rounded-md bg-secondary border border-border focus:border-primary outline-none transition text-sm font-mono"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                Deploy style
              </label>
              <select
                value={spec.cicd.style ?? ""}
                onChange={(e) => updateCICD({ style: e.target.value || undefined })}
                className="w-full px-3 py-2.5 rounded-md bg-secondary border border-border focus:border-primary outline-none transition text-sm"
              >
                <option value="">IDP API redeploy (default)</option>
                <option value="ssh">SSH — docker compose pull &amp; up</option>
                <option value="nomad">Nomad CLI — job run</option>
                <option value="kubectl">kubectl — set image &amp; rollout</option>
                <option value="helm">Helm — upgrade --install</option>
              </select>
              <p className="text-[11px] text-muted-foreground mt-1">
                {(!spec.cicd.style || spec.cicd.style === "") &&
                  "Triggers a redeploy via the TernakClouds IDP API."}
                {spec.cicd.style === "ssh" &&
                  "Requires SSH_HOST, SSH_USER and SSH_PRIVATE_KEY secrets in your CI provider."}
                {spec.cicd.style === "nomad" &&
                  "Requires NOMAD_ADDR and NOMAD_TOKEN secrets. Expects a .nomad.hcl job file in your repo."}
                {spec.cicd.style === "kubectl" &&
                  "Requires KUBE_CONFIG_DATA (base64 kubeconfig) secret in your CI provider."}
                {spec.cicd.style === "helm" &&
                  "Requires KUBE_CONFIG_DATA secret and a ./chart directory in your repo."}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
