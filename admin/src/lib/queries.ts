import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "./api";
import { clearTokens, getRefreshToken, storeTokens } from "./auth";
import type {
  AccessRequest,
  AddIntegrationInput,
  ApproveAccessRequestInput,
  BindProviderInput,
  CapabilityProvider,
  CapabilityStatusResponse,
  CreateAccessRequestInput,
  UpdateProviderInput,
  CreateDepartmentInput,
  CreateEnvironmentInput,
  CreateWorkspaceInput,
  Department,
  DepartmentList,
  Integration,
  LoginInput,
  MeResponse,
  CreateSecretGrantInput,
  NomadAllocationDetail,
  NomadAllocationStub,
  NomadDeploymentStub,
  NomadEvalStub,
  NomadJobActionResponse,
  NomadJobDetail,
  NomadJobStub,
  NomadNamespace,
  NomadNodeStub,
  SecretGrant,
  SecretGrantAdminView,
  SecretValueResponse,
  UpdateSecretGrantInput,
  PermissionCheck,
  RegisterInput,
  RegisterResponse,
  Role,
  TokenResponse,
  UpdateDepartmentInput,
  UpdateEnvironmentInput,
  UpdateWorkspaceInput,
  UserListParams,
  UserListResponse,
  UserRole,
  Workspace,
  WorkspaceDirectoryEntry,
  WorkspaceEnvironment,
  WorkspaceMember,
  RegistryProvider,
  CreateRegistryProviderInput,
  UpdateRegistryProviderInput,
  RegistryBinding,
  CreateRegistryBindingInput,
  RegistryRepo,
  RegistryTag,
  K8sNodeStub,
  K8sNamespaceStub,
  K8sDeploymentStub,
  K8sPodStub,
  K8sServiceStub,
  K8sDeploymentDetail,
  K8sPodDetail,
  K8sServiceDetail,
  DockerContainerStub,
  DockerContainerDetail,
  DockerImageStub,
  DockerNetworkStub,
  DockerVolumeStub,
  CatalogItem,
  ServiceDeployment,
  DeployServiceInput,
  LogsProviderInfo,
  RuntimeWorkload,
  Blueprint,
  PlatformApp,
  GeneratedResources,
  ProvisionAppInput,
  PreviewAppInput,
  RepoProvider,
  CreateRepoProviderInput,
  UpdateRepoProviderInput,
  SCMRepo,
  SCMBranch,
  SCMContentEntry,
  CommitFilesInput,
  CommitResult,
  PullRequestInput,
  PullRequestResult,
  ProviderCapabilities,
} from "./types";

// ─── Auth ────────────────────────────────────────────────────────────────────

export function useLogin() {
  return useMutation<TokenResponse, ApiError, LoginInput>({
    mutationFn: (input) => api.post("/api/v1/auth/login", input, false),
    onSuccess: (data) => {
      storeTokens(data.access_token, data.refresh_token);
    },
  });
}

export function useRegister() {
  return useMutation<RegisterResponse, ApiError, RegisterInput>({
    mutationFn: (input) => api.post("/api/v1/auth/register", input, false),
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation<void, ApiError, void>({
    mutationFn: async () => {
      const refreshToken = getRefreshToken();
      if (refreshToken) {
        // Best-effort server-side revocation; don't fail logout if API is unreachable
        try {
          await api.post("/api/v1/auth/logout", { refresh_token: refreshToken }, false);
        } catch {
          /* ignore */
        }
      }
    },
    onSettled: () => {
      clearTokens();
      queryClient.clear();
    },
  });
}

// GET /api/v1/auth/me — current user profile + assigned roles
export function useMe() {
  return useQuery<MeResponse, ApiError>({
    queryKey: ["me"],
    queryFn: () => api.get("/api/v1/auth/me"),
    staleTime: 60_000,
  });
}

// ─── Users (admin list) ──────────────────────────────────────────────────────

// GET /api/v1/users — paginated, filterable list with roles + workspace memberships
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

// ─── Roles ───────────────────────────────────────────────────────────────────

// GET /api/v1/roles — all roles with their permissions
export function useRoles() {
  return useQuery<Role[], ApiError>({
    queryKey: ["roles"],
    queryFn: () => api.get("/api/v1/roles"),
    staleTime: 60_000,
  });
}

// GET /api/v1/roles/:id
export function useRole(id: string) {
  return useQuery<Role, ApiError>({
    queryKey: ["roles", id],
    queryFn: () => api.get(`/api/v1/roles/${id}`),
    enabled: !!id,
  });
}

// GET /api/v1/users/:id/roles
export function useUserRoles(userId: string) {
  return useQuery<UserRole[], ApiError>({
    queryKey: ["users", userId, "roles"],
    queryFn: () => api.get(`/api/v1/users/${userId}/roles`),
    enabled: !!userId,
  });
}

// POST /api/v1/users/:id/roles — assign a role
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

// DELETE /api/v1/users/:id/roles/:roleId — revoke a role
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

// GET /api/v1/users/:id/permissions/:permission — check single permission
export function useCheckPermission(userId: string, permission: string) {
  return useQuery<PermissionCheck, ApiError>({
    queryKey: ["users", userId, "permissions", permission],
    queryFn: () => api.get(`/api/v1/users/${userId}/permissions/${permission}`),
    enabled: !!userId && !!permission,
  });
}

// ─── Departments ─────────────────────────────────────────────────────────────

export const departmentKeys = {
  all: ["departments"] as const,
  list: (page: number, limit: number) => ["departments", "list", page, limit] as const,
  detail: (id: string) => ["departments", "detail", id] as const,
};

export function useDepartments(page = 1, limit = 20) {
  return useQuery<DepartmentList, ApiError>({
    queryKey: departmentKeys.list(page, limit),
    queryFn: () => api.get(`/api/v1/departments?page=${page}&limit=${limit}`),
  });
}

export function useDepartment(id: string) {
  return useQuery<Department, ApiError>({
    queryKey: departmentKeys.detail(id),
    queryFn: () => api.get(`/api/v1/departments/${id}`),
    enabled: !!id,
    staleTime: 5 * 60_000,
  });
}

export function useCreateDepartment() {
  const queryClient = useQueryClient();
  return useMutation<Department, ApiError, CreateDepartmentInput>({
    mutationFn: (input) => api.post("/api/v1/departments", input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: departmentKeys.all });
    },
  });
}

export function useUpdateDepartment() {
  const queryClient = useQueryClient();
  return useMutation<Department, ApiError, { id: string; input: UpdateDepartmentInput }>({
    mutationFn: ({ id, input }) => api.put(`/api/v1/departments/${id}`, input),
    onSuccess: (_, { id }) => {
      void queryClient.invalidateQueries({ queryKey: departmentKeys.all });
      void queryClient.invalidateQueries({ queryKey: departmentKeys.detail(id) });
    },
  });
}

export function useDeleteDepartment() {
  const queryClient = useQueryClient();
  return useMutation<void, ApiError, string>({
    mutationFn: (id) => api.delete(`/api/v1/departments/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: departmentKeys.all });
    },
  });
}

// ─── Workspaces ──────────────────────────────────────────────────────────────

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

// GET /api/v1/workspaces/mine — only workspaces the caller is a member of.
export function useWorkspacesMine() {
  return useQuery<Workspace[], ApiError>({
    queryKey: ["workspaces", "mine"],
    queryFn: () => api.get("/api/v1/workspaces/mine"),
    staleTime: 5 * 60_000,
  });
}

// GET /api/v1/workspaces/directory — lightweight list for access request picker (any auth user)
export function useWorkspaceDirectory() {
  return useQuery<WorkspaceDirectoryEntry[], ApiError>({
    queryKey: ["workspaces", "directory"],
    queryFn: () => api.get("/api/v1/workspaces/directory"),
    staleTime: 5 * 60_000,
  });
}

// ─── Access Requests ─────────────────────────────────────────────────────────

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

// ─── Environments ─────────────────────────────────────────────────────────────

export function useEnvironments(slug: string) {
  return useQuery<WorkspaceEnvironment[], ApiError>({
    queryKey: workspaceKeys.environments(slug),
    queryFn: () => api.get(`/api/v1/workspaces/${slug}/environments`),
    enabled: !!slug,
    retry: (failureCount, error) => {
      if (error.status === 401 || error.status === 403 || error.status === 404) {
        return false;
      }
      return failureCount < 2;
    },
  });
}

export function useCreateEnvironment() {
  const queryClient = useQueryClient();
  return useMutation<
    WorkspaceEnvironment,
    ApiError,
    { slug: string; input: CreateEnvironmentInput }
  >({
    mutationFn: ({ slug, input }) => api.post(`/api/v1/workspaces/${slug}/environments`, input),
    onSuccess: (_, { slug }) => {
      void queryClient.invalidateQueries({ queryKey: workspaceKeys.environments(slug) });
    },
  });
}

export function useUpdateEnvironment() {
  const queryClient = useQueryClient();
  return useMutation<
    WorkspaceEnvironment,
    ApiError,
    { slug: string; envSlug: string; input: UpdateEnvironmentInput }
  >({
    mutationFn: ({ slug, envSlug, input }) =>
      api.put(`/api/v1/workspaces/${slug}/environments/${envSlug}`, input),
    onSuccess: (_, { slug }) => {
      void queryClient.invalidateQueries({ queryKey: workspaceKeys.environments(slug) });
    },
  });
}

export function useDeleteEnvironment() {
  const queryClient = useQueryClient();
  return useMutation<{ message: string }, ApiError, { slug: string; envSlug: string }>({
    mutationFn: ({ slug, envSlug }) =>
      api.delete(`/api/v1/workspaces/${slug}/environments/${envSlug}`),
    onSuccess: (_, { slug }) => {
      void queryClient.invalidateQueries({ queryKey: workspaceKeys.environments(slug) });
    },
  });
}

// ─── Integrations ─────────────────────────────────────────────────────────────

// GET /api/v1/workspaces/:slug/environments/:envSlug/integrations
export function useIntegrations(slug: string, envSlug: string) {
  return useQuery<Integration[], ApiError>({
    queryKey: workspaceKeys.integrations(slug, envSlug),
    queryFn: () => api.get(`/api/v1/workspaces/${slug}/environments/${envSlug}/integrations`),
    enabled: !!slug && !!envSlug,
  });
}

// POST /api/v1/workspaces/:slug/environments/:envSlug/integrations
export function useAddIntegration() {
  const queryClient = useQueryClient();
  return useMutation<
    Integration,
    ApiError,
    { slug: string; envSlug: string; input: AddIntegrationInput }
  >({
    mutationFn: ({ slug, envSlug, input }) =>
      api.post(`/api/v1/workspaces/${slug}/environments/${envSlug}/integrations`, input),
    onSuccess: (_, { slug, envSlug }) => {
      void queryClient.invalidateQueries({ queryKey: workspaceKeys.integrations(slug, envSlug) });
    },
  });
}

// DELETE /api/v1/workspaces/:slug/environments/:envSlug/integrations/:id
export function useDeleteIntegration() {
  const queryClient = useQueryClient();
  return useMutation<{ message: string }, ApiError, { slug: string; envSlug: string; id: string }>({
    mutationFn: ({ slug, envSlug, id }) =>
      api.delete(`/api/v1/workspaces/${slug}/environments/${envSlug}/integrations/${id}`),
    onSuccess: (_, { slug, envSlug }) => {
      void queryClient.invalidateQueries({ queryKey: workspaceKeys.integrations(slug, envSlug) });
    },
  });
}

// ─── Secrets ─────────────────────────────────────────────────────────────────

export const secretKeys = {
  list: (slug: string, envSlug: string) =>
    ["workspaces", slug, "environments", envSlug, "secrets"] as const,
  value: (slug: string, envSlug: string, id: string) =>
    ["workspaces", slug, "environments", envSlug, "secrets", id, "value"] as const,
};

export function useSecretGrants(slug: string, envSlug: string) {
  return useQuery<SecretGrant[], ApiError>({
    queryKey: secretKeys.list(slug, envSlug),
    queryFn: () => api.get(`/api/v1/workspaces/${slug}/environments/${envSlug}/secrets`),
    enabled: !!slug && !!envSlug,
  });
}

export function useSecretValue(slug: string, envSlug: string, id: string, enabled = true) {
  return useQuery<SecretValueResponse, ApiError>({
    queryKey: secretKeys.value(slug, envSlug, id),
    queryFn: () =>
      api.get(`/api/v1/workspaces/${slug}/environments/${envSlug}/secrets/${id}/value`),
    enabled: !!slug && !!envSlug && !!id && enabled,
    staleTime: 0,
    gcTime: 60_000,
    retry: false,
  });
}

export function useCreateSecretGrant() {
  const queryClient = useQueryClient();
  return useMutation<
    SecretGrantAdminView,
    ApiError,
    { slug: string; envSlug: string; input: CreateSecretGrantInput }
  >({
    mutationFn: ({ slug, envSlug, input }) =>
      api.post(`/api/v1/workspaces/${slug}/environments/${envSlug}/secrets`, input),
    onSuccess: (_, { slug, envSlug }) => {
      void queryClient.invalidateQueries({ queryKey: secretKeys.list(slug, envSlug) });
    },
  });
}

export function useUpdateSecretGrant() {
  const queryClient = useQueryClient();
  return useMutation<
    SecretGrantAdminView,
    ApiError,
    { slug: string; envSlug: string; id: string; input: UpdateSecretGrantInput }
  >({
    mutationFn: ({ slug, envSlug, id, input }) =>
      api.put(`/api/v1/workspaces/${slug}/environments/${envSlug}/secrets/${id}`, input),
    onSuccess: (_, { slug, envSlug }) => {
      void queryClient.invalidateQueries({ queryKey: secretKeys.list(slug, envSlug) });
    },
  });
}

export function useDeleteSecretGrant() {
  const queryClient = useQueryClient();
  return useMutation<void, ApiError, { slug: string; envSlug: string; id: string }>({
    mutationFn: ({ slug, envSlug, id }) =>
      api.delete(`/api/v1/workspaces/${slug}/environments/${envSlug}/secrets/${id}`),
    onSuccess: (_, { slug, envSlug }) => {
      void queryClient.invalidateQueries({ queryKey: secretKeys.list(slug, envSlug) });
    },
  });
}

export function useWriteSecretValue() {
  const queryClient = useQueryClient();
  return useMutation<
    void,
    ApiError,
    { slug: string; envSlug: string; id: string; path?: string; data: Record<string, string> }
  >({
    mutationFn: ({ slug, envSlug, id, path = "", data }) =>
      api.put(`/api/v1/workspaces/${slug}/environments/${envSlug}/secrets/${id}/value`, {
        path,
        data,
      }),
    onSuccess: (_, { slug, envSlug, id }) => {
      void queryClient.invalidateQueries({ queryKey: secretKeys.value(slug, envSlug, id) });
    },
  });
}

// ─── Capabilities ─────────────────────────────────────────────────────────────

export const capabilityKeys = {
  all: (slug: string, envSlug: string) =>
    ["workspaces", slug, "environments", envSlug, "capabilities"] as const,
  detail: (slug: string, envSlug: string, cap: string) =>
    ["workspaces", slug, "environments", envSlug, "capabilities", cap] as const,
  providers: (cap: string) => ["capabilities", cap, "providers"] as const,
};

// GET /api/v1/workspaces/:slug/environments/:envSlug/capabilities
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

// GET /api/v1/workspaces/:slug/environments/:envSlug/capabilities/:cap
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

// GET /api/v1/workspaces/:slug/environments/:envSlug/capabilities/:cap/providers
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

// POST /api/v1/workspaces/:slug/environments/:envSlug/capabilities/:cap/provider
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

// PUT /api/v1/workspaces/:slug/environments/:envSlug/capabilities/:cap/provider/:providerID
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

// DELETE /api/v1/workspaces/:slug/environments/:envSlug/capabilities/:cap/provider/:providerID
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

// ─── Nomad ────────────────────────────────────────────────────────────────────

export const nomadKeys = {
  nodes: (slug: string, envSlug: string) =>
    ["workspaces", slug, "environments", envSlug, "nomad", "nodes"] as const,
  namespaces: (slug: string, envSlug: string) =>
    ["workspaces", slug, "environments", envSlug, "nomad", "namespaces"] as const,
  jobs: (slug: string, envSlug: string, namespace: string) =>
    ["workspaces", slug, "environments", envSlug, "nomad", "jobs", namespace] as const,
  job: (slug: string, envSlug: string, namespace: string, jobID: string) =>
    [
      "workspaces",
      slug,
      "environments",
      envSlug,
      "nomad",
      "jobs",
      namespace,
      jobID,
      "detail",
    ] as const,
  allocations: (slug: string, envSlug: string, jobID: string, namespace: string) =>
    [
      "workspaces",
      slug,
      "environments",
      envSlug,
      "nomad",
      "jobs",
      namespace,
      jobID,
      "allocations",
    ] as const,
  evaluations: (slug: string, envSlug: string, jobID: string, namespace: string) =>
    [
      "workspaces",
      slug,
      "environments",
      envSlug,
      "nomad",
      "jobs",
      namespace,
      jobID,
      "evaluations",
    ] as const,
  deployments: (slug: string, envSlug: string, jobID: string, namespace: string) =>
    [
      "workspaces",
      slug,
      "environments",
      envSlug,
      "nomad",
      "jobs",
      namespace,
      jobID,
      "deployments",
    ] as const,
  allocation: (slug: string, envSlug: string, allocID: string) =>
    ["workspaces", slug, "environments", envSlug, "nomad", "allocations", allocID] as const,
};

// GET /api/v1/workspaces/:slug/environments/:envSlug/nomad/nodes
export function useNomadNodes(slug: string, envSlug: string, enabled = true) {
  return useQuery<NomadNodeStub[], ApiError>({
    queryKey: nomadKeys.nodes(slug, envSlug),
    queryFn: () => api.get(`/api/v1/workspaces/${slug}/environments/${envSlug}/nomad/nodes`),
    enabled: !!slug && !!envSlug && enabled,
    staleTime: 15_000,
  });
}

// GET /api/v1/workspaces/:slug/environments/:envSlug/nomad/namespaces
export function useNomadNamespaces(slug: string, envSlug: string, enabled = true) {
  return useQuery<NomadNamespace[], ApiError>({
    queryKey: nomadKeys.namespaces(slug, envSlug),
    queryFn: () => api.get(`/api/v1/workspaces/${slug}/environments/${envSlug}/nomad/namespaces`),
    enabled: !!slug && !!envSlug && enabled,
    staleTime: 30_000,
  });
}

// GET /api/v1/workspaces/:slug/environments/:envSlug/nomad/jobs?namespace=<ns>
export function useNomadJobs(slug: string, envSlug: string, namespace: string, enabled = true) {
  return useQuery<NomadJobStub[], ApiError>({
    queryKey: nomadKeys.jobs(slug, envSlug, namespace),
    queryFn: () =>
      api.get(
        `/api/v1/workspaces/${slug}/environments/${envSlug}/nomad/jobs?namespace=${encodeURIComponent(namespace)}`,
      ),
    enabled: !!slug && !!envSlug && !!namespace && enabled,
    staleTime: 15_000,
  });
}

// GET /api/v1/workspaces/:slug/environments/:envSlug/nomad/jobs/:jobID?namespace=<ns>
export function useNomadJob(
  slug: string,
  envSlug: string,
  jobID: string,
  namespace: string,
  enabled = true,
) {
  return useQuery<NomadJobDetail, ApiError>({
    queryKey: nomadKeys.job(slug, envSlug, namespace, jobID),
    queryFn: () =>
      api.get(
        `/api/v1/workspaces/${slug}/environments/${envSlug}/nomad/jobs/${encodeURIComponent(jobID)}?namespace=${encodeURIComponent(namespace)}`,
      ),
    enabled: !!slug && !!envSlug && !!jobID && !!namespace && enabled,
    staleTime: 10_000,
  });
}

// POST /api/v1/workspaces/:slug/environments/:envSlug/nomad/jobs/:jobID/stop
export function useStopJob() {
  const queryClient = useQueryClient();
  return useMutation<
    NomadJobActionResponse,
    ApiError,
    { slug: string; envSlug: string; jobID: string; namespace: string; purge?: boolean }
  >({
    mutationFn: ({ slug, envSlug, jobID, namespace, purge = false }) =>
      api.post(
        `/api/v1/workspaces/${slug}/environments/${envSlug}/nomad/jobs/${encodeURIComponent(jobID)}/stop?namespace=${encodeURIComponent(namespace)}&purge=${purge}`,
        {},
      ),
    onSuccess: (_, { slug, envSlug, namespace }) => {
      void queryClient.invalidateQueries({ queryKey: nomadKeys.jobs(slug, envSlug, namespace) });
    },
  });
}

// GET .../nomad/jobs/:jobID/evaluations?namespace=<ns>
export function useNomadEvaluations(
  slug: string,
  envSlug: string,
  jobID: string,
  namespace: string,
  enabled = true,
) {
  return useQuery<NomadEvalStub[], ApiError>({
    queryKey: nomadKeys.evaluations(slug, envSlug, jobID, namespace),
    queryFn: () =>
      api.get(
        `/api/v1/workspaces/${slug}/environments/${envSlug}/nomad/jobs/${encodeURIComponent(jobID)}/evaluations?namespace=${encodeURIComponent(namespace)}`,
      ),
    enabled: !!slug && !!envSlug && !!jobID && !!namespace && enabled,
    staleTime: 15_000,
  });
}

// GET .../nomad/jobs/:jobID/deployments?namespace=<ns>
export function useNomadDeployments(
  slug: string,
  envSlug: string,
  jobID: string,
  namespace: string,
  enabled = true,
) {
  return useQuery<NomadDeploymentStub[], ApiError>({
    queryKey: nomadKeys.deployments(slug, envSlug, jobID, namespace),
    queryFn: () =>
      api.get(
        `/api/v1/workspaces/${slug}/environments/${envSlug}/nomad/jobs/${encodeURIComponent(jobID)}/deployments?namespace=${encodeURIComponent(namespace)}`,
      ),
    enabled: !!slug && !!envSlug && !!jobID && !!namespace && enabled,
    staleTime: 15_000,
  });
}

// GET .../nomad/allocations/:allocID
export function useNomadAllocation(slug: string, envSlug: string, allocID: string, enabled = true) {
  return useQuery<NomadAllocationDetail, ApiError>({
    queryKey: nomadKeys.allocation(slug, envSlug, allocID),
    queryFn: () =>
      api.get(
        `/api/v1/workspaces/${slug}/environments/${envSlug}/nomad/allocations/${encodeURIComponent(allocID)}`,
      ),
    enabled: !!slug && !!envSlug && !!allocID && enabled,
    staleTime: 10_000,
  });
}

// GET /api/v1/workspaces/:slug/environments/:envSlug/nomad/jobs/:jobID/allocations
export function useNomadAllocations(
  slug: string,
  envSlug: string,
  jobID: string,
  namespace: string,
  enabled = true,
) {
  return useQuery<NomadAllocationStub[], ApiError>({
    queryKey: nomadKeys.allocations(slug, envSlug, jobID, namespace),
    queryFn: () =>
      api.get(
        `/api/v1/workspaces/${slug}/environments/${envSlug}/nomad/jobs/${encodeURIComponent(jobID)}/allocations?namespace=${encodeURIComponent(namespace)}`,
      ),
    enabled: !!slug && !!envSlug && !!jobID && !!namespace && enabled,
    staleTime: 10_000,
  });
}

// POST /api/v1/workspaces/:slug/environments/:envSlug/nomad/jobs/:jobID/start
export function useStartJob() {
  const queryClient = useQueryClient();
  return useMutation<
    NomadJobActionResponse,
    ApiError,
    { slug: string; envSlug: string; jobID: string; namespace: string }
  >({
    mutationFn: ({ slug, envSlug, jobID, namespace }) =>
      api.post(
        `/api/v1/workspaces/${slug}/environments/${envSlug}/nomad/jobs/${encodeURIComponent(jobID)}/start?namespace=${encodeURIComponent(namespace)}`,
        {},
      ),
    onSuccess: (_, { slug, envSlug, namespace }) => {
      void queryClient.invalidateQueries({ queryKey: nomadKeys.jobs(slug, envSlug, namespace) });
    },
  });
}

// ─── Registry ─────────────────────────────────────────────────────────────────

export const registryKeys = {
  all: (slug: string) => ["workspaces", slug, "registries"] as const,
  list: (slug: string) => ["workspaces", slug, "registries", "list"] as const,
  detail: (slug: string, id: string) => ["workspaces", slug, "registries", id] as const,
  repos: (slug: string, id: string) =>
    ["workspaces", slug, "registries", id, "repositories"] as const,
  tags: (slug: string, id: string, repo: string) =>
    ["workspaces", slug, "registries", id, "repositories", repo, "tags"] as const,
  bindings: (slug: string, envSlug: string) =>
    ["workspaces", slug, "environments", envSlug, "registries"] as const,
  boundRepos: (slug: string, envSlug: string, id: string) =>
    ["workspaces", slug, "environments", envSlug, "registries", id, "repositories"] as const,
  boundTags: (slug: string, envSlug: string, id: string, repo: string) =>
    [
      "workspaces",
      slug,
      "environments",
      envSlug,
      "registries",
      id,
      "repositories",
      repo,
      "tags",
    ] as const,
};

// GET /api/v1/workspaces/:slug/registries
export function useRegistries(slug: string) {
  return useQuery<RegistryProvider[], ApiError>({
    queryKey: registryKeys.list(slug),
    queryFn: () => api.get(`/api/v1/workspaces/${slug}/registries`),
    enabled: !!slug,
  });
}

// GET /api/v1/workspaces/:slug/registries/:id
export function useRegistry(slug: string, id: string) {
  return useQuery<RegistryProvider, ApiError>({
    queryKey: registryKeys.detail(slug, id),
    queryFn: () => api.get(`/api/v1/workspaces/${slug}/registries/${id}`),
    enabled: !!slug && !!id,
  });
}

// POST /api/v1/workspaces/:slug/registries
export function useCreateRegistry(slug: string) {
  const queryClient = useQueryClient();
  return useMutation<RegistryProvider, ApiError, CreateRegistryProviderInput>({
    mutationFn: (input) => api.post(`/api/v1/workspaces/${slug}/registries`, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: registryKeys.all(slug) });
    },
  });
}

// PUT /api/v1/workspaces/:slug/registries/:id
export function useUpdateRegistry(slug: string) {
  const queryClient = useQueryClient();
  return useMutation<
    RegistryProvider,
    ApiError,
    { id: string; input: UpdateRegistryProviderInput }
  >({
    mutationFn: ({ id, input }) => api.put(`/api/v1/workspaces/${slug}/registries/${id}`, input),
    onSuccess: (_, { id }) => {
      void queryClient.invalidateQueries({ queryKey: registryKeys.all(slug) });
      void queryClient.invalidateQueries({ queryKey: registryKeys.detail(slug, id) });
    },
  });
}

// DELETE /api/v1/workspaces/:slug/registries/:id
export function useDeleteRegistry(slug: string) {
  const queryClient = useQueryClient();
  return useMutation<void, ApiError, string>({
    mutationFn: (id) => api.delete(`/api/v1/workspaces/${slug}/registries/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: registryKeys.all(slug) });
    },
  });
}

// POST /api/v1/workspaces/:slug/registries/:id/validate
export function useValidateRegistry(slug: string) {
  return useMutation<{ message: string }, ApiError, string>({
    mutationFn: (id) => api.post(`/api/v1/workspaces/${slug}/registries/${id}/validate`, {}),
  });
}

// GET /api/v1/workspaces/:slug/registries/:id/repositories
export function useRegistryRepos(slug: string, id: string, enabled = true) {
  return useQuery<RegistryRepo[], ApiError>({
    queryKey: registryKeys.repos(slug, id),
    queryFn: () => api.get(`/api/v1/workspaces/${slug}/registries/${id}/repositories`),
    enabled: !!slug && !!id && enabled,
  });
}

// GET /api/v1/workspaces/:slug/registries/:id/tags?repo=<repoName>
export function useRegistryTags(slug: string, id: string, repoName: string, enabled = true) {
  return useQuery<RegistryTag[], ApiError>({
    queryKey: registryKeys.tags(slug, id, repoName),
    queryFn: () =>
      api.get(
        `/api/v1/workspaces/${slug}/registries/${id}/tags?repo=${encodeURIComponent(repoName)}`,
      ),
    enabled: !!slug && !!id && !!repoName && enabled,
  });
}

// GET /api/v1/workspaces/:slug/environments/:envSlug/registries
export function useEnvironmentRegistries(slug: string, envSlug: string) {
  return useQuery<RegistryBinding[], ApiError>({
    queryKey: registryKeys.bindings(slug, envSlug),
    queryFn: () => api.get(`/api/v1/workspaces/${slug}/environments/${envSlug}/registries`),
    enabled: !!slug && !!envSlug,
  });
}

// POST /api/v1/workspaces/:slug/environments/:envSlug/registries
export function useCreateBinding(slug: string, envSlug: string) {
  const queryClient = useQueryClient();
  return useMutation<RegistryBinding, ApiError, CreateRegistryBindingInput>({
    mutationFn: (input) =>
      api.post(`/api/v1/workspaces/${slug}/environments/${envSlug}/registries`, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: registryKeys.bindings(slug, envSlug) });
    },
  });
}

// DELETE /api/v1/workspaces/:slug/environments/:envSlug/registries/:bindingId
export function useDeleteBinding(slug: string, envSlug: string) {
  const queryClient = useQueryClient();
  return useMutation<void, ApiError, string>({
    mutationFn: (bindingId) =>
      api.delete(`/api/v1/workspaces/${slug}/environments/${envSlug}/registries/${bindingId}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: registryKeys.bindings(slug, envSlug) });
    },
  });
}

// GET /api/v1/workspaces/:slug/environments/:envSlug/registries/:id/repositories
export function useBoundRepos(slug: string, envSlug: string, registryId: string, enabled = true) {
  return useQuery<RegistryRepo[], ApiError>({
    queryKey: registryKeys.boundRepos(slug, envSlug, registryId),
    queryFn: () =>
      api.get(
        `/api/v1/workspaces/${slug}/environments/${envSlug}/registries/${registryId}/repositories`,
      ),
    enabled: !!slug && !!envSlug && !!registryId && enabled,
  });
}

// GET /api/v1/workspaces/:slug/environments/:envSlug/registries/:id/tags?repo=<repoName>
export function useBoundTags(
  slug: string,
  envSlug: string,
  registryId: string,
  repoName: string,
  enabled = true,
) {
  return useQuery<RegistryTag[], ApiError>({
    queryKey: registryKeys.boundTags(slug, envSlug, registryId, repoName),
    queryFn: () =>
      api.get(
        `/api/v1/workspaces/${slug}/environments/${envSlug}/registries/${registryId}/tags?repo=${encodeURIComponent(repoName)}`,
      ),
    enabled: !!slug && !!envSlug && !!registryId && !!repoName && enabled,
  });
}

// ─── Repository Providers ─────────────────────────────────────────────────────

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

// GET /api/v1/workspaces/:slug/repo-providers/:id/contents?repo=&[branch=]&[path=]
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

// ─── Kubernetes ───────────────────────────────────────────────────────────────

const k8sKeys = {
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
    [
      "workspaces",
      slug,
      "environments",
      envSlug,
      "kubernetes",
      "deployments",
      namespace,
      name,
    ] as const,
  podDetail: (slug: string, envSlug: string, namespace: string, name: string) =>
    ["workspaces", slug, "environments", envSlug, "kubernetes", "pods", namespace, name] as const,
  serviceDetail: (slug: string, envSlug: string, namespace: string, name: string) =>
    [
      "workspaces",
      slug,
      "environments",
      envSlug,
      "kubernetes",
      "services",
      namespace,
      name,
    ] as const,
};

// GET /api/v1/workspaces/:slug/environments/:envSlug/kubernetes/nodes
export function useK8sNodes(slug: string, envSlug: string, enabled = true) {
  return useQuery<K8sNodeStub[], ApiError>({
    queryKey: k8sKeys.nodes(slug, envSlug),
    queryFn: () => api.get(`/api/v1/workspaces/${slug}/environments/${envSlug}/kubernetes/nodes`),
    enabled: !!slug && !!envSlug && enabled,
  });
}

// GET /api/v1/workspaces/:slug/environments/:envSlug/kubernetes/namespaces
export function useK8sNamespaces(slug: string, envSlug: string, enabled = true) {
  return useQuery<K8sNamespaceStub[], ApiError>({
    queryKey: k8sKeys.namespaces(slug, envSlug),
    queryFn: () =>
      api.get(`/api/v1/workspaces/${slug}/environments/${envSlug}/kubernetes/namespaces`),
    enabled: !!slug && !!envSlug && enabled,
  });
}

// GET /api/v1/workspaces/:slug/environments/:envSlug/kubernetes/deployments?namespace=...
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

// GET /api/v1/workspaces/:slug/environments/:envSlug/kubernetes/pods?namespace=...
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

// GET /api/v1/workspaces/:slug/environments/:envSlug/kubernetes/services?namespace=...
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

// GET /api/v1/workspaces/:slug/environments/:envSlug/kubernetes/deployments/:namespace/:name
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

// GET /api/v1/workspaces/:slug/environments/:envSlug/kubernetes/pods/:namespace/:name
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

// GET /api/v1/workspaces/:slug/environments/:envSlug/kubernetes/services/:namespace/:name
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

// PATCH /api/v1/workspaces/:slug/environments/:envSlug/kubernetes/deployments/:namespace/:name/scale
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

// ─── Service Catalog ──────────────────────────────────────────────────────────

export const catalogKeys = {
  catalog: () => ["service-catalog"] as const,
  deployments: (slug: string, envSlug: string) =>
    ["workspaces", slug, "environments", envSlug, "service-deployments"] as const,
  deployment: (slug: string, envSlug: string, id: string) =>
    ["workspaces", slug, "environments", envSlug, "service-deployments", id] as const,
};

// GET /api/v1/service-catalog
export function useCatalog() {
  return useQuery<CatalogItem[], ApiError>({
    queryKey: catalogKeys.catalog(),
    queryFn: () => api.get("/api/v1/service-catalog"),
    staleTime: 60_000,
  });
}

// GET /api/v1/workspaces/:slug/environments/:envSlug/service-deployments
export function useServiceDeployments(slug: string, envSlug: string) {
  return useQuery<ServiceDeployment[], ApiError>({
    queryKey: catalogKeys.deployments(slug, envSlug),
    queryFn: () =>
      api.get(`/api/v1/workspaces/${slug}/environments/${envSlug}/service-deployments`),
    enabled: !!slug && !!envSlug,
    staleTime: 15_000,
  });
}

// POST /api/v1/workspaces/:slug/environments/:envSlug/service-deployments
export function useDeployService(slug: string, envSlug: string) {
  const queryClient = useQueryClient();
  return useMutation<ServiceDeployment, ApiError, DeployServiceInput>({
    mutationFn: (input) =>
      api.post(`/api/v1/workspaces/${slug}/environments/${envSlug}/service-deployments`, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: catalogKeys.deployments(slug, envSlug) });
    },
  });
}

// DELETE /api/v1/workspaces/:slug/environments/:envSlug/service-deployments/:id
export function useStopDeployment(slug: string, envSlug: string) {
  const queryClient = useQueryClient();
  return useMutation<void, ApiError, string>({
    mutationFn: (id) =>
      api.delete(`/api/v1/workspaces/${slug}/environments/${envSlug}/service-deployments/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: catalogKeys.deployments(slug, envSlug) });
    },
  });
}

// POST /api/v1/workspaces/:slug/environments/:envSlug/capabilities/:cap/provider/:providerID/verify
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

// ─── Docker ───────────────────────────────────────────────────────────────────

export const dockerKeys = {
  containers: (slug: string, envSlug: string) =>
    ["workspaces", slug, "environments", envSlug, "docker", "containers"] as const,
  container: (slug: string, envSlug: string, id: string) =>
    ["workspaces", slug, "environments", envSlug, "docker", "containers", id] as const,
  images: (slug: string, envSlug: string) =>
    ["workspaces", slug, "environments", envSlug, "docker", "images"] as const,
  networks: (slug: string, envSlug: string) =>
    ["workspaces", slug, "environments", envSlug, "docker", "networks"] as const,
  volumes: (slug: string, envSlug: string) =>
    ["workspaces", slug, "environments", envSlug, "docker", "volumes"] as const,
};

// GET /api/v1/workspaces/:slug/environments/:envSlug/docker/containers
export function useDockerContainers(slug: string, envSlug: string, enabled = true) {
  return useQuery<DockerContainerStub[], ApiError>({
    queryKey: dockerKeys.containers(slug, envSlug),
    queryFn: () => api.get(`/api/v1/workspaces/${slug}/environments/${envSlug}/docker/containers`),
    enabled: !!slug && !!envSlug && enabled,
    staleTime: 15_000,
  });
}

// GET /api/v1/workspaces/:slug/environments/:envSlug/docker/containers/:id
export function useDockerContainer(slug: string, envSlug: string, id: string, enabled = true) {
  return useQuery<DockerContainerDetail, ApiError>({
    queryKey: dockerKeys.container(slug, envSlug, id),
    queryFn: () =>
      api.get(
        `/api/v1/workspaces/${slug}/environments/${envSlug}/docker/containers/${encodeURIComponent(id)}`,
      ),
    enabled: !!slug && !!envSlug && !!id && enabled,
    staleTime: 10_000,
  });
}

// GET /api/v1/workspaces/:slug/environments/:envSlug/docker/images
export function useDockerImages(slug: string, envSlug: string, enabled = true) {
  return useQuery<DockerImageStub[], ApiError>({
    queryKey: dockerKeys.images(slug, envSlug),
    queryFn: () => api.get(`/api/v1/workspaces/${slug}/environments/${envSlug}/docker/images`),
    enabled: !!slug && !!envSlug && enabled,
    staleTime: 30_000,
  });
}

// GET /api/v1/workspaces/:slug/environments/:envSlug/docker/networks
export function useDockerNetworks(slug: string, envSlug: string, enabled = true) {
  return useQuery<DockerNetworkStub[], ApiError>({
    queryKey: dockerKeys.networks(slug, envSlug),
    queryFn: () => api.get(`/api/v1/workspaces/${slug}/environments/${envSlug}/docker/networks`),
    enabled: !!slug && !!envSlug && enabled,
    staleTime: 30_000,
  });
}

// GET /api/v1/workspaces/:slug/environments/:envSlug/docker/volumes
export function useDockerVolumes(slug: string, envSlug: string, enabled = true) {
  return useQuery<DockerVolumeStub[], ApiError>({
    queryKey: dockerKeys.volumes(slug, envSlug),
    queryFn: () => api.get(`/api/v1/workspaces/${slug}/environments/${envSlug}/docker/volumes`),
    enabled: !!slug && !!envSlug && enabled,
    staleTime: 30_000,
  });
}

// POST /api/v1/workspaces/:slug/environments/:envSlug/docker/containers/:id/start
// POST /api/v1/workspaces/:slug/environments/:envSlug/docker/containers/:id/stop
// POST /api/v1/workspaces/:slug/environments/:envSlug/docker/containers/:id/restart
export function useDockerContainerAction() {
  const queryClient = useQueryClient();
  return useMutation<
    { message: string },
    ApiError,
    { slug: string; envSlug: string; id: string; action: "start" | "stop" | "restart" }
  >({
    mutationFn: ({ slug, envSlug, id, action }) =>
      api.post(
        `/api/v1/workspaces/${slug}/environments/${envSlug}/docker/containers/${encodeURIComponent(id)}/${action}`,
        {},
      ),
    onSuccess: (_, { slug, envSlug, id }) => {
      void queryClient.invalidateQueries({ queryKey: dockerKeys.containers(slug, envSlug) });
      void queryClient.invalidateQueries({ queryKey: dockerKeys.container(slug, envSlug, id) });
    },
  });
}

// DELETE /api/v1/workspaces/:slug/environments/:envSlug/docker/containers/:id
export function useRemoveDockerContainer() {
  const queryClient = useQueryClient();
  return useMutation<{ message: string }, ApiError, { slug: string; envSlug: string; id: string }>({
    mutationFn: ({ slug, envSlug, id }) =>
      api.delete(
        `/api/v1/workspaces/${slug}/environments/${envSlug}/docker/containers/${encodeURIComponent(id)}`,
      ),
    onSuccess: (_, { slug, envSlug }) => {
      void queryClient.invalidateQueries({ queryKey: dockerKeys.containers(slug, envSlug) });
    },
  });
}

// ─── Runtime Logs ─────────────────────────────────────────────────────────────

// GET .../logs/providers
export function useLogsProviders(slug: string, envSlug: string) {
  return useQuery<LogsProviderInfo[]>({
    queryKey: ["logs-providers", slug, envSlug],
    queryFn: async () => {
      const runtime = await api.get<CapabilityStatusResponse>(
        `/api/v1/workspaces/${slug}/environments/${encodeURIComponent(envSlug)}/capabilities/runtime`,
      );
      return (runtime.providers ?? []).map((p) => ({
        name: p.provider_name,
        capabilities: {
          can_search: false,
          can_stream: true,
          can_list_labels: p.provider_name === "kubernetes",
        },
      }));
    },
    enabled: !!slug && !!envSlug,
    staleTime: 60_000,
    retry: false,
    refetchOnWindowFocus: false,
  });
}

// GET .../logs/workloads?runtime=...&namespace=...
export function useLogsWorkloads(
  slug: string,
  envSlug: string,
  runtime: string,
  namespace: string,
  enabled: boolean,
) {
  return useQuery<RuntimeWorkload[]>({
    queryKey: ["logs-workloads", slug, envSlug, runtime, namespace],
    queryFn: async () => {
      if (runtime === "nomad") {
        const jobs = await api.get<NomadJobStub[]>(
          `/api/v1/workspaces/${slug}/environments/${encodeURIComponent(envSlug)}/nomad/jobs` +
            `?namespace=${encodeURIComponent(namespace)}`,
        );
        return jobs.map((j) => ({
          id: j.ID,
          runtime: "nomad",
          type: j.Type === "service" ? "service" : "job",
          name: j.Name || j.ID,
          namespace: j.Namespace,
          status: j.Status,
          metadata: { job_type: j.Type },
        }));
      }

      if (runtime === "kubernetes") {
        const pods = await api.get<K8sPodStub[]>(
          `/api/v1/workspaces/${slug}/environments/${encodeURIComponent(envSlug)}/kubernetes/pods` +
            `?namespace=${encodeURIComponent(namespace)}`,
        );
        return pods.map((p) => ({
          id: p.name,
          runtime: "kubernetes",
          type: "task",
          name: p.name,
          namespace: p.namespace,
          status: p.phase,
          metadata: { containers: p.containers },
        }));
      }

      return [];
    },
    enabled: enabled && !!slug && !!envSlug && !!runtime,
    staleTime: 15_000,
    retry: false,
    refetchOnWindowFocus: false,
  });
}

// ─── Blueprints ───────────────────────────────────────────────────────────────

export const blueprintKeys = {
  all: () => ["blueprints"] as const,
  detail: (name: string) => ["blueprints", name] as const,
};

// GET /api/v1/blueprints
export function useBlueprints() {
  return useQuery<Blueprint[], ApiError>({
    queryKey: blueprintKeys.all(),
    queryFn: () => api.get("/api/v1/blueprints"),
    staleTime: 60_000,
    retry: false,
    refetchOnWindowFocus: false,
  });
}

// GET /api/v1/blueprints/:name
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

// ─── Platform Apps ────────────────────────────────────────────────────────────

export const platformAppKeys = {
  list: (slug: string, envSlug: string) =>
    ["workspaces", slug, "environments", envSlug, "platform-apps"] as const,
  detail: (slug: string, envSlug: string, id: string) =>
    ["workspaces", slug, "environments", envSlug, "platform-apps", id] as const,
};

// GET /api/v1/workspaces/:slug/environments/:envSlug/platform-apps
export function usePlatformApps(slug: string, envSlug: string) {
  return useQuery<PlatformApp[], ApiError>({
    queryKey: platformAppKeys.list(slug, envSlug),
    queryFn: () => api.get(`/api/v1/workspaces/${slug}/environments/${envSlug}/platform-apps`),
    enabled: !!slug && !!envSlug,
    staleTime: 15_000,
    retry: false,
    refetchOnWindowFocus: false,
  });
}

// GET /api/v1/workspaces/:slug/environments/:envSlug/platform-apps/:id
export function usePlatformApp(slug: string, envSlug: string, id: string) {
  return useQuery<PlatformApp, ApiError>({
    queryKey: platformAppKeys.detail(slug, envSlug, id),
    queryFn: () =>
      api.get(`/api/v1/workspaces/${slug}/environments/${envSlug}/platform-apps/${id}`),
    enabled: !!slug && !!envSlug && !!id,
    staleTime: 15_000,
    retry: false,
    refetchOnWindowFocus: false,
  });
}

// POST /api/v1/workspaces/:slug/environments/:envSlug/platform-apps/preview
export function usePreviewApp(slug: string, envSlug: string) {
  return useMutation<GeneratedResources, ApiError, PreviewAppInput>({
    mutationFn: (input) =>
      api.post(`/api/v1/workspaces/${slug}/environments/${envSlug}/platform-apps/preview`, input),
  });
}

// POST /api/v1/workspaces/:slug/environments/:envSlug/platform-apps
export function useProvisionApp(slug: string, envSlug: string) {
  const queryClient = useQueryClient();
  return useMutation<PlatformApp, ApiError, ProvisionAppInput>({
    mutationFn: (input) =>
      api.post(`/api/v1/workspaces/${slug}/environments/${envSlug}/platform-apps`, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: platformAppKeys.list(slug, envSlug),
      });
    },
  });
}

// DELETE /api/v1/workspaces/:slug/environments/:envSlug/platform-apps/:id
export function useDeletePlatformApp(slug: string, envSlug: string) {
  const queryClient = useQueryClient();
  return useMutation<void, ApiError, string>({
    mutationFn: (id) =>
      api.delete(`/api/v1/workspaces/${slug}/environments/${envSlug}/platform-apps/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: platformAppKeys.list(slug, envSlug),
      });
    },
  });
}
