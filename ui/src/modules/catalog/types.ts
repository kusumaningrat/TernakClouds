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
  host_network: string;
  exposed_port: number;
  container_port: number;
  cpu: number;
  memory: number;
  image: string;
  registry_id?: string;
  nomad_job_id: string;
  runtime_provider: string;
  runtime_job_id: string;
  status: string;
  deployed_by: string;
  job_definition?: string;
}

export interface DeployServiceInput {
  catalog_name: string;
  job_name: string;
  runtime_provider: string;
  exposed_port: number;
  cpu?: number;
  memory?: number;
  datacenter?: string;
  namespace?: string;
  worker_name?: string;
  host_network?: string;
  k8s_namespace?: string;
  replicas?: number;
  k8s_node_name?: string;
  registry_id?: string;
  image_path?: string;
  image_tag?: string;
  vault_role?: string;
  vault_path?: string;
  env_mappings?: Record<string, string>;
}
