import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import type {
  AddIntegrationInput,
  CreateEnvironmentInput,
  Integration,
  UpdateEnvironmentInput,
  WorkspaceEnvironment,
} from "../types";
import { workspaceKeys } from "./use-workspaces";

export function useEnvironments(slug: string) {
  return useQuery<WorkspaceEnvironment[], ApiError>({
    queryKey: workspaceKeys.environments(slug),
    queryFn: () => api.get(`/api/v1/workspaces/${slug}/environments`),
    enabled: !!slug,
    retry: (failureCount, error) => {
      if (error.status === 401 || error.status === 403 || error.status === 404) {
        return false;
      }
      return failureCount < 2;
    },
  });
}

export function useCreateEnvironment() {
  const queryClient = useQueryClient();
  return useMutation<
    WorkspaceEnvironment,
    ApiError,
    { slug: string; input: CreateEnvironmentInput }
  >({
    mutationFn: ({ slug, input }) => api.post(`/api/v1/workspaces/${slug}/environments`, input),
    onSuccess: (_, { slug }) => {
      void queryClient.invalidateQueries({ queryKey: workspaceKeys.environments(slug) });
    },
  });
}

export function useUpdateEnvironment() {
  const queryClient = useQueryClient();
  return useMutation<
    WorkspaceEnvironment,
    ApiError,
    { slug: string; envSlug: string; input: UpdateEnvironmentInput }
  >({
    mutationFn: ({ slug, envSlug, input }) =>
      api.put(`/api/v1/workspaces/${slug}/environments/${envSlug}`, input),
    onSuccess: (_, { slug }) => {
      void queryClient.invalidateQueries({ queryKey: workspaceKeys.environments(slug) });
    },
  });
}

export function useDeleteEnvironment() {
  const queryClient = useQueryClient();
  return useMutation<{ message: string }, ApiError, { slug: string; envSlug: string }>({
    mutationFn: ({ slug, envSlug }) =>
      api.delete(`/api/v1/workspaces/${slug}/environments/${envSlug}`),
    onSuccess: (_, { slug }) => {
      void queryClient.invalidateQueries({ queryKey: workspaceKeys.environments(slug) });
    },
  });
}

export function useIntegrations(slug: string, envSlug: string) {
  return useQuery<Integration[], ApiError>({
    queryKey: workspaceKeys.integrations(slug, envSlug),
    queryFn: () => api.get(`/api/v1/workspaces/${slug}/environments/${envSlug}/integrations`),
    enabled: !!slug && !!envSlug,
  });
}

export function useAddIntegration() {
  const queryClient = useQueryClient();
  return useMutation<
    Integration,
    ApiError,
    { slug: string; envSlug: string; input: AddIntegrationInput }
  >({
    mutationFn: ({ slug, envSlug, input }) =>
      api.post(`/api/v1/workspaces/${slug}/environments/${envSlug}/integrations`, input),
    onSuccess: (_, { slug, envSlug }) => {
      void queryClient.invalidateQueries({ queryKey: workspaceKeys.integrations(slug, envSlug) });
    },
  });
}

export function useDeleteIntegration() {
  const queryClient = useQueryClient();
  return useMutation<{ message: string }, ApiError, { slug: string; envSlug: string; id: string }>({
    mutationFn: ({ slug, envSlug, id }) =>
      api.delete(`/api/v1/workspaces/${slug}/environments/${envSlug}/integrations/${id}`),
    onSuccess: (_, { slug, envSlug }) => {
      void queryClient.invalidateQueries({ queryKey: workspaceKeys.integrations(slug, envSlug) });
    },
  });
}
