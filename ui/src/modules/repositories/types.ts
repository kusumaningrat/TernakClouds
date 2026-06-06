export type RepoProviderType = 'github' | 'gitlab';

export interface RepoProvider {
  id: string;
  workspace_id: string;
  name: string;
  provider_type: RepoProviderType;
  base_url?: string;
  description?: string;
  allowed_repos?: string[];
  created_at: string;
}

export interface CreateRepoProviderInput {
  name: string;
  provider_type: RepoProviderType;
  base_url?: string;
  description?: string;
  credentials?: Record<string, string>;
  allowed_repos?: string[];
}

export interface UpdateRepoProviderInput {
  name?: string;
  base_url?: string;
  description?: string;
  credentials?: Record<string, string>;
  allowed_repos?: string[];
}

export interface SCMRepo {
  provider: string;
  organization: string;
  name: string;
  full_name: string;
  default_branch?: string;
  visibility?: string;
  clone_url?: string;
}

export interface SCMBranch {
  name: string;
  protected: boolean;
  sha?: string;
}

export interface SCMContentEntry {
  name: string;
  path: string;
  type: 'dir' | 'file';
}

export interface CommitFilesInput {
  repository: string;
  branch: string;
  message: string;
  files: { path: string; content: string }[];
  create_branch?: boolean;
}

export interface CommitResult {
  sha: string;
  branch: string;
  url?: string;
}

export interface PullRequestInput {
  repository: string;
  title: string;
  body?: string;
  head: string;
  base: string;
  reviewers?: string[];
}

export interface PullRequestResult {
  number: number;
  url: string;
  state: string;
}

export interface ProviderCapabilities {
  pull_requests: boolean;
  merge_requests: boolean;
  branch_protection: boolean;
}
