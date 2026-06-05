import { createFileRoute, Link, useParams } from "@tanstack/react-router";
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
  catalogKeys,
} from "@/lib/queries";
import { useState, useEffect, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
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
  Search,
  Rocket,
  Circle,
  ScrollText,
  Database,
  Zap,
  Radio,
  HardDrive,
  Network,
  Box,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
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
  head: () => ({ meta: [{ title: "Catalog · TernakClouds" }] }),
  component: ServiceCatalogPage,
});

// ─── Category system ────────────────────────────────────────────────────────────

const ALL_CATEGORIES = [
  "All",
  "Application",
  "Database",
  "Cache",
  "Storage",
  "Messaging",
  "Networking",
] as const;

type Category = (typeof ALL_CATEGORIES)[number];

const KNOWN_CATEGORIES = new Set<string>(ALL_CATEGORIES.filter((c) => c !== "All"));

function inferCategory(item: CatalogItem): Exclude<Category, "All"> {
  if (item.category && KNOWN_CATEGORIES.has(item.category)) {
    return item.category as Exclude<Category, "All">;
  }
  return "Application";
}

type CategoryConfig = { icon: LucideIcon; color: string; bg: string };

const CATEGORY_CONFIG: Record<Exclude<Category, "All">, CategoryConfig> = {
  Application: { icon: Box, color: "text-primary", bg: "bg-primary/10" },
  Database: { icon: Database, color: "text-blue-600", bg: "bg-blue-500/10" },
  Cache: { icon: Zap, color: "text-amber-600", bg: "bg-amber-500/10" },
  Storage: { icon: HardDrive, color: "text-teal-600", bg: "bg-teal-500/10" },
  Messaging: { icon: Radio, color: "text-purple-600", bg: "bg-purple-500/10" },
  Networking: { icon: Network, color: "text-slate-600", bg: "bg-slate-500/10" },
};

// ─── Runtime badge ──────────────────────────────────────────────────────────────

const RUNTIME_COLORS: Record<string, string> = {
  nomad: "bg-purple-500/15 text-purple-600",
  kubernetes: "bg-blue-500/15 text-blue-600",
  docker: "bg-sky-500/15 text-sky-600",
};

function RuntimeBadge({ provider }: { provider: string }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${RUNTIME_COLORS[provider] ?? "bg-muted text-muted-foreground"}`}
    >
      {provider}
    </span>
  );
}

// ─── Status badge ───────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  running: "bg-emerald-500/15 text-emerald-600",
  pending: "bg-amber-500/15 text-amber-600",
  dead: "bg-gray-400/15 text-gray-500",
  unknown: "bg-muted text-muted-foreground",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${STATUS_STYLES[status] ?? "bg-muted text-muted-foreground"}`}
    >
      {status}
    </span>
  );
}

// ─── Nomad live status ──────────────────────────────────────────────────────────

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
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useNomadJob(
    workspaceSlug,
    envSlug,
    nomadJobId,
    namespace,
    enabled,
  );

  useEffect(() => {
    if (!error) return;
    void queryClient.invalidateQueries({
      queryKey: catalogKeys.deployments(workspaceSlug, envSlug),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!error]);

  if (!enabled) return <span className="text-[10px] text-muted-foreground">no provider</span>;
  if (isLoading) return <Loader2 className="size-3 animate-spin text-muted-foreground" />;
  if (error) return <StatusBadge status="unknown" />;
  return <StatusBadge status={data?.Status?.toLowerCase() ?? "unknown"} />;
}

// ─── Env mapping row ────────────────────────────────────────────────────────────

function EnvVarRow({
  envKey,
  envValue,
  onChangeKey,
  onChangeValue,
  onRemove,
}: {
  envKey: string;
  envValue: string;
  onChangeKey: (v: string) => void;
  onChangeValue: (v: string) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        value={envKey}
        onChange={(e) => onChangeKey(e.target.value)}
        placeholder="KEY"
        className="flex-1 px-2.5 py-1.5 rounded-md bg-secondary border border-border focus:border-primary outline-none transition text-xs font-mono"
      />
      <span className="text-muted-foreground text-xs shrink-0">=</span>
      <input
        value={envValue}
        onChange={(e) => onChangeValue(e.target.value)}
        placeholder="value"
        className="flex-1 px-2.5 py-1.5 rounded-md bg-secondary border border-border focus:border-primary outline-none transition text-xs font-mono"
      />
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

// ─── Deploy dialog ──────────────────────────────────────────────────────────────

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

  const availableRuntimes = [
    ...(hasNomad ? [{ value: "nomad", label: "Nomad" }] : []),
    ...(hasKubernetes ? [{ value: "kubernetes", label: "Kubernetes" }] : []),
    ...(hasDocker ? [{ value: "docker", label: "Docker" }] : []),
  ];

  const defaultRuntime = availableRuntimes[0]?.value ?? "nomad";

  const [runtimeProvider, setRuntimeProvider] = useState(defaultRuntime);
  const [jobName, setJobName] = useState("");
  const [datacenter, setDatacenter] = useState("");
  const [namespace, setNamespace] = useState("default");
  const [workerName, setWorkerName] = useState("");
  const [nomadHostNetwork, setNomadHostNetwork] = useState<"private" | "public">("private");
  const [k8sNamespace, setK8sNamespace] = useState("default");
  const [replicas, setReplicas] = useState("1");
  const [k8sNodeName, setK8sNodeName] = useState("");
  const [portMappings, setPortMappings] = useState<
    { name: string; containerPort: number; exposedPort: string }[]
  >([]);
  const [cpu, setCpu] = useState("");

  // Sync port mappings whenever the item changes.
  useEffect(() => {
    const defs = item?.default_ports ?? [];
    setPortMappings(
      defs.map((p) => ({ name: p.name, containerPort: p.container_port, exposedPort: "" })),
    );
  }, [item?.name, item?.default_ports]);
  const [memory, setMemory] = useState("");
  const [registryId, setRegistryId] = useState("");
  const [imagePath, setImagePath] = useState("");
  const [imageTag, setImageTag] = useState("");
  const [vaultRole, setVaultRole] = useState("");
  const [vaultPath, setVaultPath] = useState("");
  const [envMappings, setEnvMappings] = useState<[string, string][]>([]);
  const copyCatalogEnvToMappings = (item: CatalogItem) => {
    if (!item?.environment_config) return;
    setEnvMappings(Object.entries(item.environment_config));
  };

  const [envVars, setEnvVars] = useState<[string, string][]>([]);
  const addEnvVar = () => setEnvVars((prev) => [...prev, ["", ""]]);
  const updateEnvVar = (i: number, field: 0 | 1, value: string) =>
    setEnvVars((prev) =>
      prev.map((pair, idx) =>
        idx === i ? (field === 0 ? [value, pair[1]] : [pair[0], value]) : pair,
      ),
    );
  const removeEnvVar = (i: number) => setEnvVars((prev) => prev.filter((_, idx) => idx !== i));
  const copyCatalogEnvVars = (item: CatalogItem) => {
    if (!item?.environment_config) return;
    setEnvVars(Object.entries(item.environment_config));
  };

  const datacenters = [...new Set((nodes ?? []).map((n) => n.Datacenter))];
  const workers = (nodes ?? []).filter((n) => !datacenter || n.Datacenter === datacenter);

  const handleClose = () => {
    setRuntimeProvider(defaultRuntime);
    setJobName("");
    setDatacenter("");
    setNamespace("default");
    setWorkerName("");
    setNomadHostNetwork("private");
    setK8sNamespace("default");
    setReplicas("1");
    setK8sNodeName("");
    setPortMappings([]);
    setCpu("");
    setMemory("");
    setRegistryId("");
    setImagePath("");
    setImageTag("");
    setVaultRole("");
    setVaultPath("");
    setEnvMappings([]);
    setEnvVars([]);
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

    const vars = envVars.reduce<Record<string, string>>((acc, [k, v]) => {
      if (k) acc[k] = v;
      return acc;
    }, {});

    const ports = portMappings.map((pm) => {
      const ep = pm.exposedPort.trim() ? parseInt(pm.exposedPort, 10) : 0;
      if (pm.exposedPort.trim() && Number.isNaN(ep)) {
        toast.error(`Invalid host port for "${pm.name}"`);
        throw new Error("invalid port");
      }
      return { name: pm.name, container_port: pm.containerPort, exposed_port: ep };
    });

    try {
      await deploy.mutateAsync({
        catalog_name: item.name,
        job_name: jobName,
        runtime_provider: runtimeProvider,
        ports: ports.length > 0 ? ports : undefined,
        cpu: cpu ? parseInt(cpu, 10) : undefined,
        memory: memory ? parseInt(memory, 10) : undefined,
        datacenter: runtimeProvider === "nomad" ? datacenter : undefined,
        namespace: runtimeProvider === "nomad" ? namespace : undefined,
        worker_name: runtimeProvider === "nomad" ? workerName : undefined,
        nomad_host_network: runtimeProvider === "nomad" ? nomadHostNetwork : undefined,
        k8s_namespace: runtimeProvider === "kubernetes" ? k8sNamespace : undefined,
        replicas: runtimeProvider === "kubernetes" && replicas ? parseInt(replicas, 10) : undefined,
        k8s_node_name: runtimeProvider === "kubernetes" && k8sNodeName ? k8sNodeName : undefined,
        registry_id: registryId || undefined,
        image_path: imagePath || undefined,
        image_tag: imageTag || undefined,
        vault_role: runtimeProvider === "nomad" ? vaultRole || undefined : undefined,
        vault_path: runtimeProvider === "nomad" ? vaultPath || undefined : undefined,
        env_mappings:
          runtimeProvider === "nomad" && Object.keys(mappings).length > 0 ? mappings : undefined,
        env_vars: runtimeProvider === "docker" && Object.keys(vars).length > 0 ? vars : undefined,
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
              placeholder={item?.display_name ?? item?.name ?? ""}
              className="mt-1.5 w-full px-3 py-2.5 rounded-md bg-secondary border border-border focus:border-primary outline-none transition text-sm"
            />
          </div>

          {/* Nomad-specific fields */}
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

              <div>
                <label className="text-xs font-medium text-muted-foreground">Host network</label>
                <div className="mt-1.5 flex rounded-md overflow-hidden border border-border text-sm">
                  {(["private", "public"] as const).map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setNomadHostNetwork(opt)}
                      className={`flex-1 py-2 capitalize transition ${
                        nomadHostNetwork === opt
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Use <span className="font-mono">public</span> to bind ports on the host's public
                  interface.
                </p>
              </div>
            </>
          )}

          {/* Kubernetes-specific fields */}
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

          {/* Port mappings */}
          {portMappings.length === 0 ? (
            <p className="text-[11px] text-muted-foreground px-3 py-2.5 rounded-md bg-muted/40 border border-border">
              This service does not expose a network port and will run without port mapping.
            </p>
          ) : (
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">
                {runtimeProvider === "kubernetes" ? "Port mappings (NodePort)" : "Port mappings"}
              </label>
              {runtimeProvider === "kubernetes" && (
                <p className="text-[11px] text-muted-foreground">
                  NodePort must be in range 30000–32767. Leave blank for ClusterIP-only (internal).
                </p>
              )}
              {portMappings.map((pm, i) => (
                <div key={pm.name} className="flex items-center gap-2">
                  <span className="text-xs font-mono text-muted-foreground w-20 shrink-0 truncate">
                    {pm.name}
                  </span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    :{pm.containerPort}
                  </span>
                  <span className="text-xs text-muted-foreground shrink-0">→</span>
                  <input
                    type="number"
                    required={
                      runtimeProvider === "nomad" &&
                      pm.name === (item.default_ports?.[0]?.name ?? "")
                    }
                    min={runtimeProvider === "kubernetes" ? 30000 : 1}
                    max={runtimeProvider === "kubernetes" ? 32767 : 65535}
                    value={pm.exposedPort}
                    onChange={(e) =>
                      setPortMappings((prev) =>
                        prev.map((p, idx) =>
                          idx === i ? { ...p, exposedPort: e.target.value } : p,
                        ),
                      )
                    }
                    placeholder={
                      runtimeProvider === "kubernetes"
                        ? "e.g. 30080"
                        : runtimeProvider === "docker"
                          ? "host port (optional)"
                          : String(pm.containerPort)
                    }
                    className="flex-1 px-3 py-2 rounded-md bg-secondary border border-border focus:border-primary outline-none transition text-sm"
                  />
                </div>
              ))}
            </div>
          )}

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

          {/* Environment variables — Docker only */}
          {runtimeProvider === "docker" && (
            <div className="border-t border-border pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground">
                  Environment variables{" "}
                  <span className="font-normal text-muted-foreground/60">optional</span>
                </p>
                <div className="flex items-center gap-2">
                  {item?.environment_config && (
                    <button
                      type="button"
                      onClick={() => copyCatalogEnvVars(item)}
                      className="text-[11px] text-muted-foreground hover:text-primary hover:underline transition"
                    >
                      Copy catalog defaults
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={addEnvVar}
                    className="text-[11px] text-primary hover:underline"
                  >
                    + Add
                  </button>
                </div>
              </div>
              {envVars.length === 0 ? (
                <p className="text-[11px] text-muted-foreground">
                  No environment variables. Add one to pass config into the container.
                </p>
              ) : (
                <div className="space-y-2">
                  {envVars.map(([k, v], i) => (
                    <EnvVarRow
                      key={i}
                      envKey={k}
                      envValue={v}
                      onChangeKey={(val) => updateEnvVar(i, 0, val)}
                      onChangeValue={(val) => updateEnvVar(i, 1, val)}
                      onRemove={() => removeEnvVar(i)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

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
                  <div className="flex items-center gap-2">
                    {item?.environment_config && (
                      <button
                        type="button"
                        onClick={() => copyCatalogEnvToMappings(item)}
                        className="text-[11px] text-muted-foreground hover:text-primary hover:underline transition"
                      >
                        Copy catalog defaults
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={addEnvMapping}
                      className="text-[11px] text-primary hover:underline"
                    >
                      + Add
                    </button>
                  </div>
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

// ─── Job definition viewer ──────────────────────────────────────────────────────

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

// ─── Service card ───────────────────────────────────────────────────────────────

type CardHealth = "running" | "pending" | "failed" | "inactive";

const CARD_BORDER: Record<CardHealth, string> = {
  running: "border-success/40",
  pending: "border-warning/40",
  failed: "border-destructive/40",
  inactive: "border-border",
};

const CARD_ACCENT: Record<CardHealth, string> = {
  running: "bg-success",
  pending: "bg-warning",
  failed: "bg-destructive",
  inactive: "bg-transparent",
};

function cardHealth(d: ServiceDeployment | null): CardHealth {
  if (!d) return "inactive";
  const s = d.status?.toLowerCase() ?? "";
  if (s === "running") return "running";
  if (s === "pending") return "pending";
  return "failed";
}

const HEALTH_ORDER: Record<CardHealth, number> = {
  failed: 0,
  pending: 1,
  running: 2,
  inactive: 3,
};

function EnvServiceCard({
  item,
  deployment,
  category,
  workspaceSlug,
  envSlug,
  hasNomadProvider,
  onDeploy,
  onStop,
  stopping,
  onViewDefinition,
}: {
  item: CatalogItem;
  deployment: ServiceDeployment | null;
  category: Exclude<Category, "All">;
  workspaceSlug: string;
  envSlug: string;
  hasNomadProvider: boolean;
  onDeploy: (item: CatalogItem) => void;
  onStop: (d: ServiceDeployment) => void;
  stopping: boolean;
  onViewDefinition: (d: ServiceDeployment) => void;
}) {
  const { icon: Icon, color, bg } = CATEGORY_CONFIG[category];
  const health = cardHealth(deployment);
  const isDeployed = !!deployment;
  const isNomad =
    !deployment || deployment.runtime_provider === "nomad" || deployment.runtime_provider === "";

  return (
    <div
      className={`flex flex-col rounded-xl border bg-card overflow-hidden ${CARD_BORDER[health]}`}
    >
      {/* Health accent stripe */}
      <div className={`h-0.5 w-full ${CARD_ACCENT[health]}`} />

      {/* Card body */}
      <div className="p-4 flex-1 flex flex-col gap-3">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-3 min-w-0">
            <div className={`size-8 rounded-lg ${bg} grid place-items-center shrink-0`}>
              <Icon className={`size-4 ${color}`} />
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-sm truncate">{item.display_name || item.name}</div>
              <span
                className={`inline-flex items-center mt-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded ${bg} ${color}`}
              >
                {category}
              </span>
            </div>
          </div>

          {/* Live status badge */}
          {isDeployed && (
            <div className="shrink-0">
              {isNomad ? (
                <NomadLiveStatus
                  workspaceSlug={workspaceSlug}
                  envSlug={envSlug}
                  nomadJobId={deployment!.nomad_job_id}
                  namespace={deployment!.namespace}
                  enabled={hasNomadProvider}
                />
              ) : (
                <StatusBadge status={deployment!.status} />
              )}
            </div>
          )}
        </div>

        {/* Body content */}
        {isDeployed ? (
          <div className="space-y-2">
            <div className="text-sm font-medium text-foreground truncate">
              {deployment!.job_name}
            </div>
            <div className="flex items-center gap-3 flex-wrap text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <Cpu className="size-3" />
                {deployment!.cpu}m
              </span>
              <span className="flex items-center gap-1">
                <MemoryStick className="size-3" />
                {deployment!.memory} MB
              </span>
              {(deployment!.ports ?? [])
                .filter((p) => p.exposed_port && p.exposed_port > 0)
                .map((p) => (
                  <span key={p.name} className="font-mono">
                    :{p.exposed_port}
                  </span>
                ))}
              <RuntimeBadge provider={deployment!.runtime_provider || "nomad"} />
            </div>
            {isNomad && deployment!.datacenter && (
              <div className="text-[11px] text-muted-foreground font-mono truncate">
                {deployment!.datacenter} / {deployment!.namespace}
              </div>
            )}
          </div>
        ) : (
          <>
            {item.description && (
              <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                {item.description}
              </p>
            )}
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/50 mt-auto">
              <Circle className="size-2.5" />
              Not deployed
            </div>
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground/60">
              {item.is_public_image ? (
                <span className="flex items-center gap-1">
                  <Globe className="size-3" /> Public image
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <Lock className="size-3" /> Private image
                </span>
              )}
              <span className="flex items-center gap-1">
                <Cpu className="size-3" /> {item.default_cpu}m
              </span>
              <span className="flex items-center gap-1">
                <MemoryStick className="size-3" /> {item.default_memory} MB
              </span>
            </div>
          </>
        )}
      </div>

      {/* Actions footer */}
      <div className="px-4 py-3 bg-muted/30 border-t border-border/50 flex items-center gap-2">
        {isDeployed ? (
          <>
            <Link
              to="/dashboard/services/$serviceName"
              params={{ serviceName: item.name }}
              search={{ tab: "logs" } as never}
              className="flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded-md bg-secondary text-muted-foreground hover:text-foreground transition"
            >
              <ScrollText className="size-3" /> Logs
            </Link>
            {deployment!.job_definition && (
              <button
                onClick={() => onViewDefinition(deployment!)}
                className="flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded-md bg-secondary text-muted-foreground hover:text-foreground transition"
              >
                <FileCode className="size-3" /> Definition
              </button>
            )}
            <button
              onClick={() => onStop(deployment!)}
              disabled={stopping}
              className="ml-auto flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded-md bg-secondary text-destructive hover:bg-destructive/10 transition disabled:opacity-50"
            >
              <Trash2 className="size-3" /> Stop
            </button>
          </>
        ) : (
          <button
            onClick={() => onDeploy(item)}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition"
          >
            <Rocket className="size-3.5" /> Deploy
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Loading skeleton ───────────────────────────────────────────────────────────

function CardSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden animate-pulse">
      <div className="h-0.5 bg-transparent" />
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-3">
            <div className="size-8 rounded-lg bg-muted shrink-0" />
            <div className="space-y-1.5">
              <div className="h-3.5 bg-muted rounded w-24" />
              <div className="h-2.5 bg-muted rounded w-16" />
            </div>
          </div>
        </div>
        <div className="space-y-1.5">
          <div className="h-2.5 bg-muted rounded" />
          <div className="h-2.5 bg-muted rounded w-4/5" />
        </div>
      </div>
      <div className="px-4 py-3 bg-muted/30 border-t border-border/50">
        <div className="h-8 bg-muted rounded-md" />
      </div>
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────────

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
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<Category>("All");

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

  // Merge catalog with deployments and sort: failing first, then running, then not deployed
  const enrichedRows = useMemo(() => {
    return (catalog ?? []).map((item) => {
      const category = inferCategory(item);
      // Pick the most recent deployment for this item in this env
      const deps = (deployments ?? []).filter((d) => d.catalog_name === item.name);
      const deployment =
        deps.sort(
          (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
        )[0] ?? null;
      return { item, category, deployment };
    });
  }, [catalog, deployments]);

  const filtered = useMemo(() => {
    const searchLower = search.toLowerCase();
    return enrichedRows
      .filter((row) => {
        if (
          search &&
          !row.item.name.toLowerCase().includes(searchLower) &&
          !row.item.display_name.toLowerCase().includes(searchLower) &&
          !row.item.description?.toLowerCase().includes(searchLower)
        ) {
          return false;
        }
        if (activeCategory !== "All" && row.category !== activeCategory) return false;
        return true;
      })
      .sort((a, b) => {
        const ha = HEALTH_ORDER[cardHealth(a.deployment)];
        const hb = HEALTH_ORDER[cardHealth(b.deployment)];
        return ha - hb;
      });
  }, [enrichedRows, search, activeCategory]);

  const categoryCounts = useMemo(() => {
    const counts: Partial<Record<Category, number>> = { All: enrichedRows.length };
    for (const row of enrichedRows) {
      counts[row.category as Exclude<Category, "All">] =
        (counts[row.category as Exclude<Category, "All">] ?? 0) + 1;
    }
    return counts;
  }, [enrichedRows]);

  const deployedCount = enrichedRows.filter((r) => r.deployment).length;
  const failedCount = enrichedRows.filter((r) => cardHealth(r.deployment) === "failed").length;

  const isLoading = catalogLoading || deploymentsLoading;

  const visibleCategories = ALL_CATEGORIES.filter(
    (cat) => cat === "All" || (categoryCounts[cat] ?? 0) > 0,
  );

  return (
    <div className="flex flex-col h-full">
      <DashboardTopbar
        title="Catalog"
        subtitle={`Browse and deploy services to this environment`}
      />

      <div className="flex-1 overflow-auto">
        {/* ── Page header ── */}
        <div className="px-6 pt-6 pb-4">
          {!isLoading && enrichedRows.length > 0 && (
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              <span className="text-xs text-muted-foreground">
                {enrichedRows.length} item{enrichedRows.length !== 1 ? "s" : ""}
              </span>
              {deployedCount > 0 && (
                <span className="text-xs text-success font-medium">· {deployedCount} deployed</span>
              )}
              {failedCount > 0 && (
                <span className="text-xs text-destructive font-medium">
                  · {failedCount} failing
                </span>
              )}
            </div>
          )}

          {/* Search */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-input focus-within:border-primary/50 transition-colors max-w-lg mb-3">
            <Search className="size-3.5 text-muted-foreground shrink-0" />
            <input
              className="bg-transparent outline-none flex-1 text-sm placeholder:text-muted-foreground/60"
              placeholder="Search catalog…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="text-muted-foreground hover:text-foreground transition"
                aria-label="Clear search"
              >
                <X className="size-3" />
              </button>
            )}
          </div>

          {/* Category chips */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            {visibleCategories.map((cat) => {
              const isActive = activeCategory === cat;
              const count = categoryCounts[cat] ?? 0;
              const config = cat !== "All" ? CATEGORY_CONFIG[cat] : null;
              return (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition border shrink-0 ${
                    isActive
                      ? "bg-primary/10 text-primary border-primary/30"
                      : "bg-transparent text-muted-foreground border-border hover:border-primary/30 hover:text-foreground"
                  }`}
                >
                  {config && <config.icon className="size-3" />}
                  {cat}
                  <span
                    className={`text-[10px] px-1 rounded ${
                      isActive ? "bg-primary/20 text-primary" : "bg-secondary text-muted-foreground"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Card grid ── */}
        <div className="px-6 pb-8">
          {catalogError ? (
            <div className="flex items-center gap-2 text-sm text-destructive py-6">
              <AlertCircle className="size-4" /> {catalogError.message}
            </div>
          ) : isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <CardSkeleton key={i} />
              ))}
            </div>
          ) : enrichedRows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="size-14 rounded-2xl bg-secondary grid place-items-center mb-4">
                <Plus className="size-7 text-muted-foreground" />
              </div>
              <h2 className="text-base font-semibold mb-1">Catalog is empty</h2>
              <p className="text-sm text-muted-foreground max-w-xs">
                No services have been added to the catalog yet.
              </p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="size-14 rounded-2xl bg-secondary grid place-items-center mb-4">
                <Search className="size-7 text-muted-foreground" />
              </div>
              <h2 className="text-base font-semibold mb-1">No services match your filters</h2>
              <button
                onClick={() => {
                  setSearch("");
                  setActiveCategory("All");
                }}
                className="mt-3 text-xs text-primary hover:underline"
              >
                Clear filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filtered.map(({ item, category, deployment }) => (
                <EnvServiceCard
                  key={item.id}
                  item={item}
                  deployment={deployment}
                  category={category as Exclude<Category, "All">}
                  workspaceSlug={workspaceSlug}
                  envSlug={envId}
                  hasNomadProvider={hasNomadProvider}
                  onDeploy={setDeployingItem}
                  onStop={setStopping}
                  stopping={stopDeployment.isPending && stopping?.id === deployment?.id}
                  onViewDefinition={setViewingDefinition}
                />
              ))}
            </div>
          )}
        </div>
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
