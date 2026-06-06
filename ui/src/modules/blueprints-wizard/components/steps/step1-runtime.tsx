import type { Blueprint, PlatformSpec } from "@/lib/types";
import { BlueprintIcon } from "../../utils/icons";

export function Step1Runtime({
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
