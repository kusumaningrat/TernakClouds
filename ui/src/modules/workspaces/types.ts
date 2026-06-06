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
  role: 'owner' | 'member';
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

export interface WorkspaceDirectoryEntry {
  id: string;
  name: string;
  slug: string;
  description?: string;
}
