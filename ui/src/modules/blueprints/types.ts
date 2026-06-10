export interface BlueprintInput {
  key: string;
  label: string;
  /** "string" | "env_select" | "repo_provider_select" | "existing_deployment_select" */
  type: string;
  required: boolean;
  placeholder?: string;
  help_text?: string;
  default?: string;
}

export interface BlueprintStep {
  id: string;
  /** "deploy_catalog_item" | "write_secret" | "generate_cicd" | "generate_repository" | "configure_environment" */
  type: string;
  label: string;
  description?: string;
  config?: Record<string, unknown>;
}

export interface Blueprint {
  id: string;
  name: string;
  display_name: string;
  description: string;
  /** "provision" | "bootstrap" | "devops" | "environment" | "operate" */
  category: string;
  version: string;
  is_public: boolean;
  is_system: boolean;
  icon?: string;
  created_at: string;
  inputs_schema: BlueprintInput[];
  steps_config: BlueprintStep[];
}
