import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import type {
  AddMemberInput,
  CreateWorkspaceInput,
  UpdateWorkspaceInput,
  Workspace,
  WorkspaceDirectoryEntry,
  WorkspaceMember,
} from "../types";

export const workspaceKeys = {
  all: ["workspaces"] as const,
  list: () => ["workspaces", "list"] as const,
  detail: (slug: string) => ["workspaces", "detail", slug] as const,
  members: (slug: string) => ["workspaces", slug, "members"] as const,
  environments: (slug: string) => ["workspaces", slug, "environments"] as const,
  integrations: (slug: string, envSlug: string) =>
    ["workspaces", slug, "environments", envSlug, "integrations"] as const,
};

export function useWorkspaces() {
  return useQuery<Workspace[], ApiError>({
    queryKey: workspaceKeys.list(),
    queryFn: () => api.get("/api/v1/workspaces"),
    staleTime: 5 * 60_000,
  });
}

export function useWorkspacesMine() {
  return useQuery<Workspace[], ApiError>({
    queryKey: ["workspaces", "mine"],
    queryFn: () => api.get("/api/v1/workspaces/mine"),
    staleTime: 5 * 60_000,
  });
}

export function useWorkspaceDirectory() {
  return useQuery<WorkspaceDirectoryEntry[], ApiError>({
    queryKey: ["workspaces", "directory"],
    queryFn: () => api.get("/api/v1/workspaces/directory"),
    staleTime: 5 * 60_000,
  });
}

export function useWorkspace(slug: string) {
  return useQuery<Workspace, ApiError>({
    queryKey: workspaceKeys.detail(slug),
    queryFn: () => api.get(`/api/v1/workspaces/${slug}`),
    enabled: !!slug,
  });
}

export function useCreateWorkspace() {
  const queryClient = useQueryClient();
  return useMutation<Workspace, ApiError, CreateWorkspaceInput>({
    mutationFn: (input) => api.post("/api/v1/workspaces", input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: workspaceKeys.all });
    },
  });
}

export function useUpdateWorkspace() {
  const queryClient = useQueryClient();
  return useMutation<Workspace, ApiError, { slug: string; input: UpdateWorkspaceInput }>({
    mutationFn: ({ slug, input }) => api.put(`/api/v1/workspaces/${slug}`, input),
    onSuccess: (_, { slug }) => {
      void queryClient.invalidateQueries({ queryKey: workspaceKeys.all });
      void queryClient.invalidateQueries({ queryKey: workspaceKeys.detail(slug) });
    },
  });
}

export function useDeleteWorkspace() {
  const queryClient = useQueryClient();
  return useMutation<{ message: string }, ApiError, string>({
    mutationFn: (slug) => api.delete(`/api/v1/workspaces/${slug}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: workspaceKeys.all });
    },
  });
}

export function useWorkspaceMembers(slug: string) {
  return useQuery<WorkspaceMember[], ApiError>({
    queryKey: workspaceKeys.members(slug),
    queryFn: () => api.get(`/api/v1/workspaces/${slug}/members`),
    enabled: !!slug,
  });
}

export function useAddMember() {
  const queryClient = useQueryClient();
  return useMutation<{ message: string }, ApiError, { slug: string; userId: string }>({
    mutationFn: ({ slug, userId }) =>
      api.post(`/api/v1/workspaces/${slug}/members`, { user_id: userId }),
    onSuccess: (_, { slug }) => {
      void queryClient.invalidateQueries({ queryKey: workspaceKeys.members(slug) });
    },
  });
}

export function useRemoveMember() {
  const queryClient = useQueryClient();
  return useMutation<{ message: string }, ApiError, { slug: string; userId: string }>({
    mutationFn: ({ slug, userId }) => api.delete(`/api/v1/workspaces/${slug}/members/${userId}`),
    onSuccess: (_, { slug }) => {
      void queryClient.invalidateQueries({ queryKey: workspaceKeys.members(slug) });
    },
  });
}

// re-export AddMemberInput so it can be used from this hook file
export type { AddMemberInput };
