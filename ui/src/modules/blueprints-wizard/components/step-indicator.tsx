import { CheckCircle, ChevronRight } from "lucide-react";

export const STEPS = ["Blueprint", "Runtime", "Container", "Secrets & CI/CD", "Preview", "Provision"];

export function StepIndicator({ current }: { current: number }) {
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
