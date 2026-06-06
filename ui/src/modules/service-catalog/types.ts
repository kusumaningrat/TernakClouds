export interface PortDef {
  name: string;
  container_port: number;
  protocol?: string;
  primary?: boolean;
}

export interface PortMapping {
  name: string;
  container_port: number;
  exposed_port?: number;
  protocol?: string;
}

export interface CatalogItem {
  id: string;
  name: string;
  display_name: string;
  description: string;
  category?: string;
  default_ports?: PortDef[];
  default_image: string;
  default_cpu: number;
  default_memory: number;
  health_check_type: string;
  health_check_path?: string;
  is_public_image: boolean;
  environment_config?: Record<string, string>;
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
  ports?: PortMapping[];
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
  ports?: PortMapping[];
  cpu?: number;
  memory?: number;
  // Nomad-specific
  datacenter?: string;
  namespace?: string;
  worker_name?: string;
  nomad_host_network?: "private" | "public";
  // Kubernetes-specific
  k8s_namespace?: string;
  replicas?: number;
  k8s_node_name?: string;
  // Registry
  registry_id?: string;
  image_path?: string;
  image_tag?: string;
  // Vault (Nomad only)
  vault_role?: string;
  vault_path?: string;
  env_mappings?: Record<string, string>;
  env_vars?: Record<string, string>;
}
