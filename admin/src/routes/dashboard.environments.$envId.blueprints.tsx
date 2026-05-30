import { createFileRoute, useParams } from "@tanstack/react-router";
import { DashboardTopbar } from "@/components/DashboardTopbar";
import { useWorkspaceContext } from "@/lib/workspace-context";
import {
  useBlueprints,
  useCapabilities,
  useNomadNodes,
  useNomadNamespaces,
  useK8sNamespaces,
  useRegistries,
  useEnvironmentRegistries,
  useBoundRepos,
  useRegistryRepos,
  useRepoProviders,
  useRepoProviderRepos,
  useRepoProviderContents,
  useSecretGrants,
  useCreateSecretGrant,
  usePreviewApp,
  useProvisionApp,
  usePlatformApps,
  useDeletePlatformApp,
  useAppDeployments,
} from "@/lib/queries";
import { isAdminGrant } from "@/lib/types";
import type {
  SecretGrantAdminView,
  Blueprint,
  PlatformSpec,
  GeneratedResources,
  RegistryProvider,
  RegistryProviderType,
  RepositoryProvisionConfig,
  PlatformApp,
  DeploymentRecord,
  PlatformAppPage,
} from "@/lib/types";
import { useState, useMemo } from "react";
import { toast } from "sonner";
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
  Circle,
  XCircle,
  Clock as ClockIcon,
} from "lucide-react";
import type { ApiError } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/dashboard/environments/$envId/blueprints")({
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
};

function BlueprintIcon({ icon, className }: { icon?: string; className?: string }) {
  const Icon = (icon && ICONS[icon]) || Layers;
  return <Icon className={className ?? "size-5 text-muted-foreground"} />;
}

// ─── Category colors ───────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  application: "bg-blue-500/15 text-blue-600",
  infrastructure: "bg-amber-500/15 text-amber-600",
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

        <div className="mt-auto">
          <button
            onClick={() => onProvision(bp)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition"
          >
            <Rocket className="size-3.5" />
            {hasBlueprintDraft ? "Resume draft" : "Provision"}
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

const STEPS = ["Blueprint", "Runtime", "Container", "Secrets & CI/CD", "Preview", "Provision"];

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-1 mb-6">
      {STEPS.map((label, i) => (
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
          {i < STEPS.length - 1 && (
            <ChevronRight className="size-3 text-muted-foreground/30 mx-0.5" />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Wizard steps ──────────────────────────────────────────────────────────────

function buildDefaultSpec(bp: Blueprint, runtimeProvider: string): PlatformSpec {
  return {
    service: { name: "", type: bp.name },
    runtime: {
      provider: runtimeProvider as PlatformSpec["runtime"]["provider"],
      datacenter: "",
      namespace: "default",
      worker_name: "",
      k8s_namespace: "default",
      replicas: 1,
    },
    container: { image: "", tag: "latest", port: 8080, cpu: 256, memory_mb: 256 },
    deployment: { strategy: "rolling" },
    registry: {},
    secrets: {},
    cicd: { enabled: false, provider: "github-actions", branch: "main" },
    observability: { logs_enabled: true, metrics_enabled: false },
  };
}

// ─── Draft persistence ─────────────────────────────────────────────────────────

interface WizardDraft {
  step: number;
  spec: PlatformSpec;
  grantId: string;
  initialSecretsRaw: string;
  repoConfig: RepositoryProvisionConfig | null;
  buildContext: string;
}

function draftStorageKey(envSlug: string, blueprintName: string) {
  return `idp:blueprint-draft:${envSlug}:${blueprintName}`;
}

function loadDraft(envSlug: string, blueprintName: string): WizardDraft | null {
  try {
    const raw = localStorage.getItem(draftStorageKey(envSlug, blueprintName));
    return raw ? (JSON.parse(raw) as WizardDraft) : null;
  } catch {
    return null;
  }
}

function saveDraft(envSlug: string, blueprintName: string, draft: WizardDraft) {
  try {
    localStorage.setItem(draftStorageKey(envSlug, blueprintName), JSON.stringify(draft));
  } catch {
    // localStorage quota exceeded or unavailable
  }
}

function clearDraft(envSlug: string, blueprintName: string) {
  try {
    localStorage.removeItem(draftStorageKey(envSlug, blueprintName));
  } catch {
    // ignore
  }
}

function hasDraft(envSlug: string, blueprintName: string): boolean {
  try {
    return localStorage.getItem(draftStorageKey(envSlug, blueprintName)) !== null;
  } catch {
    return false;
  }
}

// Step 1 — confirm blueprint + choose runtime
function Step1Runtime({
  bp,
  spec,
  onChange,
}: {
  bp: Blueprint;
  spec: PlatformSpec;
  onChange: (patch: Partial<PlatformSpec>) => void;
}) {
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
        <label className="text-xs font-medium text-muted-foreground mb-2 block">
          Runtime provider *
        </label>
        <div className="grid grid-cols-3 gap-2">
          {bp.supported_runtimes.map((rt) => (
            <button
              key={rt}
              onClick={() =>
                onChange({
                  runtime: { ...spec.runtime, provider: rt as PlatformSpec["runtime"]["provider"] },
                })
              }
              className={`px-3 py-2.5 rounded-md border text-sm font-medium transition ${
                spec.runtime.provider === rt
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border hover:border-primary/50 text-muted-foreground"
              }`}
            >
              {rt.charAt(0).toUpperCase() + rt.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
          Application name *
        </label>
        <input
          value={spec.service.name}
          onChange={(e) => onChange({ service: { ...spec.service, name: e.target.value } })}
          placeholder={`my-${bp.name}`}
          className="w-full px-3 py-2.5 rounded-md bg-secondary border border-border focus:border-primary outline-none transition text-sm font-mono"
        />
        <p className="text-[11px] text-muted-foreground mt-1">
          Slug format. Used as the deployment identifier.
        </p>
      </div>

      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
          Deployment strategy
        </label>
        <select
          value={spec.deployment.strategy}
          onChange={(e) =>
            onChange({
              deployment: { strategy: e.target.value as PlatformSpec["deployment"]["strategy"] },
            })
          }
          className="w-full px-3 py-2.5 rounded-md bg-secondary border border-border focus:border-primary outline-none transition text-sm"
        >
          <option value="rolling">Rolling update (default)</option>
          <option value="recreate">Recreate</option>
          <option value="canary">Canary</option>
        </select>
      </div>
    </div>
  );
}

// Step 2 — runtime-specific config
function Step2RuntimeConfig({
  spec,
  workspaceSlug,
  envSlug,
  onChange,
}: {
  spec: PlatformSpec;
  workspaceSlug: string;
  envSlug: string;
  onChange: (patch: Partial<PlatformSpec>) => void;
}) {
  const isNomad = spec.runtime.provider === "nomad";
  const isK8s = spec.runtime.provider === "kubernetes";

  const { data: nodes } = useNomadNodes(workspaceSlug, envSlug, isNomad);
  const { data: nomadNamespaces, isLoading: nomadNsLoading } = useNomadNamespaces(
    workspaceSlug,
    envSlug,
    isNomad,
  );
  const { data: k8sNamespaces, isLoading: k8sNsLoading } = useK8sNamespaces(
    workspaceSlug,
    envSlug,
    isK8s,
  );
  const datacenters = [...new Set((nodes ?? []).map((n) => n.Datacenter))];
  const workers = (nodes ?? []).filter(
    (n) => !spec.runtime.datacenter || n.Datacenter === spec.runtime.datacenter,
  );

  const updateRuntime = (patch: Partial<PlatformSpec["runtime"]>) =>
    onChange({ runtime: { ...spec.runtime, ...patch } });

  return (
    <div className="space-y-4">
      {isNomad && (
        <>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              Datacenter *
            </label>
            {datacenters.length > 0 ? (
              <select
                value={spec.runtime.datacenter}
                onChange={(e) => updateRuntime({ datacenter: e.target.value, worker_name: "" })}
                className="w-full px-3 py-2.5 rounded-md bg-secondary border border-border focus:border-primary outline-none transition text-sm"
              >
                <option value="">Select datacenter…</option>
                {datacenters.map((dc) => (
                  <option key={dc} value={dc}>
                    {dc}
                  </option>
                ))}
              </select>
            ) : (
              <input
                value={spec.runtime.datacenter}
                onChange={(e) => updateRuntime({ datacenter: e.target.value })}
                placeholder="dc1"
                className="w-full px-3 py-2.5 rounded-md bg-secondary border border-border focus:border-primary outline-none transition text-sm"
              />
            )}
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              Worker node *
            </label>
            {workers.length > 0 ? (
              <select
                value={spec.runtime.worker_name}
                onChange={(e) => updateRuntime({ worker_name: e.target.value })}
                className="w-full px-3 py-2.5 rounded-md bg-secondary border border-border focus:border-primary outline-none transition text-sm"
              >
                <option value="">Select worker…</option>
                {workers.map((n) => (
                  <option key={n.ID} value={n.Name}>
                    {n.Name} ({n.Address})
                  </option>
                ))}
              </select>
            ) : (
              <input
                value={spec.runtime.worker_name}
                onChange={(e) => updateRuntime({ worker_name: e.target.value })}
                placeholder="worker-1"
                className="w-full px-3 py-2.5 rounded-md bg-secondary border border-border focus:border-primary outline-none transition text-sm"
              />
            )}
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              Namespace
            </label>
            <select
              value={spec.runtime.namespace}
              onChange={(e) => updateRuntime({ namespace: e.target.value })}
              disabled={nomadNsLoading}
              className="w-full px-3 py-2.5 rounded-md bg-secondary border border-border focus:border-primary outline-none transition text-sm disabled:opacity-60"
            >
              {nomadNamespaces && nomadNamespaces.length > 0 ? (
                nomadNamespaces.map((ns) => (
                  <option key={ns.Name} value={ns.Name}>
                    {ns.Name}
                  </option>
                ))
              ) : (
                <option value="default">default</option>
              )}
            </select>
          </div>
        </>
      )}

      {isK8s && (
        <>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              Kubernetes namespace
            </label>
            <select
              value={spec.runtime.k8s_namespace}
              onChange={(e) => updateRuntime({ k8s_namespace: e.target.value })}
              disabled={k8sNsLoading}
              className="w-full px-3 py-2.5 rounded-md bg-secondary border border-border focus:border-primary outline-none transition text-sm disabled:opacity-60"
            >
              {k8sNamespaces && k8sNamespaces.length > 0 ? (
                k8sNamespaces.map((ns) => (
                  <option key={ns.name} value={ns.name}>
                    {ns.name}
                  </option>
                ))
              ) : (
                <option value="default">default</option>
              )}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              Replicas
            </label>
            <input
              type="number"
              min={1}
              value={spec.runtime.replicas}
              onChange={(e) => updateRuntime({ replicas: parseInt(e.target.value, 10) || 1 })}
              className="w-full px-3 py-2.5 rounded-md bg-secondary border border-border focus:border-primary outline-none transition text-sm"
            />
          </div>
        </>
      )}

      {isNomad && (
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
            Manifest variant
          </label>
          <select
            value={spec.runtime.variant ?? ""}
            onChange={(e) => updateRuntime({ variant: e.target.value || undefined })}
            className="w-full px-3 py-2.5 rounded-md bg-secondary border border-border focus:border-primary outline-none transition text-sm"
          >
            <option value="">Default (with Vault)</option>
            <option value="no-vault">No Vault (plain env vars)</option>
            <option value="with-volume">With persistent volume</option>
          </select>
        </div>
      )}

      {isK8s && (
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
            Manifest variant
          </label>
          <select
            value={spec.runtime.variant ?? ""}
            onChange={(e) => updateRuntime({ variant: e.target.value || undefined })}
            className="w-full px-3 py-2.5 rounded-md bg-secondary border border-border focus:border-primary outline-none transition text-sm"
          >
            <option value="">Default (Deployment + Service)</option>
            <option value="with-hpa">With HorizontalPodAutoscaler</option>
            <option value="with-ingress">With Ingress</option>
            <option value="with-pvc">With PersistentVolumeClaim</option>
          </select>
        </div>
      )}

      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
          Observability
        </label>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={spec.observability.logs_enabled}
              onChange={(e) =>
                onChange({
                  observability: { ...spec.observability, logs_enabled: e.target.checked },
                })
              }
              className="rounded"
            />
            Enable centralized logs
          </label>
        </div>
      </div>
    </div>
  );
}

// Step 3 — container config
function Step3Container({
  spec,
  onChange,
  workspaceSlug,
  envSlug,
}: {
  spec: PlatformSpec;
  onChange: (patch: Partial<PlatformSpec>) => void;
  workspaceSlug: string;
  envSlug: string;
}) {
  const updateContainer = (patch: Partial<PlatformSpec["container"]>) =>
    onChange({ container: { ...spec.container, ...patch } });

  // registryId: "" = public, "b:{binding.registry_id}" = env-bound, "ws:{registry.id}" = workspace
  const [registryId, setRegistryId] = useState("");
  const [selectedRepo, setSelectedRepo] = useState("");
  const [customRepo, setCustomRepo] = useState("");
  const [isCustomRepo, setIsCustomRepo] = useState(false);

  const isWorkspaceReg = registryId.startsWith("ws:");
  const isBoundReg = registryId.startsWith("b:");
  const boundRegId = isBoundReg ? registryId.slice(2) : "";
  const wsRegId = isWorkspaceReg ? registryId.slice(3) : "";

  const { data: bindings = [] } = useEnvironmentRegistries(workspaceSlug, envSlug);
  const { data: allRegistries = [] } = useRegistries(workspaceSlug);
  const boundIds = new Set(bindings.map((b) => b.registry_id));
  const unboundRegistries = allRegistries.filter((r) => !boundIds.has(r.id));

  const { data: boundRepos = [], isLoading: boundReposLoading } = useBoundRepos(
    workspaceSlug,
    envSlug,
    boundRegId,
    isBoundReg && !!boundRegId,
  );
  const { data: wsRepos = [], isLoading: wsReposLoading } = useRegistryRepos(
    workspaceSlug,
    wsRegId,
    isWorkspaceReg && !!wsRegId,
  );

  const repos = isWorkspaceReg ? wsRepos : boundRepos;
  const reposLoading = isWorkspaceReg ? wsReposLoading : boundReposLoading;

  const selectedBinding = bindings.find((b) => b.registry_id === boundRegId);
  const selectedWsRegistry = allRegistries.find((r) => r.id === wsRegId);
  const selectedEndpoint = isWorkspaceReg
    ? selectedWsRegistry?.endpoint
    : selectedBinding?.registry_endpoint;

  const PROVIDER_LABELS_SMALL: Record<RegistryProviderType, string> = {
    harbor: "Harbor",
    dockerhub: "Docker Hub",
    ghcr: "GHCR",
    ecr: "AWS ECR",
    gcr: "Google GCR",
  };

  const buildImage = (endpoint: string, repo: string) => {
    const host = endpoint.replace(/^https?:\/\//, "").replace(/\/$/, "");
    return repo ? `${host}/${repo}` : host;
  };

  const cleanEndpoint = (ep: string) => ep.replace(/^https?:\/\//, "").replace(/\/$/, "");

  const handleRegistryChange = (newId: string) => {
    setRegistryId(newId);
    setSelectedRepo("");
    setCustomRepo("");
    setIsCustomRepo(false);
    updateContainer({ image: "" });
    onChange({ registry: {} }); // clear registry spec when source changes
  };

  const handleRepoSelect = (value: string) => {
    if (value === "__new__") {
      setIsCustomRepo(true);
      setSelectedRepo("");
      updateContainer({ image: "" });
      onChange({ registry: { ...spec.registry, image_path: "" } });
    } else {
      setIsCustomRepo(false);
      setSelectedRepo(value);
      if (selectedEndpoint) {
        updateContainer({ image: buildImage(selectedEndpoint, value) });
      }
      // Populate spec.registry so the CI/CD template gets the correct endpoint + image path.
      onChange({
        registry: {
          registry_id: isBoundReg ? boundRegId : wsRegId,
          endpoint: cleanEndpoint(selectedEndpoint ?? ""),
          image_path: value,
        },
      });
    }
  };

  const handleCustomRepoChange = (value: string) => {
    setCustomRepo(value);
    if (selectedEndpoint) {
      updateContainer({ image: buildImage(selectedEndpoint, value) });
    }
    onChange({
      registry: {
        registry_id: isBoundReg ? boundRegId : wsRegId,
        endpoint: cleanEndpoint(selectedEndpoint ?? ""),
        image_path: value,
      },
    });
  };

  return (
    <div className="space-y-4">
      {/* Image source */}
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
          Image source *
        </label>
        <select
          value={registryId}
          onChange={(e) => handleRegistryChange(e.target.value)}
          className="w-full px-3 py-2.5 rounded-md bg-secondary border border-border focus:border-primary outline-none transition text-sm"
        >
          <option value="">Public image</option>
          {bindings.length > 0 && (
            <optgroup label="── Bound to this environment">
              {bindings.map((b) => (
                <option key={b.registry_id} value={`b:${b.registry_id}`}>
                  {b.registry_name ?? b.registry_endpoint ?? b.registry_id}
                </option>
              ))}
            </optgroup>
          )}
          {unboundRegistries.length > 0 && (
            <optgroup label="── Workspace (not bound)">
              {unboundRegistries.map((r) => (
                <option key={r.id} value={`ws:${r.id}`}>
                  {r.name}
                  {r.endpoint ? ` · ${r.endpoint.replace(/^https?:\/\//, "")}` : ""}
                  {` (${PROVIDER_LABELS_SMALL[r.provider_type as RegistryProviderType] ?? r.provider_type})`}
                </option>
              ))}
            </optgroup>
          )}
        </select>
      </div>

      {/* Public image — free-text path + tag side by side */}
      {!registryId && (
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              Image *
            </label>
            <input
              value={spec.container.image}
              onChange={(e) => updateContainer({ image: e.target.value })}
              placeholder="nginx or registry.example.com/myorg/myapp"
              className="w-full px-3 py-2.5 rounded-md bg-secondary border border-border focus:border-primary outline-none transition text-sm font-mono"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Tag</label>
            <input
              value={spec.container.tag}
              onChange={(e) => updateContainer({ tag: e.target.value })}
              placeholder="latest"
              className="w-full px-3 py-2.5 rounded-md bg-secondary border border-border focus:border-primary outline-none transition text-sm font-mono"
            />
          </div>
        </div>
      )}

      {/* Private registry flow */}
      {registryId && (
        <>
          {/* Registry endpoint badge */}
          {selectedEndpoint && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted/40 border border-border text-xs font-mono text-muted-foreground">
              <span className="text-muted-foreground/50 shrink-0">Registry</span>
              <span className="text-foreground truncate">{selectedEndpoint}</span>
              {isWorkspaceReg && (
                <span className="ml-auto shrink-0 text-[10px] text-amber-600 bg-amber-500/10 px-1.5 py-0.5 rounded font-medium font-sans">
                  workspace
                </span>
              )}
            </div>
          )}

          {/* Project / image path */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              Project / image path *
            </label>
            {reposLoading ? (
              <div className="flex items-center gap-2 h-10 text-xs text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" /> Loading repositories…
              </div>
            ) : (
              <select
                value={isCustomRepo ? "__new__" : selectedRepo}
                onChange={(e) => handleRepoSelect(e.target.value)}
                className="w-full px-3 py-2.5 rounded-md bg-secondary border border-border focus:border-primary outline-none transition text-sm"
              >
                <option value="">Select project…</option>
                {repos.map((r) => (
                  <option key={r.name} value={r.name}>
                    {r.name}
                  </option>
                ))}
                <option value="__new__">＋ Create new project…</option>
              </select>
            )}
            {isCustomRepo && (
              <input
                autoFocus
                value={customRepo}
                onChange={(e) => handleCustomRepoChange(e.target.value)}
                placeholder="myproject/myimage"
                className="mt-2 w-full px-3 py-2.5 rounded-md bg-secondary border border-border focus:border-primary outline-none transition text-sm font-mono"
              />
            )}
          </div>

          {/* Tag */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Tag</label>
            <input
              value={spec.container.tag}
              onChange={(e) => updateContainer({ tag: e.target.value })}
              placeholder="latest"
              className="w-full px-3 py-2.5 rounded-md bg-secondary border border-border focus:border-primary outline-none transition text-sm font-mono"
            />
          </div>

          {/* Composed image preview */}
          {spec.container.image && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-primary/5 border border-primary/20 text-xs font-mono text-muted-foreground break-all">
              <span className="text-muted-foreground/50 shrink-0">Image</span>
              <span className="text-foreground">
                {spec.container.image}:{spec.container.tag || "latest"}
              </span>
            </div>
          )}
        </>
      )}

      {/* Ports + Health path */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
            Container port *
          </label>
          <input
            type="number"
            min={1}
            max={65535}
            value={spec.container.port}
            onChange={(e) => updateContainer({ port: parseInt(e.target.value, 10) || 8080 })}
            placeholder="8080"
            className="w-full px-3 py-2.5 rounded-md bg-secondary border border-border focus:border-primary outline-none transition text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
            Host port
            <span className="ml-1 text-muted-foreground/60 font-normal">(optional)</span>
          </label>
          <input
            type="number"
            min={1}
            max={65535}
            value={spec.container.host_port ?? ""}
            onChange={(e) => {
              const v = parseInt(e.target.value, 10);
              updateContainer({ host_port: v > 0 ? v : undefined });
            }}
            placeholder="dynamic"
            className="w-full px-3 py-2.5 rounded-md bg-secondary border border-border focus:border-primary outline-none transition text-sm"
          />
          <p className="mt-1 text-[11px] text-muted-foreground">
            Leave blank for dynamic (Nomad) or same as container port (K8s).
          </p>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
            Health check path
          </label>
          <input
            value={spec.container.health_path ?? ""}
            onChange={(e) => updateContainer({ health_path: e.target.value || undefined })}
            placeholder="/health"
            className="w-full px-3 py-2.5 rounded-md bg-secondary border border-border focus:border-primary outline-none transition text-sm font-mono"
          />
        </div>
      </div>

      {/* CPU + Memory */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
            CPU (MHz)
          </label>
          <input
            type="number"
            min={100}
            value={spec.container.cpu}
            onChange={(e) => updateContainer({ cpu: parseInt(e.target.value, 10) || 256 })}
            placeholder="256"
            className="w-full px-3 py-2.5 rounded-md bg-secondary border border-border focus:border-primary outline-none transition text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
            Memory (MB)
          </label>
          <input
            type="number"
            min={64}
            value={spec.container.memory_mb}
            onChange={(e) => updateContainer({ memory_mb: parseInt(e.target.value, 10) || 256 })}
            placeholder="256"
            className="w-full px-3 py-2.5 rounded-md bg-secondary border border-border focus:border-primary outline-none transition text-sm"
          />
        </div>
      </div>
    </div>
  );
}

// ─── Repository section (used inside Step4) ────────────────────────────────

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

  // Fetch top-level directory entries for the build context picker.
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
  // When dirs load and buildContext is already set to a non-listed value, auto-enter custom mode.
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
                          // Keep buildContext as-is — user will type in the input below
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

// Step 4 — secrets + CI/CD
type SecretMode = "none" | "existing" | "new";

function Step4SecretsCICD({
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

// Step 5 — preview + editable generated resources
function Step5Preview({
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

  const tabs: { key: "runtime" | "cicd"; label: string }[] = [
    { key: "runtime", label: `${resources.runtime_provider} manifest` },
  ];
  if (resources.cicd_workflow) {
    tabs.push({ key: "cicd", label: `${resources.cicd_provider ?? "CI/CD"} workflow` });
  }

  const isEditing = editingTab === activeTab;
  const currentContent = activeTab === "runtime" ? editedManifest : editedCICD;
  const originalContent =
    activeTab === "runtime" ? (resources.runtime_manifest ?? "") : (resources.cicd_workflow ?? "");
  const isDirty = currentContent !== originalContent;

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 flex items-center gap-2 text-emerald-600">
        <CheckCircle className="size-4 shrink-0" />
        <span className="text-xs font-medium">
          Resources generated. Review and edit before provisioning.
        </span>
      </div>

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
                activeTab === t.key
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground hover:bg-accent"
              }`}
            >
              <FileCode className="size-3 inline mr-1" />
              {t.label}
              {activeTab === t.key && isDirty && (
                <span className="ml-1.5 size-1.5 rounded-full bg-amber-400 inline-block" />
              )}
            </button>
          ))}
        </div>

        <button
          onClick={() => setEditingTab(isEditing ? null : activeTab)}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium transition ${
            isEditing
              ? "bg-amber-500/15 text-amber-600 hover:bg-amber-500/25"
              : "bg-secondary text-muted-foreground hover:bg-accent"
          }`}
          title={isEditing ? "Done editing" : "Edit pipeline"}
        >
          {isEditing ? <Eye className="size-3" /> : <Pencil className="size-3" />}
          {isEditing ? "Preview" : "Edit"}
        </button>

        {isDirty && (
          <button
            onClick={() => {
              if (activeTab === "runtime") onManifestChange(originalContent);
              else onCICDChange(originalContent);
            }}
            className="px-2.5 py-1.5 rounded text-xs font-medium bg-secondary text-muted-foreground hover:bg-accent transition"
            title="Revert to generated"
          >
            Revert
          </button>
        )}
      </div>

      {isEditing ? (
        <textarea
          value={currentContent}
          onChange={(e) => {
            if (activeTab === "runtime") onManifestChange(e.target.value);
            else onCICDChange(e.target.value);
          }}
          spellCheck={false}
          className="w-full h-80 px-4 py-3 rounded-md bg-secondary border border-amber-500/50 outline-none resize-none text-xs font-mono leading-relaxed focus:border-primary transition"
        />
      ) : (
        <div className="rounded-md bg-secondary border border-border overflow-auto max-h-80">
          <pre className="p-4 text-xs font-mono whitespace-pre leading-relaxed">
            {currentContent}
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
  envSlug,
}: {
  open: boolean;
  blueprint: Blueprint | null;
  onClose: () => void;
  workspaceSlug: string;
  envSlug: string;
}) {
  const [step, setStep] = useState(0);
  const [spec, setSpec] = useState<PlatformSpec | null>(null);
  const [preview, setPreview] = useState<GeneratedResources | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [editedManifest, setEditedManifest] = useState("");
  const [editedCICD, setEditedCICD] = useState("");
  const [grantId, setGrantId] = useState("");
  const [initialSecretsRaw, setInitialSecretsRaw] = useState("");
  const [repoConfig, setRepoConfig] = useState<RepositoryProvisionConfig | null>(null);
  const [buildContext, setBuildContext] = useState("");
  const [isDraftLoaded, setIsDraftLoaded] = useState(false);

  const previewMutation = usePreviewApp(workspaceSlug, envSlug);
  const provisionMutation = useProvisionApp(workspaceSlug, envSlug);

  const parseSecrets = (raw: string): Record<string, string> => {
    const result: Record<string, string> = {};
    raw.split("\n").forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return;
      const idx = trimmed.indexOf("=");
      if (idx <= 0) return;
      result[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1);
    });
    return result;
  };

  const patchSpec = (patch: Partial<PlatformSpec>) =>
    setSpec((prev) => (prev ? { ...prev, ...patch } : prev));

  const handleOpen = (bp: Blueprint) => {
    const draft = loadDraft(envSlug, bp.name);
    if (draft) {
      setSpec(draft.spec);
      setStep(draft.step);
      setGrantId(draft.grantId);
      setInitialSecretsRaw(draft.initialSecretsRaw);
      setRepoConfig(draft.repoConfig);
      setBuildContext(draft.buildContext);
      setIsDraftLoaded(true);
    } else {
      const defaultRuntime = bp.supported_runtimes[0] ?? "nomad";
      setSpec(buildDefaultSpec(bp, defaultRuntime));
      setStep(0);
      setGrantId("");
      setInitialSecretsRaw("");
      setRepoConfig(null);
      setBuildContext("");
      setIsDraftLoaded(false);
    }
    setPreview(null);
    setPreviewError(null);
  };

  if (blueprint && spec && spec.service.type !== blueprint.name) {
    handleOpen(blueprint);
  }

  const canNext = () => {
    if (!spec || !blueprint) return false;
    if (step === 0) return spec.service.name.trim() !== "" && !!spec.runtime.provider;
    if (step === 1) {
      if (spec.runtime.provider === "nomad")
        return !!spec.runtime.datacenter && !!spec.runtime.worker_name;
      return true;
    }
    if (step === 2) return spec.container.image.trim() !== "" && spec.container.port > 0;
    return true;
  };

  const handleNext = async () => {
    if (step === 3) {
      // Entering preview — generate resources
      if (!blueprint || !spec) return;
      setPreview(null);
      setPreviewError(null);
      setStep(4);
      try {
        const res = await previewMutation.mutateAsync({ blueprint_name: blueprint.name, spec });
        setPreview(res);
        setEditedManifest(res.runtime_manifest ?? "");
        setEditedCICD(res.cicd_workflow ?? "");
      } catch (err: unknown) {
        setPreviewError(err instanceof Error ? err.message : "Preview failed");
      }
      return;
    }
    setStep((s) => s + 1);
  };

  const handleProvision = async () => {
    if (!blueprint || !spec) return;
    try {
      const overrideManifest =
        editedManifest !== (preview?.runtime_manifest ?? "") ? editedManifest : undefined;
      const overrideCICD = editedCICD !== (preview?.cicd_workflow ?? "") ? editedCICD : undefined;
      const parsedSecrets = parseSecrets(initialSecretsRaw);
      const result = await provisionMutation.mutateAsync({
        blueprint_name: blueprint.name,
        spec,
        override_manifest: overrideManifest,
        override_cicd: overrideCICD,
        repository: repoConfig?.provider_id && repoConfig?.repository ? repoConfig : undefined,
        initial_secrets: Object.keys(parsedSecrets).length > 0 ? parsedSecrets : undefined,
        secret_grant_id: grantId || undefined,
      });

      if (result.pr_url) {
        toast.success(`${spec.service.name} provisioned`, {
          description: `Runtime: ${spec.runtime.provider} · PR #${result.pr_number} opened in ${result.repo_name ?? repoConfig?.repository ?? ""}`,
        });
      } else {
        toast.success(`${spec.service.name} provisioned`, {
          description: `Blueprint: ${blueprint.display_name} · Runtime: ${spec.runtime.provider}`,
        });
      }

      if (repoConfig?.repository && result.repo_error) {
        toast.warning("Repository commit failed", { description: result.repo_error });
      }

      clearDraft(envSlug, blueprint.name);
      resetWizard();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Provision failed";
      toast.error(msg);
    }
  };

  const resetWizard = () => {
    setStep(0);
    setSpec(null);
    setPreview(null);
    setPreviewError(null);
    setEditedManifest("");
    setEditedCICD("");
    setGrantId("");
    setInitialSecretsRaw("");
    setRepoConfig(null);
    setBuildContext("");
    setIsDraftLoaded(false);
  };

  const handleClose = () => {
    if (spec && blueprint && (step > 0 || spec.service.name.trim() !== "")) {
      saveDraft(envSlug, blueprint.name, {
        step,
        spec,
        grantId,
        initialSecretsRaw,
        repoConfig,
        buildContext,
      });
    }
    resetWizard();
    onClose();
  };

  const handleDiscardDraft = () => {
    if (!blueprint) return;
    clearDraft(envSlug, blueprint.name);
    const defaultRuntime = blueprint.supported_runtimes[0] ?? "nomad";
    setSpec(buildDefaultSpec(blueprint, defaultRuntime));
    setStep(0);
    setGrantId("");
    setInitialSecretsRaw("");
    setRepoConfig(null);
    setBuildContext("");
    setIsDraftLoaded(false);
  };

  if (!blueprint) return null;

  if (!spec) {
    handleOpen(blueprint);
    return null;
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) handleClose();
      }}
    >
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BlueprintIcon icon={blueprint.icon} className="size-4 text-muted-foreground" />
            Provision {blueprint.display_name}
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
          <StepIndicator current={step} />

          <div className="mt-2">
            {step === 0 && <Step1Runtime bp={blueprint} spec={spec} onChange={patchSpec} />}
            {step === 1 && (
              <Step2RuntimeConfig
                spec={spec}
                workspaceSlug={workspaceSlug}
                envSlug={envSlug}
                onChange={patchSpec}
              />
            )}
            {step === 2 && (
              <Step3Container
                spec={spec}
                onChange={patchSpec}
                workspaceSlug={workspaceSlug}
                envSlug={envSlug}
              />
            )}
            {step === 3 && (
              <Step4SecretsCICD
                spec={spec}
                onChange={patchSpec}
                workspaceSlug={workspaceSlug}
                envSlug={envSlug}
                onGrantIdChange={setGrantId}
                initialSecretsRaw={initialSecretsRaw}
                onInitialSecretsChange={setInitialSecretsRaw}
                repoConfig={repoConfig}
                onRepoConfigChange={setRepoConfig}
                buildContext={buildContext}
                onBuildContextChange={(v) => {
                  setBuildContext(v);
                  patchSpec({ cicd: { ...spec.cicd, build_context: v || undefined } });
                }}
              />
            )}
            {step === 4 && (
              <Step5Preview
                resources={preview}
                isLoading={previewMutation.isPending}
                error={previewError}
                editedManifest={editedManifest}
                editedCICD={editedCICD}
                onManifestChange={setEditedManifest}
                onCICDChange={setEditedCICD}
              />
            )}
            {step === 5 && (
              <div className="space-y-4">
                <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2 text-sm">
                  {[
                    ["Application", spec.service.name],
                    ["Blueprint", blueprint.display_name],
                    ["Runtime", spec.runtime.provider],
                    ["Image", `${spec.container.image}:${spec.container.tag}`],
                    ["Strategy", spec.deployment.strategy],
                  ].map(([k, v]) => (
                    <div key={k} className="flex items-center gap-2">
                      <span className="text-muted-foreground w-28 shrink-0 text-xs">{k}</span>
                      <span className="font-mono text-xs">{v}</span>
                    </div>
                  ))}
                  {repoConfig?.repository && (
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground w-28 shrink-0 text-xs">PR target</span>
                      <span className="font-mono text-xs">
                        {repoConfig.repository} /{" "}
                        <span className="text-primary">{repoConfig.base_branch || "main"}</span>
                      </span>
                    </div>
                  )}
                  {buildContext && (
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground w-28 shrink-0 text-xs">
                        Build context
                      </span>
                      <span className="font-mono text-xs">./{buildContext}</span>
                    </div>
                  )}
                  {Object.keys(parseSecrets(initialSecretsRaw)).length > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground w-28 shrink-0 text-xs">
                        Vault write
                      </span>
                      <span className="font-mono text-xs">
                        {Object.keys(parseSecrets(initialSecretsRaw)).length} key
                        {Object.keys(parseSecrets(initialSecretsRaw)).length !== 1 ? "s" : ""}
                      </span>
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  The platform will generate the runtime manifest and submit it to{" "}
                  <strong>{spec.runtime.provider}</strong>.
                  {repoConfig?.repository &&
                    " A pull request will be opened with the generated manifests."}{" "}
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

          {step < 5 ? (
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
              {step === 3 ? "Generate Preview" : "Next"}
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

// ─── Deployment history row ────────────────────────────────────────────────────

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

// ─── Provisioned app card ──────────────────────────────────────────────────────

// ─── Shared page-bar component ────────────────────────────────────────────────

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
  const latest = deployments[0];

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* App summary row */}
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

      {/* Deployment history panel */}
      {expanded && (
        <div className="border-t border-border bg-muted/20 px-4 py-3 space-y-0">
          {/* Header */}
          <div className="flex items-center gap-2 pb-2">
            <History className="size-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">Deployment history</span>
            {histData && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground tabular-nums">
                {histData.total} total
              </span>
            )}
          </div>

          {/* Rows */}
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

          {/* Pagination footer — always visible once data loads */}
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

// ─── Provisioned applications section ─────────────────────────────────────────

const APPS_LIMIT = 5;

function ProvisionedApplications({
  workspaceSlug,
  envSlug,
}: {
  workspaceSlug: string;
  envSlug: string;
}) {
  const [appsPage, setAppsPage] = useState(1);
  const { data: appsData, isLoading } = usePlatformApps(
    workspaceSlug,
    envSlug,
    appsPage,
    APPS_LIMIT,
  );
  const deleteMutation = useDeletePlatformApp(workspaceSlug, envSlug);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);

  const apps = appsData?.items ?? [];
  const totalAppPages = appsData ? Math.max(1, Math.ceil(appsData.total / APPS_LIMIT)) : 1;

  const handleDelete = async (id: string) => {
    try {
      await deleteMutation.mutateAsync(id);
      toast.success("Application deleted");
      setConfirmDelete(null);
      // Step back if the deleted item was the only one on this page
      if (apps.length === 1 && appsPage > 1) setAppsPage((p) => p - 1);
    } catch {
      toast.error("Failed to delete application");
    }
  };

  if (!appsData && isLoading)
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
        <Loader2 className="size-4 animate-spin" /> Loading applications…
      </div>
    );

  if (!appsData || appsData.total === 0) return null;

  return (
    <section>
      <div className="flex items-center gap-2 mb-1">
        <h2 className="text-base font-semibold">Provisioned Applications</h2>
        <span className="text-xs px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground tabular-nums">
          {appsData.total}
        </span>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Running application instances provisioned from blueprints. Expand each entry to view its
        full deployment history and CI/CD pipeline traceability.
      </p>

      <div className="space-y-3 mb-3">
        {apps.map((app) => (
          <ProvisionedAppCard
            key={app.id}
            app={app}
            workspaceSlug={workspaceSlug}
            envSlug={envSlug}
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

      {/* Delete confirmation dialog */}
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
  const { envId } = useParams({ from: "/dashboard/environments/$envId/blueprints" });
  const { selectedWorkspace } = useWorkspaceContext();
  const workspaceSlug = selectedWorkspace?.slug ?? "";

  const { data: blueprints, isLoading, error } = useBlueprints();
  const [provisioning, setProvisioning] = useState<Blueprint | null>(null);
  const [draftVersion, setDraftVersion] = useState(0);

  const blueprintDrafts = useMemo(() => {
    const map = new Map<string, boolean>();
    (blueprints ?? []).forEach((bp) => {
      map.set(bp.name, hasDraft(envId, bp.name));
    });
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blueprints, draftVersion, envId]);

  const { data: capabilities } = useCapabilities(workspaceSlug, envId);
  const hasNomad = (capabilities ?? []).some(
    (c) => c.capability_name === "runtime" && c.providers.some((p) => p.provider_name === "nomad"),
  );

  const appBluprints = (blueprints ?? []).filter((b) => b.category === "application");
  const infraBlueprints = (blueprints ?? []).filter((b) => b.category === "infrastructure");

  return (
    <div className="flex flex-col h-full">
      <DashboardTopbar
        title="Blueprints"
        subtitle="Choose a blueprint to provision a standardized application"
      />

      <div className="flex-1 overflow-auto p-6 space-y-8">
        {!hasNomad && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 flex items-start gap-3">
            <AlertCircle className="size-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <div className="text-sm font-medium text-amber-700">
                No runtime provider configured
              </div>
              <div className="text-xs text-amber-600 mt-0.5">
                Bind a runtime provider in <strong>Platform → Runtime</strong> before provisioning.
              </div>
            </div>
          </div>
        )}

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
            <section>
              <h2 className="text-base font-semibold mb-1">Application blueprints</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Reusable automation templates for application provisioning and deployment.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {appBluprints.map((bp) => (
                  <BlueprintCard
                    key={bp.id}
                    bp={bp}
                    onProvision={setProvisioning}
                    hasDraft={blueprintDrafts.get(bp.name)}
                  />
                ))}
              </div>
            </section>

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

            <ProvisionedApplications workspaceSlug={workspaceSlug} envSlug={envId} />
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
        envSlug={envId}
      />
    </div>
  );
}
