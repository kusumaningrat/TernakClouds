export function formatTime(ns: number | undefined): string {
  if (!ns) return "—";
  return new Date(ns / 1_000_000).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export const ALLOC_DOT: Record<string, string> = {
  running: "bg-success",
  pending: "bg-yellow-500",
  complete: "bg-blue-500",
  failed: "bg-destructive",
  lost: "bg-muted-foreground",
  unknown: "bg-muted-foreground",
};
export const ALLOC_TEXT: Record<string, string> = {
  running: "text-success",
  pending: "text-yellow-500",
  complete: "text-blue-500",
  failed: "text-destructive",
  lost: "text-muted-foreground",
  unknown: "text-muted-foreground",
};
export const DEPLOY_STATUS: Record<string, { dot: string; text: string }> = {
  successful: { dot: "bg-success", text: "text-success" },
  running: { dot: "bg-yellow-500", text: "text-yellow-500" },
  failed: { dot: "bg-destructive", text: "text-destructive" },
  cancelled: { dot: "bg-muted-foreground", text: "text-muted-foreground" },
  paused: { dot: "bg-blue-400", text: "text-blue-400" },
};
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
