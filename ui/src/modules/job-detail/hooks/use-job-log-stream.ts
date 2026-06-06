import { useState, useEffect } from "react";
import { getAccessToken } from "@/lib/auth";

const LOG_BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? "";
const MAX_LOG_LINES = 2000;

export interface JobLogStreamParams {
  slug: string;
  envSlug: string;
  allocID: string;
  task: string;
  logType: "stdout" | "stderr";
  follow: boolean;
  enabled: boolean;
}

export function useJobLogStream({
  slug,
  envSlug,
  allocID,
  task,
  logType,
  follow,
  enabled,
}: JobLogStreamParams) {
  const [lines, setLines] = useState<string[]>([]);
  const [connected, setConnected] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !allocID || !task) return;
    const ctrl = new AbortController();
    setLines([]);
    setConnected(false);
    setStreamError(null);
    const token = getAccessToken();
    const url =
      `${LOG_BASE_URL}/api/v1/workspaces/${slug}/environments/${encodeURIComponent(envSlug)}/nomad/allocations/${encodeURIComponent(allocID)}/logs` +
      `?task=${encodeURIComponent(task)}&type=${logType}&follow=${follow}&origin=start`;
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    void (async () => {
      try {
        const res = await fetch(url, { signal: ctrl.signal, headers });
        if (!res.ok) {
          setStreamError(`HTTP ${res.status}`);
          return;
        }
        if (!res.body) {
          setStreamError("No response body");
          return;
        }
        setConnected(true);
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split("\n\n");
          buffer = parts.pop() ?? "";
          for (const part of parts) {
            let eventType = "message";
            let data = "";
            for (const ln of part.split("\n")) {
              if (ln.startsWith("event: ")) eventType = ln.slice(7).trim();
              else if (ln.startsWith("data: ")) data = ln.slice(6);
            }
            if (eventType === "log" && data) {
              setLines((prev) => {
                const next = [...prev, data];
                return next.length > MAX_LOG_LINES ? next.slice(next.length - MAX_LOG_LINES) : next;
              });
            }
          }
        }
        setConnected(false);
      } catch (err) {
        if ((err as Error).name !== "AbortError") setStreamError(String(err));
        setConnected(false);
      }
    })();
    return () => ctrl.abort();
  }, [slug, envSlug, allocID, task, logType, follow, enabled]);

  return { lines, connected, streamError, clear: () => setLines([]) };
}
