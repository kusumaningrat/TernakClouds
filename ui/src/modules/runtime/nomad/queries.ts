import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import type {
  NomadAllocationDetail,
  NomadAllocationStub,
  NomadDeploymentStub,
  NomadEvalStub,
  NomadJobActionResponse,
  NomadJobDetail,
  NomadJobStub,
  NomadNamespace,
  NomadNodeStub,
} from "./types";

export const nomadKeys = {
  nodes: (slug: string, envSlug: string) =>
    ["workspaces", slug, "environments", envSlug, "nomad", "nodes"] as const,
  namespaces: (slug: string, envSlug: string) =>
    ["workspaces", slug, "environments", envSlug, "nomad", "namespaces"] as const,
  jobs: (slug: string, envSlug: string, namespace: string) =>
    ["workspaces", slug, "environments", envSlug, "nomad", "jobs", namespace] as const,
  job: (slug: string, envSlug: string, namespace: string, jobID: string) =>
    [
      "workspaces",
      slug,
      "environments",
      envSlug,
      "nomad",
      "jobs",
      namespace,
      jobID,
      "detail",
    ] as const,
  allocations: (slug: string, envSlug: string, jobID: string, namespace: string) =>
    [
      "workspaces",
      slug,
      "environments",
      envSlug,
      "nomad",
      "jobs",
      namespace,
      jobID,
      "allocations",
    ] as const,
  evaluations: (slug: string, envSlug: string, jobID: string, namespace: string) =>
    [
      "workspaces",
      slug,
      "environments",
      envSlug,
      "nomad",
      "jobs",
      namespace,
      jobID,
      "evaluations",
    ] as const,
  deployments: (slug: string, envSlug: string, jobID: string, namespace: string) =>
    [
      "workspaces",
      slug,
      "environments",
      envSlug,
      "nomad",
      "jobs",
      namespace,
      jobID,
      "deployments",
    ] as const,
  allocation: (slug: string, envSlug: string, allocID: string) =>
    ["workspaces", slug, "environments", envSlug, "nomad", "allocations", allocID] as const,
};

export function useNomadNodes(slug: string, envSlug: string, enabled = true) {
  return useQuery<NomadNodeStub[], ApiError>({
    queryKey: nomadKeys.nodes(slug, envSlug),
    queryFn: () => api.get(`/api/v1/workspaces/${slug}/environments/${envSlug}/nomad/nodes`),
    enabled: !!slug && !!envSlug && enabled,
    staleTime: 15_000,
  });
}

export function useNomadNamespaces(slug: string, envSlug: string, enabled = true) {
  return useQuery<NomadNamespace[], ApiError>({
    queryKey: nomadKeys.namespaces(slug, envSlug),
    queryFn: () => api.get(`/api/v1/workspaces/${slug}/environments/${envSlug}/nomad/namespaces`),
    enabled: !!slug && !!envSlug && enabled,
    staleTime: 30_000,
  });
}

export function useNomadJobs(slug: string, envSlug: string, namespace: string, enabled = true) {
  return useQuery<NomadJobStub[], ApiError>({
    queryKey: nomadKeys.jobs(slug, envSlug, namespace),
    queryFn: () =>
      api.get(
        `/api/v1/workspaces/${slug}/environments/${envSlug}/nomad/jobs?namespace=${encodeURIComponent(namespace)}`,
      ),
    enabled: !!slug && !!envSlug && !!namespace && enabled,
    staleTime: 15_000,
  });
}

export function useNomadJob(
  slug: string,
  envSlug: string,
  jobID: string,
  namespace: string,
  enabled = true,
) {
  return useQuery<NomadJobDetail, ApiError>({
    queryKey: nomadKeys.job(slug, envSlug, namespace, jobID),
    queryFn: () =>
      api.get(
        `/api/v1/workspaces/${slug}/environments/${envSlug}/nomad/jobs/${encodeURIComponent(jobID)}?namespace=${encodeURIComponent(namespace)}`,
      ),
    enabled: !!slug && !!envSlug && !!jobID && !!namespace && enabled,
    staleTime: 10_000,
  });
}

export function useStopJob() {
  const queryClient = useQueryClient();
  return useMutation<
    NomadJobActionResponse,
    ApiError,
    { slug: string; envSlug: string; jobID: string; namespace: string; purge?: boolean }
  >({
    mutationFn: ({ slug, envSlug, jobID, namespace, purge = false }) =>
      api.post(
        `/api/v1/workspaces/${slug}/environments/${envSlug}/nomad/jobs/${encodeURIComponent(jobID)}/stop?namespace=${encodeURIComponent(namespace)}&purge=${purge}`,
        {},
      ),
    onSuccess: (_, { slug, envSlug, namespace }) => {
      void queryClient.invalidateQueries({ queryKey: nomadKeys.jobs(slug, envSlug, namespace) });
    },
  });
}

export function useNomadEvaluations(
  slug: string,
  envSlug: string,
  jobID: string,
  namespace: string,
  enabled = true,
) {
  return useQuery<NomadEvalStub[], ApiError>({
    queryKey: nomadKeys.evaluations(slug, envSlug, jobID, namespace),
    queryFn: () =>
      api.get(
        `/api/v1/workspaces/${slug}/environments/${envSlug}/nomad/jobs/${encodeURIComponent(jobID)}/evaluations?namespace=${encodeURIComponent(namespace)}`,
      ),
    enabled: !!slug && !!envSlug && !!jobID && !!namespace && enabled,
    staleTime: 15_000,
  });
}

export function useNomadDeployments(
  slug: string,
  envSlug: string,
  jobID: string,
  namespace: string,
  enabled = true,
) {
  return useQuery<NomadDeploymentStub[], ApiError>({
    queryKey: nomadKeys.deployments(slug, envSlug, jobID, namespace),
    queryFn: () =>
      api.get(
        `/api/v1/workspaces/${slug}/environments/${envSlug}/nomad/jobs/${encodeURIComponent(jobID)}/deployments?namespace=${encodeURIComponent(namespace)}`,
      ),
    enabled: !!slug && !!envSlug && !!jobID && !!namespace && enabled,
    staleTime: 15_000,
  });
}

export function useNomadAllocation(slug: string, envSlug: string, allocID: string, enabled = true) {
  return useQuery<NomadAllocationDetail, ApiError>({
    queryKey: nomadKeys.allocation(slug, envSlug, allocID),
    queryFn: () =>
      api.get(
        `/api/v1/workspaces/${slug}/environments/${envSlug}/nomad/allocations/${encodeURIComponent(allocID)}`,
      ),
    enabled: !!slug && !!envSlug && !!allocID && enabled,
    staleTime: 10_000,
  });
}

export function useNomadAllocations(
  slug: string,
  envSlug: string,
  jobID: string,
  namespace: string,
  enabled = true,
) {
  return useQuery<NomadAllocationStub[], ApiError>({
    queryKey: nomadKeys.allocations(slug, envSlug, jobID, namespace),
    queryFn: () =>
      api.get(
        `/api/v1/workspaces/${slug}/environments/${envSlug}/nomad/jobs/${encodeURIComponent(jobID)}/allocations?namespace=${encodeURIComponent(namespace)}`,
      ),
    enabled: !!slug && !!envSlug && !!jobID && !!namespace && enabled,
    staleTime: 10_000,
  });
}

export function useStartJob() {
  const queryClient = useQueryClient();
  return useMutation<
    NomadJobActionResponse,
    ApiError,
    { slug: string; envSlug: string; jobID: string; namespace: string }
  >({
    mutationFn: ({ slug, envSlug, jobID, namespace }) =>
      api.post(
        `/api/v1/workspaces/${slug}/environments/${envSlug}/nomad/jobs/${encodeURIComponent(jobID)}/start?namespace=${encodeURIComponent(namespace)}`,
        {},
      ),
    onSuccess: (_, { slug, envSlug, namespace }) => {
      void queryClient.invalidateQueries({ queryKey: nomadKeys.jobs(slug, envSlug, namespace) });
    },
  });
}
