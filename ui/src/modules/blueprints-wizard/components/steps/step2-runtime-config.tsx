import type { PlatformSpec } from "@/lib/types";
import {
  useNomadNodes,
  useNomadNamespaces,
  useK8sNamespaces,
} from "@/lib/queries";

export function Step2RuntimeConfig({
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
