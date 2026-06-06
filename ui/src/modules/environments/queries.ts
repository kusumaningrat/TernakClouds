import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import { workspaceKeys } from "../workspaces/queries";
import type { CreateEnvironmentInput, UpdateEnvironmentInput, WorkspaceEnvironment } from "./types";

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
