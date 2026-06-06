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
