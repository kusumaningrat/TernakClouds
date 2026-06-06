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
