// ─── Nomad ────────────────────────────────────────────────────────────────────

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

// ─── Kubernetes ───────────────────────────────────────────────────────────────

export interface K8sNodeStub {
  name: string;
  status: string;
  roles: string[];
  version: string;
  age: string;
}

export interface K8sNamespaceStub {
  name: string;
  status: string;
}

export interface K8sPortStub {
  port: number;
  protocol: string;
  nodePort?: number;
}

export interface K8sDeploymentStub {
  name: string;
  namespace: string;
  desired: number;
  ready: number;
  upToDate: number;
  available: number;
  unavailable: number;
  createdAt: string;
}

export interface K8sPodStub {
  name: string;
  namespace: string;
  phase: string;
  nodeName: string;
  ready: string;
  restarts: number;
  containers: string[];
  createdAt: string;
}

export interface K8sServiceStub {
  name: string;
  namespace: string;
  type: string;
  clusterIP: string;
  ports: K8sPortStub[];
  createdAt: string;
}

export interface K8sContainerPort {
  name?: string;
  containerPort: number;
  protocol: string;
}

export interface K8sContainerSpec {
  name: string;
  image: string;
  ports: K8sContainerPort[];
}

export interface K8sResourceCondition {
  type: string;
  status: string;
  reason?: string;
  message?: string;
}

export interface K8sDeploymentDetail {
  name: string;
  namespace: string;
  desired: number;
  ready: number;
  upToDate: number;
  available: number;
  unavailable: number;
  labels: Record<string, string>;
  selector: Record<string, string>;
  containers: K8sContainerSpec[];
  conditions: K8sResourceCondition[];
  createdAt: string;
}

export interface K8sContainerStateRunning {
  startedAt: string;
}

export interface K8sContainerStateWaiting {
  reason: string;
  message?: string;
}

export interface K8sContainerStateTerminated {
  exitCode: number;
  reason?: string;
  message?: string;
  finishedAt?: string;
}

export interface K8sContainerState {
  running?: K8sContainerStateRunning;
  waiting?: K8sContainerStateWaiting;
  terminated?: K8sContainerStateTerminated;
}

export interface K8sContainerDetail {
  name: string;
  image: string;
  ready: boolean;
  restartCount: number;
  state: K8sContainerState;
}

export interface K8sPodDetail {
  name: string;
  namespace: string;
  phase: string;
  nodeName: string;
  labels: Record<string, string>;
  containers: K8sContainerDetail[];
  conditions: K8sResourceCondition[];
  createdAt: string;
}

export interface K8sServiceDetail {
  name: string;
  namespace: string;
  type: string;
  clusterIP: string;
  externalIPs: string[];
  loadBalancerIPs: string[];
  selector: Record<string, string>;
  ports: K8sPortStub[];
  endpoints: string[];
  createdAt: string;
}

// ─── Docker ───────────────────────────────────────────────────────────────────

export interface DockerPortBinding {
  ip?: string;
  private_port: number;
  public_port?: number;
  type: string;
}

export interface DockerContainerStub {
  id: string;
  name: string;
  image: string;
  state: string;
  status: string;
  created: number;
  ports: DockerPortBinding[];
  labels: Record<string, string>;
}

export interface DockerContainerState {
  status: string;
  running: boolean;
  paused: boolean;
  restarting: boolean;
  exit_code: number;
  started_at: string;
  finished_at: string;
  error?: string;
}

export interface DockerContainerConfig {
  image: string;
  cmd?: string[];
  env?: string[];
  labels?: Record<string, string>;
}

export interface DockerContainerNetwork {
  name: string;
  ip_address: string;
  gateway: string;
}

export interface DockerBoundPort {
  private_port: string;
  host_ip?: string;
  host_port?: string;
}

export interface DockerContainerMount {
  type: string;
  source: string;
  destination: string;
  mode: string;
}

export interface DockerContainerDetail {
  id: string;
  name: string;
  image: string;
  image_id: string;
  created: string;
  state: DockerContainerState;
  config: DockerContainerConfig;
  networks: DockerContainerNetwork[];
  ports: DockerBoundPort[];
  mounts: DockerContainerMount[];
  restart_policy: string;
}

export interface DockerImageStub {
  id: string;
  tags: string[];
  size: number;
  created: number;
}

export interface DockerNetworkStub {
  id: string;
  name: string;
  driver: string;
  scope: string;
  subnet?: string;
}

export interface DockerVolumeStub {
  name: string;
  driver: string;
  mountpoint: string;
  scope: string;
}
