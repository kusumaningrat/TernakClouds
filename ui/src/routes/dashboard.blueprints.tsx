import { createFileRoute } from "@tanstack/react-router";
import { DashboardTopbar } from "@/components/DashboardTopbar";
import { useWorkspaceContext } from "@/lib/workspace-context";
import {
  useBlueprints,
  useNomadNodes,
  useNomadNamespaces,
  useK8sNamespaces,
  useCapabilities,
  useRepoProviders,
  useRepoProviderRepos,
  usePreviewApp,
  useProvisionApp,
  usePlatformApps,
  useDeletePlatformApp,
  useAppDeployments,
  useEnvironments,
} from "@/lib/queries";
import type {
  Blueprint,
  PlatformSpec,
  GeneratedResources,
  RepositoryProvisionConfig,
  PlatformApp,
  DeploymentRecord,
} from "@/lib/types";
import { useState, useMemo, useEffect } from "react";
import { toast } from "sonner";
import { toastError, extractError } from "@/lib/toast-helpers";
import {
  Globe,
  Cpu,
  Clock,
  Network,
  LayoutDashboard,
  Zap,
  Layers,
  ArrowRight,
  ArrowLeft,
  CheckCircle,
  Loader2,
  AlertCircle,
  FileCode,
  Pencil,
  Eye,
  X,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Rocket,
  GitBranch,
  GitCommit,
  ExternalLink,
  History,
  Trash2,
  Database,
} from "lucide-react";
import type { ApiError } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/dashboard/blueprints")({
  head: () => ({ meta: [{ title: "Blueprints · TernakClouds" }] }),
  component: BlueprintsPage,
});

// ─── Icon resolver ─────────────────────────────────────────────────────────────

const ICONS: Record<string, React.ElementType> = {
  globe: Globe,
  cpu: Cpu,
  clock: Clock,
  network: Network,
  "layout-dashboard": LayoutDashboard,
  zap: Zap,
  database: Database,
  "git-branch": GitBranch,
};

function BlueprintIcon({ icon, className }: { icon?: string; className?: string }) {
  const Icon = (icon && ICONS[icon]) || Layers;
  return <Icon className={className ?? "size-5 text-muted-foreground"} />;
}

// ─── Category colors ───────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  application: "bg-blue-500/15 text-blue-600",
  infrastructure: "bg-amber-500/15 text-amber-600",
  cicd: "bg-purple-500/15 text-purple-600",
};

// ─── Blueprint card ────────────────────────────────────────────────────────────

function BlueprintCard({
  bp,
  onProvision,
  hasDraft: hasBlueprintDraft,
}: {
  bp: Blueprint;
  onProvision: (bp: Blueprint) => void;
  hasDraft?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden flex flex-col hover:border-primary/50 transition group">
      <div className="h-1 w-full bg-[image:var(--gradient-primary)]" />
      <div className="p-5 flex flex-col flex-1">
        <div className="flex items-start gap-3 mb-3">
          <div className="size-10 rounded-lg bg-secondary grid place-items-center shrink-0 group-hover:bg-primary/10 transition">
            <BlueprintIcon
              icon={bp.icon}
              className="size-5 text-muted-foreground group-hover:text-primary transition"
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="font-semibold text-sm">{bp.display_name}</span>
              {bp.is_system && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                  platform
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${CATEGORY_COLORS[bp.category] ?? "bg-muted text-muted-foreground"}`}
              >
                {bp.category}
              </span>
              <span className="text-[10px] text-muted-foreground font-mono">{bp.version}</span>
            </div>
          </div>
        </div>

        {bp.description && (
          <p className="text-xs text-muted-foreground mb-3 line-clamp-2 leading-relaxed">
            {bp.description}
          </p>
        )}

        {bp.category !== "cicd" && bp.supported_runtimes.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-4">
            {bp.supported_runtimes.map((r) => (
              <span
                key={r}
                className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground font-mono"
              >
                {r}
              </span>
            ))}
          </div>
        )}

        {bp.category === "cicd" && bp.cicd_provider && (
          <div className="flex flex-wrap gap-1 mb-4">
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-600 font-mono">
              {bp.cicd_provider}
            </span>
          </div>
        )}

        <div className="mt-auto">
          <button
            onClick={() => onProvision(bp)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition"
          >
            <Rocket className="size-3.5" />
            {hasBlueprintDraft ? "Resume draft" : bp.category === "cicd" ? "Generate" : "Use blueprint"}
            {hasBlueprintDraft && (
              <span className="text-[9px] px-1 py-0.5 rounded bg-amber-400/30 text-amber-200 font-medium">
                draft
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Wizard step indicator ─────────────────────────────────────────────────────

const STEPS_APP = ["Configure", "Preview", "Provision"];
const STEPS_CICD = ["Configure", "Preview", "Provision"];

function StepIndicator({ current, steps }: { current: number; steps: string[] }) {
  return (
    <div className="flex items-center gap-1 mb-6">
      {steps.map((label, i) => (
        <div key={i} className="flex items-center">
          <div
            className={`flex items-center gap-1.5 px-2 py-1 rounded text-[11px] font-medium transition ${
              i === current
                ? "bg-primary/15 text-primary"
                : i < current
                  ? "text-muted-foreground"
                  : "text-muted-foreground/40"
            }`}
          >
            {i < current ? (
              <CheckCircle className="size-3 text-primary" />
            ) : (
              <span
                className={`size-4 rounded-full grid place-items-center text-[10px] ${
                  i === current
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {i + 1}
              </span>
            )}
            <span className="hidden sm:inline">{label}</span>
          </div>
          {i < steps.length - 1 && (
            <ChevronRight className="size-3 text-muted-foreground/30 mx-0.5" />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Draft persistence ─────────────────────────────────────────────────────────

interface WizardDraft {
  step: number;
  envSlug: string;
  appName: string;
  imageTag: string;
  imageOverride: string;
  repoConfig: RepositoryProvisionConfig | null;
  cicdBranch: string;
}

function draftStorageKey(workspaceSlug: string, blueprintName: string) {
  return `idp:bp-draft-v2:${workspaceSlug}:${blueprintName}`;
}

function loadDraft(workspaceSlug: string, blueprintName: string): WizardDraft | null {
  try {
    const raw = localStorage.getItem(draftStorageKey(workspaceSlug, blueprintName));
    return raw ? (JSON.parse(raw) as WizardDraft) : null;
  } catch {
    return null;
  }
}

function saveDraft(workspaceSlug: string, blueprintName: string, draft: WizardDraft) {
  try {
    localStorage.setItem(draftStorageKey(workspaceSlug, blueprintName), JSON.stringify(draft));
  } catch {
    // ignore
  }
}

function clearDraft(workspaceSlug: string, blueprintName: string) {
  try {
    localStorage.removeItem(draftStorageKey(workspaceSlug, blueprintName));
  } catch {
    // ignore
  }
}

function hasDraft(workspaceSlug: string, blueprintName: string): boolean {
  try {
    return localStorage.getItem(draftStorageKey(workspaceSlug, blueprintName)) !== null;
  } catch {
    return false;
  }
}

// ─── Runtime auto-resolver ─────────────────────────────────────────────────────

function useResolvedRuntime(workspaceSlug: string, envSlug: string) {
  const { data: caps, isLoading: capsLoading } = useCapabilities(workspaceSlug, envSlug);

  const runtimeCap = (caps ?? []).find((c) => c.capability_name === "runtime");
  const providers = runtimeCap?.providers ?? [];
  const hasNomad = providers.some((p) => p.provider_name === "nomad");
  const hasKubernetes = providers.some((p) => p.provider_name === "kubernetes");
  const hasDocker = providers.some((p) => p.provider_name === "docker");

  const runtimeProvider = hasNomad ? "nomad" : hasKubernetes ? "kubernetes" : hasDocker ? "docker" : "";

  const { data: nodes } = useNomadNodes(workspaceSlug, envSlug, !!envSlug && hasNomad);
  const { data: nomadNs } = useNomadNamespaces(workspaceSlug, envSlug, !!envSlug && hasNomad);
  const { data: k8sNs } = useK8sNamespaces(workspaceSlug, envSlug, !!envSlug && hasKubernetes);

  const datacenter = nodes && nodes.length > 0 ? nodes[0].Datacenter : "";
  const workerName = nodes && nodes.length > 0 ? nodes[0].Name : "";
  const nomadNamespace =
    nomadNs && nomadNs.length > 0 ? nomadNs[0].Name : "default";
  const k8sNamespace = k8sNs && k8sNs.length > 0 ? k8sNs[0].name : "default";

  return {
    runtimeProvider,
    datacenter,
    workerName,
    nomadNamespace,
    k8sNamespace,
    capsLoading,
    noRuntime: !!envSlug && !capsLoading && !runtimeProvider,
  };
}

// ─── Spec builder ─────────────────────────────────────────────────────────────

function buildSpec(
  bp: Blueprint,
  appName: string,
  imageTag: string,
  imageOverride: string,
  cicdBranch: string,
  runtime: ReturnType<typeof useResolvedRuntime>,
): PlatformSpec {
  const image = imageOverride.trim() || bp.default_image || "";
  const tag = imageTag.trim() || bp.default_tag || "latest";
  const port = bp.default_port ?? 8080;
  const cpu = bp.default_cpu ?? 256;
  const memMB = bp.default_memory_mb ?? 256;
  const cicdProvider = bp.cicd_provider ?? bp.name;

  if (bp.category === "cicd") {
    return {
      service: { name: appName, type: bp.name },
      runtime: { provider: "" as PlatformSpec["runtime"]["provider"] },
      container: { image: "", tag: "", port: 0, cpu: 0, memory_mb: 0 },
      deployment: { strategy: "rolling" },
      registry: {},
      secrets: {},
      cicd: { enabled: true, provider: cicdProvider, branch: cicdBranch || "main" },
      observability: { logs_enabled: false, metrics_enabled: false },
    };
  }

  return {
    service: { name: appName, type: bp.name },
    runtime: {
      provider: runtime.runtimeProvider as PlatformSpec["runtime"]["provider"],
      datacenter: runtime.datacenter,
      namespace: runtime.nomadNamespace,
      worker_name: runtime.workerName,
      k8s_namespace: runtime.k8sNamespace,
      replicas: 1,
    },
    container: { image, tag, port, cpu, memory_mb: memMB },
    deployment: { strategy: "rolling" },
    registry: {},
    secrets: {},
    cicd: { enabled: false, provider: "github-actions", branch: "main" },
    observability: { logs_enabled: true, metrics_enabled: false },
  };
}

// ─── Step 0 — Configure ───────────────────────────────────────────────────────

function StepConfigure({
  bp,
  workspaceSlug,
  envSlug,
  onEnvChange,
  appName,
  onAppNameChange,
  imageTag,
  onImageTagChange,
  imageOverride,
  onImageOverrideChange,
  repoConfig,
  onRepoConfigChange,
  cicdBranch,
  onCICDBranchChange,
  runtime,
}: {
  bp: Blueprint;
  workspaceSlug: string;
  envSlug: string;
  onEnvChange: (s: string) => void;
  appName: string;
  onAppNameChange: (s: string) => void;
  imageTag: string;
  onImageTagChange: (s: string) => void;
  imageOverride: string;
  onImageOverrideChange: (s: string) => void;
  repoConfig: RepositoryProvisionConfig | null;
  onRepoConfigChange: (cfg: RepositoryProvisionConfig | null) => void;
  cicdBranch: string;
  onCICDBranchChange: (s: string) => void;
  runtime: ReturnType<typeof useResolvedRuntime>;
}) {
  const { data: environments = [] } = useEnvironments(workspaceSlug);
  const isCICD = bp.category === "cicd";
  const isInfra = bp.category === "infrastructure";

  const providerId = repoConfig?.provider_id ?? "";
  const { data: repoProviders = [] } = useRepoProviders(workspaceSlug);
  const { data: repos = [], isLoading: reposLoading } = useRepoProviderRepos(
    workspaceSlug,
    providerId,
    !!providerId,
  );

  const patchRepo = (p: Partial<RepositoryProvisionConfig>) =>
    onRepoConfigChange({
      ...(repoConfig ?? { provider_id: "", repository: "", base_branch: "main" }),
      ...p,
    });

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-border bg-muted/30 p-4 flex items-center gap-3">
        <div className="size-10 rounded-lg bg-secondary grid place-items-center shrink-0">
          <BlueprintIcon icon={bp.icon} />
        </div>
        <div>
          <div className="font-semibold text-sm">{bp.display_name}</div>
          <div className="text-xs text-muted-foreground">{bp.description}</div>
        </div>
      </div>

      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
          {isCICD ? "Service name *" : "Application name *"}
        </label>
        <input
          value={appName}
          onChange={(e) => onAppNameChange(e.target.value)}
          placeholder={isCICD ? `my-service` : `my-${bp.name}`}
          className="w-full px-3 py-2.5 rounded-md bg-secondary border border-border focus:border-primary outline-none transition text-sm font-mono"
        />
        <p className="text-[11px] text-muted-foreground mt-1">
          Slug format — used as the deployment identifier.
        </p>
      </div>

      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
          {isCICD ? "Deploy target environment *" : "Target environment *"}
        </label>
        <select
          value={envSlug}
          onChange={(e) => onEnvChange(e.target.value)}
          className="w-full px-3 py-2.5 rounded-md bg-secondary border border-border focus:border-primary outline-none transition text-sm"
        >
          <option value="">Select environment…</option>
          {environments.map((env) => (
            <option key={env.slug} value={env.slug}>
              {env.name}
            </option>
          ))}
        </select>
        {!isCICD && envSlug && (
          <div className="mt-2">
            {runtime.capsLoading ? (
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Loader2 className="size-3 animate-spin" /> Detecting runtime…
              </div>
            ) : runtime.noRuntime ? (
              <div className="flex items-center gap-1.5 text-[11px] text-amber-600">
                <AlertCircle className="size-3" /> No runtime provider configured for this environment.
              </div>
            ) : runtime.runtimeProvider ? (
              <div className="flex items-center gap-1.5 text-[11px] text-emerald-600">
                <CheckCircle className="size-3" />
                Runtime auto-detected:{" "}
                <span className="font-mono font-medium">{runtime.runtimeProvider}</span>
                {runtime.datacenter && (
                  <span className="text-muted-foreground">· {runtime.datacenter}</span>
                )}
              </div>
            ) : null}
          </div>
        )}
      </div>

      {!isCICD && (
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              {isInfra ? "Image" : "Image"}
              {bp.default_image && (
                <span className="ml-1 font-normal font-mono text-[10px] text-muted-foreground/70">
                  default: {bp.default_image}
                </span>
              )}
            </label>
            <input
              value={imageOverride}
              onChange={(e) => onImageOverrideChange(e.target.value)}
              placeholder={bp.default_image || "registry.example.com/org/app"}
              className="w-full px-3 py-2.5 rounded-md bg-secondary border border-border focus:border-primary outline-none transition text-sm font-mono"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              Tag
            </label>
            <input
              value={imageTag}
              onChange={(e) => onImageTagChange(e.target.value)}
              placeholder={bp.default_tag || "latest"}
              className="w-full px-3 py-2.5 rounded-md bg-secondary border border-border focus:border-primary outline-none transition text-sm font-mono"
            />
          </div>
        </div>
      )}

      {isCICD && (
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              Repository provider *
            </label>
            {repoProviders.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No repository providers registered. Add one from the workspace{" "}
                <strong>Repositories</strong> page.
              </p>
            ) : (
              <select
                value={providerId}
                onChange={(e) => {
                  patchRepo({ provider_id: e.target.value, repository: "" });
                }}
                className="w-full px-3 py-2.5 rounded-md bg-secondary border border-border focus:border-primary outline-none transition text-sm"
              >
                <option value="">Select provider…</option>
                {repoProviders.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.provider_type === "github" ? "GitHub" : "GitLab"})
                  </option>
                ))}
              </select>
            )}
          </div>

          {providerId && (
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                Repository *
              </label>
              {reposLoading ? (
                <div className="flex items-center gap-2 h-10 text-xs text-muted-foreground">
                  <Loader2 className="size-3.5 animate-spin" /> Loading repositories…
                </div>
              ) : (
                <select
                  value={repoConfig?.repository ?? ""}
                  onChange={(e) => patchRepo({ repository: e.target.value })}
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

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              Trigger branch
            </label>
            <input
              value={cicdBranch}
              onChange={(e) => onCICDBranchChange(e.target.value)}
              placeholder="main"
              className="w-full px-3 py-2.5 rounded-md bg-secondary border border-border focus:border-primary outline-none transition text-sm font-mono"
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Step 1 — Preview ─────────────────────────────────────────────────────────

function StepPreview({
  resources,
  isLoading,
  error,
  editedManifest,
  editedCICD,
  onManifestChange,
  onCICDChange,
}: {
  resources: GeneratedResources | null;
  isLoading: boolean;
  error: string | null;
  editedManifest: string;
  editedCICD: string;
  onManifestChange: (v: string) => void;
  onCICDChange: (v: string) => void;
}) {
  const [activeTab, setActiveTab] = useState<"runtime" | "cicd">("runtime");
  const [editingTab, setEditingTab] = useState<"runtime" | "cicd" | null>(null);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <Loader2 className="size-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Generating resources…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 flex items-start gap-3">
        <AlertCircle className="size-5 text-destructive shrink-0 mt-0.5" />
        <div>
          <div className="text-sm font-medium text-destructive">Generation failed</div>
          <div className="text-xs text-destructive/80 mt-0.5">{error}</div>
        </div>
      </div>
    );
  }

  if (!resources) return null;

  const tabs: { key: "runtime" | "cicd"; label: string }[] = [];
  if (resources.runtime_manifest) {
    tabs.push({ key: "runtime", label: `${resources.runtime_provider} manifest` });
  }
  if (resources.cicd_workflow) {
    tabs.push({ key: "cicd", label: `${resources.cicd_provider ?? "CI/CD"} workflow` });
  }

  const effectiveTab = tabs.some((t) => t.key === activeTab) ? activeTab : (tabs[0]?.key ?? "runtime");
  const isEditing = editingTab === effectiveTab;
  const currentContent = effectiveTab === "runtime" ? editedManifest : editedCICD;
  const originalContent =
    effectiveTab === "runtime"
      ? (resources.runtime_manifest ?? "")
      : (resources.cicd_workflow ?? "");
  const isDirty = currentContent !== originalContent;

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 flex items-center gap-2 text-emerald-600">
        <CheckCircle className="size-4 shrink-0" />
        <span className="text-xs font-medium">
          Resources generated. Review before provisioning.
        </span>
      </div>

      {tabs.length > 0 && (
        <div className="flex items-center gap-1">
          <div className="flex gap-1 flex-1">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => {
                  setActiveTab(t.key);
                  setEditingTab(null);
                }}
                className={`px-3 py-1.5 rounded text-xs font-medium transition ${
                  effectiveTab === t.key
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-muted-foreground hover:bg-accent"
                }`}
              >
                <FileCode className="size-3 inline mr-1" />
                {t.label}
                {effectiveTab === t.key && isDirty && (
                  <span className="ml-1.5 size-1.5 rounded-full bg-amber-400 inline-block" />
                )}
              </button>
            ))}
          </div>

          <button
            onClick={() => setEditingTab(isEditing ? null : effectiveTab)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium transition ${
              isEditing
                ? "bg-amber-500/15 text-amber-600 hover:bg-amber-500/25"
                : "bg-secondary text-muted-foreground hover:bg-accent"
            }`}
          >
            {isEditing ? <Eye className="size-3" /> : <Pencil className="size-3" />}
            {isEditing ? "Preview" : "Edit"}
          </button>

          {isDirty && (
            <button
              onClick={() => {
                if (effectiveTab === "runtime") onManifestChange(originalContent);
                else onCICDChange(originalContent);
              }}
              className="px-2.5 py-1.5 rounded text-xs font-medium bg-secondary text-muted-foreground hover:bg-accent transition"
            >
              Revert
            </button>
          )}
        </div>
      )}

      {isEditing ? (
        <textarea
          value={currentContent}
          onChange={(e) => {
            if (effectiveTab === "runtime") onManifestChange(e.target.value);
            else onCICDChange(e.target.value);
          }}
          spellCheck={false}
          className="w-full h-80 px-4 py-3 rounded-md bg-secondary border border-amber-500/50 outline-none resize-none text-xs font-mono leading-relaxed focus:border-primary transition"
        />
      ) : (
        <div className="rounded-md bg-secondary border border-border overflow-auto max-h-80">
          <pre className="p-4 text-xs font-mono whitespace-pre leading-relaxed">
            {currentContent || "(no content)"}
          </pre>
        </div>
      )}

      {isDirty && !isEditing && (
        <p className="text-[11px] text-amber-600 flex items-center gap-1">
          <Pencil className="size-3" />
          This file has been edited. The modified version will be provisioned.
        </p>
      )}
    </div>
  );
}

// ─── Provision wizard dialog ────────────────────────────────────────────────────

function ProvisionWizard({
  open,
  blueprint,
  onClose,
  workspaceSlug,
}: {
  open: boolean;
  blueprint: Blueprint | null;
  onClose: () => void;
  workspaceSlug: string;
}) {
  const [step, setStep] = useState(0);
  const [envSlug, setEnvSlug] = useState("");
  const [appName, setAppName] = useState("");
  const [imageTag, setImageTag] = useState("");
  const [imageOverride, setImageOverride] = useState("");
  const [repoConfig, setRepoConfig] = useState<RepositoryProvisionConfig | null>(null);
  const [cicdBranch, setCicdBranch] = useState("main");
  const [preview, setPreview] = useState<GeneratedResources | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [editedManifest, setEditedManifest] = useState("");
  const [editedCICD, setEditedCICD] = useState("");
  const [isDraftLoaded, setIsDraftLoaded] = useState(false);

  const runtime = useResolvedRuntime(workspaceSlug, envSlug);
  const previewMutation = usePreviewApp(workspaceSlug, envSlug);
  const provisionMutation = useProvisionApp(workspaceSlug, envSlug);

  const isCICD = blueprint?.category === "cicd";
  const steps = isCICD ? STEPS_CICD : STEPS_APP;

  const handleOpen = (bp: Blueprint) => {
    const draft = loadDraft(workspaceSlug, bp.name);
    if (draft) {
      setStep(draft.step);
      setEnvSlug(draft.envSlug ?? "");
      setAppName(draft.appName ?? "");
      setImageTag(draft.imageTag ?? "");
      setImageOverride(draft.imageOverride ?? "");
      setRepoConfig(draft.repoConfig);
      setCicdBranch(draft.cicdBranch ?? "main");
      setIsDraftLoaded(true);
    } else {
      setStep(0);
      setEnvSlug("");
      setAppName("");
      setImageTag(bp.default_tag ?? "latest");
      setImageOverride("");
      setRepoConfig(null);
      setCicdBranch("main");
      setIsDraftLoaded(false);
    }
    setPreview(null);
    setPreviewError(null);
    setEditedManifest("");
    setEditedCICD("");
  };

  if (blueprint && appName === "" && !isDraftLoaded && step === 0) {
    // Initial open — set imageTag from blueprint default
  }

  useEffect(() => {
    if (blueprint && open) {
      handleOpen(blueprint);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blueprint?.name, open]);

  const canNext = (): boolean => {
    if (!blueprint) return false;
    if (step === 0) {
      if (isCICD) return appName.trim() !== "" && !!envSlug && !!repoConfig?.repository;
      return appName.trim() !== "" && !!envSlug && !runtime.noRuntime && !runtime.capsLoading;
    }
    if (step === 1) return !previewMutation.isPending && (!!preview || !!previewError);
    return true;
  };

  const handleNext = async () => {
    if (!blueprint) return;
    if (step === 0) {
      const spec = buildSpec(blueprint, appName, imageTag, imageOverride, cicdBranch, runtime);
      setPreview(null);
      setPreviewError(null);
      setStep(1);
      try {
        const res = await previewMutation.mutateAsync({ blueprint_name: blueprint.name, spec });
        setPreview(res);
        setEditedManifest(res.runtime_manifest ?? "");
        setEditedCICD(res.cicd_workflow ?? "");
      } catch (err: unknown) {
        setPreviewError(extractError(err, "Preview failed"));
      }
      return;
    }
    setStep((s) => s + 1);
  };

  const handleProvision = async () => {
    if (!blueprint) return;
    const spec = buildSpec(blueprint, appName, imageTag, imageOverride, cicdBranch, runtime);
    try {
      const overrideManifest =
        editedManifest !== (preview?.runtime_manifest ?? "") ? editedManifest : undefined;
      const overrideCICD = editedCICD !== (preview?.cicd_workflow ?? "") ? editedCICD : undefined;

      const result = await provisionMutation.mutateAsync({
        blueprint_name: blueprint.name,
        spec,
        override_manifest: overrideManifest,
        override_cicd: overrideCICD,
        repository: repoConfig?.provider_id && repoConfig?.repository ? repoConfig : undefined,
      });

      if (result.pr_url) {
        toast.success(`${appName} provisioned`, {
          description: `PR #${result.pr_number} opened in ${result.repo_name ?? repoConfig?.repository ?? ""}`,
        });
      } else {
        toast.success(`${appName} provisioned`, {
          description: `Blueprint: ${blueprint.display_name}${spec.runtime.provider ? ` · Runtime: ${spec.runtime.provider}` : ""}`,
        });
      }

      clearDraft(workspaceSlug, blueprint.name);
      resetWizard();
      onClose();
    } catch (err: unknown) {
      toastError(extractError(err, "Provision failed"));
    }
  };

  const resetWizard = () => {
    setStep(0);
    setEnvSlug("");
    setAppName("");
    setImageTag("");
    setImageOverride("");
    setRepoConfig(null);
    setCicdBranch("main");
    setPreview(null);
    setPreviewError(null);
    setEditedManifest("");
    setEditedCICD("");
    setIsDraftLoaded(false);
  };

  const handleClose = () => {
    if (blueprint && (step > 0 || appName.trim() !== "")) {
      saveDraft(workspaceSlug, blueprint.name, {
        step,
        envSlug,
        appName,
        imageTag,
        imageOverride,
        repoConfig,
        cicdBranch,
      });
    }
    resetWizard();
    onClose();
  };

  const handleDiscardDraft = () => {
    if (!blueprint) return;
    clearDraft(workspaceSlug, blueprint.name);
    setStep(0);
    setEnvSlug("");
    setAppName("");
    setImageTag(blueprint.default_tag ?? "latest");
    setImageOverride("");
    setRepoConfig(null);
    setCicdBranch("main");
    setIsDraftLoaded(false);
  };

  if (!blueprint) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) handleClose();
      }}
    >
      <DialogContent className="sm:max-w-xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BlueprintIcon icon={blueprint.icon} className="size-4 text-muted-foreground" />
            {blueprint.display_name}
            {isDraftLoaded && (
              <span className="ml-auto flex items-center gap-2">
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600 font-medium">
                  draft restored
                </span>
                <button
                  type="button"
                  onClick={handleDiscardDraft}
                  className="text-[11px] text-muted-foreground hover:text-destructive transition underline underline-offset-2"
                >
                  Discard
                </button>
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-1">
          <StepIndicator current={step} steps={steps} />

          <div className="mt-2">
            {step === 0 && (
              <StepConfigure
                bp={blueprint}
                workspaceSlug={workspaceSlug}
                envSlug={envSlug}
                onEnvChange={setEnvSlug}
                appName={appName}
                onAppNameChange={setAppName}
                imageTag={imageTag}
                onImageTagChange={setImageTag}
                imageOverride={imageOverride}
                onImageOverrideChange={setImageOverride}
                repoConfig={repoConfig}
                onRepoConfigChange={setRepoConfig}
                cicdBranch={cicdBranch}
                onCICDBranchChange={setCicdBranch}
                runtime={runtime}
              />
            )}

            {step === 1 && (
              <StepPreview
                resources={preview}
                isLoading={previewMutation.isPending}
                error={previewError}
                editedManifest={editedManifest}
                editedCICD={editedCICD}
                onManifestChange={setEditedManifest}
                onCICDChange={setEditedCICD}
              />
            )}

            {step === 2 && (
              <div className="space-y-4">
                <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2 text-sm">
                  {[
                    ["Blueprint", blueprint.display_name],
                    ["Environment", envSlug],
                    [isCICD ? "Service" : "Application", appName],
                    ...(isCICD
                      ? [
                          ["CI/CD provider", blueprint.cicd_provider ?? ""],
                          ["Repository", repoConfig?.repository ?? "—"],
                          ["Branch", cicdBranch || "main"],
                        ]
                      : [
                          ["Runtime", runtime.runtimeProvider],
                          [
                            "Image",
                            `${imageOverride || blueprint.default_image || ""}:${imageTag || blueprint.default_tag || "latest"}`,
                          ],
                        ]),
                  ].map(([k, v]) => (
                    <div key={k} className="flex items-center gap-2">
                      <span className="text-muted-foreground w-28 shrink-0 text-xs">{k}</span>
                      <span className="font-mono text-xs">{v}</span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  {isCICD
                    ? `The platform will generate and commit the CI/CD workflow to ${repoConfig?.repository ?? "your repository"} targeting ${envSlug}.`
                    : `The platform will generate the runtime manifest and provision it to ${runtime.runtimeProvider} in ${envSlug}.`}{" "}
                  This action cannot be automatically undone.
                </p>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="pt-4 border-t border-border mt-2">
          <button
            type="button"
            onClick={step === 0 ? handleClose : () => setStep((s) => s - 1)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-secondary hover:bg-accent text-sm transition"
          >
            {step === 0 ? <X className="size-3.5" /> : <ArrowLeft className="size-3.5" />}
            {step === 0 ? "Cancel" : "Back"}
          </button>

          {step < 2 ? (
            <button
              type="button"
              onClick={() => void handleNext()}
              disabled={!canNext() || previewMutation.isPending}
              className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition disabled:opacity-60"
            >
              {previewMutation.isPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <ArrowRight className="size-3.5" />
              )}
              {step === 0 ? "Preview" : "Review"}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void handleProvision()}
              disabled={provisionMutation.isPending}
              className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition disabled:opacity-60"
            >
              {provisionMutation.isPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Rocket className="size-3.5" />
              )}
              Provision
            </button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Deployment history helpers ────────────────────────────────────────────────

function shortSHA(sha?: string) {
  return sha ? sha.slice(0, 7) : null;
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function cicdPipelineUrl(rec: DeploymentRecord): string | null {
  if (rec.pr_url) return rec.pr_url;
  if (!rec.repo_name) return null;
  if (rec.cicd_provider === "github-actions") return `https://github.com/${rec.repo_name}/actions`;
  if (rec.cicd_provider === "gitlab-ci") return `https://gitlab.com/${rec.repo_name}/-/pipelines`;
  return null;
}

function commitUrl(rec: DeploymentRecord): string | null {
  if (!rec.commit_sha || !rec.repo_name) return null;
  if (rec.cicd_provider === "gitlab-ci")
    return `https://gitlab.com/${rec.repo_name}/-/commit/${rec.commit_sha}`;
  return `https://github.com/${rec.repo_name}/commit/${rec.commit_sha}`;
}

const STATUS_STYLES: Record<string, { dot: string; text: string; label: string }> = {
  provisioned: { dot: "bg-emerald-500", text: "text-emerald-600", label: "provisioned" },
  pending: { dot: "bg-amber-400", text: "text-amber-600", label: "pending" },
  failed: { dot: "bg-red-500", text: "text-red-600", label: "failed" },
  stopped: { dot: "bg-slate-400", text: "text-slate-500", label: "stopped" },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLES[status] ?? STATUS_STYLES.pending;
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium ${s.text}`}>
      <span className={`size-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

function DeploymentHistoryRow({ rec }: { rec: DeploymentRecord }) {
  const sha = shortSHA(rec.commit_sha);
  const pipeline = cicdPipelineUrl(rec);
  const commit = commitUrl(rec);

  return (
    <div className="flex items-center gap-3 py-2 px-3 rounded-md hover:bg-muted/40 transition text-xs">
      <StatusBadge status={rec.status} />

      <div className="flex items-center gap-1.5 text-muted-foreground min-w-0 flex-1">
        {rec.repo_branch && (
          <span className="flex items-center gap-1 font-mono">
            <GitBranch className="size-3 shrink-0" />
            {rec.repo_branch}
          </span>
        )}
        {sha && (
          <>
            <span className="text-muted-foreground/40">@</span>
            {commit ? (
              <a
                href={commit}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 font-mono hover:text-primary transition"
              >
                <GitCommit className="size-3 shrink-0" />
                {sha}
              </a>
            ) : (
              <span className="flex items-center gap-1 font-mono">
                <GitCommit className="size-3 shrink-0" />
                {sha}
              </span>
            )}
          </>
        )}
        {(rec.pr_number ?? 0) > 0 && (
          <span className="text-muted-foreground/60">· PR #{rec.pr_number}</span>
        )}
        {rec.cicd_provider && (
          <span className="px-1 py-0.5 rounded bg-secondary text-[10px] font-mono">
            {rec.cicd_provider}
          </span>
        )}
      </div>

      <span className="text-muted-foreground shrink-0">{relativeTime(rec.created_at)}</span>

      {pipeline && (
        <a
          href={pipeline}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-primary hover:underline shrink-0"
        >
          <ExternalLink className="size-3" />
          {rec.pr_url ? "PR" : "Pipeline"}
        </a>
      )}
    </div>
  );
}

function PageBar({
  page,
  totalPages,
  total,
  limit,
  isLoading,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  isLoading?: boolean;
  onPageChange: (p: number) => void;
}) {
  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  return (
    <div className="flex items-center justify-between pt-2 border-t border-border/40">
      <span className="text-[11px] text-muted-foreground tabular-nums">
        {total === 0 ? "No items" : `Showing ${from}–${to} of ${total}`}
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page === 1 || isLoading}
          className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium bg-secondary hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          <ChevronRight className="size-3 rotate-180" />
          Prev
        </button>
        <span className="px-2 text-[11px] text-muted-foreground tabular-nums select-none">
          {page} / {totalPages}
        </span>
        <button
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page === totalPages || isLoading}
          className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium bg-secondary hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          Next
          <ChevronRight className="size-3" />
        </button>
      </div>
    </div>
  );
}

const HIST_LIMIT = 5;

function ProvisionedAppCard({
  app,
  workspaceSlug,
  envSlug,
  onDelete,
}: {
  app: PlatformApp;
  workspaceSlug: string;
  envSlug: string;
  onDelete: (id: string, name: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [histPage, setHistPage] = useState(1);
  const { data: histData, isLoading: histLoading } = useAppDeployments(
    workspaceSlug,
    envSlug,
    expanded ? app.id : "",
    histPage,
    HIST_LIMIT,
  );

  const sha = shortSHA(app.commit_sha);
  const deployments = histData?.items ?? [];
  const totalPages = histData ? Math.max(1, Math.ceil(histData.total / HIST_LIMIT)) : 1;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-4 py-3 flex items-center gap-3">
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm">{app.name}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground font-mono">
              {app.blueprint_name}
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground font-mono">
              {app.runtime_provider}
            </span>
            <StatusBadge status={app.status} />
          </div>

          <div className="flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap">
            {app.repo_branch && (
              <span className="flex items-center gap-1 font-mono">
                <GitBranch className="size-3" />
                {app.repo_branch}
              </span>
            )}
            {sha && (
              <span className="flex items-center gap-1 font-mono">
                <GitCommit className="size-3" />
                {sha}
              </span>
            )}
            {(app.pr_number ?? 0) > 0 && (
              <span>
                PR{" "}
                {app.pr_url ? (
                  <a
                    href={app.pr_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    #{app.pr_number}
                  </a>
                ) : (
                  `#${app.pr_number}`
                )}
              </span>
            )}
            {app.spec?.cicd?.provider && (
              <span className="px-1 py-0.5 rounded bg-secondary text-[10px] font-mono">
                {app.spec.cicd.provider}
              </span>
            )}
            <span className="text-muted-foreground/60">· {relativeTime(app.created_at)}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => {
              setExpanded((e) => !e);
              setHistPage(1);
            }}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-medium bg-secondary hover:bg-accent text-muted-foreground transition"
          >
            <History className="size-3.5" />
            History
            {expanded ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
          </button>
          <button
            onClick={() => onDelete(app.id, app.name)}
            className="p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition"
            title="Delete application"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border bg-muted/20 px-4 py-3 space-y-0">
          <div className="flex items-center gap-2 pb-2">
            <History className="size-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">Deployment history</span>
            {histData && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground tabular-nums">
                {histData.total} total
              </span>
            )}
          </div>

          {histLoading ? (
            <div className="flex items-center gap-2 py-4 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" /> Loading…
            </div>
          ) : deployments.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4">No deployment records yet.</p>
          ) : (
            <div className="divide-y divide-border/50 mb-3">
              {deployments.map((rec) => (
                <DeploymentHistoryRow key={rec.id} rec={rec} />
              ))}
            </div>
          )}

          {histData && (
            <PageBar
              page={histPage}
              totalPages={totalPages}
              total={histData.total}
              limit={HIST_LIMIT}
              isLoading={histLoading}
              onPageChange={setHistPage}
            />
          )}
        </div>
      )}
    </div>
  );
}

const APPS_LIMIT = 5;

function ProvisionedApplications({ workspaceSlug }: { workspaceSlug: string }) {
  const { data: environments = [] } = useEnvironments(workspaceSlug);
  const [selectedEnvSlug, setSelectedEnvSlug] = useState("");
  const [appsPage, setAppsPage] = useState(1);

  useEffect(() => {
    if (!selectedEnvSlug && environments.length > 0) {
      setSelectedEnvSlug(environments[0].slug);
    }
  }, [environments, selectedEnvSlug]);

  const { data: appsData, isLoading } = usePlatformApps(
    workspaceSlug,
    selectedEnvSlug,
    appsPage,
    APPS_LIMIT,
  );
  const deleteMutation = useDeletePlatformApp(workspaceSlug, selectedEnvSlug);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);

  const apps = appsData?.items ?? [];
  const totalAppPages = appsData ? Math.max(1, Math.ceil(appsData.total / APPS_LIMIT)) : 1;

  const handleDelete = async (id: string) => {
    try {
      await deleteMutation.mutateAsync(id);
      toast.success("Application deleted");
      setConfirmDelete(null);
      if (apps.length === 1 && appsPage > 1) setAppsPage((p) => p - 1);
    } catch (err: unknown) {
      toastError(extractError(err, "Failed to delete application"));
    }
  };

  if (!selectedEnvSlug) return null;

  if (!appsData && isLoading)
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
        <Loader2 className="size-4 animate-spin" /> Loading applications…
      </div>
    );

  if (!appsData || appsData.total === 0) return null;

  return (
    <section>
      <div className="flex items-center gap-3 mb-1">
        <h2 className="text-base font-semibold flex-1">Provisioned Applications</h2>
        <span className="text-xs px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground tabular-nums">
          {appsData.total}
        </span>
        {environments.length > 1 && (
          <select
            value={selectedEnvSlug}
            onChange={(e) => {
              setSelectedEnvSlug(e.target.value);
              setAppsPage(1);
            }}
            className="px-2.5 py-1 rounded-md bg-secondary border border-border text-xs outline-none focus:border-primary transition"
          >
            {environments.map((env) => (
              <option key={env.slug} value={env.slug}>
                {env.name}
              </option>
            ))}
          </select>
        )}
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Running application instances provisioned from blueprints.
      </p>

      <div className="space-y-3 mb-3">
        {apps.map((app) => (
          <ProvisionedAppCard
            key={app.id}
            app={app}
            workspaceSlug={workspaceSlug}
            envSlug={selectedEnvSlug}
            onDelete={(id, name) => setConfirmDelete({ id, name })}
          />
        ))}
      </div>

      <PageBar
        page={appsPage}
        totalPages={totalAppPages}
        total={appsData.total}
        limit={APPS_LIMIT}
        isLoading={isLoading}
        onPageChange={setAppsPage}
      />

      {confirmDelete && (
        <Dialog
          open
          onOpenChange={(v) => {
            if (!v) setConfirmDelete(null);
          }}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Delete {confirmDelete.name}?</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              This will stop and remove the application. This action cannot be undone.
            </p>
            <DialogFooter className="pt-2">
              <button
                onClick={() => setConfirmDelete(null)}
                className="px-4 py-2 rounded-md bg-secondary hover:bg-accent text-sm transition"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleDelete(confirmDelete.id)}
                disabled={deleteMutation.isPending}
                className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-destructive text-destructive-foreground text-sm font-medium hover:opacity-90 transition disabled:opacity-60"
              >
                {deleteMutation.isPending ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Trash2 className="size-3.5" />
                )}
                Delete
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </section>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

function BlueprintsPage() {
  const { selectedWorkspace } = useWorkspaceContext();
  const workspaceSlug = selectedWorkspace?.slug ?? "";

  const { data: blueprints, isLoading, error } = useBlueprints(workspaceSlug);
  const [provisioning, setProvisioning] = useState<Blueprint | null>(null);
  const [draftVersion, setDraftVersion] = useState(0);

  const blueprintDrafts = useMemo(() => {
    const map = new Map<string, boolean>();
    (blueprints ?? []).forEach((bp) => {
      map.set(bp.name, hasDraft(workspaceSlug, bp.name));
    });
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blueprints, draftVersion, workspaceSlug]);

  const appBlueprints = (blueprints ?? []).filter((b) => b.category === "application");
  const infraBlueprints = (blueprints ?? []).filter((b) => b.category === "infrastructure");
  const cicdBlueprints = (blueprints ?? []).filter((b) => b.category === "cicd");

  return (
    <div className="flex flex-col h-full">
      <DashboardTopbar
        title="Blueprints"
        subtitle="Choose a blueprint to provision a standardized application or generate CI/CD workflows"
      />

      <div className="flex-1 overflow-auto p-6 space-y-8">
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading blueprints…
          </div>
        ) : error ? (
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="size-4" /> {(error as ApiError).message}
          </div>
        ) : (
          <>
            {appBlueprints.length > 0 && (
              <section>
                <h2 className="text-base font-semibold mb-1">Application blueprints</h2>
                <p className="text-sm text-muted-foreground mb-4">
                  Deploy your application to any environment. The platform auto-detects the runtime
                  and generates the manifest.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {appBlueprints.map((bp) => (
                    <BlueprintCard
                      key={bp.id}
                      bp={bp}
                      onProvision={setProvisioning}
                      hasDraft={blueprintDrafts.get(bp.name)}
                    />
                  ))}
                </div>
              </section>
            )}

            {infraBlueprints.length > 0 && (
              <section>
                <h2 className="text-base font-semibold mb-1">Infrastructure blueprints</h2>
                <p className="text-sm text-muted-foreground mb-4">
                  Managed infrastructure components provisioned via the platform.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {infraBlueprints.map((bp) => (
                    <BlueprintCard
                      key={bp.id}
                      bp={bp}
                      onProvision={setProvisioning}
                      hasDraft={blueprintDrafts.get(bp.name)}
                    />
                  ))}
                </div>
              </section>
            )}

            {cicdBlueprints.length > 0 && (
              <section>
                <h2 className="text-base font-semibold mb-1">CI/CD blueprints</h2>
                <p className="text-sm text-muted-foreground mb-4">
                  Generate CI/CD workflows for your repository. No runtime configuration needed.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {cicdBlueprints.map((bp) => (
                    <BlueprintCard
                      key={bp.id}
                      bp={bp}
                      onProvision={setProvisioning}
                      hasDraft={blueprintDrafts.get(bp.name)}
                    />
                  ))}
                </div>
              </section>
            )}

            <ProvisionedApplications workspaceSlug={workspaceSlug} />
          </>
        )}
      </div>

      <ProvisionWizard
        open={!!provisioning}
        blueprint={provisioning}
        onClose={() => {
          setProvisioning(null);
          setDraftVersion((v) => v + 1);
        }}
        workspaceSlug={workspaceSlug}
      />
    </div>
  );
}
