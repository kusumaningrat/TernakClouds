import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import type {
  CommitFilesInput,
  CommitResult,
  CreateRepoProviderInput,
  ProviderCapabilities,
  PullRequestInput,
  PullRequestResult,
  RepoProvider,
  SCMBranch,
  SCMContentEntry,
  SCMRepo,
  UpdateRepoProviderInput,
} from "./types";

export const repoProviderKeys = {
  all: (slug: string) => ["workspaces", slug, "repo-providers"] as const,
  list: (slug: string) => ["workspaces", slug, "repo-providers", "list"] as const,
  detail: (slug: string, id: string) => ["workspaces", slug, "repo-providers", id] as const,
  repos: (slug: string, id: string) =>
    ["workspaces", slug, "repo-providers", id, "repositories"] as const,
  branches: (slug: string, id: string, repo: string) =>
    ["workspaces", slug, "repo-providers", id, "branches", repo] as const,
  contents: (slug: string, id: string, repo: string, branch: string, path: string) =>
    ["workspaces", slug, "repo-providers", id, "contents", repo, branch, path] as const,
  capabilities: (slug: string, id: string) =>
    ["workspaces", slug, "repo-providers", id, "capabilities"] as const,
};

export function useRepoProviders(slug: string) {
  return useQuery<RepoProvider[], ApiError>({
    queryKey: repoProviderKeys.list(slug),
    queryFn: () => api.get(`/api/v1/workspaces/${slug}/repo-providers`),
    enabled: !!slug,
  });
}

export function useCreateRepoProvider(slug: string) {
  const queryClient = useQueryClient();
  return useMutation<RepoProvider, ApiError, CreateRepoProviderInput>({
    mutationFn: (input) => api.post(`/api/v1/workspaces/${slug}/repo-providers`, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: repoProviderKeys.all(slug) });
    },
  });
}

export function useUpdateRepoProvider(slug: string) {
  const queryClient = useQueryClient();
  return useMutation<RepoProvider, ApiError, { id: string; input: UpdateRepoProviderInput }>({
    mutationFn: ({ id, input }) =>
      api.put(`/api/v1/workspaces/${slug}/repo-providers/${id}`, input),
    onSuccess: (_, { id }) => {
      void queryClient.invalidateQueries({ queryKey: repoProviderKeys.all(slug) });
      void queryClient.invalidateQueries({ queryKey: repoProviderKeys.detail(slug, id) });
    },
  });
}

export function useDeleteRepoProvider(slug: string) {
  const queryClient = useQueryClient();
  return useMutation<void, ApiError, string>({
    mutationFn: (id) => api.delete(`/api/v1/workspaces/${slug}/repo-providers/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: repoProviderKeys.all(slug) });
    },
  });
}

export function useValidateRepoProvider(slug: string) {
  return useMutation<{ status: string }, ApiError, string>({
    mutationFn: (id) => api.post(`/api/v1/workspaces/${slug}/repo-providers/${id}/validate`, {}),
  });
}

export function useRepoProviderRepos(slug: string, id: string, enabled = true) {
  return useQuery<SCMRepo[], ApiError>({
    queryKey: repoProviderKeys.repos(slug, id),
    queryFn: () => api.get(`/api/v1/workspaces/${slug}/repo-providers/${id}/repositories`),
    enabled: !!slug && !!id && enabled,
  });
}

export function useRepoProviderBranches(
  slug: string,
  id: string,
  repoFullName: string,
  enabled = true,
) {
  return useQuery<SCMBranch[], ApiError>({
    queryKey: repoProviderKeys.branches(slug, id, repoFullName),
    queryFn: () =>
      api.get(
        `/api/v1/workspaces/${slug}/repo-providers/${id}/branches?repo=${encodeURIComponent(repoFullName)}`,
      ),
    enabled: !!slug && !!id && !!repoFullName && enabled,
  });
}

export function useRepoProviderContents(
  slug: string,
  id: string,
  repoFullName: string,
  branch = "",
  path = "",
  enabled = true,
) {
  return useQuery<SCMContentEntry[], ApiError>({
    queryKey: repoProviderKeys.contents(slug, id, repoFullName, branch, path),
    queryFn: () => {
      const params = new URLSearchParams({ repo: repoFullName });
      if (branch) params.set("branch", branch);
      if (path) params.set("path", path);
      return api.get(
        `/api/v1/workspaces/${slug}/repo-providers/${id}/contents?${params.toString()}`,
      );
    },
    enabled: !!slug && !!id && !!repoFullName && enabled,
  });
}

export function useCommitFiles(slug: string) {
  return useMutation<CommitResult, ApiError, { id: string; input: CommitFilesInput }>({
    mutationFn: ({ id, input }) =>
      api.post(`/api/v1/workspaces/${slug}/repo-providers/${id}/commit`, input),
  });
}

export function useCreatePullRequest(slug: string) {
  return useMutation<PullRequestResult, ApiError, { id: string; input: PullRequestInput }>({
    mutationFn: ({ id, input }) =>
      api.post(`/api/v1/workspaces/${slug}/repo-providers/${id}/pull-request`, input),
  });
}

export function useRepoProviderCapabilities(slug: string, id: string, enabled = true) {
  return useQuery<ProviderCapabilities, ApiError>({
    queryKey: repoProviderKeys.capabilities(slug, id),
    queryFn: () => api.get(`/api/v1/workspaces/${slug}/repo-providers/${id}/capabilities`),
    enabled: !!slug && !!id && enabled,
  });
}
