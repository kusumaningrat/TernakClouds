import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '@/lib/api';
import { workspaceKeys } from '../workspaces/queries';
import type { AddIntegrationInput, Integration } from './types';

export function useIntegrations(slug: string, envSlug: string) {
  return useQuery<Integration[], ApiError>({
    queryKey: workspaceKeys.integrations(slug, envSlug),
    queryFn: () =>
      api.get(`/api/v1/workspaces/${slug}/environments/${envSlug}/integrations`),
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
      void queryClient.invalidateQueries({
        queryKey: workspaceKeys.integrations(slug, envSlug),
      });
    },
  });
}

export function useDeleteIntegration() {
  const queryClient = useQueryClient();
  return useMutation<
    { message: string },
    ApiError,
    { slug: string; envSlug: string; id: string }
  >({
    mutationFn: ({ slug, envSlug, id }) =>
      api.delete(`/api/v1/workspaces/${slug}/environments/${envSlug}/integrations/${id}`),
    onSuccess: (_, { slug, envSlug }) => {
      void queryClient.invalidateQueries({
        queryKey: workspaceKeys.integrations(slug, envSlug),
      });
    },
  });
}
