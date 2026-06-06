export interface PlatformServiceSpec {
  name: string;
  type: string;
}

export interface PlatformRuntimeSpec {
  provider: 'nomad' | 'kubernetes' | 'docker';
  variant?: string;
  datacenter?: string;
  namespace?: string;
  worker_name?: string;
  k8s_namespace?: string;
  replicas?: number;
  network?: string;
}

export interface PlatformContainerSpec {
  image: string;
  tag: string;
  port: number;
  host_port?: number;
  cpu: number;
  memory_mb: number;
  health_path?: string;
}

export interface PlatformDeploymentSpec {
  strategy: 'rolling' | 'recreate' | 'canary';
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
  provider?: string;
  enabled: boolean;
  branch?: string;
  style?: string;
  build_context?: string;
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

export interface PlatformApp {
  id: string;
  workspace_id: string;
  environment_id: string;
  blueprint_id: string;
  blueprint_name: string;
  name: string;
  runtime_provider: string;
  status: 'pending' | 'provisioned' | 'failed' | 'stopped';
  generated_manifest?: string;
  runtime_job_id?: string;
  provisioned_by: string;
  spec: PlatformSpec;
  repo_provider_id?: string;
  repo_name?: string;
  repo_branch?: string;
  commit_sha?: string;
  pr_number?: number;
  pr_url?: string;
  repo_error?: string;
  created_at: string;
  updated_at: string;
}

export interface GeneratedResources {
  runtime_manifest?: string;
  runtime_provider: string;
  cicd_workflow?: string;
  cicd_provider?: string;
}

export interface RepositoryProvisionConfig {
  provider_id: string;
  repository: string;
  base_branch: string;
}

export interface ProvisionAppInput {
  blueprint_name: string;
  spec: PlatformSpec;
  override_manifest?: string;
  override_cicd?: string;
  repository?: RepositoryProvisionConfig;
  initial_secrets?: Record<string, string>;
  secret_grant_id?: string;
}

export interface PreviewAppInput {
  blueprint_name: string;
  spec: PlatformSpec;
}

export interface DeploymentRecord {
  id: string;
  platform_app_id: string;
  triggered_by: string;
  status: 'pending' | 'provisioned' | 'failed' | 'stopped';
  runtime_job_id?: string;
  repo_name?: string;
  repo_branch?: string;
  commit_sha?: string;
  pr_number?: number;
  pr_url?: string;
  cicd_provider?: string;
  message?: string;
  created_at: string;
}

export interface PlatformAppPage {
  items: PlatformApp[];
  total: number;
  page: number;
  limit: number;
}

export interface DeploymentHistoryPage {
  items: DeploymentRecord[];
  total: number;
  page: number;
  limit: number;
}
