import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import type { CatalogItem, DeployServiceInput, ServiceDeployment } from "./types";

export const catalogKeys = {
  catalog: () => ["service-catalog"] as const,
  deployments: (slug: string, envSlug: string) =>
    ["workspaces", slug, "environments", envSlug, "service-deployments"] as const,
  deployment: (slug: string, envSlug: string, id: string) =>
    ["workspaces", slug, "environments", envSlug, "service-deployments", id] as const,
};

export function useCatalog() {
  return useQuery<CatalogItem[], ApiError>({
    queryKey: catalogKeys.catalog(),
    queryFn: () => api.get("/api/v1/service-catalog"),
    staleTime: 60_000,
  });
}

export function useServiceDeployments(slug: string, envSlug: string) {
  return useQuery<ServiceDeployment[], ApiError>({
    queryKey: catalogKeys.deployments(slug, envSlug),
    queryFn: () =>
      api.get(`/api/v1/workspaces/${slug}/environments/${envSlug}/service-deployments`),
    enabled: !!slug && !!envSlug,
    staleTime: 15_000,
    refetchInterval: 10_000,
    refetchIntervalInBackground: true,
  });
}

export function useDeployService(slug: string, envSlug: string) {
  const queryClient = useQueryClient();
  return useMutation<ServiceDeployment, ApiError, DeployServiceInput>({
    mutationFn: (input) =>
      api.post(`/api/v1/workspaces/${slug}/environments/${envSlug}/service-deployments`, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: catalogKeys.deployments(slug, envSlug) });
    },
  });
}

export function useStopDeployment(slug: string, envSlug: string) {
  const queryClient = useQueryClient();
  return useMutation<void, ApiError, string>({
    mutationFn: (id) =>
      api.delete(`/api/v1/workspaces/${slug}/environments/${envSlug}/service-deployments/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: catalogKeys.deployments(slug, envSlug) });
    },
  });
}
