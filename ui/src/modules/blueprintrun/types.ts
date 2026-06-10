export interface BlueprintRunStep {
  id: string;
  step_id: string;
  step_type: string;
  label: string;
  /** "pending" | "running" | "completed" | "failed" | "skipped" */
  status: string;
  output: Record<string, unknown>;
  error?: string;
  started_at?: string;
  completed_at?: string;
}

export interface BlueprintRun {
  id: string;
  blueprint_id: string;
  blueprint_name: string;
  workspace_id: string;
  environment_id: string;
  environment_slug: string;
  triggered_by: string;
  /** "pending" | "running" | "completed" | "failed" */
  status: string;
  inputs: Record<string, unknown>;
  steps: BlueprintRunStep[];
  completed_at?: string;
  created_at: string;
}

export interface BlueprintRunPage {
  items: BlueprintRun[];
  total: number;
  page: number;
  limit: number;
}

export interface TriggerRunInput {
  blueprint_name: string;
  environment_id: string;
  environment_slug: string;
  inputs: Record<string, unknown>;
}
