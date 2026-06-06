import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import type {
  DeploymentHistoryPage,
  GeneratedResources,
  PlatformApp,
  PlatformAppPage,
  PreviewAppInput,
  ProvisionAppInput,
} from "./types";

export const platformAppKeys = {
  list: (slug: string, envSlug: string) =>
    ["workspaces", slug, "environments", envSlug, "platform-apps"] as const,
  detail: (slug: string, envSlug: string, id: string) =>
    ["workspaces", slug, "environments", envSlug, "platform-apps", id] as const,
  deployments: (slug: string, envSlug: string, id: string) =>
    ["workspaces", slug, "environments", envSlug, "platform-apps", id, "deployments"] as const,
};

export function usePlatformApps(slug: string, envSlug: string, page = 1, limit = 5) {
  return useQuery<PlatformAppPage, ApiError>({
    queryKey: [...platformAppKeys.list(slug, envSlug), page, limit],
    queryFn: () =>
      api.get(
        `/api/v1/workspaces/${slug}/environments/${envSlug}/platform-apps?page=${page}&limit=${limit}`,
      ),
    enabled: !!slug && !!envSlug,
    staleTime: 15_000,
    retry: false,
    refetchOnWindowFocus: false,
  });
}

export function usePlatformApp(slug: string, envSlug: string, id: string) {
  return useQuery<PlatformApp, ApiError>({
    queryKey: platformAppKeys.detail(slug, envSlug, id),
    queryFn: () =>
      api.get(`/api/v1/workspaces/${slug}/environments/${envSlug}/platform-apps/${id}`),
    enabled: !!slug && !!envSlug && !!id,
    staleTime: 15_000,
    retry: false,
    refetchOnWindowFocus: false,
  });
}

export function usePreviewApp(slug: string, envSlug: string) {
  return useMutation<GeneratedResources, ApiError, PreviewAppInput>({
    mutationFn: (input) =>
      api.post(`/api/v1/workspaces/${slug}/environments/${envSlug}/platform-apps/preview`, input),
  });
}

export function useProvisionApp(slug: string, envSlug: string) {
  const queryClient = useQueryClient();
  return useMutation<PlatformApp, ApiError, ProvisionAppInput>({
    mutationFn: (input) =>
      api.post(`/api/v1/workspaces/${slug}/environments/${envSlug}/platform-apps`, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: platformAppKeys.list(slug, envSlug),
      });
    },
  });
}

export function useDeletePlatformApp(slug: string, envSlug: string) {
  const queryClient = useQueryClient();
  return useMutation<void, ApiError, string>({
    mutationFn: (id) =>
      api.delete(`/api/v1/workspaces/${slug}/environments/${envSlug}/platform-apps/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: platformAppKeys.list(slug, envSlug),
      });
    },
  });
}

export function useAppDeployments(
  slug: string,
  envSlug: string,
  appId: string,
  page = 1,
  limit = 5,
) {
  return useQuery<DeploymentHistoryPage, ApiError>({
    queryKey: [...platformAppKeys.deployments(slug, envSlug, appId), page, limit],
    queryFn: () =>
      api.get(
        `/api/v1/workspaces/${slug}/environments/${envSlug}/platform-apps/${appId}/deployments?page=${page}&limit=${limit}`,
      ),
    enabled: !!slug && !!envSlug && !!appId,
    staleTime: 30_000,
    retry: false,
    refetchOnWindowFocus: false,
  });
}
