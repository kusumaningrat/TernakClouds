import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import type { AccessRequest, ApproveAccessRequestInput, CreateAccessRequestInput } from "./types";

export function useAccessRequestsMine() {
  return useQuery<AccessRequest[], ApiError>({
    queryKey: ["access-requests", "mine"],
    queryFn: () => api.get("/api/v1/access-requests/mine"),
    staleTime: 30_000,
  });
}

export function useAccessRequestsPending() {
  return useQuery<AccessRequest[], ApiError>({
    queryKey: ["access-requests", "pending"],
    queryFn: () => api.get("/api/v1/access-requests"),
    staleTime: 30_000,
  });
}

export function useCreateAccessRequest() {
  const queryClient = useQueryClient();
  return useMutation<AccessRequest, ApiError, CreateAccessRequestInput>({
    mutationFn: (input) => api.post("/api/v1/access-requests", input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["access-requests", "mine"] });
    },
  });
}

export function useApproveAccessRequest() {
  const queryClient = useQueryClient();
  return useMutation<
    { message: string },
    ApiError,
    { id: string; input?: ApproveAccessRequestInput }
  >({
    mutationFn: ({ id, input }) => api.put(`/api/v1/access-requests/${id}/approve`, input ?? {}),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["access-requests", "pending"] });
      void queryClient.invalidateQueries({ queryKey: ["workspaces"] });
    },
  });
}

export function useDenyAccessRequest() {
  const queryClient = useQueryClient();
  return useMutation<{ message: string }, ApiError, string>({
    mutationFn: (id) => api.put(`/api/v1/access-requests/${id}/deny`, {}),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["access-requests", "pending"] });
    },
  });
}
