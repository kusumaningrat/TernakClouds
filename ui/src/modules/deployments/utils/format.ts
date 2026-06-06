import type { DockerContainerStub } from "@/lib/types";

export function formatTime(ns: number | undefined): string {
  if (!ns) return "—";
  return new Date(ns / 1_000_000).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDate(iso: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatCreated(unix: number): string {
  if (!unix) return "—";
  return new Date(unix * 1000).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatPorts(ports: DockerContainerStub["ports"]): string {
  if (!ports || ports.length === 0) return "—";
  return (
    ports
      .filter((p) => p.public_port)
      .map((p) => `${p.public_port}:${p.private_port}/${p.type}`)
      .join(", ") || ports.map((p) => `${p.private_port}/${p.type}`).join(", ")
  );
}

export const JOB_STATUS_DOT: Record<string, string> = {
  running: "bg-success",
  pending: "bg-yellow-500",
  dead: "bg-muted-foreground",
};

export const JOB_STATUS_TEXT: Record<string, string> = {
  running: "text-success",
  pending: "text-yellow-500",
  dead: "text-muted-foreground",
};

export const CONTAINER_STATE_DOT: Record<string, string> = {
  running: "bg-success",
  exited: "bg-muted-foreground",
  paused: "bg-yellow-500",
  restarting: "bg-warning",
  dead: "bg-destructive",
};

export const CONTAINER_STATE_TEXT: Record<string, string> = {
  running: "text-success",
  exited: "text-muted-foreground",
  paused: "text-yellow-500",
  restarting: "text-warning",
  dead: "text-destructive",
};
