import type { Blueprint, PlatformSpec, RepositoryProvisionConfig } from "@/lib/types";

export function buildDefaultSpec(bp: Blueprint, runtimeProvider: string): PlatformSpec {
  return {
    service: { name: "", type: bp.name },
    runtime: {
      provider: runtimeProvider as PlatformSpec["runtime"]["provider"],
      datacenter: "",
      namespace: "default",
      worker_name: "",
      k8s_namespace: "default",
      replicas: 1,
    },
    container: { image: "", tag: "latest", port: 8080, cpu: 256, memory_mb: 256 },
    deployment: { strategy: "rolling" },
    registry: {},
    secrets: {},
    cicd: { enabled: false, provider: "github-actions", branch: "main" },
    observability: { logs_enabled: true, metrics_enabled: false },
  };
}

export interface WizardDraft {
  step: number;
  spec: PlatformSpec;
  grantId: string;
  initialSecretsRaw: string;
  repoConfig: RepositoryProvisionConfig | null;
  buildContext: string;
}

function draftStorageKey(envSlug: string, blueprintName: string) {
  return `idp:blueprint-draft:${envSlug}:${blueprintName}`;
}

export function loadDraft(envSlug: string, blueprintName: string): WizardDraft | null {
  try {
    const raw = localStorage.getItem(draftStorageKey(envSlug, blueprintName));
    return raw ? (JSON.parse(raw) as WizardDraft) : null;
  } catch {
    return null;
  }
}

export function saveDraft(envSlug: string, blueprintName: string, draft: WizardDraft) {
  try {
    localStorage.setItem(draftStorageKey(envSlug, blueprintName), JSON.stringify(draft));
  } catch {
    // localStorage quota exceeded or unavailable
  }
}

export function clearDraft(envSlug: string, blueprintName: string) {
  try {
    localStorage.removeItem(draftStorageKey(envSlug, blueprintName));
  } catch {
    // ignore
  }
}

export function hasDraft(envSlug: string, blueprintName: string): boolean {
  try {
    return localStorage.getItem(draftStorageKey(envSlug, blueprintName)) !== null;
  } catch {
    return false;
  }
}
