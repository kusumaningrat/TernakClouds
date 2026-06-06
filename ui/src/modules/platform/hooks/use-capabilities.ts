import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import type {
  BindProviderInput,
  CapabilityProvider,
  CapabilityStatusResponse,
  UpdateProviderInput,
} from "../types";

export const capabilityKeys = {
  all: (slug: string, envSlug: string) =>
    ["workspaces", slug, "environments", envSlug, "capabilities"] as const,
  detail: (slug: string, envSlug: string, cap: string) =>
    ["workspaces", slug, "environments", envSlug, "capabilities", cap] as const,
  providers: (cap: string) => ["capabilities", cap, "providers"] as const,
};

export function useCapabilities(slug: string, envSlug: string) {
  return useQuery<CapabilityStatusResponse[], ApiError>({
    queryKey: capabilityKeys.all(slug, envSlug),
    queryFn: () => api.get(`/api/v1/workspaces/${slug}/environments/${envSlug}/capabilities`),
    enabled: !!slug && !!envSlug,
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 30_000,
  });
}

export function useCapability(slug: string, envSlug: string, cap: string) {
  return useQuery<CapabilityStatusResponse, ApiError>({
    queryKey: capabilityKeys.detail(slug, envSlug, cap),
    queryFn: () =>
      api.get(`/api/v1/workspaces/${slug}/environments/${envSlug}/capabilities/${cap}`),
    enabled: !!slug && !!envSlug && !!cap,
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 30_000,
  });
}

export function useCapabilityProviders(slug: string, envSlug: string, cap: string) {
  return useQuery<CapabilityProvider[], ApiError>({
    queryKey: capabilityKeys.providers(cap),
    queryFn: () =>
      api.get(`/api/v1/workspaces/${slug}/environments/${envSlug}/capabilities/${cap}/providers`),
    enabled: !!slug && !!envSlug && !!cap,
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 60_000,
  });
}

export function useBindProvider() {
  const queryClient = useQueryClient();
  return useMutation<
    CapabilityStatusResponse,
    ApiError,
    { slug: string; envSlug: string; cap: string; input: BindProviderInput }
  >({
    mutationFn: ({ slug, envSlug, cap, input }) =>
      api.post(
        `/api/v1/workspaces/${slug}/environments/${envSlug}/capabilities/${cap}/provider`,
        input,
      ),
    onSuccess: (_, { slug, envSlug, cap }) => {
      void queryClient.invalidateQueries({ queryKey: capabilityKeys.all(slug, envSlug) });
      void queryClient.invalidateQueries({ queryKey: capabilityKeys.detail(slug, envSlug, cap) });
    },
  });
}

export function useUpdateProvider() {
  const queryClient = useQueryClient();
  return useMutation<
    CapabilityStatusResponse,
    ApiError,
    { slug: string; envSlug: string; cap: string; providerID: string; input: UpdateProviderInput }
  >({
    mutationFn: ({ slug, envSlug, cap, providerID, input }) =>
      api.put(
        `/api/v1/workspaces/${slug}/environments/${envSlug}/capabilities/${cap}/provider/${providerID}`,
        input,
      ),
    onSuccess: (_, { slug, envSlug, cap }) => {
      void queryClient.invalidateQueries({ queryKey: capabilityKeys.all(slug, envSlug) });
      void queryClient.invalidateQueries({ queryKey: capabilityKeys.detail(slug, envSlug, cap) });
    },
  });
}

export function useUnbindProvider() {
  const queryClient = useQueryClient();
  return useMutation<
    { message: string },
    ApiError,
    { slug: string; envSlug: string; cap: string; providerID: string }
  >({
    mutationFn: ({ slug, envSlug, cap, providerID }) =>
      api.delete(
        `/api/v1/workspaces/${slug}/environments/${envSlug}/capabilities/${cap}/provider/${providerID}`,
      ),
    onSuccess: (_, { slug, envSlug, cap }) => {
      void queryClient.invalidateQueries({ queryKey: capabilityKeys.all(slug, envSlug) });
      void queryClient.invalidateQueries({ queryKey: capabilityKeys.detail(slug, envSlug, cap) });
    },
  });
}

export function useVerifyProvider() {
  return useMutation<
    { reachable: boolean; status_code?: number; message: string },
    ApiError,
    { slug: string; envSlug: string; cap: string; providerID: string }
  >({
    mutationFn: ({ slug, envSlug, cap, providerID }) =>
      api.post(
        `/api/v1/workspaces/${slug}/environments/${encodeURIComponent(envSlug)}/capabilities/${cap}/provider/${providerID}/verify`,
        {},
      ),
  });
}
