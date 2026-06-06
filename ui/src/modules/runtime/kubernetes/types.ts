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
