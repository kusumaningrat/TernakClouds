import { useState, useEffect } from "react";
import { getAccessToken } from "@/lib/auth";

const LOG_BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? "";
const MAX_LOG_LINES = 2000;

function useLogStream(url: string, enabled: boolean) {
  const [lines, setLines] = useState<string[]>([]);
  const [connected, setConnected] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const ctrl = new AbortController();
    setLines([]);
    setConnected(false);
    setStreamError(null);
    const token = getAccessToken();
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
            if ((eventType === "log" || eventType === "message") && data) {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, enabled]);

  return { lines, connected, streamError, clear: () => setLines([]) };
}

export function useDockerLogStream({
  slug,
  envSlug,
  containerId,
  enabled,
}: {
  slug: string;
  envSlug: string;
  containerId: string;
  enabled: boolean;
}) {
  const active = enabled && !!containerId;
  const url =
    `${LOG_BASE_URL}/api/v1/workspaces/${slug}/environments/${encodeURIComponent(envSlug)}` +
    `/docker/containers/${encodeURIComponent(containerId)}/logs?follow=true`;
  return useLogStream(active ? url : "", active);
}

export function useNomadAllocLogStream({
  slug,
  envSlug,
  allocID,
  task,
  logType,
  enabled,
}: {
  slug: string;
  envSlug: string;
  allocID: string;
  task: string;
  logType: "stdout" | "stderr";
  enabled: boolean;
}) {
  const active = enabled && !!allocID && !!task;
  const url =
    `${LOG_BASE_URL}/api/v1/workspaces/${slug}/environments/${encodeURIComponent(envSlug)}` +
    `/nomad/allocations/${encodeURIComponent(allocID)}/logs` +
    `?task=${encodeURIComponent(task)}&type=${logType}&follow=true&origin=start`;
  return useLogStream(active ? url : "", active);
}

export function useK8sPodLogStream({
  slug,
  envSlug,
  namespace,
  podName,
  container,
  enabled,
}: {
  slug: string;
  envSlug: string;
  namespace: string;
  podName: string;
  container: string;
  enabled: boolean;
}) {
  const active = enabled && !!podName && !!container;
  const url =
    `${LOG_BASE_URL}/api/v1/workspaces/${slug}/environments/${encodeURIComponent(envSlug)}` +
    `/kubernetes/pods/${encodeURIComponent(namespace)}/${encodeURIComponent(podName)}/logs` +
    `?follow=true&container=${encodeURIComponent(container)}`;
  return useLogStream(active ? url : "", active);
}
