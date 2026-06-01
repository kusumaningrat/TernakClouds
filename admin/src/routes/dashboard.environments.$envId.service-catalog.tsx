import { createFileRoute, useParams } from "@tanstack/react-router";
import { DashboardTopbar } from "@/components/DashboardTopbar";
import { useWorkspaceContext } from "@/lib/workspace-context";
import {
  useCatalog,
  useServiceDeployments,
  useDeployService,
  useStopDeployment,
  useNomadNodes,
  useNomadNamespaces,
  useK8sNamespaces,
  useK8sNodes,
  useEnvironmentRegistries,
  useNomadJob,
  useCapabilities,
} from "@/lib/queries";
import { useState } from "react";
import {
  Package,
  Plus,
  Trash2,
  Loader2,
  AlertCircle,
  Cpu,
  MemoryStick,
  Globe,
  Lock,
  FileCode,
  X,
  Eye,
  EyeOff,
  Server,
} from "lucide-react";
import { toast } from "sonner";
import type { CatalogItem, ServiceDeployment } from "@/lib/types";
import type { ApiError } from "@/lib/api";
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

export const Route = createFileRoute("/dashboard/environments/$envId/service-catalog")({
  head: () => ({ meta: [{ title: "Service Catalog · TernakClouds" }] }),
  component: ServiceCatalogPage,
});

// ─── Runtime badge ─────────────────────────────────────────────────────────────

const RUNTIME_COLORS: Record<string, string> = {
  nomad: "bg-purple-500/15 text-purple-600",
  kubernetes: "bg-blue-500/15 text-blue-600",
  docker: "bg-sky-500/15 text-sky-600",
};

function RuntimeBadge({ provider }: { provider: string }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${RUNTIME_COLORS[provider] ?? "bg-muted text-muted-foreground"}`}
    >
      {provider}
    </span>
  );
}

// ─── Status badge ──────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  running: "bg-emerald-500/15 text-emerald-600",
  pending: "bg-amber-500/15 text-amber-600",
  dead: "bg-gray-400/15 text-gray-500",
  unknown: "bg-muted text-muted-foreground",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${STATUS_COLORS[status] ?? "bg-muted text-muted-foreground"}`}
    >
      {status}
    </span>
  );
}

// Fetches live Nomad status — only rendered for Nomad deployments.
function NomadLiveStatus({
  workspaceSlug,
  envSlug,
  nomadJobId,
  namespace,
  enabled,
}: {
  workspaceSlug: string;
  envSlug: string;
  nomadJobId: string;
  namespace: string;
  enabled: boolean;
}) {
  const { data, isLoading, error } = useNomadJob(
    workspaceSlug,
    envSlug,
    nomadJobId,
    namespace,
    enabled,
  );
  if (!enabled) return <span className="text-[11px] text-muted-foreground">no provider</span>;
  if (isLoading) return <Loader2 className="size-3 animate-spin text-muted-foreground" />;
  if (error) return <StatusBadge status="unknown" />;
  return <StatusBadge status={data?.Status?.toLowerCase() ?? "unknown"} />;
}

// ─── Catalog card ──────────────────────────────────────────────────────────────

function CatalogCard({
  item,
  onDeploy,
}: {
  item: CatalogItem;
  onDeploy: (item: CatalogItem) => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden flex flex-col">
      <div className="h-1.5 w-full bg-[image:var(--gradient-primary)]" />
      <div className="p-4 flex flex-col flex-1">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-lg bg-secondary grid place-items-center shrink-0">
              <Package className="size-4 text-muted-foreground" />
            </div>
            <div>
              <div className="font-semibold text-sm">{item.display_name}</div>
              <div className="text-[11px] text-muted-foreground font-mono">{item.name}</div>
            </div>
          </div>
          {item.is_public_image ? (
            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full">
              <Globe className="size-3" /> Public
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[11px] text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded-full">
              <Lock className="size-3" /> Private
            </span>
          )}
        </div>

        {item.description && (
          <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{item.description}</p>
        )}

        <div className="flex items-center gap-3 text-[11px] text-muted-foreground mb-4">
          <span className="flex items-center gap-1">
            <Cpu className="size-3" /> {item.default_cpu}m
          </span>
          <span className="flex items-center gap-1">
            <MemoryStick className="size-3" /> {item.default_memory} MB
          </span>
          {item.default_image && (
            <span className="font-mono truncate max-w-[120px]" title={item.default_image}>
              :{item.default_image.split(":")[1] ?? "latest"}
            </span>
          )}
        </div>

        <div className="mt-auto">
          <button
            onClick={() => onDeploy(item)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition"
          >
            <Plus className="size-3.5" /> Deploy
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Env mapping row ────────────────────────────────────────────────────────────

function EnvMappingRow({
  envVar,
  secretValue,
  onChangeEnvVar,
  onChangeSecretValue,
  onRemove,
}: {
  envVar: string;
  secretValue: string;
  onChangeEnvVar: (v: string) => void;
  onChangeSecretValue: (v: string) => void;
  onRemove: () => void;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <input
        value={envVar}
        onChange={(e) => onChangeEnvVar(e.target.value)}
        placeholder="ENV_VAR"
        className="flex-1 px-2.5 py-1.5 rounded-md bg-secondary border border-border focus:border-primary outline-none transition text-xs font-mono"
      />
      <span className="text-muted-foreground text-xs shrink-0">=</span>
      <div className="flex-1 relative">
        <input
          value={secretValue}
          onChange={(e) => onChangeSecretValue(e.target.value)}
          placeholder="actual_value"
          type={visible ? "text" : "password"}
          className="w-full px-2.5 py-1.5 pr-7 rounded-md bg-secondary border border-border focus:border-primary outline-none transition text-xs font-mono"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-muted-foreground hover:text-foreground transition"
          tabIndex={-1}
        >
          {visible ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
        </button>
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="p-1 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition shrink-0"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}

// ─── Deploy dialog ─────────────────────────────────────────────────────────────

function DeployDialog({
  open,
  item,
  onClose,
  workspaceSlug,
  envSlug,
  capabilities,
}: {
  open: boolean;
  item: CatalogItem | null;
  onClose: () => void;
  workspaceSlug: string;
  envSlug: string;
  capabilities: { capability_name: string; providers: { provider_name: string }[] }[];
}) {
  const hasNomad = capabilities.some(
    (c) => c.capability_name === "runtime" && c.providers.some((p) => p.provider_name === "nomad"),
  );
  const hasKubernetes = capabilities.some(
    (c) =>
      c.capability_name === "runtime" && c.providers.some((p) => p.provider_name === "kubernetes"),
  );
  const hasDocker = capabilities.some(
    (c) => c.capability_name === "runtime" && c.providers.some((p) => p.provider_name === "docker"),
  );

  const { data: nodes } = useNomadNodes(workspaceSlug, envSlug, hasNomad);
  const { data: nomadNamespaces } = useNomadNamespaces(workspaceSlug, envSlug, hasNomad);
  const { data: k8sNamespaces } = useK8sNamespaces(workspaceSlug, envSlug, hasKubernetes);
  const { data: k8sNodes } = useK8sNodes(workspaceSlug, envSlug, hasKubernetes);
  const { data: bindings } = useEnvironmentRegistries(workspaceSlug, envSlug);
  const deploy = useDeployService(workspaceSlug, envSlug);

  // Determine available runtimes from capabilities
  const availableRuntimes = [
    ...(hasNomad ? [{ value: "nomad", label: "Nomad" }] : []),
    ...(hasKubernetes ? [{ value: "kubernetes", label: "Kubernetes" }] : []),
    ...(hasDocker ? [{ value: "docker", label: "Docker" }] : []),
  ];

  const defaultRuntime = availableRuntimes[0]?.value ?? "nomad";

  const [runtimeProvider, setRuntimeProvider] = useState(defaultRuntime);
  const [jobName, setJobName] = useState("");
  // Nomad fields
  const [datacenter, setDatacenter] = useState("");
  const [namespace, setNamespace] = useState("default");
  const [workerName, setWorkerName] = useState("");
  // Kubernetes fields
  const [k8sNamespace, setK8sNamespace] = useState("default");
  const [replicas, setReplicas] = useState("1");
  const [k8sNodeName, setK8sNodeName] = useState("");
  // Shared
  const [exposedPort, setExposedPort] = useState("");
  const [cpu, setCpu] = useState("");
  const [memory, setMemory] = useState("");
  // Registry
  const [registryId, setRegistryId] = useState("");
  const [imagePath, setImagePath] = useState("");
  const [imageTag, setImageTag] = useState("");
  // Vault (Nomad only)
  const [vaultRole, setVaultRole] = useState("");
  const [vaultPath, setVaultPath] = useState("");
  const [envMappings, setEnvMappings] = useState<[string, string][]>([]);

  const datacenters = [...new Set((nodes ?? []).map((n) => n.Datacenter))];
  const workers = (nodes ?? []).filter((n) => !datacenter || n.Datacenter === datacenter);

  const handleClose = () => {
    setRuntimeProvider(defaultRuntime);
    setJobName("");
    setDatacenter("");
    setNamespace("default");
    setWorkerName("");
    setK8sNamespace("default");
    setReplicas("1");
    setK8sNodeName("");
    setExposedPort("");
    setCpu("");
    setMemory("");
    setRegistryId("");
    setImagePath("");
    setImageTag("");
    setVaultRole("");
    setVaultPath("");
    setEnvMappings([]);
    onClose();
  };

  const addEnvMapping = () => setEnvMappings((prev) => [...prev, ["", ""]]);
  const updateEnvMapping = (i: number, field: 0 | 1, value: string) =>
    setEnvMappings((prev) =>
      prev.map((pair, idx) =>
        idx === i ? (field === 0 ? [value, pair[1]] : [pair[0], value]) : pair,
      ),
    );
  const removeEnvMapping = (i: number) =>
    setEnvMappings((prev) => prev.filter((_, idx) => idx !== i));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!item) return;

    const mappings = envMappings.reduce<Record<string, string>>((acc, [k, v]) => {
      if (k && v) acc[k] = v;
      return acc;
    }, {});

    try {
      await deploy.mutateAsync({
        catalog_name: item.name,
        job_name: jobName,
        runtime_provider: runtimeProvider,
        exposed_port: parseInt(exposedPort, 10),
        cpu: cpu ? parseInt(cpu, 10) : undefined,
        memory: memory ? parseInt(memory, 10) : undefined,
        // Nomad
        datacenter: runtimeProvider === "nomad" ? datacenter : undefined,
        namespace: runtimeProvider === "nomad" ? namespace : undefined,
        worker_name: runtimeProvider === "nomad" ? workerName : undefined,
        // Kubernetes
        k8s_namespace: runtimeProvider === "kubernetes" ? k8sNamespace : undefined,
        replicas: runtimeProvider === "kubernetes" && replicas ? parseInt(replicas, 10) : undefined,
        k8s_node_name: runtimeProvider === "kubernetes" && k8sNodeName ? k8sNodeName : undefined,
        // Registry
        registry_id: registryId || undefined,
        image_path: imagePath || undefined,
        image_tag: imageTag || undefined,
        // Vault
        vault_role: runtimeProvider === "nomad" ? vaultRole || undefined : undefined,
        vault_path: runtimeProvider === "nomad" ? vaultPath || undefined : undefined,
        env_mappings:
          runtimeProvider === "nomad" && Object.keys(mappings).length > 0 ? mappings : undefined,
      });
      toast.success(`${item.display_name} deployed via ${runtimeProvider}`);
      handleClose();
    } catch (err: unknown) {
      if ((err as ApiError)?.status === 503) {
        toast.error("No runtime provider configured", {
          description: "Bind a provider in Platform → Runtime before deploying.",
        });
        return;
      }
      const raw = err instanceof Error ? err.message : "Deploy failed";
      const parts = raw.split(": ");
      const last = parts[parts.length - 1] ?? raw;
      const clean = last.startsWith("{") ? (parts[parts.length - 2] ?? raw) : last;
      toast.error(clean, { description: raw !== clean ? raw : undefined });
    }
  };

  if (!item) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) handleClose();
      }}
    >
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Deploy {item.display_name}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            void handleSubmit(e);
          }}
          className="space-y-4 mt-2"
        >
          {/* Runtime selector */}
          <div>
            <label className="text-xs font-medium text-muted-foreground">Runtime *</label>
            {availableRuntimes.length > 0 ? (
              <div className="mt-1.5 flex gap-2">
                {availableRuntimes.map((rt) => (
                  <button
                    key={rt.value}
                    type="button"
                    onClick={() => setRuntimeProvider(rt.value)}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md border text-xs font-medium transition ${
                      runtimeProvider === rt.value
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-secondary text-muted-foreground hover:border-primary/40"
                    }`}
                  >
                    <Server className="size-3.5" />
                    {rt.label}
                  </button>
                ))}
              </div>
            ) : (
              <p className="mt-1.5 text-xs text-destructive">
                No runtime providers configured. Bind a runtime in Platform → Capabilities.
              </p>
            )}
          </div>

          {/* Job name */}
          <div>
            <label className="text-xs font-medium text-muted-foreground">Job name *</label>
            <input
              required
              value={jobName}
              onChange={(e) => setJobName(e.target.value)}
              placeholder="my-redis"
              className="mt-1.5 w-full px-3 py-2.5 rounded-md bg-secondary border border-border focus:border-primary outline-none transition text-sm"
            />
          </div>

          {/* ── Nomad-specific fields ── */}
          {runtimeProvider === "nomad" && (
            <>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Datacenter *</label>
                {datacenters.length > 0 ? (
                  <select
                    required
                    value={datacenter}
                    onChange={(e) => {
                      setDatacenter(e.target.value);
                      setWorkerName("");
                    }}
                    className="mt-1.5 w-full px-3 py-2.5 rounded-md bg-secondary border border-border focus:border-primary outline-none transition text-sm"
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
                    required
                    value={datacenter}
                    onChange={(e) => setDatacenter(e.target.value)}
                    placeholder="dc1"
                    className="mt-1.5 w-full px-3 py-2.5 rounded-md bg-secondary border border-border focus:border-primary outline-none transition text-sm"
                  />
                )}
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Worker node *</label>
                {workers.length > 0 ? (
                  <select
                    required
                    value={workerName}
                    onChange={(e) => setWorkerName(e.target.value)}
                    className="mt-1.5 w-full px-3 py-2.5 rounded-md bg-secondary border border-border focus:border-primary outline-none transition text-sm"
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
                    required
                    value={workerName}
                    onChange={(e) => setWorkerName(e.target.value)}
                    placeholder="worker-1"
                    className="mt-1.5 w-full px-3 py-2.5 rounded-md bg-secondary border border-border focus:border-primary outline-none transition text-sm"
                  />
                )}
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Namespace *</label>
                <select
                  required
                  value={namespace}
                  onChange={(e) => setNamespace(e.target.value)}
                  className="mt-1.5 w-full px-3 py-2.5 rounded-md bg-secondary border border-border focus:border-primary outline-none transition text-sm"
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

          {/* ── Kubernetes-specific fields ── */}
          {runtimeProvider === "kubernetes" && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Namespace *</label>
                  <select
                    required
                    value={k8sNamespace}
                    onChange={(e) => setK8sNamespace(e.target.value)}
                    className="mt-1.5 w-full px-3 py-2.5 rounded-md bg-secondary border border-border focus:border-primary outline-none transition text-sm"
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
                  <label className="text-xs font-medium text-muted-foreground">Replicas</label>
                  <input
                    type="number"
                    min={1}
                    value={replicas}
                    onChange={(e) => setReplicas(e.target.value)}
                    placeholder="1"
                    className="mt-1.5 w-full px-3 py-2.5 rounded-md bg-secondary border border-border focus:border-primary outline-none transition text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  Worker node{" "}
                  <span className="font-normal text-muted-foreground/60">
                    optional — leave blank to let K8s schedule freely
                  </span>
                </label>
                {k8sNodes && k8sNodes.length > 0 ? (
                  <select
                    value={k8sNodeName}
                    onChange={(e) => setK8sNodeName(e.target.value)}
                    className="mt-1.5 w-full px-3 py-2.5 rounded-md bg-secondary border border-border focus:border-primary outline-none transition text-sm"
                  >
                    <option value="">Any node (scheduler decides)</option>
                    {k8sNodes
                      .filter((n) => n.status === "Ready")
                      .map((n) => (
                        <option key={n.name} value={n.name}>
                          {n.name} — {n.roles.join("/")}
                        </option>
                      ))}
                  </select>
                ) : (
                  <input
                    value={k8sNodeName}
                    onChange={(e) => setK8sNodeName(e.target.value)}
                    placeholder="e.g. worker-node-1 (optional)"
                    className="mt-1.5 w-full px-3 py-2.5 rounded-md bg-secondary border border-border focus:border-primary outline-none transition text-sm"
                  />
                )}
              </div>
            </div>
          )}

          {/* Exposed port */}
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              {runtimeProvider === "kubernetes" ? "Exposed port (NodePort) *" : "Exposed port *"}
            </label>
            {runtimeProvider === "kubernetes" && (
              <p className="text-[11px] text-muted-foreground mt-0.5 mb-1.5">
                Port exposed on every node (30000–32767). The container listens on{" "}
                <span className="font-mono">{item.default_container_port}</span> internally.
              </p>
            )}
            <input
              required
              type="number"
              min={runtimeProvider === "kubernetes" ? 30000 : 1}
              max={runtimeProvider === "kubernetes" ? 32767 : 65535}
              value={exposedPort}
              onChange={(e) => setExposedPort(e.target.value)}
              placeholder={
                runtimeProvider === "kubernetes"
                  ? "e.g. 30080"
                  : String(item.default_container_port)
              }
              className="mt-1.5 w-full px-3 py-2.5 rounded-md bg-secondary border border-border focus:border-primary outline-none transition text-sm"
            />
          </div>

          {/* CPU + Memory */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">
                CPU (millicores){" "}
                <span className="text-muted-foreground/60">default: {item.default_cpu}</span>
              </label>
              <input
                type="number"
                min={100}
                value={cpu}
                onChange={(e) => setCpu(e.target.value)}
                placeholder={String(item.default_cpu)}
                className="mt-1.5 w-full px-3 py-2.5 rounded-md bg-secondary border border-border focus:border-primary outline-none transition text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">
                Memory (MB){" "}
                <span className="text-muted-foreground/60">default: {item.default_memory}</span>
              </label>
              <input
                type="number"
                min={64}
                value={memory}
                onChange={(e) => setMemory(e.target.value)}
                placeholder={String(item.default_memory)}
                className="mt-1.5 w-full px-3 py-2.5 rounded-md bg-secondary border border-border focus:border-primary outline-none transition text-sm"
              />
            </div>
          </div>

          {/* Private image fields */}
          {!item.is_public_image && (
            <div className="border-t border-border pt-4 space-y-3">
              <p className="text-xs font-medium text-muted-foreground">Private image settings</p>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Registry *</label>
                <select
                  required
                  value={registryId}
                  onChange={(e) => setRegistryId(e.target.value)}
                  className="mt-1.5 w-full px-3 py-2.5 rounded-md bg-secondary border border-border focus:border-primary outline-none transition text-sm"
                >
                  <option value="">Select registry…</option>
                  {(bindings ?? []).map((b) => (
                    <option key={b.registry_id} value={b.registry_id}>
                      {b.registry_name ?? b.registry_id}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Image path *</label>
                <input
                  required
                  value={imagePath}
                  onChange={(e) => setImagePath(e.target.value)}
                  placeholder="myorg/myapp"
                  className="mt-1.5 w-full px-3 py-2.5 rounded-md bg-secondary border border-border focus:border-primary outline-none transition text-sm font-mono"
                />
              </div>
            </div>
          )}

          {/* Tag override */}
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              Image tag <span className="text-muted-foreground/60">optional override</span>
            </label>
            <input
              value={imageTag}
              onChange={(e) => setImageTag(e.target.value)}
              placeholder={
                item.is_public_image ? (item.default_image.split(":")[1] ?? "latest") : "latest"
              }
              className="mt-1.5 w-full px-3 py-2.5 rounded-md bg-secondary border border-border focus:border-primary outline-none transition text-sm font-mono"
            />
          </div>

          {/* Vault section — Nomad only */}
          {runtimeProvider === "nomad" && (
            <div className="border-t border-border pt-4 space-y-3">
              <p className="text-xs font-medium text-muted-foreground">
                Vault integration{" "}
                <span className="font-normal text-muted-foreground/60">optional</span>
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Vault role</label>
                  <input
                    value={vaultRole}
                    onChange={(e) => setVaultRole(e.target.value)}
                    placeholder="my-app-role"
                    className="mt-1.5 w-full px-3 py-2.5 rounded-md bg-secondary border border-border focus:border-primary outline-none transition text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Vault path</label>
                  <input
                    value={vaultPath}
                    onChange={(e) => setVaultPath(e.target.value)}
                    placeholder="myapp/credentials"
                    className="mt-1.5 w-full px-3 py-2.5 rounded-md bg-secondary border border-border focus:border-primary outline-none transition text-sm font-mono"
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-muted-foreground">
                    Env mappings{" "}
                    <span className="font-normal text-muted-foreground/60">
                      (ENV_VAR → secret value)
                    </span>
                  </label>
                  <button
                    type="button"
                    onClick={addEnvMapping}
                    className="text-[11px] text-primary hover:underline"
                  >
                    + Add
                  </button>
                </div>
                {envMappings.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground">
                    No mappings. Add one to inject Vault secrets as environment variables.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {envMappings.map(([envVar, secretValue], i) => (
                      <EnvMappingRow
                        key={i}
                        envVar={envVar}
                        secretValue={secretValue}
                        onChangeEnvVar={(v) => updateEnvMapping(i, 0, v)}
                        onChangeSecretValue={(v) => updateEnvMapping(i, 1, v)}
                        onRemove={() => removeEnvMapping(i)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

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
              disabled={deploy.isPending || availableRuntimes.length === 0}
              className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition disabled:opacity-60 inline-flex items-center gap-2"
            >
              {deploy.isPending && <Loader2 className="size-3.5 animate-spin" />}
              Deploy
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Job definition viewer ─────────────────────────────────────────────────────

function DefinitionDialog({ definition, onClose }: { definition: string; onClose: () => void }) {
  return (
    <Dialog
      open
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Job definition</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-auto mt-2 rounded-md bg-secondary border border-border p-4">
          <pre className="text-xs font-mono whitespace-pre-wrap break-all">{definition}</pre>
        </div>
        <DialogFooter className="mt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md bg-secondary hover:bg-accent text-sm transition"
          >
            Close
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Deployment row ────────────────────────────────────────────────────────────

function DeploymentRow({
  d,
  workspaceSlug,
  envSlug,
  hasNomadProvider,
  onStop,
  stopping,
  onViewDefinition,
}: {
  d: ServiceDeployment;
  workspaceSlug: string;
  envSlug: string;
  hasNomadProvider: boolean;
  onStop: (d: ServiceDeployment) => void;
  stopping: boolean;
  onViewDefinition: (d: ServiceDeployment) => void;
}) {
  const isNomad = d.runtime_provider === "nomad" || d.runtime_provider === "";

  return (
    <tr className="border-b border-border last:border-0 hover:bg-muted/40 transition">
      <td className="px-4 py-3">
        <div className="font-medium text-sm">{d.job_name}</div>
        <div className="text-[11px] text-muted-foreground">{d.catalog_name}</div>
      </td>
      <td className="px-4 py-3">
        <RuntimeBadge provider={d.runtime_provider || "nomad"} />
      </td>
      <td className="px-4 py-3">
        {isNomad ? (
          <NomadLiveStatus
            workspaceSlug={workspaceSlug}
            envSlug={envSlug}
            nomadJobId={d.nomad_job_id}
            namespace={d.namespace}
            enabled={hasNomadProvider}
          />
        ) : (
          <StatusBadge status={d.status} />
        )}
      </td>
      <td className="px-4 py-3 text-xs text-muted-foreground font-mono">
        {isNomad ? `${d.datacenter} / ${d.namespace}` : d.namespace || "—"}
      </td>
      <td className="px-4 py-3 text-xs text-muted-foreground font-mono">:{d.exposed_port}</td>
      <td
        className="px-4 py-3 text-xs text-muted-foreground font-mono max-w-[180px] truncate"
        title={d.image}
      >
        {d.image}
      </td>
      <td className="px-4 py-3 text-xs text-muted-foreground">
        {d.cpu}m / {d.memory} MB
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex items-center gap-1.5 justify-end">
          {d.job_definition && (
            <button
              onClick={() => onViewDefinition(d)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-secondary hover:bg-accent text-xs text-muted-foreground transition"
              title="View job definition"
            >
              <FileCode className="size-3.5" /> Definition
            </button>
          )}
          <button
            onClick={() => onStop(d)}
            disabled={stopping}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-secondary hover:bg-destructive/20 text-xs text-destructive transition disabled:opacity-50"
          >
            <Trash2 className="size-3.5" /> Stop
          </button>
        </div>
      </td>
    </tr>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

function ServiceCatalogPage() {
  const { envId } = useParams({ from: "/dashboard/environments/$envId/service-catalog" });
  const { selectedWorkspace } = useWorkspaceContext();
  const workspaceSlug = selectedWorkspace?.slug ?? "";

  const { data: capabilities, isLoading: capLoading } = useCapabilities(workspaceSlug, envId);
  const capList = capabilities ?? [];

  const hasNomadProvider =
    !capLoading &&
    capList.some(
      (c) =>
        c.capability_name === "runtime" && c.providers.some((p) => p.provider_name === "nomad"),
    );

  const { data: catalog, isLoading: catalogLoading, error: catalogError } = useCatalog();
  const { data: deployments, isLoading: deploymentsLoading } = useServiceDeployments(
    workspaceSlug,
    envId,
  );
  const stopDeployment = useStopDeployment(workspaceSlug, envId);

  const [deployingItem, setDeployingItem] = useState<CatalogItem | null>(null);
  const [stopping, setStopping] = useState<ServiceDeployment | null>(null);
  const [viewingDefinition, setViewingDefinition] = useState<ServiceDeployment | null>(null);

  const handleStop = async () => {
    if (!stopping) return;
    try {
      await stopDeployment.mutateAsync(stopping.id);
      toast.success(`${stopping.job_name} stopped`);
      setStopping(null);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to stop deployment");
    }
  };

  return (
    <div className="flex flex-col h-full">
      <DashboardTopbar
        title="Service Catalog"
        subtitle="Deploy managed services to this environment"
      />

      <div className="flex-1 overflow-auto p-6 space-y-8">
        {/* Catalog section */}
        <section>
          <h2 className="text-base font-semibold mb-1">Available services</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Select a service template to deploy it to this environment.
          </p>

          {catalogLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Loading catalog…
            </div>
          ) : catalogError ? (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="size-4" /> {catalogError.message}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {(catalog ?? []).map((item) => (
                <CatalogCard key={item.id} item={item} onDeploy={setDeployingItem} />
              ))}
            </div>
          )}
        </section>

        {/* Active deployments section */}
        <section>
          <h2 className="text-base font-semibold mb-1">Active deployments</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Services deployed to this environment via the catalog.
          </p>

          {deploymentsLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Loading deployments…
            </div>
          ) : !deployments || deployments.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-8 flex flex-col items-center text-center">
              <div className="size-12 rounded-xl bg-secondary grid place-items-center mb-3">
                <Package className="size-6 text-muted-foreground" />
              </div>
              <div className="font-medium text-sm">No catalog deployments yet</div>
              <p className="text-xs text-muted-foreground mt-1">
                Deploy a service from the catalog above to see it here.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">
                      Job
                    </th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">
                      Runtime
                    </th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">
                      Status
                    </th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">
                      Location
                    </th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">
                      Port
                    </th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">
                      Image
                    </th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">
                      Resources
                    </th>
                    <th className="px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {deployments.map((d) => (
                    <DeploymentRow
                      key={d.id}
                      d={d}
                      workspaceSlug={workspaceSlug}
                      envSlug={envId}
                      hasNomadProvider={hasNomadProvider}
                      onStop={setStopping}
                      stopping={stopDeployment.isPending && stopping?.id === d.id}
                      onViewDefinition={setViewingDefinition}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {/* Deploy dialog */}
      <DeployDialog
        open={!!deployingItem}
        item={deployingItem}
        onClose={() => setDeployingItem(null)}
        workspaceSlug={workspaceSlug}
        envSlug={envId}
        capabilities={capList}
      />

      {/* Definition viewer */}
      {viewingDefinition?.job_definition && (
        <DefinitionDialog
          definition={viewingDefinition.job_definition}
          onClose={() => setViewingDefinition(null)}
        />
      )}

      {/* Stop confirmation */}
      <AlertDialog
        open={!!stopping}
        onOpenChange={(v) => {
          if (!v) setStopping(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Stop deployment?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{stopping?.job_name}</strong> will be stopped on{" "}
              <strong>{stopping?.runtime_provider || "nomad"}</strong> and removed from this
              environment. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                void handleStop();
              }}
              disabled={stopDeployment.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {stopDeployment.isPending && <Loader2 className="size-3.5 animate-spin mr-1.5" />}
              Stop & delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
