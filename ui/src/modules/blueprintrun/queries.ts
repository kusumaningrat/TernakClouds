import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import type { BlueprintRun, BlueprintRunPage, TriggerRunInput } from "./types";

export const blueprintRunKeys = {
  list: (slug: string) => ["workspaces", slug, "blueprint-runs"] as const,
  detail: (slug: string, id: string) =>
    ["workspaces", slug, "blueprint-runs", id] as const,
};

export function useBlueprintRuns(slug: string, page = 1, limit = 20) {
  return useQuery<BlueprintRunPage, ApiError>({
    queryKey: [...blueprintRunKeys.list(slug), page, limit],
    queryFn: () =>
      api.get(
        `/api/v1/workspaces/${slug}/blueprint-runs?page=${page}&limit=${limit}`,
      ),
    enabled: !!slug,
    staleTime: 10_000,
    retry: false,
    refetchOnWindowFocus: false,
  });
}

export function useBlueprintRun(slug: string, id: string, enabled = true) {
  return useQuery<BlueprintRun, ApiError>({
    queryKey: blueprintRunKeys.detail(slug, id),
    queryFn: () => api.get(`/api/v1/workspaces/${slug}/blueprint-runs/${id}`),
    enabled: !!slug && !!id && enabled,
    // Poll every 2s while the run is active; caller controls enabled flag.
    refetchInterval: 2_000,
    staleTime: 0,
    retry: false,
  });
}

export function useTriggerBlueprintRun(slug: string) {
  const queryClient = useQueryClient();
  return useMutation<BlueprintRun, ApiError, TriggerRunInput>({
    mutationFn: (input) =>
      api.post(`/api/v1/workspaces/${slug}/blueprint-runs`, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: blueprintRunKeys.list(slug),
      });
    },
  });
}
