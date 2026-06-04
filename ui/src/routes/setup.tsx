import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { isAuthenticated } from "@/lib/auth";
import { WorkspaceProvider, useWorkspaceContext } from "@/lib/workspace-context";
import {
  useWorkspacesMine,
  useCreateWorkspace,
  useCreateEnvironment,
  useBindProvider,
  useCatalog,
  useDeployService,
  useCapabilities,
  useEnvironments,
} from "@/lib/queries";
import {
  CheckCircle2,
  ChevronRight,
  Server,
  Globe,
  Layers,
  Rocket,
  ArrowLeft,
  ArrowRight,
  Loader2,
  SkipForward,
  Building2,
} from "lucide-react";
import { useState, useEffect } from "react";

// ─── Setup visited flag ───────────────────────────────────────────────────────

const SETUP_VISITED_KEY = "tc_setup_visited";

export function markSetupVisited() {
  try { localStorage.setItem(SETUP_VISITED_KEY, "1"); } catch { /* ignore */ }
}

export function hasSetupBeenVisited(): boolean {
  try { return !!localStorage.getItem(SETUP_VISITED_KEY); } catch { return false; }
}

// ─── Route ────────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/setup")({
  head: () => ({ meta: [{ title: "Get started · TernakClouds" }] }),
  beforeLoad: () => {
    if (typeof window !== "undefined" && !isAuthenticated()) {
      throw redirect({ to: "/login" });
    }
  },
  component: SetupShell,
});

// ─── Shell ────────────────────────────────────────────────────────────────────

function SetupShell() {
  return (
    <WorkspaceProvider>
      <SetupPage />
    </WorkspaceProvider>
  );
}

// ─── Step types ───────────────────────────────────────────────────────────────

// Steps: workspace → environment (optional) → runtime (optional) → service (optional) → done
// "workspace" only appears when the user has no workspace yet.
// "environment" is optional — user can create environments from the dashboard later.

type Step = "workspace" | "environment" | "runtime" | "service" | "done";

const STEP_META: { id: Step; label: string; icon: React.ElementType }[] = [
  { id: "workspace",   label: "Workspace",   icon: Building2 },
  { id: "environment", label: "Environment", icon: Globe },
  { id: "runtime",     label: "Runtime",     icon: Server },
  { id: "service",     label: "Service",     icon: Layers },
];

// ─── Progress indicator ───────────────────────────────────────────────────────

function StepProgress({
  visibleSteps,
  current,
  completed,
}: {
  visibleSteps: Step[];
  current: Step;
  completed: Step[];
}) {
  if (current === "done") return null;

  const steps = STEP_META.filter((s) => visibleSteps.includes(s.id));

  return (
    <div className="w-full max-w-lg mx-auto mb-8">
      <div className="flex items-center justify-between mb-3">
        {steps.map((s, i) => {
          const isDone    = completed.includes(s.id);
          const isCurrent = s.id === current;
          const Icon      = s.icon;
          return (
            <div key={s.id} className="flex items-center gap-1.5">
              <div
                className={`size-6 rounded-full grid place-items-center text-xs font-bold transition-colors ${
                  isDone    ? "bg-success text-success-foreground"   :
                  isCurrent ? "bg-primary text-primary-foreground"   :
                              "bg-secondary text-muted-foreground"
                }`}
              >
                {isDone ? <CheckCircle2 className="size-3.5" /> : <Icon className="size-3" />}
              </div>
              <span className={`text-xs font-medium hidden sm:block ${
                isCurrent ? "text-foreground" : isDone ? "text-success" : "text-muted-foreground"
              }`}>
                {s.label}
              </span>
              {i < steps.length - 1 && (
                <div className={`w-12 h-px mx-2 ${isDone ? "bg-success" : "bg-border"}`} />
              )}
            </div>
          );
        })}
      </div>
      <div className="h-1 bg-secondary rounded-full overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all duration-500"
          style={{
            width: `${Math.round(
              ((steps.findIndex((s) => s.id === current) + 0.5) / steps.length) * 100
            )}%`,
          }}
        />
      </div>
    </div>
  );
}

// ─── Card + nav buttons ───────────────────────────────────────────────────────

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="glass rounded-2xl p-8 w-full max-w-lg mx-auto">
      {children}
    </div>
  );
}

function NavButtons({
  onBack,
  onNext,
  nextLabel = "Continue",
  nextIcon: NextIcon = ArrowRight,
  onSkip,
  loading,
  disabled,
}: {
  onBack?: () => void;
  onNext: () => void;
  nextLabel?: string;
  nextIcon?: React.ElementType;
  onSkip?: () => void;
  loading?: boolean;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between mt-6">
      {onBack ? (
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition"
        >
          <ArrowLeft className="size-3.5" /> Back
        </button>
      ) : <div />}

      <div className="flex items-center gap-3">
        {onSkip && (
          <button
            onClick={onSkip}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition"
          >
            <SkipForward className="size-3.5" /> Skip for now
          </button>
        )}
        <button
          onClick={onNext}
          disabled={disabled || loading}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition font-medium text-sm disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <>{nextLabel}<NextIcon className="size-4" /></>
          )}
        </button>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

function SetupPage() {
  const navigate   = useNavigate();
  const { setSelectedWorkspace } = useWorkspaceContext();

  const { data: workspaces, isLoading: workspacesLoading } = useWorkspacesMine();
  const slug          = workspaces?.[0]?.slug ?? "";
  const { data: envs } = useEnvironments(slug);
  const firstEnvSlug  = envs?.[0]?.slug ?? "";
  const { data: caps, isLoading: capsLoading } = useCapabilities(slug, firstEnvSlug);

  const hasWorkspace = (workspaces?.length ?? 0) > 0;
  const hasRuntime   = caps
    ? caps.some((c) => c.capability_name === "runtime" && (c.providers ?? []).length > 0)
    : null;

  // The provider_name the user bound in the Runtime step (e.g. "kubernetes", "nomad", "docker").
  // Used to pass the correct runtime_provider when deploying in the Service step.
  const existingRuntimeProvider =
    caps
      ?.find((c) => c.capability_name === "runtime" && (c.providers ?? []).length > 0)
      ?.providers[0] ?? null;

  const connectedRuntimeProvider = existingRuntimeProvider?.provider_name ?? "";

  const [step, setStep]           = useState<Step | null>(null); // null = detecting
  const [completed, setCompleted] = useState<Step[]>([]);

  // ── Detect where to start ──────────────────────────────────────────────────
  // Called once when all queries settle. Skips steps that are already done so
  // returning to /setup always puts the user at the right uncompleted step.
  useEffect(() => {
    if (workspacesLoading || capsLoading || step !== null) return;

    if (!hasWorkspace) {
      setStep("workspace");
      return;
    }

    // Workspace exists — mark it done
    setCompleted((p) => (p.includes("workspace") ? p : [...p, "workspace"]));

    // Sync context
    if (workspaces?.length) setSelectedWorkspace(workspaces[0]);

    if (!hasRuntime) {
      // If envs exist (created manually or from a previous wizard run) skip
      // the environment step and go straight to runtime.
      if ((envs?.length ?? 0) > 0) {
        setCompleted((p) => (p.includes("environment") ? p : [...p, "environment"]));
      }
      setStep(envs?.length ? "runtime" : "environment");
      return;
    }

    setCompleted((p) => (p.includes("environment") ? p : [...p, "environment"]));
    setCompleted((p) => (p.includes("runtime") ? p : [...p, "runtime"]));
    setStep("service");
  }, [workspacesLoading, capsLoading, hasWorkspace, hasRuntime, envs, step, workspaces, setSelectedWorkspace]);

  // ── Visible steps for progress bar ────────────────────────────────────────
  const visibleSteps: Step[] = hasWorkspace
    ? ["environment", "runtime", "service"]
    : ["workspace", "environment", "runtime", "service"];

  const markDone = (s: Step) =>
    setCompleted((p) => (p.includes(s) ? p : [...p, s]));

  const goToDashboard = () => {
    markSetupVisited();
    void navigate({ to: "/dashboard" });
  };

  // ── Loading / detecting ────────────────────────────────────────────────────
  if (workspacesLoading || capsLoading || step === null) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background grid-bg flex flex-col">
      {/* Minimal topbar */}
      <header className="h-12 flex items-center px-6 border-b border-border bg-sidebar shrink-0">
        <div className="flex items-center gap-2">
          <div className="size-6 rounded bg-[image:var(--gradient-primary)] grid place-items-center">
            <svg viewBox="0 0 16 16" className="size-3.5 text-white fill-current">
              <path d="M8 2C5.8 2 4 3.8 4 6c0 .4.1.8.2 1.1C2.9 7.5 2 8.6 2 10c0 1.7 1.3 3 3 3h7c1.7 0 3-1.3 3-3 0-1.4-.9-2.5-2.2-2.9C12.9 6.8 13 6.4 13 6c0-2.2-1.8-4-4-4zm0 1.5c1.4 0 2.5 1.1 2.5 2.5 0 .3-.1.6-.2.8l-.3.7.7.2c.9.3 1.5 1.1 1.5 2C12.2 10.9 11.3 11.5 10.2 11.5H5C4.1 11.5 3.5 10.8 3.5 10c0-.8.5-1.6 1.3-1.8l.8-.2-.3-.8C5.1 6.9 5 6.5 5 6c0-1.4 1.1-2.5 3-2.5z" />
            </svg>
          </div>
          <span className="font-semibold text-sm tracking-tight">
            Ternak<span className="text-primary">Clouds</span>
          </span>
        </div>
        <div className="flex-1" />
        <button
          onClick={goToDashboard}
          className="text-xs text-muted-foreground hover:text-foreground transition"
        >
          Go to dashboard →
        </button>
      </header>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <StepProgress visibleSteps={visibleSteps} current={step} completed={completed} />

        {step === "workspace" && (
          <WorkspaceStep
            existing={workspaces?.[0]}
            onDone={(ws) => {
              setSelectedWorkspace(ws);
              markDone("workspace");
              setStep("environment");
            }}
          />
        )}

        {step === "environment" && (
          <EnvironmentStep
            slug={slug}
            existing={envs?.[0]}
            onBack={() => setStep("workspace")}
            onDone={(envSlug) => {
              markDone("environment");
              setStep("runtime");
            }}
            onSkip={() => setStep("runtime")}
          />
        )}

        {step === "runtime" && (
          <RuntimeStep
            slug={slug}
            envSlug={firstEnvSlug}
            existing={existingRuntimeProvider}
            onBack={() => setStep("environment")}
            onDone={() => {
              markDone("runtime");
              setStep("service");
            }}
            onSkip={() => setStep("service")}
          />
        )}

        {step === "service" && (
          <ServiceStep
            slug={slug}
            envSlug={firstEnvSlug}
            runtimeProvider={connectedRuntimeProvider}
            onBack={() => setStep("runtime")}
            onDone={() => {
              markDone("service");
              setStep("done");
            }}
            onSkip={() => setStep("done")}
          />
        )}

        {step === "done" && (
          <DoneStep completed={completed} onGo={goToDashboard} />
        )}
      </div>
    </div>
  );
}

// ─── Step: Workspace ──────────────────────────────────────────────────────────

function WorkspaceStep({
  existing,
  onDone,
}: {
  existing?: import("@/lib/types").Workspace;
  onDone: (ws: import("@/lib/types").Workspace) => void;
}) {
  const [name, setName]   = useState("");
  const [error, setError] = useState("");
  const createWs = useCreateWorkspace();

  // ── Already created — show summary and let user continue ──────────────────
  if (existing) {
    return (
      <Card>
        <div className="mb-6">
          <div className="label-mono text-muted-foreground mb-1">Step 1</div>
          <h2 className="text-xl font-bold">Workspace</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Your workspace is ready. Continue to the next step.
          </p>
        </div>

        <div className="p-4 rounded-lg bg-success/10 border border-success/20 flex items-center gap-3 mb-4">
          <CheckCircle2 className="size-5 text-success shrink-0" />
          <div>
            <div className="text-sm font-semibold">{existing.name}</div>
            <div className="text-xs text-muted-foreground font-mono">{existing.slug}</div>
          </div>
        </div>

        <NavButtons
          onNext={() => onDone(existing)}
          nextLabel="Continue"
        />
      </Card>
    );
  }

  // ── Creation form ─────────────────────────────────────────────────────────
  const submit = async () => {
    if (!name.trim()) { setError("Workspace name is required"); return; }
    setError("");
    try {
      const ws = await createWs.mutateAsync({ name: name.trim() });
      onDone(ws);
    } catch (e: unknown) {
      setError((e as { message?: string })?.message ?? "Failed to create workspace. Try again.");
    }
  };

  return (
    <Card>
      <div className="mb-6">
        <div className="label-mono text-muted-foreground mb-1">Step 1</div>
        <h2 className="text-xl font-bold">Create your workspace</h2>
        <p className="text-sm text-muted-foreground mt-1">
          A workspace contains all your services, environments, and team members.
          This is usually your company or project name.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium block mb-1.5">Workspace name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void submit()}
            placeholder="Acme Corp"
            autoFocus
            className="w-full px-3 py-2.5 rounded-lg bg-input border border-border text-sm outline-none focus:border-primary/50 transition"
          />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="p-3 rounded-lg bg-secondary/50 text-xs text-muted-foreground">
          💡 You'll create environments manually in the next steps.
        </div>
      </div>

      <NavButtons
        onNext={submit}
        nextLabel="Create workspace"
        loading={createWs.isPending}
        disabled={!name.trim()}
      />
    </Card>
  );
}

// ─── Step: Environment ───────────────────────────────────────────────────────

function EnvironmentStep({
  slug,
  existing,
  onBack,
  onDone,
  onSkip,
}: {
  slug: string;
  existing?: import("@/lib/types").WorkspaceEnvironment;
  onBack?: () => void;
  onDone: (envSlug: string) => void;
  onSkip: () => void;
}) {
  const [name, setName]         = useState("Development");
  const [description, setDesc]  = useState("");
  const [error, setError]       = useState("");

  const createEnv = useCreateEnvironment();

  // ── Already created — show summary and let user continue ──────────────────
  if (existing) {
    return (
      <Card>
        <div className="mb-6">
          <div className="label-mono text-muted-foreground mb-1">
            Step — <span className="text-warning">Optional</span>
          </div>
          <h2 className="text-xl font-bold">Environment</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Your environment is ready. Continue to the next step.
          </p>
        </div>

        <div className="p-4 rounded-lg bg-success/10 border border-success/20 flex items-center gap-3 mb-4">
          <CheckCircle2 className="size-5 text-success shrink-0" />
          <div>
            <div className="text-sm font-semibold">{existing.name}</div>
            <div className="text-xs text-muted-foreground font-mono">{existing.slug}</div>
          </div>
        </div>

        <NavButtons
          onBack={onBack}
          onNext={() => onDone(existing.slug)}
          nextLabel="Continue"
        />
      </Card>
    );
  }

  // ── Creation form ─────────────────────────────────────────────────────────
  const submit = async () => {
    if (!name.trim()) { setError("Name is required"); return; }
    setError("");
    try {
      const env = await createEnv.mutateAsync({
        slug,
        input: { name: name.trim(), description: description.trim() || undefined },
      });
      onDone(env.slug);
    } catch (e: unknown) {
      setError((e as { message?: string })?.message ?? "Failed to create environment. Try again.");
    }
  };

  return (
    <Card>
      <div className="mb-6">
        <div className="label-mono text-muted-foreground mb-1">
          Step — <span className="text-warning">Optional</span>
        </div>
        <h2 className="text-xl font-bold">Create an environment</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Environments are where your services run — Development, Staging, Production.
          You can create more from the dashboard later.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium block mb-1.5">Environment name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !createEnv.isPending && void submit()}
            placeholder="Development"
            autoFocus
            className="w-full px-3 py-2.5 rounded-lg bg-input border border-border text-sm outline-none focus:border-primary/50 transition"
          />
        </div>

        <div>
          <label className="text-sm font-medium block mb-1.5 text-muted-foreground">
            Description <span className="font-normal">(optional)</span>
          </label>
          <input
            value={description}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="Local development environment"
            className="w-full px-3 py-2.5 rounded-lg bg-input border border-border text-sm outline-none focus:border-primary/50 transition"
          />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="p-3 rounded-lg bg-secondary/50 text-xs text-muted-foreground">
          💡 You can add more environments (Staging, Production) anytime from Platform settings.
        </div>
      </div>

      <NavButtons
        onBack={onBack}
        onNext={submit}
        nextLabel="Create & continue"
        loading={createEnv.isPending}
        disabled={!name.trim()}
        onSkip={onSkip}
      />
    </Card>
  );
}

// ─── Step: Runtime ────────────────────────────────────────────────────────────

type RuntimeType = "kubernetes" | "nomad" | "docker";

const RUNTIME_OPTIONS: { type: RuntimeType; icon: string; label: string; desc: string }[] = [
  { type: "kubernetes", icon: "☸",  label: "Kubernetes", desc: "GKE, EKS, AKS, self-hosted" },
  { type: "nomad",      icon: "📦", label: "Nomad",      desc: "HashiCorp Nomad cluster" },
  { type: "docker",     icon: "🐳", label: "Docker",     desc: "Docker host or Compose" },
];

function RuntimeStep({
  slug,
  envSlug,
  existing,
  onBack,
  onDone,
  onSkip,
}: {
  slug: string;
  envSlug: string;
  existing?: import("@/lib/types").ProviderConfigResponse | null;
  onBack?: () => void;
  onDone: () => void;
  onSkip: () => void;
}) {
  const [runtimeType, setRuntimeType] = useState<RuntimeType>("kubernetes");
  const [endpoint, setEndpoint]       = useState("");
  const [token, setToken]             = useState("");
  const [namespace, setNamespace]     = useState("");
  const [error, setError]             = useState("");

  const bindProvider = useBindProvider();

  // ── Already connected — show summary and let user continue ────────────────
  if (existing) {
    const iconMap: Record<string, string> = {
      kubernetes: "☸",
      nomad:      "📦",
      docker:     "🐳",
    };
    const icon = iconMap[existing.provider_name] ?? "⚡";

    return (
      <Card>
        <div className="mb-6">
          <div className="label-mono text-muted-foreground mb-1">
            Step 2 — <span className="text-warning">Optional</span>
          </div>
          <h2 className="text-xl font-bold">Runtime</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Your runtime is connected. Continue to the next step.
          </p>
        </div>

        <div className="p-4 rounded-lg bg-success/10 border border-success/20 flex items-center gap-3 mb-4">
          <CheckCircle2 className="size-5 text-success shrink-0" />
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-xl">{icon}</span>
            <div className="min-w-0">
              <div className="text-sm font-semibold">{existing.display_name || existing.provider_name}</div>
              <div className="text-xs text-muted-foreground font-mono truncate">{existing.endpoint}</div>
            </div>
          </div>
        </div>

        <NavButtons
          onBack={onBack}
          onNext={onDone}
          nextLabel="Continue"
        />
      </Card>
    );
  }

  const submit = async () => {
    if (!endpoint.trim()) { setError("Endpoint is required"); return; }
    setError("");
    try {
      await bindProvider.mutateAsync({
        slug,
        envSlug,
        cap: "runtime",
        input: {
          provider_name: runtimeType,
          endpoint: endpoint.trim(),
          token: token.trim() || undefined,
          namespace: namespace.trim() || undefined,
        },
      });
      onDone();
    } catch (e: unknown) {
      setError((e as { message?: string })?.message ?? "Could not connect. Check your endpoint and credentials.");
    }
  };

  return (
    <Card>
      <div className="mb-6">
        <div className="label-mono text-muted-foreground mb-1">Step 2 — <span className="text-warning">Optional</span></div>
        <h2 className="text-xl font-bold">Connect a runtime</h2>
        <p className="text-sm text-muted-foreground mt-1">
          A runtime is where your services will run. You can connect this later from
          Platform settings if you're not ready yet.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-5">
        {RUNTIME_OPTIONS.map(({ type, icon, label, desc }) => (
          <button
            key={type}
            onClick={() => { setRuntimeType(type); setEndpoint(""); setToken(""); }}
            className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border transition text-center ${
              runtimeType === type
                ? "border-primary bg-primary/10"
                : "border-border bg-secondary/30 hover:border-primary/40"
            }`}
          >
            <span className="text-xl">{icon}</span>
            <span className="text-xs font-semibold">{label}</span>
            <span className="text-[10px] text-muted-foreground leading-tight">{desc}</span>
          </button>
        ))}
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-sm font-medium block mb-1.5">
            {runtimeType === "docker" ? "Docker daemon URL" : "API endpoint"}
          </label>
          <input
            value={endpoint}
            onChange={(e) => setEndpoint(e.target.value)}
            placeholder={
              runtimeType === "kubernetes" ? "https://k8s.example.com" :
              runtimeType === "nomad"      ? "http://nomad.example.com:4646" :
              "http://localhost:2375"
            }
            className="w-full px-3 py-2.5 rounded-lg bg-input border border-border text-sm font-mono outline-none focus:border-primary/50 transition"
          />
        </div>

        <div>
          <label className="text-sm font-medium block mb-1.5 text-muted-foreground">
            {runtimeType === "kubernetes" ? "Service account token" :
             runtimeType === "nomad"      ? "ACL token" :
             "TLS certificate"}{" "}
            <span className="font-normal">(optional)</span>
          </label>
          <input
            value={token}
            onChange={(e) => setToken(e.target.value)}
            type="password"
            placeholder="●●●●●●●●●●●●●●●●●●●"
            className="w-full px-3 py-2.5 rounded-lg bg-input border border-border text-sm font-mono outline-none focus:border-primary/50 transition"
          />
        </div>

        {runtimeType !== "docker" && (
          <div>
            <label className="text-sm font-medium block mb-1.5 text-muted-foreground">
              {runtimeType === "kubernetes" ? "Namespace" : "Datacenter"}{" "}
              <span className="font-normal">(optional, defaults to first available)</span>
            </label>
            <input
              value={namespace}
              onChange={(e) => setNamespace(e.target.value)}
              placeholder={runtimeType === "kubernetes" ? "default" : "dc1"}
              className="w-full px-3 py-2.5 rounded-lg bg-input border border-border text-sm font-mono outline-none focus:border-primary/50 transition"
            />
          </div>
        )}

        {runtimeType === "docker" && (
          <div className="p-3 rounded-lg bg-secondary/50 text-xs text-muted-foreground space-y-1">
            <p>💡 Docker must have its TCP socket enabled. To enable it, add the following to <span className="font-mono">/etc/docker/daemon.json</span>:</p>
            <pre className="font-mono bg-background/60 rounded px-2 py-1 text-[11px] select-all">{"{ \"hosts\": [\"unix:///var/run/docker.sock\", \"tcp://0.0.0.0:2375\"] }"}</pre>
            <p>Then restart Docker. Use <span className="font-mono">http://</span> (not <span className="font-mono">tcp://</span>) in the URL above.</p>
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>

      <NavButtons
        onBack={onBack}
        onNext={submit}
        nextLabel="Connect & continue"
        loading={bindProvider.isPending}
        disabled={!endpoint.trim()}
        onSkip={onSkip}
      />
    </Card>
  );
}

// ─── Step: Service ────────────────────────────────────────────────────────────

function ServiceStep({
  slug,
  envSlug,
  runtimeProvider,
  onBack,
  onDone,
  onSkip,
}: {
  slug: string;
  envSlug: string;
  runtimeProvider: string;
  onBack?: () => void;
  onDone: () => void;
  onSkip: () => void;
}) {
  const { data: catalog, isLoading } = useCatalog();
  const [selectedService, setSelectedService] = useState("");
  const [port, setPort]                       = useState("80");
  const [error, setError]                     = useState("");

  const deployService = useDeployService(slug, envSlug);

  useEffect(() => {
    if (catalog?.length && !selectedService) {
      setSelectedService(catalog[0].name);
      setPort(String(catalog[0].default_container_port || 80));
    }
  }, [catalog, selectedService]);

  const submit = async () => {
    if (!selectedService) { setError("Select a service"); return; }
    setError("");
    try {
      await deployService.mutateAsync({
        catalog_name: selectedService,
        job_name: `${selectedService}-${envSlug}`,
        runtime_provider: runtimeProvider,
        exposed_port: parseInt(port, 10) || 80,
      });
      onDone();
    } catch (e: unknown) {
      setError((e as { message?: string })?.message ?? "Deployment failed. Check your runtime connection.");
    }
  };

  return (
    <Card>
      <div className="mb-6">
        <div className="label-mono text-muted-foreground mb-1">Step 3 — <span className="text-warning">Optional</span></div>
        <h2 className="text-xl font-bold">Deploy your first service</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Deploy a service to verify your runtime connection works.
          You can deploy anytime from the Service Catalog.
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm py-8 justify-center">
          <Loader2 className="size-4 animate-spin" /> Loading catalog…
        </div>
      ) : (catalog ?? []).length === 0 ? (
        <div className="py-6 text-center text-sm text-muted-foreground">
          No services in catalog yet.
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium block mb-2">Choose a service</label>
            <div className="grid grid-cols-2 gap-2 max-h-44 overflow-auto pr-1">
              {(catalog ?? []).slice(0, 6).map((item) => (
                <button
                  key={item.name}
                  onClick={() => {
                    setSelectedService(item.name);
                    setPort(String(item.default_container_port || 80));
                  }}
                  className={`flex items-start gap-2.5 p-3 rounded-lg border text-left transition ${
                    selectedService === item.name
                      ? "border-primary bg-primary/10"
                      : "border-border bg-secondary/30 hover:border-primary/40"
                  }`}
                >
                  <div className="size-7 rounded bg-secondary grid place-items-center shrink-0 mt-0.5">
                    <Layers className="size-3.5 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold truncate">{item.display_name}</div>
                    <div className="text-[10px] text-muted-foreground font-mono truncate">{item.name}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="p-3 rounded-lg bg-secondary/50 text-xs text-muted-foreground">
            💡 Requires a connected runtime. If you skipped Step 2, deploy from the dashboard later.
          </div>
        </div>
      )}

      <NavButtons
        onBack={onBack}
        onNext={submit}
        nextLabel="Deploy"
        nextIcon={Rocket}
        loading={deployService.isPending}
        disabled={!selectedService}
        onSkip={onSkip}
      />
    </Card>
  );
}

// ─── Step: Done ───────────────────────────────────────────────────────────────

function DoneStep({
  completed,
  onGo,
}: {
  completed: Step[];
  onGo: () => void;
}) {
  const items = [
    { step: "workspace"   as Step, label: "Workspace created" },
    { step: "environment" as Step, label: "Environment created" },
    { step: "runtime"     as Step, label: "Runtime connected" },
    { step: "service"     as Step, label: "First service deployed" },
  ];

  const skipped = items.filter((i) => !completed.includes(i.step));

  return (
    <Card>
      <div className="text-center mb-8">
        <div className="size-16 rounded-2xl bg-success/20 grid place-items-center mx-auto mb-4">
          <CheckCircle2 className="size-8 text-success" />
        </div>
        <h1 className="text-2xl font-bold">You're set up!</h1>
        <p className="text-sm text-muted-foreground mt-2">
          {skipped.length > 0
            ? "Some optional steps were skipped. You can complete them anytime from the dashboard."
            : "Everything is configured and ready to go."}
        </p>
      </div>

      <div className="space-y-2 mb-8">
        {items.map(({ step, label }) => (
          <div
            key={step}
            className={`flex items-center gap-3 p-3 rounded-lg ${
              completed.includes(step) ? "bg-success/10" : "bg-secondary/30"
            }`}
          >
            {completed.includes(step) ? (
              <CheckCircle2 className="size-4 text-success shrink-0" />
            ) : (
              <div className="size-4 rounded-full border-2 border-border shrink-0" />
            )}
            <span className={`text-sm font-medium flex-1 ${
              completed.includes(step) ? "text-foreground" : "text-muted-foreground"
            }`}>
              {label}
            </span>
            {!completed.includes(step) && (
              <span className="text-[10px] label-mono text-muted-foreground">SKIPPED</span>
            )}
          </div>
        ))}
      </div>

      <button
        onClick={onGo}
        className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition font-medium"
      >
        Go to dashboard <ChevronRight className="size-4" />
      </button>
    </Card>
  );
}
