import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import type {
  K8sDeploymentDetail,
  K8sDeploymentStub,
  K8sNamespaceStub,
  K8sNodeStub,
  K8sPodDetail,
  K8sPodStub,
  K8sServiceDetail,
  K8sServiceStub,
} from "../types";

export const k8sKeys = {
  nodes: (slug: string, envSlug: string) =>
    ["workspaces", slug, "environments", envSlug, "kubernetes", "nodes"] as const,
  namespaces: (slug: string, envSlug: string) =>
    ["workspaces", slug, "environments", envSlug, "kubernetes", "namespaces"] as const,
  deployments: (slug: string, envSlug: string) =>
    ["workspaces", slug, "environments", envSlug, "kubernetes", "deployments"] as const,
  pods: (slug: string, envSlug: string) =>
    ["workspaces", slug, "environments", envSlug, "kubernetes", "pods"] as const,
  services: (slug: string, envSlug: string) =>
    ["workspaces", slug, "environments", envSlug, "kubernetes", "services"] as const,
  deploymentDetail: (slug: string, envSlug: string, namespace: string, name: string) =>
    ["workspaces", slug, "environments", envSlug, "kubernetes", "deployments", namespace, name] as const,
  podDetail: (slug: string, envSlug: string, namespace: string, name: string) =>
    ["workspaces", slug, "environments", envSlug, "kubernetes", "pods", namespace, name] as const,
  serviceDetail: (slug: string, envSlug: string, namespace: string, name: string) =>
    ["workspaces", slug, "environments", envSlug, "kubernetes", "services", namespace, name] as const,
};

export function useK8sNodes(slug: string, envSlug: string, enabled = true) {
  return useQuery<K8sNodeStub[], ApiError>({
    queryKey: k8sKeys.nodes(slug, envSlug),
    queryFn: () => api.get(`/api/v1/workspaces/${slug}/environments/${envSlug}/kubernetes/nodes`),
    enabled: !!slug && !!envSlug && enabled,
  });
}

export function useK8sNamespaces(slug: string, envSlug: string, enabled = true) {
  return useQuery<K8sNamespaceStub[], ApiError>({
    queryKey: k8sKeys.namespaces(slug, envSlug),
    queryFn: () =>
      api.get(`/api/v1/workspaces/${slug}/environments/${envSlug}/kubernetes/namespaces`),
    enabled: !!slug && !!envSlug && enabled,
  });
}

export function useK8sDeployments(
  slug: string,
  envSlug: string,
  namespace: string,
  enabled = true,
) {
  return useQuery<K8sDeploymentStub[], ApiError>({
    queryKey: [...k8sKeys.deployments(slug, envSlug), namespace],
    queryFn: () =>
      api.get(
        `/api/v1/workspaces/${slug}/environments/${envSlug}/kubernetes/deployments?namespace=${encodeURIComponent(namespace)}`,
      ),
    enabled: !!slug && !!envSlug && !!namespace && enabled,
  });
}

export function useK8sPods(slug: string, envSlug: string, namespace: string, enabled = true) {
  return useQuery<K8sPodStub[], ApiError>({
    queryKey: [...k8sKeys.pods(slug, envSlug), namespace],
    queryFn: () =>
      api.get(
        `/api/v1/workspaces/${slug}/environments/${envSlug}/kubernetes/pods?namespace=${encodeURIComponent(namespace)}`,
      ),
    enabled: !!slug && !!envSlug && !!namespace && enabled,
  });
}

export function useK8sServices(slug: string, envSlug: string, namespace: string, enabled = true) {
  return useQuery<K8sServiceStub[], ApiError>({
    queryKey: [...k8sKeys.services(slug, envSlug), namespace],
    queryFn: () =>
      api.get(
        `/api/v1/workspaces/${slug}/environments/${envSlug}/kubernetes/services?namespace=${encodeURIComponent(namespace)}`,
      ),
    enabled: !!slug && !!envSlug && !!namespace && enabled,
  });
}

export function useK8sDeploymentDetail(
  slug: string,
  envSlug: string,
  namespace: string,
  name: string,
  enabled = true,
) {
  return useQuery<K8sDeploymentDetail, ApiError>({
    queryKey: k8sKeys.deploymentDetail(slug, envSlug, namespace, name),
    queryFn: () =>
      api.get(
        `/api/v1/workspaces/${slug}/environments/${envSlug}/kubernetes/deployments/${namespace}/${name}`,
      ),
    enabled: !!slug && !!envSlug && !!namespace && !!name && enabled,
  });
}

export function useK8sPodDetail(
  slug: string,
  envSlug: string,
  namespace: string,
  name: string,
  enabled = true,
) {
  return useQuery<K8sPodDetail, ApiError>({
    queryKey: k8sKeys.podDetail(slug, envSlug, namespace, name),
    queryFn: () =>
      api.get(
        `/api/v1/workspaces/${slug}/environments/${envSlug}/kubernetes/pods/${namespace}/${name}`,
      ),
    enabled: !!slug && !!envSlug && !!namespace && !!name && enabled,
  });
}

export function useK8sServiceDetail(
  slug: string,
  envSlug: string,
  namespace: string,
  name: string,
  enabled = true,
) {
  return useQuery<K8sServiceDetail, ApiError>({
    queryKey: k8sKeys.serviceDetail(slug, envSlug, namespace, name),
    queryFn: () =>
      api.get(
        `/api/v1/workspaces/${slug}/environments/${envSlug}/kubernetes/services/${namespace}/${name}`,
      ),
    enabled: !!slug && !!envSlug && !!namespace && !!name && enabled,
  });
}

export function useScaleK8sDeployment() {
  const queryClient = useQueryClient();
  return useMutation<
    { message: string },
    ApiError,
    { slug: string; envSlug: string; namespace: string; name: string; replicas: number }
  >({
    mutationFn: ({ slug, envSlug, namespace, name, replicas }) =>
      api.patch(
        `/api/v1/workspaces/${slug}/environments/${envSlug}/kubernetes/deployments/${namespace}/${name}/scale`,
        { replicas },
      ),
    onSuccess: (_, { slug, envSlug, namespace, name }) => {
      void queryClient.invalidateQueries({
        queryKey: k8sKeys.deploymentDetail(slug, envSlug, namespace, name),
      });
      void queryClient.invalidateQueries({ queryKey: k8sKeys.deployments(slug, envSlug) });
    },
  });
}
