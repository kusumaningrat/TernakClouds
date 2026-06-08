import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import type { Bucket, StorageProviderInfo } from "./types";

const storageKeys = {
  provider: (slug: string, envSlug: string) =>
    ["workspaces", slug, "environments", envSlug, "storage", "provider"] as const,
  buckets: (slug: string, envSlug: string) =>
    ["workspaces", slug, "environments", envSlug, "storage", "buckets"] as const,
};

export function useStorageProvider(slug: string, envSlug: string) {
  return useQuery<StorageProviderInfo, ApiError>({
    queryKey: storageKeys.provider(slug, envSlug),
    queryFn: () => api.get(`/api/v1/workspaces/${slug}/environments/${envSlug}/storage/provider`),
    enabled: !!slug && !!envSlug,
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 60_000,
  });
}

export function useStorageBuckets(slug: string, envSlug: string) {
  return useQuery<Bucket[], ApiError>({
    queryKey: storageKeys.buckets(slug, envSlug),
    queryFn: () => api.get(`/api/v1/workspaces/${slug}/environments/${envSlug}/storage/buckets`),
    enabled: !!slug && !!envSlug,
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 30_000,
  });
}

export function useCreateBucket(slug: string, envSlug: string) {
  const qc = useQueryClient();
  return useMutation<unknown, ApiError, { name: string; region?: string }>({
    mutationFn: (body) =>
      api.post(`/api/v1/workspaces/${slug}/environments/${envSlug}/storage/buckets`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: storageKeys.buckets(slug, envSlug) });
    },
  });
}

export function useDeleteBucket(slug: string, envSlug: string) {
  const qc = useQueryClient();
  return useMutation<unknown, ApiError, string>({
    mutationFn: (name) =>
      api.delete(`/api/v1/workspaces/${slug}/environments/${envSlug}/storage/buckets/${name}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: storageKeys.buckets(slug, envSlug) });
    },
  });
}
