export interface Permission {
  id: string;
  name: string;
  resource: string;
  action: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface RolePermission {
  role_id: string;
  permission_id: string;
  permission?: Permission;
}

export interface Role {
  id: string;
  name: string;
  description?: string;
  role_permissions?: RolePermission[];
  created_at: string;
  updated_at: string;
}

export interface UserRole {
  user_id: string;
  role_id: string;
  assigned_at: string;
  role?: Role;
}

export interface AssignRoleInput {
  role_id: string;
}

export interface PermissionCheck {
  user_id: string;
  permission: string;
  has_permission: boolean;
}

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

export interface CreateUserInput {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  department_id: string;
  role: string;
  workspace_id: string;
}

export interface UserListParams {
  workspace?: string;
  department_id?: string;
  role_id?: string;
  status?: "active" | "inactive" | "";
  page?: number;
  limit?: number;
}
