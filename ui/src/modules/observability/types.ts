export type WorkloadType = "service" | "job" | "cron" | "task";

export interface RuntimeWorkload {
  id: string;
  runtime: string;
  type: WorkloadType;
  name: string;
  namespace?: string;
  status?: string;
  metadata?: Record<string, unknown>;
}

export interface LogsProviderInfo {
  name: string;
  capabilities: {
    can_search: boolean;
    can_stream: boolean;
    can_list_labels: boolean;
  };
}
