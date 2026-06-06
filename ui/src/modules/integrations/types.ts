export type IntegrationType = 'nomad' | 'vault';

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
