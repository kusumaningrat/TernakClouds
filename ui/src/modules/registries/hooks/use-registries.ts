import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import type {
  CreateRegistryBindingInput,
  CreateRegistryProviderInput,
  RegistryBinding,
  RegistryProvider,
  RegistryRepo,
  RegistryTag,
  UpdateRegistryProviderInput,
} from "../types";

export const registryKeys = {
  all: (slug: string) => ["workspaces", slug, "registries"] as const,
  list: (slug: string) => ["workspaces", slug, "registries", "list"] as const,
  detail: (slug: string, id: string) => ["workspaces", slug, "registries", id] as const,
  repos: (slug: string, id: string) =>
    ["workspaces", slug, "registries", id, "repositories"] as const,
  tags: (slug: string, id: string, repo: string) =>
    ["workspaces", slug, "registries", id, "repositories", repo, "tags"] as const,
  bindings: (slug: string, envSlug: string) =>
    ["workspaces", slug, "environments", envSlug, "registries"] as const,
  boundRepos: (slug: string, envSlug: string, id: string) =>
    ["workspaces", slug, "environments", envSlug, "registries", id, "repositories"] as const,
  boundTags: (slug: string, envSlug: string, id: string, repo: string) =>
    ["workspaces", slug, "environments", envSlug, "registries", id, "repositories", repo, "tags"] as const,
};

export function useRegistries(slug: string) {
  return useQuery<RegistryProvider[], ApiError>({
    queryKey: registryKeys.list(slug),
    queryFn: () => api.get(`/api/v1/workspaces/${slug}/registries`),
    enabled: !!slug,
  });
}

export function useRegistry(slug: string, id: string) {
  return useQuery<RegistryProvider, ApiError>({
    queryKey: registryKeys.detail(slug, id),
    queryFn: () => api.get(`/api/v1/workspaces/${slug}/registries/${id}`),
    enabled: !!slug && !!id,
  });
}

export function useCreateRegistry(slug: string) {
  const queryClient = useQueryClient();
  return useMutation<RegistryProvider, ApiError, CreateRegistryProviderInput>({
    mutationFn: (input) => api.post(`/api/v1/workspaces/${slug}/registries`, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: registryKeys.all(slug) });
    },
  });
}

export function useUpdateRegistry(slug: string) {
  const queryClient = useQueryClient();
  return useMutation<
    RegistryProvider,
    ApiError,
    { id: string; input: UpdateRegistryProviderInput }
  >({
    mutationFn: ({ id, input }) => api.put(`/api/v1/workspaces/${slug}/registries/${id}`, input),
    onSuccess: (_, { id }) => {
      void queryClient.invalidateQueries({ queryKey: registryKeys.all(slug) });
      void queryClient.invalidateQueries({ queryKey: registryKeys.detail(slug, id) });
    },
  });
}

export function useDeleteRegistry(slug: string) {
  const queryClient = useQueryClient();
  return useMutation<void, ApiError, string>({
    mutationFn: (id) => api.delete(`/api/v1/workspaces/${slug}/registries/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: registryKeys.all(slug) });
    },
  });
}

export function useValidateRegistry(slug: string) {
  return useMutation<{ message: string }, ApiError, string>({
    mutationFn: (id) => api.post(`/api/v1/workspaces/${slug}/registries/${id}/validate`, {}),
  });
}

export function useRegistryRepos(slug: string, id: string, enabled = true) {
  return useQuery<RegistryRepo[], ApiError>({
    queryKey: registryKeys.repos(slug, id),
    queryFn: () => api.get(`/api/v1/workspaces/${slug}/registries/${id}/repositories`),
    enabled: !!slug && !!id && enabled,
  });
}

export function useRegistryTags(slug: string, id: string, repoName: string, enabled = true) {
  return useQuery<RegistryTag[], ApiError>({
    queryKey: registryKeys.tags(slug, id, repoName),
    queryFn: () =>
      api.get(
        `/api/v1/workspaces/${slug}/registries/${id}/tags?repo=${encodeURIComponent(repoName)}`,
      ),
    enabled: !!slug && !!id && !!repoName && enabled,
  });
}

export function useEnvironmentRegistries(slug: string, envSlug: string) {
  return useQuery<RegistryBinding[], ApiError>({
    queryKey: registryKeys.bindings(slug, envSlug),
    queryFn: () => api.get(`/api/v1/workspaces/${slug}/environments/${envSlug}/registries`),
    enabled: !!slug && !!envSlug,
  });
}

export function useCreateBinding(slug: string, envSlug: string) {
  const queryClient = useQueryClient();
  return useMutation<RegistryBinding, ApiError, CreateRegistryBindingInput>({
    mutationFn: (input) =>
      api.post(`/api/v1/workspaces/${slug}/environments/${envSlug}/registries`, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: registryKeys.bindings(slug, envSlug) });
    },
  });
}

export function useDeleteBinding(slug: string, envSlug: string) {
  const queryClient = useQueryClient();
  return useMutation<void, ApiError, string>({
    mutationFn: (bindingId) =>
      api.delete(`/api/v1/workspaces/${slug}/environments/${envSlug}/registries/${bindingId}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: registryKeys.bindings(slug, envSlug) });
    },
  });
}

export function useBoundRepos(slug: string, envSlug: string, registryId: string, enabled = true) {
  return useQuery<RegistryRepo[], ApiError>({
    queryKey: registryKeys.boundRepos(slug, envSlug, registryId),
    queryFn: () =>
      api.get(
        `/api/v1/workspaces/${slug}/environments/${envSlug}/registries/${registryId}/repositories`,
      ),
    enabled: !!slug && !!envSlug && !!registryId && enabled,
  });
}

export function useBoundTags(
  slug: string,
  envSlug: string,
  registryId: string,
  repoName: string,
  enabled = true,
) {
  return useQuery<RegistryTag[], ApiError>({
    queryKey: registryKeys.boundTags(slug, envSlug, registryId, repoName),
    queryFn: () =>
      api.get(
        `/api/v1/workspaces/${slug}/environments/${envSlug}/registries/${registryId}/tags?repo=${encodeURIComponent(repoName)}`,
      ),
    enabled: !!slug && !!envSlug && !!registryId && !!repoName && enabled,
  });
}
