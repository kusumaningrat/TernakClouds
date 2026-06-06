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
  status: 'pending' | 'approved' | 'denied';
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
