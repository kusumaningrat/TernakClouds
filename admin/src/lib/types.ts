// ─── Auth ────────────────────────────────────────────────────────────────────

export interface RegisterInput {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  department_name: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface RegisterResponse {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  created_at: string;
}

// GET /api/v1/auth/me — UserProfile embedded in MeResponse
export interface UserProfile {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  department_id: string;
  department_name: string;
  is_active: boolean;
}

// GET /api/v1/auth/me
export interface MeResponse extends UserProfile {
  roles: UserRole[];
}

// JWT payload (HS256, claims from backend pkg/jwt/jwt.go)
export interface JWTClaims {
  user_id: string;
  email: string;
  department_id: string;
  exp: number;
  iat: number;
}

// ─── Roles & Permissions ─────────────────────────────────────────────────────

export interface Permission {
  id: string;
  name: string; // e.g. "deployments:exec"
  resource: string; // e.g. "deployments"
  action: string; // e.g. "exec"
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface RolePermission {
  role_id: string;
  permission_id: string;
  permission?: Permission;
}

// GET /api/v1/roles and GET /api/v1/roles/:id
export interface Role {
  id: string;
  name: string;
  description?: string;
  role_permissions?: RolePermission[];
  created_at: string;
  updated_at: string;
}

// Used in MeResponse.roles and GET /api/v1/users/:id/roles
export interface UserRole {
  user_id: string;
  role_id: string;
  assigned_at: string;
  role?: Role;
}

// POST /api/v1/users/:id/roles input
export interface AssignRoleInput {
  role_id: string;
}

// GET /api/v1/users/:id/permissions/:permission
export interface PermissionCheck {
  user_id: string;
  permission: string;
  has_permission: boolean;
}

// ─── Departments ─────────────────────────────────────────────────────────────

export interface Department {
  id: string;
  name: string;
  slug: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface DepartmentList {
  items: Department[];
  total: number;
  page: number;
  limit: number;
}

export interface CreateDepartmentInput {
  name: string;
  slug: string;
  description?: string;
}

export interface UpdateDepartmentInput {
  name?: string;
  description?: string;
}

// ─── Workspaces ───────────────────────────────────────────────────────────────

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  description?: string;
  owner_id: string;
  created_at: string;
}

export interface WorkspaceMember {
  workspace_id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  role: "owner" | "member";
  joined_at: string;
}

export interface CreateWorkspaceInput {
  name: string;
  description?: string;
}

export interface UpdateWorkspaceInput {
  name?: string;
  description?: string;
}

export interface AddMemberInput {
  user_id: string;
}

// ─── Environments ─────────────────────────────────────────────────────────────

export interface WorkspaceEnvironment {
  id: string;
  workspace_id: string;
  name: string;
  slug: string;
  description?: string;
  order: number;
  created_at: string;
}

export interface CreateEnvironmentInput {
  name: string;
  description?: string;
}

export interface UpdateEnvironmentInput {
  name?: string;
  description?: string;
}

// ─── Integrations ─────────────────────────────────────────────────────────────

export type IntegrationType = "nomad" | "vault";

export interface Integration {
  id: string;
  workspace_id: string;
  name: string;
  type: IntegrationType;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface AddIntegrationInput {
  name: string;
  token: string;
}

// ─── Capabilities ─────────────────────────────────────────────────────────────

export interface ProviderConfigResponse {
  id: string;
  provider_name: string;
  display_name: string;
  endpoint: string;
  region?: string;
  namespace?: string;
  credential_type: string;
  created_at: string;
}

export interface CapabilityStatusResponse {
  capability_name: string;
  display_name: string;
  is_enabled: boolean;
  providers: ProviderConfigResponse[];
}

export interface CapabilityProvider {
  id: string;
  name: string;
  display_name: string;
  capability_name: string;
  description: string;
}

export interface BindProviderInput {
  provider_name: string;
  endpoint: string;
  region?: string;
  namespace?: string;
  token?: string;
}

export interface UpdateProviderInput {
  endpoint: string;
  region?: string;
  namespace?: string;
  token?: string; // optional — leave blank to keep existing
}

// ─── Users (admin list) ───────────────────────────────────────────────────────

export interface UserRoleSummary {
  role_id: string;
  role_name: string;
  description?: string;
  assigned_at: string;
}

export interface UserWorkspaceSummary {
  workspace_id: string;
  workspace_name: string;
  workspace_slug: string;
  role: "owner" | "member";
  joined_at: string;
}

export interface UserSummary {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  department_id: string;
  department_name: string;
  created_at: string;
  updated_at: string;
  roles: UserRoleSummary[];
  workspaces: UserWorkspaceSummary[];
}

export interface UserListResponse {
  items: UserSummary[];
  total: number;
  page: number;
  limit: number;
}

export interface UserListParams {
  workspace?: string;
  department_id?: string;
  role_id?: string;
  status?: "active" | "inactive" | "";
  page?: number;
  limit?: number;
}

// ─── Secrets ──────────────────────────────────────────────────────────────────

export interface SecretGrantMemberView {
  id: string;
  name: string;
  description: string;
  created_at: string;
}

export interface SecretGrantAdminView extends SecretGrantMemberView {
  vault_path: string;
  created_by: string;
  updated_at: string;
}

export type SecretGrant = SecretGrantAdminView | SecretGrantMemberView;

export function isAdminGrant(g: SecretGrant): g is SecretGrantAdminView {
  return "vault_path" in g;
}

export interface SecretEntry {
  path: string;
  data: Record<string, string>;
}

export interface SecretValueResponse {
  name: string;
  entries: SecretEntry[];
}

export interface WriteSecretInput {
  data: Record<string, string>;
}

export interface CreateSecretGrantInput {
  name: string;
  vault_path: string;
  description?: string;
}

export interface UpdateSecretGrantInput {
  name?: string;
  vault_path?: string;
  description?: string;
}

// ─── Access Requests ──────────────────────────────────────────────────────────

export interface WorkspaceDirectoryEntry {
  id: string;
  name: string;
  slug: string;
  description?: string;
}

export interface AccessRequest {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  workspace_id: string;
  workspace_name: string;
  workspace_slug: string;
  requested_role: string;
  reason: string;
  status: "pending" | "approved" | "denied";
  reviewed_by?: string;
  reviewed_at?: string;
  created_at: string;
}

export interface CreateAccessRequestInput {
  workspace_id: string;
  requested_role: string;
  reason?: string;
}

export interface ApproveAccessRequestInput {
  role?: string;
}

// ─── Registry ─────────────────────────────────────────────────────────────────

export type RegistryProviderType = "harbor" | "dockerhub" | "ghcr" | "ecr" | "gcr";

export interface RegistryProvider {
  id: string;
  workspace_id: string;
  name: string;
  provider_type: RegistryProviderType;
  endpoint?: string;
  description?: string;
  created_at: string;
}

export interface CreateRegistryProviderInput {
  name: string;
  provider_type: RegistryProviderType;
  endpoint?: string;
  description?: string;
  credentials?: Record<string, string>;
}

export interface UpdateRegistryProviderInput {
  name?: string;
  endpoint?: string;
  description?: string;
  credentials?: Record<string, string>;
}

export interface RegistryBinding {
  id: string;
  environment_id: string;
  registry_id: string;
  registry_name?: string;
  registry_type?: string;
  registry_endpoint?: string;
  allowed_paths?: string[];
  created_at: string;
}

export interface CreateRegistryBindingInput {
  registry_id: string;
  allowed_paths?: string[];
}

export interface RegistryRepo {
  name: string;
  uri?: string;
}

export interface RegistryTag {
  name: string;
  digest?: string;
  size?: number;
}

// ─── Service Catalog ──────────────────────────────────────────────────────────

export interface CatalogItem {
  id: string;
  name: string;
  display_name: string;
  description: string;
  default_image: string;
  default_container_port: number;
  default_cpu: number;
  default_memory: number;
  health_check_type: string;
  health_check_path?: string;
  is_public_image: boolean;
}

export interface ServiceDeployment {
  id: string;
  created_at: string;
  updated_at: string;
  workspace_id: string;
  environment_id: string;
  catalog_name: string;
  job_name: string;
  datacenter: string;
  namespace: string;
  worker_name: string;
  exposed_port: number;
  container_port: number;
  cpu: number;
  memory: number;
  image: string;
  registry_id?: string;
  nomad_job_id: string;
  status: string;
  deployed_by: string;
  job_definition?: string;
}

export interface DeployServiceInput {
  catalog_name: string;
  job_name: string;
  datacenter: string;
  namespace: string;
  worker_name: string;
  exposed_port: number;
  cpu?: number;
  memory?: number;
  registry_id?: string;
  image_path?: string;
  image_tag?: string;
  vault_role?: string;
  vault_path?: string;
  env_mappings?: Record<string, string>;
}

// ─── Nomad ────────────────────────────────────────────────────────────────────

export interface NomadDriverInfo {
  Detected: boolean;
  Healthy: boolean;
}

export interface NomadNodeStub {
  ID: string;
  Name: string;
  Address: string;
  Datacenter: string;
  NodeClass: string;
  Version: string;
  Status: string;
  StatusDescription: string;
  Drain: boolean;
  SchedulingEligibility: string;
  Drivers: Record<string, NomadDriverInfo>;
}

export interface NomadNamespace {
  Name: string;
  Description: string;
}

export interface NomadTaskGroupSummary {
  Queued: number;
  Complete: number;
  Failed: number;
  Running: number;
  Starting: number;
  Lost: number;
  Unknown: number;
}

export interface NomadJobStatusSummary {
  JobID: string;
  Namespace: string;
  Summary: Record<string, NomadTaskGroupSummary>;
}

export interface NomadJobStub {
  ID: string;
  ParentID: string;
  Name: string;
  Namespace: string;
  Type: string;
  Priority: number;
  Status: string;
  JobSummary: NomadJobStatusSummary;
  SubmitTime: number;
  Datacenters: string[];
}

export interface NomadTask {
  Name: string;
  Driver: string;
  Resources?: {
    CPU?: number;
    MemoryMB?: number;
  };
}

export interface NomadTaskGroup {
  Name: string;
  Count: number;
  Tasks?: NomadTask[];
}

export interface NomadJobDetail {
  ID: string;
  Name: string;
  Type: string;
  Status: string;
  Priority: number;
  Namespace: string;
  Datacenters: string[];
  Stop: boolean;
  TaskGroups?: NomadTaskGroup[];
  Meta?: Record<string, string>;
  SubmitTime?: number;
  ModifyTime?: number;
}

export interface NomadJobActionResponse {
  EvalID: string;
  EvalCreateIndex: number;
  JobModifyIndex: number;
  Index: number;
}

export interface NomadTaskState {
  State: string;
  Failed: boolean;
  Restarts: number;
  StartedAt: string;
  FinishedAt: string;
}

export interface NomadAllocationStub {
  ID: string;
  EvalID: string;
  Name: string;
  Namespace: string;
  NodeID: string;
  NodeName: string;
  JobID: string;
  TaskGroup: string;
  DesiredStatus: string;
  ClientStatus: string;
  TaskStates: Record<string, NomadTaskState>;
  CreateTime: number;
  ModifyTime: number;
}

// ─── Evaluations ──────────────────────────────────────────────────────────────

export interface NomadAllocMetrics {
  NodesEvaluated: number;
  NodesFiltered: number;
  NodesExhausted: number;
  DimensionExhausted: Record<string, number> | null;
  ConstraintFiltered: Record<string, number> | null;
  QuotaExhausted: string[] | null;
  CoalescedFailures: number;
}

export interface NomadEvalStub {
  ID: string;
  Namespace: string;
  Priority: number;
  Type: string;
  TriggeredBy: string;
  JobID: string;
  Status: string;
  StatusDescription: string;
  BlockedEval: string;
  FailedTGAllocs: Record<string, NomadAllocMetrics> | null;
  CreateTime: number;
  ModifyTime: number;
}

// ─── Deployments ──────────────────────────────────────────────────────────────

export interface NomadDeploymentTGSummary {
  DesiredTotal: number;
  PlacedAllocs: number;
  HealthyAllocs: number;
  UnhealthyAllocs: number;
  DesiredCanaries: number;
}

export interface NomadDeploymentStub {
  ID: string;
  Namespace: string;
  JobID: string;
  JobVersion: number;
  Status: string;
  StatusDescription: string;
  TaskGroups: Record<string, NomadDeploymentTGSummary> | null;
  CreateTime: number;
  ModifyTime: number;
}

// ─── Allocation detail (with task events) ─────────────────────────────────────

export interface NomadTaskEvent {
  Type: string;
  Time: number;
  DisplayMessage: string;
  Details: Record<string, string> | null;
  FailsTask: boolean;
}

export interface NomadTaskStateDetail {
  State: string;
  Failed: boolean;
  Restarts: number;
  StartedAt: string;
  FinishedAt: string;
  Events: NomadTaskEvent[];
}

export interface NomadAllocationDetail {
  ID: string;
  Name: string;
  Namespace: string;
  NodeID: string;
  NodeName: string;
  JobID: string;
  TaskGroup: string;
  DesiredStatus: string;
  ClientStatus: string;
  TaskStates: Record<string, NomadTaskStateDetail>;
  CreateTime: number;
  ModifyTime: number;
}

// ─── K8s ──────────────────────────────────────────────────────────────────────

export interface K8sNodeStub {
  name: string;
  status: string;
  roles: string[];
  version: string;
  age: string;
}

export interface K8sNamespaceStub {
  name: string;
  status: string;
}

export interface K8sPortStub {
  port: number;
  protocol: string;
  nodePort?: number;
}

export interface K8sDeploymentStub {
  name: string;
  namespace: string;
  desired: number;
  ready: number;
  upToDate: number;
  available: number;
  unavailable: number;
  createdAt: string;
}

export interface K8sPodStub {
  name: string;
  namespace: string;
  phase: string;
  nodeName: string;
  ready: string;
  restarts: number;
  containers: string[];
  createdAt: string;
}

export interface K8sServiceStub {
  name: string;
  namespace: string;
  type: string;
  clusterIP: string;
  ports: K8sPortStub[];
  createdAt: string;
}

// ─── K8s detail types ─────────────────────────────────────────────────────────

export interface K8sContainerPort {
  name?: string;
  containerPort: number;
  protocol: string;
}

export interface K8sContainerSpec {
  name: string;
  image: string;
  ports: K8sContainerPort[];
}

export interface K8sResourceCondition {
  type: string;
  status: string;
  reason?: string;
  message?: string;
}

export interface K8sDeploymentDetail {
  name: string;
  namespace: string;
  desired: number;
  ready: number;
  upToDate: number;
  available: number;
  unavailable: number;
  labels: Record<string, string>;
  selector: Record<string, string>;
  containers: K8sContainerSpec[];
  conditions: K8sResourceCondition[];
  createdAt: string;
}

export interface K8sContainerStateRunning {
  startedAt: string;
}
export interface K8sContainerStateWaiting {
  reason: string;
  message?: string;
}
export interface K8sContainerStateTerminated {
  exitCode: number;
  reason?: string;
  message?: string;
  finishedAt?: string;
}

export interface K8sContainerState {
  running?: K8sContainerStateRunning;
  waiting?: K8sContainerStateWaiting;
  terminated?: K8sContainerStateTerminated;
}

export interface K8sContainerDetail {
  name: string;
  image: string;
  ready: boolean;
  restartCount: number;
  state: K8sContainerState;
}

export interface K8sPodDetail {
  name: string;
  namespace: string;
  phase: string;
  nodeName: string;
  labels: Record<string, string>;
  containers: K8sContainerDetail[];
  conditions: K8sResourceCondition[];
  createdAt: string;
}

export interface K8sServiceDetail {
  name: string;
  namespace: string;
  type: string;
  clusterIP: string;
  externalIPs: string[];
  loadBalancerIPs: string[];
  selector: Record<string, string>;
  ports: K8sPortStub[];
  endpoints: string[];
  createdAt: string;
}

// ─── Docker ───────────────────────────────────────────────────────────────────

export interface DockerPortBinding {
  ip?: string;
  private_port: number;
  public_port?: number;
  type: string;
}

export interface DockerContainerStub {
  id: string;
  name: string;
  image: string;
  state: string;
  status: string;
  created: number;
  ports: DockerPortBinding[];
  labels: Record<string, string>;
}

export interface DockerContainerState {
  status: string;
  running: boolean;
  paused: boolean;
  restarting: boolean;
  exit_code: number;
  started_at: string;
  finished_at: string;
  error?: string;
}

export interface DockerContainerConfig {
  image: string;
  cmd?: string[];
  env?: string[];
  labels?: Record<string, string>;
}

export interface DockerContainerNetwork {
  name: string;
  ip_address: string;
  gateway: string;
}

export interface DockerBoundPort {
  private_port: string;
  host_ip?: string;
  host_port?: string;
}

export interface DockerContainerMount {
  type: string;
  source: string;
  destination: string;
  mode: string;
}

export interface DockerContainerDetail {
  id: string;
  name: string;
  image: string;
  image_id: string;
  created: string;
  state: DockerContainerState;
  config: DockerContainerConfig;
  networks: DockerContainerNetwork[];
  ports: DockerBoundPort[];
  mounts: DockerContainerMount[];
  restart_policy: string;
}

export interface DockerImageStub {
  id: string;
  tags: string[];
  size: number;
  created: number;
}

export interface DockerNetworkStub {
  id: string;
  name: string;
  driver: string;
  scope: string;
  subnet?: string;
}

export interface DockerVolumeStub {
  name: string;
  driver: string;
  mountpoint: string;
  scope: string;
}

// ─── Runtime Logs ─────────────────────────────────────────────────────────────

export type WorkloadType = "service" | "job" | "cron" | "task";

export interface RuntimeWorkload {
  id: string;
  runtime: string;
  type: WorkloadType;
  name: string;
  namespace?: string;
  status?: string;
  metadata?: Record<string, unknown>;
}

export interface LogsProviderInfo {
  name: string;
  capabilities: {
    can_search: boolean;
    can_stream: boolean;
    can_list_labels: boolean;
  };
}

// ─── Blueprints ───────────────────────────────────────────────────────────────

export interface Blueprint {
  id: string;
  name: string;
  display_name: string;
  description: string;
  category: "application" | "infrastructure";
  version: string;
  supported_runtimes: string[];
  is_public: boolean;
  is_system: boolean;
  icon?: string;
  created_at: string;
}

// ─── Platform Spec ────────────────────────────────────────────────────────────

export interface PlatformServiceSpec {
  name: string;
  type: string; // "web-api", "worker", "cron-job", "static-website", "background-processor"
}

export interface PlatformRuntimeSpec {
  provider: "nomad" | "kubernetes" | "docker";
  /** Selects manifest template variant. Nomad: ""|"v1"|"no-vault"|"with-volume". K8s: ""|"v1"|"with-hpa"|"with-ingress"|"with-pvc". */
  variant?: string;
  // Nomad
  datacenter?: string;
  namespace?: string;
  worker_name?: string;
  // Kubernetes
  k8s_namespace?: string;
  replicas?: number;
  // Docker
  network?: string;
}

export interface PlatformContainerSpec {
  image: string;
  tag: string;
  port: number;
  cpu: number;
  memory_mb: number;
  health_path?: string;
}

export interface PlatformDeploymentSpec {
  strategy: "rolling" | "recreate" | "canary";
}

export interface PlatformRegistrySpec {
  provider?: string;
  registry_id?: string;
  endpoint?: string;
  image_path?: string;
}

export interface PlatformSecretsSpec {
  provider?: string;
  vault_role?: string;
  vault_path?: string;
}

export interface PlatformCICDSpec {
  provider?: string; // "github-actions" | "gitlab-ci" | "jenkins"
  enabled: boolean;
  branch?: string;
  /** Deploy method: ""|"v1" = IDP API, "ssh", "nomad", "kubectl", "helm". */
  style?: string;
}

export interface PlatformObservabilitySpec {
  logs_enabled: boolean;
  metrics_enabled: boolean;
  labels?: Record<string, string>;
}

export interface PlatformSpec {
  service: PlatformServiceSpec;
  runtime: PlatformRuntimeSpec;
  container: PlatformContainerSpec;
  deployment: PlatformDeploymentSpec;
  registry: PlatformRegistrySpec;
  secrets: PlatformSecretsSpec;
  cicd: PlatformCICDSpec;
  observability: PlatformObservabilitySpec;
}

// ─── Platform Apps ────────────────────────────────────────────────────────────

export interface PlatformApp {
  id: string;
  workspace_id: string;
  environment_id: string;
  blueprint_id: string;
  blueprint_name: string;
  name: string;
  runtime_provider: string;
  status: "pending" | "provisioned" | "failed" | "stopped";
  generated_manifest?: string;
  runtime_job_id?: string;
  provisioned_by: string;
  spec: PlatformSpec;
  created_at: string;
  updated_at: string;
}

export interface GeneratedResources {
  runtime_manifest?: string;
  runtime_provider: string;
  cicd_workflow?: string;
  cicd_provider?: string;
}

export interface ProvisionAppInput {
  blueprint_name: string;
  spec: PlatformSpec;
  /** Manually edited manifest from the preview step overrides generated output. */
  override_manifest?: string;
  /** Manually edited CI/CD workflow from the preview step overrides generated output. */
  override_cicd?: string;
}

export interface PreviewAppInput {
  blueprint_name: string;
  spec: PlatformSpec;
}
