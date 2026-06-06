import { useQuery } from '@tanstack/react-query';
import { api, ApiError } from '@/lib/api';
import type { Blueprint } from './types';

export const blueprintKeys = {
  all: () => ['blueprints'] as const,
  detail: (name: string) => ['blueprints', name] as const,
};

export function useBlueprints() {
  return useQuery<Blueprint[], ApiError>({
    queryKey: blueprintKeys.all(),
    queryFn: () => api.get('/api/v1/blueprints'),
    staleTime: 60_000,
    retry: false,
    refetchOnWindowFocus: false,
  });
}

export function useBlueprint(name: string) {
  return useQuery<Blueprint, ApiError>({
    queryKey: blueprintKeys.detail(name),
    queryFn: () => api.get(`/api/v1/blueprints/${name}`),
    enabled: !!name,
    staleTime: 60_000,
    retry: false,
    refetchOnWindowFocus: false,
  });
}
