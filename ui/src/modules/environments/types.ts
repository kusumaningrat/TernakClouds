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
