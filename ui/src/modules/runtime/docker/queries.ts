import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '@/lib/api';
import type {
  DockerContainerDetail,
  DockerContainerStub,
  DockerImageStub,
  DockerNetworkStub,
  DockerVolumeStub,
} from './types';

export const dockerKeys = {
  containers: (slug: string, envSlug: string) =>
    ['workspaces', slug, 'environments', envSlug, 'docker', 'containers'] as const,
  container: (slug: string, envSlug: string, id: string) =>
    ['workspaces', slug, 'environments', envSlug, 'docker', 'containers', id] as const,
  images: (slug: string, envSlug: string) =>
    ['workspaces', slug, 'environments', envSlug, 'docker', 'images'] as const,
  networks: (slug: string, envSlug: string) =>
    ['workspaces', slug, 'environments', envSlug, 'docker', 'networks'] as const,
  volumes: (slug: string, envSlug: string) =>
    ['workspaces', slug, 'environments', envSlug, 'docker', 'volumes'] as const,
};

export function useDockerContainers(slug: string, envSlug: string, enabled = true) {
  return useQuery<DockerContainerStub[], ApiError>({
    queryKey: dockerKeys.containers(slug, envSlug),
    queryFn: () =>
      api.get(`/api/v1/workspaces/${slug}/environments/${envSlug}/docker/containers`),
    enabled: !!slug && !!envSlug && enabled,
    staleTime: 15_000,
  });
}

export function useDockerContainer(slug: string, envSlug: string, id: string, enabled = true) {
  return useQuery<DockerContainerDetail, ApiError>({
    queryKey: dockerKeys.container(slug, envSlug, id),
    queryFn: () =>
      api.get(
        `/api/v1/workspaces/${slug}/environments/${envSlug}/docker/containers/${encodeURIComponent(id)}`,
      ),
    enabled: !!slug && !!envSlug && !!id && enabled,
    staleTime: 10_000,
  });
}

export function useDockerImages(slug: string, envSlug: string, enabled = true) {
  return useQuery<DockerImageStub[], ApiError>({
    queryKey: dockerKeys.images(slug, envSlug),
    queryFn: () =>
      api.get(`/api/v1/workspaces/${slug}/environments/${envSlug}/docker/images`),
    enabled: !!slug && !!envSlug && enabled,
    staleTime: 30_000,
  });
}

export function useDockerNetworks(slug: string, envSlug: string, enabled = true) {
  return useQuery<DockerNetworkStub[], ApiError>({
    queryKey: dockerKeys.networks(slug, envSlug),
    queryFn: () =>
      api.get(`/api/v1/workspaces/${slug}/environments/${envSlug}/docker/networks`),
    enabled: !!slug && !!envSlug && enabled,
    staleTime: 30_000,
  });
}

export function useDockerVolumes(slug: string, envSlug: string, enabled = true) {
  return useQuery<DockerVolumeStub[], ApiError>({
    queryKey: dockerKeys.volumes(slug, envSlug),
    queryFn: () =>
      api.get(`/api/v1/workspaces/${slug}/environments/${envSlug}/docker/volumes`),
    enabled: !!slug && !!envSlug && enabled,
    staleTime: 30_000,
  });
}

export function useDockerContainerAction() {
  const queryClient = useQueryClient();
  return useMutation<
    { message: string },
    ApiError,
    { slug: string; envSlug: string; id: string; action: 'start' | 'stop' | 'restart' }
  >({
    mutationFn: ({ slug, envSlug, id, action }) =>
      api.post(
        `/api/v1/workspaces/${slug}/environments/${envSlug}/docker/containers/${encodeURIComponent(id)}/${action}`,
        {},
      ),
    onSuccess: (_, { slug, envSlug, id }) => {
      void queryClient.invalidateQueries({ queryKey: dockerKeys.containers(slug, envSlug) });
      void queryClient.invalidateQueries({ queryKey: dockerKeys.container(slug, envSlug, id) });
    },
  });
}

export function useRemoveDockerContainer() {
  const queryClient = useQueryClient();
  return useMutation<{ message: string }, ApiError, { slug: string; envSlug: string; id: string }>({
    mutationFn: ({ slug, envSlug, id }) =>
      api.delete(
        `/api/v1/workspaces/${slug}/environments/${envSlug}/docker/containers/${encodeURIComponent(id)}`,
      ),
    onSuccess: (_, { slug, envSlug }) => {
      void queryClient.invalidateQueries({ queryKey: dockerKeys.containers(slug, envSlug) });
    },
  });
}
