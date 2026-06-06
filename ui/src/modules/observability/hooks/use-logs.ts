import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { CapabilityStatusResponse } from "@/modules/platform/types";
import type { NomadJobStub } from "@/modules/compute/types";
import type { K8sPodStub } from "@/modules/compute/types";
import type { LogsProviderInfo, RuntimeWorkload } from "../types";

export function useLogsProviders(slug: string, envSlug: string) {
  return useQuery<LogsProviderInfo[]>({
    queryKey: ["logs-providers", slug, envSlug],
    queryFn: async () => {
      const runtime = await api.get<CapabilityStatusResponse>(
        `/api/v1/workspaces/${slug}/environments/${encodeURIComponent(envSlug)}/capabilities/runtime`,
      );
      return (runtime.providers ?? []).map((p) => ({
        name: p.provider_name,
        capabilities: {
          can_search: false,
          can_stream: true,
          can_list_labels: p.provider_name === "kubernetes",
        },
      }));
    },
    enabled: !!slug && !!envSlug,
    staleTime: 60_000,
    retry: false,
    refetchOnWindowFocus: false,
  });
}

export function useLogsWorkloads(
  slug: string,
  envSlug: string,
  runtime: string,
  namespace: string,
  enabled: boolean,
) {
  return useQuery<RuntimeWorkload[]>({
    queryKey: ["logs-workloads", slug, envSlug, runtime, namespace],
    queryFn: async () => {
      if (runtime === "nomad") {
        const jobs = await api.get<NomadJobStub[]>(
          `/api/v1/workspaces/${slug}/environments/${encodeURIComponent(envSlug)}/nomad/jobs` +
            `?namespace=${encodeURIComponent(namespace)}`,
        );
        return jobs.map((j) => ({
          id: j.ID,
          runtime: "nomad",
          type: j.Type === "service" ? ("service" as const) : ("job" as const),
          name: j.Name || j.ID,
          namespace: j.Namespace,
          status: j.Status,
          metadata: { job_type: j.Type },
        }));
      }

      if (runtime === "kubernetes") {
        const pods = await api.get<K8sPodStub[]>(
          `/api/v1/workspaces/${slug}/environments/${encodeURIComponent(envSlug)}/kubernetes/pods` +
            `?namespace=${encodeURIComponent(namespace)}`,
        );
        return pods.map((p) => ({
          id: p.name,
          runtime: "kubernetes",
          type: "task" as const,
          name: p.name,
          namespace: p.namespace,
          status: p.phase,
          metadata: { containers: p.containers },
        }));
      }

      return [];
    },
    enabled: enabled && !!slug && !!envSlug && !!runtime,
    staleTime: 15_000,
    retry: false,
    refetchOnWindowFocus: false,
  });
}
