import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import type {
  CreateUserInput,
  PermissionCheck,
  Role,
  UserListParams,
  UserListResponse,
  UserRole,
  UserSummary,
} from "./types";

export function useUsers(params: UserListParams = {}) {
  const qs = new URLSearchParams();
  if (params.workspace) qs.set("workspace", params.workspace);
  if (params.department_id) qs.set("department_id", params.department_id);
  if (params.role_id) qs.set("role_id", params.role_id);
  if (params.status) qs.set("status", params.status);
  if (params.page) qs.set("page", String(params.page));
  if (params.limit) qs.set("limit", String(params.limit));
  const search = qs.toString();
  return useQuery<UserListResponse, ApiError>({
    queryKey: ["users", "list", params],
    queryFn: () => api.get(`/api/v1/users${search ? "?" + search : ""}`),
    staleTime: 30_000,
  });
}

export function useRoles() {
  return useQuery<Role[], ApiError>({
    queryKey: ["roles"],
    queryFn: () => api.get("/api/v1/roles"),
    staleTime: 60_000,
  });
}

export function useRole(id: string) {
  return useQuery<Role, ApiError>({
    queryKey: ["roles", id],
    queryFn: () => api.get(`/api/v1/roles/${id}`),
    enabled: !!id,
  });
}

export function useUserRoles(userId: string) {
  return useQuery<UserRole[], ApiError>({
    queryKey: ["users", userId, "roles"],
    queryFn: () => api.get(`/api/v1/users/${userId}/roles`),
    enabled: !!userId,
  });
}

export function useAssignRole() {
  const queryClient = useQueryClient();
  return useMutation<{ message: string }, ApiError, { userId: string; roleId: string }>({
    mutationFn: ({ userId, roleId }) =>
      api.post(`/api/v1/users/${userId}/roles`, { role_id: roleId }),
    onSuccess: (_, { userId }) => {
      void queryClient.invalidateQueries({ queryKey: ["users", userId, "roles"] });
      void queryClient.invalidateQueries({ queryKey: ["users", "list"] });
      void queryClient.invalidateQueries({ queryKey: ["me"] });
    },
  });
}

export function useRevokeRole() {
  const queryClient = useQueryClient();
  return useMutation<{ message: string }, ApiError, { userId: string; roleId: string }>({
    mutationFn: ({ userId, roleId }) => api.delete(`/api/v1/users/${userId}/roles/${roleId}`),
    onSuccess: (_, { userId }) => {
      void queryClient.invalidateQueries({ queryKey: ["users", userId, "roles"] });
      void queryClient.invalidateQueries({ queryKey: ["users", "list"] });
      void queryClient.invalidateQueries({ queryKey: ["me"] });
    },
  });
}

export function useCheckPermission(userId: string, permission: string) {
  return useQuery<PermissionCheck, ApiError>({
    queryKey: ["users", userId, "permissions", permission],
    queryFn: () => api.get(`/api/v1/users/${userId}/permissions/${permission}`),
    enabled: !!userId && !!permission,
  });
}

export function useChangePassword() {
  return useMutation<
    { message: string },
    ApiError,
    { current_password: string; new_password: string }
  >({
    mutationFn: (input) => api.put("/api/v1/users/me/password", input),
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation<UserSummary, ApiError, CreateUserInput>({
    mutationFn: (input) => api.post("/api/v1/users", input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["users", "list"] });
    },
  });
}
