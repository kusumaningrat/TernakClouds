import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { DashboardTopbar } from "@/components/DashboardTopbar";
import { useWorkspaceContext } from "@/lib/workspace-context";
import {
  useCatalog,
  useEnvironments,
  useCapabilities,
  useDeployService,
  useNomadNodes,
  useNomadNamespaces,
  useK8sNamespaces,
  useK8sNodes,
  useEnvironmentRegistries,
} from "@/lib/queries";
import { useState, useEffect } from "react";
import type { CatalogItem } from "@/lib/types";
import type { ApiError } from "@/lib/api";
import { toast } from "sonner";
import {
  ArrowLeft,
  Cpu,
  MemoryStick,
  Globe,
  Lock,
  Server,
  Rocket,
  Loader2,
  Eye,
  EyeOff,
  X,
  Plus,
} from "lucide-react";
import { inferCategory, CATEGORY_CONFIG } from "@/lib/catalog-category";

export const Route = createFileRoute("/dashboard/deploy/$serviceName")({
  head: ({ params }) => ({
    meta: [{ title: `Deploy ${params.serviceName} · TernakClouds` }],
  }),
  component: DeployServicePage,
});

// ─── Env var row (Docker) ───────────────────────────────────────────────────────

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

// ─── Env mapping row (Nomad/Vault) ──────────────────────────────────────────────

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

// ─── Deploy form ────────────────────────────────────────────────────────────────

function DeployForm({
  item,
  workspaceSlug,
  envSlug,
}: {
  item: CatalogItem;
  workspaceSlug: string;
  envSlug: string;
}) {
  const navigate = useNavigate();

  const { data: capabilities } = useCapabilities(workspaceSlug, envSlug);
  const capList = capabilities ?? [];

  const hasNomad = capList.some(
    (c) => c.capability_name === "runtime" && c.providers.some((p) => p.provider_name === "nomad"),
  );
  const hasKubernetes = capList.some(
    (c) =>
      c.capability_name === "runtime" && c.providers.some((p) => p.provider_name === "kubernetes"),
  );
  const hasDocker = capList.some(
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

  const [runtimeProvider, setRuntimeProvider] = useState(availableRuntimes[0]?.value ?? "nomad");
  const [jobName, setJobName] = useState("");
  const [datacenter, setDatacenter] = useState("");
  const [namespace, setNamespace] = useState("default");
  const [workerName, setWorkerName] = useState("");
  const [k8sNamespace, setK8sNamespace] = useState("default");
  const [replicas, setReplicas] = useState("1");
  const [k8sNodeName, setK8sNodeName] = useState("");
  const [exposedPort, setExposedPort] = useState("");
  const [cpu, setCpu] = useState("");
  const [memory, setMemory] = useState("");
  const [registryId, setRegistryId] = useState("");
  const [imagePath, setImagePath] = useState("");
  const [imageTag, setImageTag] = useState("");
  const [vaultRole, setVaultRole] = useState("");
  const [vaultPath, setVaultPath] = useState("");
  const [envMappings, setEnvMappings] = useState<[string, string][]>([]);
  const [envVars, setEnvVars] = useState<[string, string][]>([]);
  const addEnvVar = () => setEnvVars((prev) => [...prev, ["", ""]]);
  const updateEnvVar = (i: number, field: 0 | 1, value: string) =>
    setEnvVars((prev) =>
      prev.map((pair, idx) =>
        idx === i ? (field === 0 ? [value, pair[1]] : [pair[0], value]) : pair,
      ),
    );
  const removeEnvVar = (i: number) => setEnvVars((prev) => prev.filter((_, idx) => idx !== i));
  const copyCatalogEnvVars = () => {
    if (!item.environment_config) return;
    setEnvVars(Object.entries(item.environment_config));
  };

  // Sync runtime when capabilities load
  useEffect(() => {
    if (
      availableRuntimes.length > 0 &&
      !availableRuntimes.find((r) => r.value === runtimeProvider)
    ) {
      setRuntimeProvider(availableRuntimes[0].value);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasNomad, hasKubernetes, hasDocker]);

  const datacenters = [...new Set((nodes ?? []).map((n) => n.Datacenter))];
  const workers = (nodes ?? []).filter((n) => !datacenter || n.Datacenter === datacenter);

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

    const mappings = envMappings.reduce<Record<string, string>>((acc, [k, v]) => {
      if (k && v) acc[k] = v;
      return acc;
    }, {});

    const vars = envVars.reduce<Record<string, string>>((acc, [k, v]) => {
      if (k) acc[k] = v;
      return acc;
    }, {});

    const portValue = exposedPort.trim() ? parseInt(exposedPort, 10) : undefined;
    if (exposedPort.trim() && Number.isNaN(portValue)) {
      toast.error("Exposed port must be a valid number");
      return;
    }

    try {
      await deploy.mutateAsync({
        catalog_name: item.name,
        job_name: jobName,
        runtime_provider: runtimeProvider,
        exposed_port: portValue,
        cpu: cpu ? parseInt(cpu, 10) : undefined,
        memory: memory ? parseInt(memory, 10) : undefined,
        datacenter: runtimeProvider === "nomad" ? datacenter : undefined,
        namespace: runtimeProvider === "nomad" ? namespace : undefined,
        worker_name: runtimeProvider === "nomad" ? workerName : undefined,
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
      toast.success(`${item.display_name} deployed successfully`);
      void navigate({
        to: "/dashboard/services/$serviceName",
        params: { serviceName: item.name },
      });
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

  return (
    <form
      onSubmit={(e) => {
        void handleSubmit(e);
      }}
      className="space-y-5"
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
            No runtime providers configured for this environment. Bind one in Platform →
            Capabilities.
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
          placeholder={item.display_name || item.name}
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
        </>
      )}

      {/* Kubernetes-specific fields */}
      {runtimeProvider === "kubernetes" && (
        <div className="space-y-4">
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

      {/* Exposed port — hidden for portless services (e.g. busybox) */}
      {item.default_container_port === 0 ? (
        <div className="flex items-start gap-2 px-3 py-2.5 rounded-md bg-muted/40 border border-border text-[11px] text-muted-foreground">
          <Globe className="size-3.5 shrink-0 mt-0.5" />
          <span>
            This service does not expose a network port and will run without port mapping.
          </span>
        </div>
      ) : (
        <div>
          <label className="text-xs font-medium text-muted-foreground">
            {runtimeProvider === "kubernetes"
              ? "Exposed port (NodePort) *"
              : runtimeProvider === "docker"
                ? "Exposed port (optional)"
                : "Exposed port *"}
          </label>
          {runtimeProvider === "kubernetes" && (
            <p className="text-[11px] text-muted-foreground mt-0.5 mb-1.5">
              Port exposed on every node (30000–32767). The container listens on{" "}
              <span className="font-mono">{item.default_container_port}</span> internally.
            </p>
          )}
          <input
            type="number"
            required={runtimeProvider !== "docker"}
            min={runtimeProvider === "kubernetes" ? 30000 : 1}
            max={runtimeProvider === "kubernetes" ? 32767 : 65535}
            value={exposedPort}
            onChange={(e) => setExposedPort(e.target.value)}
            placeholder={
              runtimeProvider === "kubernetes" ? "e.g. 30080" : String(item.default_container_port)
            }
            className="mt-1.5 w-full px-3 py-2.5 rounded-md bg-secondary border border-border focus:border-primary outline-none transition text-sm"
          />
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
        <div className="border-t border-border pt-5 space-y-4">
          <p className="text-xs font-semibold text-foreground">Private image settings</p>
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
        <div className="border-t border-border pt-5 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-foreground">
              Environment variables{" "}
              <span className="font-normal text-muted-foreground/60">optional</span>
            </p>
            <div className="flex items-center gap-2">
              {item.environment_config && (
                <button
                  type="button"
                  onClick={copyCatalogEnvVars}
                  className="text-[11px] text-muted-foreground hover:text-primary hover:underline transition"
                >
                  Copy catalog defaults
                </button>
              )}
              <button
                type="button"
                onClick={addEnvVar}
                className="text-[11px] text-primary hover:underline flex items-center gap-1"
              >
                <Plus className="size-3" /> Add
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

      {/* Vault — Nomad only */}
      {runtimeProvider === "nomad" && (
        <div className="border-t border-border pt-5 space-y-4">
          <p className="text-xs font-semibold text-foreground">
            Vault integration <span className="font-normal text-muted-foreground/60">optional</span>
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
                className="text-[11px] text-primary hover:underline flex items-center gap-1"
              >
                <Plus className="size-3" /> Add
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

      {/* Form actions */}
      <div className="flex items-center justify-between pt-4 border-t border-border">
        <Link
          to="/dashboard/services"
          className="px-4 py-2 rounded-md bg-secondary hover:bg-accent text-sm text-muted-foreground hover:text-foreground transition"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={deploy.isPending || availableRuntimes.length === 0}
          className="flex items-center gap-2 px-5 py-2.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition disabled:opacity-60"
        >
          {deploy.isPending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Rocket className="size-3.5" />
          )}
          Deploy
        </button>
      </div>
    </form>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────────

function DeployServicePage() {
  const { serviceName } = useParams({ from: "/dashboard/deploy/$serviceName" });
  const { selectedWorkspace } = useWorkspaceContext();
  const workspaceSlug = selectedWorkspace?.slug ?? "";

  const { data: catalog, isLoading: catalogLoading } = useCatalog();
  const { data: environments, isLoading: envsLoading } = useEnvironments(workspaceSlug);

  const item = (catalog ?? []).find((c) => c.name === serviceName) ?? null;

  const [selectedEnvSlug, setSelectedEnvSlug] = useState("");

  // Auto-select the first environment
  useEffect(() => {
    if (environments?.length && !selectedEnvSlug) {
      setSelectedEnvSlug(environments[0].slug);
    }
  }, [environments, selectedEnvSlug]);

  const isLoading = catalogLoading || envsLoading;

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <DashboardTopbar breadcrumbs={["Catalog", "Deploy"]} />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="flex flex-col h-full">
        <DashboardTopbar breadcrumbs={["Catalog", "Deploy"]} />
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center p-8">
          <p className="text-muted-foreground text-sm">
            Service <span className="font-mono">{serviceName}</span> not found in catalog.
          </p>
          <Link
            to="/dashboard/services"
            className="text-primary text-sm hover:underline flex items-center gap-1.5"
          >
            <ArrowLeft className="size-3.5" /> Back to catalog
          </Link>
        </div>
      </div>
    );
  }

  const category = inferCategory(item);
  const categoryConfig = CATEGORY_CONFIG[category];
  const CategoryIcon = categoryConfig.icon;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <DashboardTopbar breadcrumbs={["Catalog", item.display_name || item.name, "Deploy"]} />

      <div className="flex-1 overflow-auto">
        <div className="max-w-2xl mx-auto px-6 py-8">
          {/* Back link */}
          <Link
            to="/dashboard/services"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition mb-6"
          >
            <ArrowLeft className="size-3.5" /> Back to catalog
          </Link>

          {/* Service info */}
          <div className="flex items-start gap-4 p-4 rounded-xl border border-border bg-card mb-8">
            <div
              className={`size-10 rounded-xl ${categoryConfig.bg} grid place-items-center shrink-0`}
            >
              <CategoryIcon className={`size-5 ${categoryConfig.color}`} />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-base font-bold">{item.display_name || item.name}</h1>
              <span
                className={`inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded mt-0.5 ${categoryConfig.bg} ${categoryConfig.color}`}
              >
                {category}
              </span>
              {item.description && (
                <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                  {item.description}
                </p>
              )}
              <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
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
                  <Cpu className="size-3" /> {item.default_cpu}m default
                </span>
                <span className="flex items-center gap-1">
                  <MemoryStick className="size-3" /> {item.default_memory} MB default
                </span>
              </div>
            </div>
          </div>

          {/* Environment selector */}
          <div className="mb-8">
            <p className="text-sm font-semibold mb-3">Deploy to</p>
            {(environments ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No environments available.{" "}
                <Link to="/dashboard/environments" className="text-primary hover:underline">
                  Create one first.
                </Link>
              </p>
            ) : (
              <div className="flex gap-2 flex-wrap">
                {(environments ?? []).map((env) => (
                  <button
                    key={env.id}
                    type="button"
                    onClick={() => setSelectedEnvSlug(env.slug)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium border transition ${
                      selectedEnvSlug === env.slug
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-secondary text-muted-foreground hover:border-primary/40 hover:text-foreground"
                    }`}
                  >
                    {env.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Deploy form — rendered when env is selected */}
          {selectedEnvSlug && (
            <>
              <div className="border-t border-border pt-6 mb-5">
                <p className="text-sm font-semibold">Configuration</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Deployment settings for the selected environment.
                </p>
              </div>
              <DeployForm
                key={selectedEnvSlug}
                item={item}
                workspaceSlug={workspaceSlug}
                envSlug={selectedEnvSlug}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
