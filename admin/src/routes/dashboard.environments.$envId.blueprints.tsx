import { createFileRoute, useParams } from "@tanstack/react-router";
import { DashboardTopbar } from "@/components/DashboardTopbar";
import { useWorkspaceContext } from "@/lib/workspace-context";
import {
  useBlueprints,
  useCapabilities,
  useNomadNodes,
  useNomadNamespaces,
  useK8sNamespaces,
  useEnvironmentRegistries,
  useBoundRepos,
  usePreviewApp,
  useProvisionApp,
} from "@/lib/queries";
import { useState } from "react";
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
  Rocket,
} from "lucide-react";
import { toast } from "sonner";
import type { Blueprint, PlatformSpec, GeneratedResources } from "@/lib/types";
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
}: {
  bp: Blueprint;
  onProvision: (bp: Blueprint) => void;
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
            <Rocket className="size-3.5" /> Provision
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
            <option value="">Default (v1 — with Vault)</option>
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

  // Registry source: "" = public image, otherwise a registry_id
  const [registryId, setRegistryId] = useState("");
  const [selectedRepo, setSelectedRepo] = useState("");
  const [customRepo, setCustomRepo] = useState("");
  const [isCustomRepo, setIsCustomRepo] = useState(false);

  const { data: bindings = [] } = useEnvironmentRegistries(workspaceSlug, envSlug);
  const { data: repos = [], isLoading: reposLoading } = useBoundRepos(
    workspaceSlug,
    envSlug,
    registryId,
    !!registryId,
  );

  const selectedRegistry = bindings.find((b) => b.registry_id === registryId);

  const buildImage = (endpoint: string, repo: string) =>
    repo ? `${endpoint.replace(/\/$/, "")}/${repo}` : endpoint.replace(/\/$/, "");

  const handleRegistryChange = (newId: string) => {
    setRegistryId(newId);
    setSelectedRepo("");
    setCustomRepo("");
    setIsCustomRepo(false);
    updateContainer({ image: "" });
  };

  const handleRepoSelect = (value: string) => {
    if (value === "__new__") {
      setIsCustomRepo(true);
      setSelectedRepo("");
      updateContainer({ image: "" });
    } else {
      setIsCustomRepo(false);
      setSelectedRepo(value);
      if (selectedRegistry?.registry_endpoint) {
        updateContainer({ image: buildImage(selectedRegistry.registry_endpoint, value) });
      }
    }
  };

  const handleCustomRepoChange = (value: string) => {
    setCustomRepo(value);
    if (selectedRegistry?.registry_endpoint) {
      updateContainer({ image: buildImage(selectedRegistry.registry_endpoint, value) });
    }
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
          {bindings.map((b) => (
            <option key={b.registry_id} value={b.registry_id}>
              {b.registry_name ?? b.registry_endpoint ?? b.registry_id}
            </option>
          ))}
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
          {selectedRegistry?.registry_endpoint && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted/40 border border-border text-xs font-mono text-muted-foreground">
              <span className="text-muted-foreground/50 shrink-0">Registry</span>
              <span className="text-foreground truncate">{selectedRegistry.registry_endpoint}</span>
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

      {/* Container port */}
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

// Step 4 — secrets + CI/CD
function Step4SecretsCICD({
  spec,
  onChange,
}: {
  spec: PlatformSpec;
  onChange: (patch: Partial<PlatformSpec>) => void;
}) {
  const updateSecrets = (patch: Partial<PlatformSpec["secrets"]>) =>
    onChange({ secrets: { ...spec.secrets, ...patch } });
  const updateCICD = (patch: Partial<PlatformSpec["cicd"]>) =>
    onChange({ cicd: { ...spec.cicd, ...patch } });

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Vault Secrets
        </h3>
        <div className="grid grid-cols-2 gap-3">
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
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Optional. Relative path within the KV engine (e.g.{" "}
          <span className="font-mono">myapp/env</span>).
        </p>
      </div>

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

  const previewMutation = usePreviewApp(workspaceSlug, envSlug);
  const provisionMutation = useProvisionApp(workspaceSlug, envSlug);

  const patchSpec = (patch: Partial<PlatformSpec>) =>
    setSpec((prev) => (prev ? { ...prev, ...patch } : prev));

  const handleOpen = (bp: Blueprint) => {
    const defaultRuntime = bp.supported_runtimes[0] ?? "nomad";
    setSpec(buildDefaultSpec(bp, defaultRuntime));
    setStep(0);
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
      await provisionMutation.mutateAsync({
        blueprint_name: blueprint.name,
        spec,
        override_manifest: overrideManifest,
        override_cicd: overrideCICD,
      });
      toast.success(`${spec.service.name} provisioned`, {
        description: `Blueprint: ${blueprint.display_name} · Runtime: ${spec.runtime.provider}`,
      });
      handleClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Provision failed";
      toast.error(msg);
    }
  };

  const handleClose = () => {
    setStep(0);
    setSpec(null);
    setPreview(null);
    setPreviewError(null);
    setEditedManifest("");
    setEditedCICD("");
    onClose();
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
            {step === 3 && <Step4SecretsCICD spec={spec} onChange={patchSpec} />}
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
                </div>
                <p className="text-xs text-muted-foreground">
                  The platform will generate the runtime manifest and submit it to{" "}
                  <strong>{spec.runtime.provider}</strong>. This action cannot be automatically
                  undone.
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

// ─── Page ──────────────────────────────────────────────────────────────────────

function BlueprintsPage() {
  const { envId } = useParams({ from: "/dashboard/environments/$envId/blueprints" });
  const { selectedWorkspace } = useWorkspaceContext();
  const workspaceSlug = selectedWorkspace?.slug ?? "";

  const { data: blueprints, isLoading, error } = useBlueprints();
  const [provisioning, setProvisioning] = useState<Blueprint | null>(null);

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
                Standardized templates for deploying application workloads across any runtime.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {appBluprints.map((bp) => (
                  <BlueprintCard key={bp.id} bp={bp} onProvision={setProvisioning} />
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
                    <BlueprintCard key={bp.id} bp={bp} onProvision={setProvisioning} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>

      <ProvisionWizard
        open={!!provisioning}
        blueprint={provisioning}
        onClose={() => setProvisioning(null)}
        workspaceSlug={workspaceSlug}
        envSlug={envId}
      />
    </div>
  );
}
