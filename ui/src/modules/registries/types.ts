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
