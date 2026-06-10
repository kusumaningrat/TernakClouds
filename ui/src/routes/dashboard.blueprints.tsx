import { createFileRoute } from "@tanstack/react-router";
import { DashboardTopbar } from "@/components/DashboardTopbar";
import { useWorkspaceContext } from "@/lib/workspace-context";
import {
  useBlueprints,
  useEnvironments,
  useBlueprintRuns,
  useBlueprintRun,
  useTriggerBlueprintRun,
} from "@/lib/queries";
import type { Blueprint, BlueprintInput, BlueprintRun, BlueprintRunStep } from "@/lib/types";
import { useState, useMemo, useEffect } from "react";
import { toast } from "sonner";
import { extractError } from "@/lib/toast-helpers";
import {
  Database,
  Code2,
  GitBranch,
  Layers,
  Activity,
  Globe,
  Zap,
  CheckCircle2,
  Circle,
  XCircle,
  Loader2,
  AlertCircle,
  Search,
  ChevronRight,
  ArrowLeft,
  Play,
  Clock,
  X,
  RotateCcw,
} from "lucide-react";
import type { ApiError } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/dashboard/blueprints")({
  head: () => ({ meta: [{ title: "Blueprints · TernakClouds" }] }),
  component: BlueprintsPage,
});

// ─── Icon resolver ─────────────────────────────────────────────────────────────

const ICONS: Record<string, React.ElementType> = {
  database: Database,
  "code-2": Code2,
  "git-branch": GitBranch,
  layers: Layers,
  activity: Activity,
  globe: Globe,
  zap: Zap,
};

function BlueprintIcon({ icon, className }: { icon?: string; className?: string }) {
  const Icon = (icon && ICONS[icon]) || Layers;
  return <Icon className={className ?? "size-5 text-muted-foreground"} />;
}

// ─── Category config ───────────────────────────────────────────────────────────

const CATEGORIES: Record<string, { label: string; color: string; description: string }> = {
  provision: {
    label: "Provision",
    color: "bg-blue-500/15 text-blue-600",
    description: "Deploy and configure platform resources",
  },
  bootstrap: {
    label: "Bootstrap",
    color: "bg-emerald-500/15 text-emerald-600",
    description: "Scaffold new projects from scratch",
  },
  devops: {
    label: "DevOps",
    color: "bg-purple-500/15 text-purple-600",
    description: "CI/CD pipelines and observability",
  },
  environment: {
    label: "Environment",
    color: "bg-amber-500/15 text-amber-600",
    description: "Environment setup and configuration",
  },
  operate: {
    label: "Operate",
    color: "bg-rose-500/15 text-rose-600",
    description: "Day-2 operations on existing resources",
  },
};

// ─── Step status icon ──────────────────────────────────────────────────────────

function StepStatusIcon({ status }: { status: string }) {
  switch (status) {
    case "completed":
      return <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />;
    case "running":
      return <Loader2 className="size-4 text-primary shrink-0 animate-spin" />;
    case "failed":
      return <XCircle className="size-4 text-destructive shrink-0" />;
    case "skipped":
      return <Circle className="size-4 text-muted-foreground/40 shrink-0" />;
    default:
      return <Circle className="size-4 text-muted-foreground/30 shrink-0" />;
  }
}

// ─── Run status badge ──────────────────────────────────────────────────────────

const RUN_STATUS: Record<string, { dot: string; text: string }> = {
  pending: { dot: "bg-muted-foreground", text: "text-muted-foreground" },
  running: { dot: "bg-primary animate-pulse", text: "text-primary" },
  completed: { dot: "bg-emerald-500", text: "text-emerald-600" },
  failed: { dot: "bg-destructive", text: "text-destructive" },
};

function RunStatusBadge({ status }: { status: string }) {
  const s = RUN_STATUS[status] ?? RUN_STATUS.pending;
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium ${s.text}`}>
      <span className={`size-1.5 rounded-full ${s.dot}`} />
      {status}
    </span>
  );
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

// ─── Blueprint card ────────────────────────────────────────────────────────────

function BlueprintCard({ bp, onRun }: { bp: Blueprint; onRun: (bp: Blueprint) => void }) {
  const cat = CATEGORIES[bp.category];
  const stepCount = bp.steps_config?.length ?? 0;

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
            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
              <span className="font-semibold text-sm">{bp.display_name}</span>
              {bp.is_system && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                  platform
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {cat && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${cat.color}`}>
                  {cat.label}
                </span>
              )}
              <span className="text-[10px] text-muted-foreground">
                {stepCount} {stepCount === 1 ? "step" : "steps"}
              </span>
            </div>
          </div>
        </div>

        {bp.description && (
          <p className="text-xs text-muted-foreground mb-4 line-clamp-2 leading-relaxed flex-1">
            {bp.description}
          </p>
        )}

        {stepCount > 0 && (
          <div className="flex flex-col gap-1 mb-4">
            {bp.steps_config.slice(0, 3).map((s) => (
              <div
                key={s.id}
                className="flex items-center gap-1.5 text-[11px] text-muted-foreground"
              >
                <Circle className="size-2 shrink-0" />
                {s.label}
              </div>
            ))}
            {stepCount > 3 && (
              <div className="text-[11px] text-muted-foreground/60 pl-3.5">
                +{stepCount - 3} more steps
              </div>
            )}
          </div>
        )}

        <div className="mt-auto">
          <button
            onClick={() => onRun(bp)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition"
          >
            <Play className="size-3.5" />
            Run blueprint
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Dynamic input form ────────────────────────────────────────────────────────

function InputField({
  input,
  value,
  onChange,
  workspaceSlug,
}: {
  input: BlueprintInput;
  value: string;
  onChange: (v: string) => void;
  workspaceSlug: string;
}) {
  const { data: environments = [] } = useEnvironments(workspaceSlug);

  if (input.type === "env_select") {
    return (
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
          {input.label} {input.required && <span className="text-destructive">*</span>}
        </label>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-3 py-2.5 rounded-md bg-secondary border border-border focus:border-primary outline-none transition text-sm"
        >
          <option value="">Select environment…</option>
          {environments.map((env) => (
            <option key={env.id} value={`${env.id}|${env.slug}`}>
              {env.name}
            </option>
          ))}
        </select>
        {input.help_text && (
          <p className="text-[11px] text-muted-foreground mt-1">{input.help_text}</p>
        )}
      </div>
    );
  }

  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
        {input.label} {input.required && <span className="text-destructive">*</span>}
      </label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={input.placeholder ?? ""}
        className="w-full px-3 py-2.5 rounded-md bg-secondary border border-border focus:border-primary outline-none transition text-sm font-mono"
      />
      {input.help_text && (
        <p className="text-[11px] text-muted-foreground mt-1">{input.help_text}</p>
      )}
    </div>
  );
}

// ─── Live execution view ───────────────────────────────────────────────────────

function ExecutionView({
  runId,
  workspaceSlug,
  onClose,
}: {
  runId: string;
  workspaceSlug: string;
  onClose: () => void;
}) {
  const isActive = (status: string) => status === "pending" || status === "running";

  const { data: run } = useBlueprintRun(workspaceSlug, runId, true);

  const isRunning = run ? isActive(run.status) : true;

  useEffect(() => {
    if (run && !isRunning) {
      if (run.status === "completed") {
        toast.success(`Blueprint completed`, {
          description: `${run.blueprint_name} finished successfully.`,
        });
      }
    }
  }, [run, isRunning]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isRunning ? (
            <Loader2 className="size-4 animate-spin text-primary" />
          ) : run?.status === "completed" ? (
            <CheckCircle2 className="size-4 text-emerald-500" />
          ) : (
            <XCircle className="size-4 text-destructive" />
          )}
          <span className="text-sm font-medium">
            {isRunning
              ? "Running automation…"
              : run?.status === "completed"
                ? "Completed"
                : "Failed"}
          </span>
        </div>
        {run && <RunStatusBadge status={run.status} />}
      </div>

      <div className="space-y-2">
        {(run?.steps ?? []).map((step: BlueprintRunStep, i: number) => (
          <div
            key={step.id}
            className={`rounded-lg border p-3 transition ${
              step.status === "running"
                ? "border-primary/40 bg-primary/5"
                : step.status === "completed"
                  ? "border-emerald-500/30 bg-emerald-500/5"
                  : step.status === "failed"
                    ? "border-destructive/30 bg-destructive/5"
                    : "border-border bg-muted/20"
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground/60 w-4 shrink-0 text-right tabular-nums">
                {i + 1}
              </span>
              <StepStatusIcon status={step.status} />
              <span className="text-sm font-medium flex-1">{step.label}</span>
              {step.started_at && step.completed_at && (
                <span className="text-[11px] text-muted-foreground tabular-nums">
                  {Math.round(
                    (new Date(step.completed_at).getTime() - new Date(step.started_at).getTime()) /
                      1000,
                  )}
                  s
                </span>
              )}
            </div>

            {step.status === "failed" && step.error && (
              <div className="mt-2 ml-10 text-[11px] text-destructive bg-destructive/10 rounded px-2 py-1">
                {step.error}
              </div>
            )}

            {step.status === "completed" && Object.keys(step.output ?? {}).length > 0 && (
              <div className="mt-2 ml-10 flex flex-wrap gap-2">
                {Object.entries(step.output).map(([k, v]) => (
                  <span
                    key={k}
                    className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground font-mono"
                  >
                    {k}: {String(v)}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}

        {(!run || run.steps.length === 0) && (
          <div className="flex items-center gap-2 py-4 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" /> Initializing steps…
          </div>
        )}
      </div>

      {!isRunning && (
        <div className="pt-2 border-t border-border">
          <button
            onClick={onClose}
            className="w-full py-2 rounded-md bg-secondary hover:bg-accent text-sm transition"
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Run blueprint dialog ──────────────────────────────────────────────────────

function RunBlueprintDialog({
  open,
  blueprint,
  onClose,
  workspaceSlug,
}: {
  open: boolean;
  blueprint: Blueprint | null;
  onClose: () => void;
  workspaceSlug: string;
}) {
  // "inputs" | "review" | "running"
  const [stage, setStage] = useState<"inputs" | "review" | "running">("inputs");
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [activeRunId, setActiveRunId] = useState<string | null>(null);

  const triggerMutation = useTriggerBlueprintRun(workspaceSlug);

  useEffect(() => {
    if (open && blueprint) {
      const defaults: Record<string, string> = {};
      for (const input of blueprint.inputs_schema ?? []) {
        defaults[input.key] = input.default ?? "";
      }
      setFieldValues(defaults);
      setStage("inputs");
      setActiveRunId(null);
    }
  }, [open, blueprint]);

  if (!blueprint) return null;

  const inputs = blueprint.inputs_schema ?? [];
  const steps = blueprint.steps_config ?? [];

  const canProceed = inputs.filter((i) => i.required).every((i) => fieldValues[i.key]?.trim());

  const handleRun = async () => {
    const parsedInputs: Record<string, unknown> = {};
    let environmentId = "";
    let environmentSlug = "";

    for (const [k, v] of Object.entries(fieldValues)) {
      const inputDef = inputs.find((i) => i.key === k);
      if (inputDef?.type === "env_select" && v.includes("|")) {
        const [id, slug] = v.split("|");
        environmentId = id;
        environmentSlug = slug;
        parsedInputs["environment"] = slug;
      } else {
        parsedInputs[k] = v;
      }
    }

    try {
      const run = await triggerMutation.mutateAsync({
        blueprint_name: blueprint.name,
        environment_id: environmentId,
        environment_slug: environmentSlug,
        inputs: parsedInputs,
      });
      setActiveRunId(run.id);
      setStage("running");
    } catch (err: unknown) {
      toast.error(extractError(err, "Failed to trigger blueprint"));
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BlueprintIcon icon={blueprint.icon} className="size-4 text-muted-foreground" />
            {blueprint.display_name}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-1">
          {/* Stage: inputs */}
          {stage === "inputs" && (
            <div className="space-y-5">
              <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground leading-relaxed">
                {blueprint.description}
              </div>

              {inputs.length > 0 ? (
                inputs.map((input) => (
                  <InputField
                    key={input.key}
                    input={input}
                    value={fieldValues[input.key] ?? ""}
                    onChange={(v) => setFieldValues((prev) => ({ ...prev, [input.key]: v }))}
                    workspaceSlug={workspaceSlug}
                  />
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  This blueprint requires no inputs. Click Review to proceed.
                </p>
              )}
            </div>
          )}

          {/* Stage: review */}
          {stage === "review" && (
            <div className="space-y-4">
              <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2">
                <p className="text-xs font-medium text-muted-foreground mb-2">Configured inputs</p>
                {Object.entries(fieldValues)
                  .filter(([, v]) => v)
                  .map(([k, v]) => {
                    const inputDef = inputs.find((i) => i.key === k);
                    const display =
                      inputDef?.type === "env_select" && v.includes("|") ? v.split("|")[1] : v;
                    return (
                      <div key={k} className="flex items-center gap-2 text-xs">
                        <span className="text-muted-foreground w-32 shrink-0">
                          {inputDef?.label ?? k}
                        </span>
                        <span className="font-mono">{display}</span>
                      </div>
                    );
                  })}
              </div>

              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  {steps.length} step{steps.length !== 1 ? "s" : ""} will execute
                </p>
                <div className="space-y-2">
                  {steps.map((s, i) => (
                    <div
                      key={s.id}
                      className="flex items-start gap-2 rounded-lg border border-border bg-muted/20 p-3"
                    >
                      <span className="text-[11px] text-muted-foreground/60 w-5 shrink-0 text-right tabular-nums mt-0.5">
                        {i + 1}
                      </span>
                      <Circle className="size-3.5 text-muted-foreground/50 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium">{s.label}</p>
                        {s.description && (
                          <p className="text-xs text-muted-foreground mt-0.5">{s.description}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <p className="text-[11px] text-muted-foreground">
                The platform will execute these steps sequentially. On failure, execution stops at
                the failing step.
              </p>
            </div>
          )}

          {/* Stage: running */}
          {stage === "running" && activeRunId && (
            <ExecutionView runId={activeRunId} workspaceSlug={workspaceSlug} onClose={onClose} />
          )}
        </div>

        {stage !== "running" && (
          <DialogFooter className="pt-4 border-t border-border mt-2">
            <button
              type="button"
              onClick={stage === "inputs" ? onClose : () => setStage("inputs")}
              className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-secondary hover:bg-accent text-sm transition"
            >
              {stage === "inputs" ? (
                <>
                  <X className="size-3.5" /> Cancel
                </>
              ) : (
                <>
                  <ArrowLeft className="size-3.5" /> Back
                </>
              )}
            </button>

            {stage === "inputs" && (
              <button
                type="button"
                onClick={() => setStage("review")}
                disabled={!canProceed}
                className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition disabled:opacity-60"
              >
                <ChevronRight className="size-3.5" />
                Review
              </button>
            )}

            {stage === "review" && (
              <button
                type="button"
                onClick={() => void handleRun()}
                disabled={triggerMutation.isPending}
                className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition disabled:opacity-60"
              >
                {triggerMutation.isPending ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Play className="size-3.5" />
                )}
                Run blueprint
              </button>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Runs history tab ──────────────────────────────────────────────────────────

function RunsHistory({ workspaceSlug }: { workspaceSlug: string }) {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useBlueprintRuns(workspaceSlug, page, 20);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  const runs = data?.items ?? [];
  const totalPages = data ? Math.max(1, Math.ceil(data.total / 20)) : 1;

  return (
    <div>
      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading runs…
        </div>
      ) : runs.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <RotateCcw className="size-8 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No blueprint runs yet.</p>
          <p className="text-xs mt-1">Run a blueprint to see execution history here.</p>
        </div>
      ) : (
        <>
          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">
                    Blueprint
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">
                    Environment
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">
                    Status
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">
                    Started
                  </th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {runs.map((run) => (
                  <tr key={run.id} className="hover:bg-muted/20 transition">
                    <td className="px-4 py-3 font-medium">{run.blueprint_name}</td>
                    <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                      {run.environment_slug || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <RunStatusBadge status={run.status} />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {relativeTime(run.created_at)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setSelectedRunId(run.id)}
                        className="text-xs text-primary hover:underline"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-end gap-2 mt-3">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 rounded text-xs bg-secondary hover:bg-accent disabled:opacity-40 transition"
              >
                Prev
              </button>
              <span className="text-xs text-muted-foreground tabular-nums">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 rounded text-xs bg-secondary hover:bg-accent disabled:opacity-40 transition"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}

      {/* Run detail dialog */}
      <Dialog
        open={!!selectedRunId}
        onOpenChange={(v) => {
          if (!v) setSelectedRunId(null);
        }}
      >
        <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="size-4 text-muted-foreground" />
              Run detail
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-1">
            {selectedRunId && <RunDetail runId={selectedRunId} workspaceSlug={workspaceSlug} />}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RunDetail({ runId, workspaceSlug }: { runId: string; workspaceSlug: string }) {
  const isActive = (s: string) => s === "pending" || s === "running";
  const { data: run, isLoading } = useBlueprintRun(workspaceSlug, runId, true);

  if (isLoading || !run) {
    return (
      <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Loading…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1.5 text-xs">
        {[
          ["Blueprint", run.blueprint_name],
          ["Environment", run.environment_slug || "—"],
          ["Status", run.status],
          ["Started", relativeTime(run.created_at)],
        ].map(([k, v]) => (
          <div key={k} className="flex items-center gap-2">
            <span className="text-muted-foreground w-24 shrink-0">{k}</span>
            <span className="font-mono">{v}</span>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        {run.steps.map((step: BlueprintRunStep, i: number) => (
          <div
            key={step.id}
            className={`rounded-lg border p-3 ${
              step.status === "running"
                ? "border-primary/40 bg-primary/5"
                : step.status === "completed"
                  ? "border-emerald-500/30 bg-emerald-500/5"
                  : step.status === "failed"
                    ? "border-destructive/30 bg-destructive/5"
                    : "border-border bg-muted/20"
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground/60 w-4 shrink-0 text-right tabular-nums">
                {i + 1}
              </span>
              <StepStatusIcon status={step.status} />
              <span className="text-sm font-medium flex-1">{step.label}</span>
              {isActive(step.status) && (
                <span className="text-[11px] text-primary animate-pulse">running</span>
              )}
            </div>
            {step.status === "failed" && step.error && (
              <div className="mt-2 ml-10 text-[11px] text-destructive bg-destructive/10 rounded px-2 py-1">
                {step.error}
              </div>
            )}
            {step.status === "completed" && Object.keys(step.output ?? {}).length > 0 && (
              <div className="mt-2 ml-10 flex flex-wrap gap-1.5">
                {Object.entries(step.output).map(([k, v]) => (
                  <span
                    key={k}
                    className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground font-mono"
                  >
                    {k}: {String(v)}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

const CATEGORY_ORDER = ["provision", "bootstrap", "devops", "environment", "operate"];

function BlueprintsPage() {
  const { selectedWorkspace } = useWorkspaceContext();
  const workspaceSlug = selectedWorkspace?.slug ?? "";

  const { data: blueprints, isLoading, error } = useBlueprints(workspaceSlug);
  const [activeTab, setActiveTab] = useState<"catalog" | "runs">("catalog");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [running, setRunning] = useState<Blueprint | null>(null);

  const filtered = useMemo(() => {
    const all = blueprints ?? [];
    return all.filter((bp) => {
      const matchSearch =
        !search ||
        bp.display_name.toLowerCase().includes(search.toLowerCase()) ||
        bp.description?.toLowerCase().includes(search.toLowerCase());
      const matchCat = categoryFilter === "all" || bp.category === categoryFilter;
      return matchSearch && matchCat;
    });
  }, [blueprints, search, categoryFilter]);

  const grouped = useMemo(() => {
    const map: Record<string, Blueprint[]> = {};
    for (const bp of filtered) {
      if (!map[bp.category]) map[bp.category] = [];
      map[bp.category].push(bp);
    }
    return map;
  }, [filtered]);

  const orderedCategories = CATEGORY_ORDER.filter((c) => grouped[c]?.length > 0);
  const presentCategories = [...new Set((blueprints ?? []).map((b) => b.category))];

  return (
    <div className="flex flex-col h-full">
      <DashboardTopbar
        title="Blueprints"
        subtitle="Automation workflows for common platform tasks — provision services, bootstrap projects, configure environments"
      />

      <div className="flex-1 overflow-auto p-6">
        {/* Tabs */}
        <div className="flex items-center gap-1 mb-6 border-b border-border">
          {(["catalog", "runs"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium transition border-b-2 -mb-px ${
                activeTab === tab
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab === "catalog" ? "Blueprints" : "Runs"}
            </button>
          ))}
        </div>

        {/* Catalog tab */}
        {activeTab === "catalog" && (
          <>
            {/* Search + filter bar */}
            <div className="flex items-center gap-3 mb-6 flex-wrap">
              <div className="relative flex-1 min-w-48">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search automations…"
                  className="w-full pl-8 pr-3 py-2 rounded-md bg-secondary border border-border focus:border-primary outline-none transition text-sm"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setCategoryFilter("all")}
                  className={`px-3 py-1.5 rounded text-xs font-medium transition ${
                    categoryFilter === "all"
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-muted-foreground hover:bg-accent"
                  }`}
                >
                  All
                </button>
                {presentCategories.map((cat) => {
                  const meta = CATEGORIES[cat];
                  return (
                    <button
                      key={cat}
                      onClick={() => setCategoryFilter(cat)}
                      className={`px-3 py-1.5 rounded text-xs font-medium transition ${
                        categoryFilter === cat
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary text-muted-foreground hover:bg-accent"
                      }`}
                    >
                      {meta?.label ?? cat}
                    </button>
                  );
                })}
              </div>
            </div>

            {isLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Loading blueprints…
              </div>
            ) : error ? (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="size-4" /> {(error as ApiError).message}
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <Search className="size-8 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No blueprints match your search.</p>
              </div>
            ) : (
              <div className="space-y-8">
                {orderedCategories.map((cat) => {
                  const meta = CATEGORIES[cat];
                  return (
                    <section key={cat}>
                      <div className="mb-4">
                        <div className="flex items-center gap-2 mb-1">
                          <h2 className="text-base font-semibold">{meta?.label ?? cat}</h2>
                          <span className="text-xs px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground tabular-nums">
                            {grouped[cat].length}
                          </span>
                        </div>
                        {meta?.description && (
                          <p className="text-sm text-muted-foreground">{meta.description}</p>
                        )}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                        {grouped[cat].map((bp) => (
                          <BlueprintCard key={bp.id} bp={bp} onRun={setRunning} />
                        ))}
                      </div>
                    </section>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* Runs tab */}
        {activeTab === "runs" && <RunsHistory workspaceSlug={workspaceSlug} />}
      </div>

      <RunBlueprintDialog
        open={!!running}
        blueprint={running}
        onClose={() => setRunning(null)}
        workspaceSlug={workspaceSlug}
      />
    </div>
  );
}
