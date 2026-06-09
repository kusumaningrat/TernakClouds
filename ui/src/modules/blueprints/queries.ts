import { useQuery } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import type { Blueprint } from "./types";

export const blueprintKeys = {
  all: (slug: string) => ["workspaces", slug, "blueprints"] as const,
  detail: (slug: string, name: string) => ["workspaces", slug, "blueprints", name] as const,
};

export function useBlueprints(slug: string) {
  return useQuery<Blueprint[], ApiError>({
    queryKey: blueprintKeys.all(slug),
    queryFn: () => api.get(`/api/v1/workspaces/${slug}/blueprints`),
    enabled: !!slug,
    staleTime: 60_000,
    retry: false,
    refetchOnWindowFocus: false,
  });
}

export function useBlueprint(slug: string, name: string) {
  return useQuery<Blueprint, ApiError>({
    queryKey: blueprintKeys.detail(slug, name),
    queryFn: () => api.get(`/api/v1/workspaces/${slug}/blueprints/${name}`),
    enabled: !!slug && !!name,
    staleTime: 60_000,
    retry: false,
    refetchOnWindowFocus: false,
  });
}
