import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import type {
  CreateSecretGrantInput,
  SecretGrant,
  SecretGrantAdminView,
  SecretValueResponse,
  UpdateSecretGrantInput,
} from "./types";

export const secretKeys = {
  list: (slug: string, envSlug: string) =>
    ["workspaces", slug, "environments", envSlug, "secrets"] as const,
  value: (slug: string, envSlug: string, id: string) =>
    ["workspaces", slug, "environments", envSlug, "secrets", id, "value"] as const,
};

export function useSecretGrants(slug: string, envSlug: string) {
  return useQuery<SecretGrant[], ApiError>({
    queryKey: secretKeys.list(slug, envSlug),
    queryFn: () => api.get(`/api/v1/workspaces/${slug}/environments/${envSlug}/secrets`),
    enabled: !!slug && !!envSlug,
  });
}

export function useSecretValue(slug: string, envSlug: string, id: string, enabled = true) {
  return useQuery<SecretValueResponse, ApiError>({
    queryKey: secretKeys.value(slug, envSlug, id),
    queryFn: () =>
      api.get(`/api/v1/workspaces/${slug}/environments/${envSlug}/secrets/${id}/value`),
    enabled: !!slug && !!envSlug && !!id && enabled,
    staleTime: 0,
    gcTime: 60_000,
    retry: false,
  });
}

export function useCreateSecretGrant() {
  const queryClient = useQueryClient();
  return useMutation<
    SecretGrantAdminView,
    ApiError,
    { slug: string; envSlug: string; input: CreateSecretGrantInput }
  >({
    mutationFn: ({ slug, envSlug, input }) =>
      api.post(`/api/v1/workspaces/${slug}/environments/${envSlug}/secrets`, input),
    onSuccess: (_, { slug, envSlug }) => {
      void queryClient.invalidateQueries({ queryKey: secretKeys.list(slug, envSlug) });
    },
  });
}

export function useUpdateSecretGrant() {
  const queryClient = useQueryClient();
  return useMutation<
    SecretGrantAdminView,
    ApiError,
    { slug: string; envSlug: string; id: string; input: UpdateSecretGrantInput }
  >({
    mutationFn: ({ slug, envSlug, id, input }) =>
      api.put(`/api/v1/workspaces/${slug}/environments/${envSlug}/secrets/${id}`, input),
    onSuccess: (_, { slug, envSlug }) => {
      void queryClient.invalidateQueries({ queryKey: secretKeys.list(slug, envSlug) });
    },
  });
}

export function useDeleteSecretGrant() {
  const queryClient = useQueryClient();
  return useMutation<void, ApiError, { slug: string; envSlug: string; id: string }>({
    mutationFn: ({ slug, envSlug, id }) =>
      api.delete(`/api/v1/workspaces/${slug}/environments/${envSlug}/secrets/${id}`),
    onSuccess: (_, { slug, envSlug }) => {
      void queryClient.invalidateQueries({ queryKey: secretKeys.list(slug, envSlug) });
    },
  });
}

export function useWriteSecretValue() {
  const queryClient = useQueryClient();
  return useMutation<
    void,
    ApiError,
    { slug: string; envSlug: string; id: string; path?: string; data: Record<string, string> }
  >({
    mutationFn: ({ slug, envSlug, id, path = "", data }) =>
      api.put(`/api/v1/workspaces/${slug}/environments/${envSlug}/secrets/${id}/value`, {
        path,
        data,
      }),
    onSuccess: (_, { slug, envSlug, id }) => {
      void queryClient.invalidateQueries({ queryKey: secretKeys.value(slug, envSlug, id) });
    },
  });
}
