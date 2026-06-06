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
  return 'vault_path' in g;
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
