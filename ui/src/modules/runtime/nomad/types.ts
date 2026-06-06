export interface NomadDriverInfo {
  Detected: boolean;
  Healthy: boolean;
}

export interface NomadNodeStub {
  ID: string;
  Name: string;
  Address: string;
  Datacenter: string;
  NodeClass: string;
  Version: string;
  Status: string;
  StatusDescription: string;
  Drain: boolean;
  SchedulingEligibility: string;
  Drivers: Record<string, NomadDriverInfo>;
}

export interface NomadNamespace {
  Name: string;
  Description: string;
}

export interface NomadTaskGroupSummary {
  Queued: number;
  Complete: number;
  Failed: number;
  Running: number;
  Starting: number;
  Lost: number;
  Unknown: number;
}

export interface NomadJobStatusSummary {
  JobID: string;
  Namespace: string;
  Summary: Record<string, NomadTaskGroupSummary>;
}

export interface NomadJobStub {
  ID: string;
  ParentID: string;
  Name: string;
  Namespace: string;
  Type: string;
  Priority: number;
  Status: string;
  JobSummary: NomadJobStatusSummary;
  SubmitTime: number;
  Datacenters: string[];
}

export interface NomadTask {
  Name: string;
  Driver: string;
  Resources?: {
    CPU?: number;
    MemoryMB?: number;
  };
}

export interface NomadTaskGroup {
  Name: string;
  Count: number;
  Tasks?: NomadTask[];
}

export interface NomadJobDetail {
  ID: string;
  Name: string;
  Type: string;
  Status: string;
  Priority: number;
  Namespace: string;
  Datacenters: string[];
  Stop: boolean;
  TaskGroups?: NomadTaskGroup[];
  Meta?: Record<string, string>;
  SubmitTime?: number;
  ModifyTime?: number;
}

export interface NomadJobActionResponse {
  EvalID: string;
  EvalCreateIndex: number;
  JobModifyIndex: number;
  Index: number;
}

export interface NomadTaskState {
  State: string;
  Failed: boolean;
  Restarts: number;
  StartedAt: string;
  FinishedAt: string;
}

export interface NomadAllocationStub {
  ID: string;
  EvalID: string;
  Name: string;
  Namespace: string;
  NodeID: string;
  NodeName: string;
  JobID: string;
  TaskGroup: string;
  DesiredStatus: string;
  ClientStatus: string;
  TaskStates: Record<string, NomadTaskState>;
  CreateTime: number;
  ModifyTime: number;
}

export interface NomadAllocMetrics {
  NodesEvaluated: number;
  NodesFiltered: number;
  NodesExhausted: number;
  DimensionExhausted: Record<string, number> | null;
  ConstraintFiltered: Record<string, number> | null;
  QuotaExhausted: string[] | null;
  CoalescedFailures: number;
}

export interface NomadEvalStub {
  ID: string;
  Namespace: string;
  Priority: number;
  Type: string;
  TriggeredBy: string;
  JobID: string;
  Status: string;
  StatusDescription: string;
  BlockedEval: string;
  FailedTGAllocs: Record<string, NomadAllocMetrics> | null;
  CreateTime: number;
  ModifyTime: number;
}

export interface NomadDeploymentTGSummary {
  DesiredTotal: number;
  PlacedAllocs: number;
  HealthyAllocs: number;
  UnhealthyAllocs: number;
  DesiredCanaries: number;
}

export interface NomadDeploymentStub {
  ID: string;
  Namespace: string;
  JobID: string;
  JobVersion: number;
  Status: string;
  StatusDescription: string;
  TaskGroups: Record<string, NomadDeploymentTGSummary> | null;
  CreateTime: number;
  ModifyTime: number;
}

export interface NomadTaskEvent {
  Type: string;
  Time: number;
  DisplayMessage: string;
  Details: Record<string, string> | null;
  FailsTask: boolean;
}

export interface NomadTaskStateDetail {
  State: string;
  Failed: boolean;
  Restarts: number;
  StartedAt: string;
  FinishedAt: string;
  Events: NomadTaskEvent[];
}

export interface NomadAllocationDetail {
  ID: string;
  Name: string;
  Namespace: string;
  NodeID: string;
  NodeName: string;
  JobID: string;
  TaskGroup: string;
  DesiredStatus: string;
  ClientStatus: string;
  TaskStates: Record<string, NomadTaskStateDetail>;
  CreateTime: number;
  ModifyTime: number;
}
