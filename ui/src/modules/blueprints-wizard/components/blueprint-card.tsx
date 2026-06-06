import { Rocket } from "lucide-react";
import type { Blueprint } from "@/lib/types";
import { BlueprintIcon, CATEGORY_COLORS } from "../utils/icons";

export function BlueprintCard({
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
