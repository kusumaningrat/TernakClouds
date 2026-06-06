import type { NomadJobStub, K8sDeploymentStub, DockerContainerStub } from "@/lib/types";

export type DrawerTarget =
  | { kind: "nomad"; job: NomadJobStub; namespace: string }
  | { kind: "k8s"; dep: K8sDeploymentStub }
  | { kind: "docker"; container: DockerContainerStub };

export type K8sFilter = "all" | "active" | "scaled-down";
