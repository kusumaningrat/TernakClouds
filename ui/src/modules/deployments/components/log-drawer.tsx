import { createPortal } from "react-dom";
import { useState, useRef, useEffect } from "react";
import { Terminal, X, Loader2 } from "lucide-react";
import type { DrawerTarget } from "../types";
import type { DockerContainerStub } from "@/lib/types";
import { useNomadAllocations, useK8sPods } from "@/lib/queries";
import {
  useNomadAllocLogStream,
  useK8sPodLogStream,
  useDockerLogStream,
} from "../hooks/use-log-streams";
import { LogTerminal } from "./log-terminal";

// ─── NomadLogsPanel ───────────────────────────────────────────────────────────

function NomadLogsPanel({
  slug,
  envSlug,
  jobId,
  namespace,
}: {
  slug: string;
  envSlug: string;
  jobId: string;
  namespace: string;
}) {
  const { data: allocations = [], isLoading } = useNomadAllocations(
    slug,
    envSlug,
    jobId,
    namespace,
    true,
  );
  const termRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);

  const runningAlloc =
    [...allocations]
      .filter((a) => a.ClientStatus === "running")
      .sort((a, b) => b.ModifyTime - a.ModifyTime)[0] ??
    [...allocations].sort((a, b) => b.ModifyTime - a.ModifyTime)[0];

  const tasks = runningAlloc ? Object.keys(runningAlloc.TaskStates ?? {}) : [];
  const [task, setTask] = useState("");
  const [logType, setLogType] = useState<"stdout" | "stderr">("stdout");

  const taskKey = tasks.join(",");
  useEffect(() => {
    if (!task && tasks.length > 0) setTask(tasks[0] ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskKey]);

  const { lines, connected, streamError, clear } = useNomadAllocLogStream({
    slug,
    envSlug,
    allocID: runningAlloc?.ID ?? "",
    task,
    logType,
    enabled: !!runningAlloc?.ID && !!task,
  });

  useEffect(() => {
    if (termRef.current && atBottomRef.current)
      termRef.current.scrollTop = termRef.current.scrollHeight;
  }, [lines]);

  const handleScroll = () => {
    if (!termRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = termRef.current;
    atBottomRef.current = scrollHeight - scrollTop - clientHeight < 60;
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center gap-2 text-muted-foreground text-sm">
        <Loader2 className="size-4 animate-spin" /> Loading allocations…
      </div>
    );
  }
  if (!runningAlloc) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
        No allocations found for this job.
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border shrink-0 flex-wrap">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-muted-foreground">Alloc</span>
          <span className="font-mono text-[11px] bg-secondary px-1.5 py-0.5 rounded border border-border">
            {runningAlloc.ID.slice(0, 8)}
          </span>
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
              runningAlloc.ClientStatus === "running"
                ? "bg-success/10 text-success"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {runningAlloc.ClientStatus}
          </span>
        </div>
        {tasks.length > 0 && (
          <select
            value={task}
            onChange={(e) => setTask(e.target.value)}
            className="text-xs px-2 py-1 rounded border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary/50"
          >
            {tasks.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        )}
        <div className="flex rounded-md border border-border overflow-hidden text-[11px]">
          {(["stdout", "stderr"] as const).map((lt) => (
            <button
              key={lt}
              onClick={() => setLogType(lt)}
              className={`px-2 py-1 font-mono transition ${
                logType === lt
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-accent text-muted-foreground"
              }`}
            >
              {lt}
            </button>
          ))}
        </div>
      </div>
      <LogTerminal
        lines={lines}
        connected={connected}
        streamError={streamError}
        termRef={termRef}
        onScroll={handleScroll}
        onClear={() => {
          clear();
          atBottomRef.current = true;
        }}
      />
    </>
  );
}

// ─── K8sLogsPanel ─────────────────────────────────────────────────────────────

function K8sLogsPanel({
  slug,
  envSlug,
  namespace,
  depName,
}: {
  slug: string;
  envSlug: string;
  namespace: string;
  depName: string;
}) {
  const { data: pods = [], isLoading } = useK8sPods(slug, envSlug, namespace, true);
  const termRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);

  const depPods = pods.filter((p) => p.name.startsWith(depName + "-"));
  const runningPods = depPods.filter((p) => p.phase === "Running");
  const candidates = runningPods.length > 0 ? runningPods : depPods;

  const [podName, setPodName] = useState("");
  const [container, setContainer] = useState("");

  const candidatesKey = candidates.map((p) => p.name).join(",");
  useEffect(() => {
    if (!podName && candidates.length > 0) setPodName(candidates[0]?.name ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidatesKey]);

  const selectedPod = pods.find((p) => p.name === podName);
  const containerKey = selectedPod?.containers.join(",") ?? "";
  useEffect(() => {
    if (selectedPod?.containers.length) setContainer(selectedPod.containers[0] ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [podName, containerKey]);

  const { lines, connected, streamError, clear } = useK8sPodLogStream({
    slug,
    envSlug,
    namespace,
    podName,
    container,
    enabled: !!podName && !!container,
  });

  useEffect(() => {
    if (termRef.current && atBottomRef.current)
      termRef.current.scrollTop = termRef.current.scrollHeight;
  }, [lines]);

  const handleScroll = () => {
    if (!termRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = termRef.current;
    atBottomRef.current = scrollHeight - scrollTop - clientHeight < 60;
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center gap-2 text-muted-foreground text-sm">
        <Loader2 className="size-4 animate-spin" /> Loading pods…
      </div>
    );
  }
  if (candidates.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
        No pods found for this deployment.
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border shrink-0 flex-wrap">
        <select
          value={podName}
          onChange={(e) => {
            setPodName(e.target.value);
            setContainer("");
          }}
          className="text-xs px-2 py-1 rounded border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary/50 font-mono flex-1 min-w-0"
        >
          {candidates.map((p) => (
            <option key={p.name} value={p.name}>
              {p.name}
            </option>
          ))}
        </select>
        {selectedPod && selectedPod.containers.length > 0 && (
          <select
            value={container}
            onChange={(e) => setContainer(e.target.value)}
            className="text-xs px-2 py-1 rounded border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary/50"
          >
            {selectedPod.containers.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        )}
      </div>
      <LogTerminal
        lines={lines}
        connected={connected}
        streamError={streamError}
        termRef={termRef}
        onScroll={handleScroll}
        onClear={() => {
          clear();
          atBottomRef.current = true;
        }}
      />
    </>
  );
}

// ─── DockerLogsPanel ──────────────────────────────────────────────────────────

function DockerLogsPanel({
  slug,
  envSlug,
  container,
}: {
  slug: string;
  envSlug: string;
  container: DockerContainerStub;
}) {
  const termRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);

  const { lines, connected, streamError, clear } = useDockerLogStream({
    slug,
    envSlug,
    containerId: container.id,
    enabled: true,
  });

  useEffect(() => {
    if (termRef.current && atBottomRef.current)
      termRef.current.scrollTop = termRef.current.scrollHeight;
  }, [lines]);

  const handleScroll = () => {
    if (!termRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = termRef.current;
    atBottomRef.current = scrollHeight - scrollTop - clientHeight < 60;
  };

  return (
    <LogTerminal
      lines={lines}
      connected={connected}
      streamError={streamError}
      termRef={termRef}
      onScroll={handleScroll}
      onClear={() => {
        clear();
        atBottomRef.current = true;
      }}
    />
  );
}

// ─── LogDrawer ────────────────────────────────────────────────────────────────

export function LogDrawer({
  slug,
  envSlug,
  target,
  onClose,
}: {
  slug: string;
  envSlug: string;
  target: DrawerTarget;
  onClose: () => void;
}) {
  const title =
    target.kind === "nomad"
      ? target.job.Name
      : target.kind === "k8s"
        ? target.dep.name
        : target.container.name.replace(/^\//, "");

  const subtitle =
    target.kind === "nomad"
      ? `${target.namespace} · Nomad`
      : target.kind === "k8s"
        ? `${target.dep.namespace} · Kubernetes`
        : `${target.container.id.slice(0, 12)} · Docker`;

  return createPortal(
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute right-0 top-0 h-full w-[700px] max-w-[95vw] flex flex-col glass border-l border-border shadow-2xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <Terminal className="size-4 text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <p className="font-semibold text-sm leading-none truncate">{title}</p>
              <p className="text-xs font-mono text-muted-foreground mt-0.5">{subtitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-accent transition text-muted-foreground shrink-0"
          >
            <X className="size-4" />
          </button>
        </div>

        {target.kind === "nomad" && (
          <NomadLogsPanel
            slug={slug}
            envSlug={envSlug}
            jobId={target.job.ID}
            namespace={target.namespace}
          />
        )}
        {target.kind === "k8s" && (
          <K8sLogsPanel
            slug={slug}
            envSlug={envSlug}
            namespace={target.dep.namespace}
            depName={target.dep.name}
          />
        )}
        {target.kind === "docker" && (
          <DockerLogsPanel slug={slug} envSlug={envSlug} container={target.container} />
        )}
      </div>
    </div>,
    document.body,
  );
}
