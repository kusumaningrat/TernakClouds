import { useState } from "react";
import { Loader2 } from "lucide-react";
import type { PlatformSpec, RegistryProviderType } from "@/lib/types";
import {
  useEnvironmentRegistries,
  useRegistries,
  useBoundRepos,
  useRegistryRepos,
} from "@/lib/queries";

export function Step3Container({
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
