// This file is a barrel re-export maintained for backward compatibility.
// All hooks now live in their respective modules/*/hooks/*.ts files.
// Existing imports from "@/lib/queries" continue to work without any changes.

export * from "@/modules/auth/hooks/use-auth";
export * from "@/modules/admin/hooks/use-users";
export * from "@/modules/admin/hooks/use-departments";
export * from "@/modules/admin/hooks/use-access-requests";
export * from "@/modules/workspaces/hooks/use-workspaces";
export * from "@/modules/workspaces/hooks/use-environments";
export * from "@/modules/platform/hooks/use-capabilities";
export * from "@/modules/compute/hooks/use-nomad";
export * from "@/modules/compute/hooks/use-k8s";
export * from "@/modules/compute/hooks/use-docker";
export * from "@/modules/secrets/hooks/use-secrets";
export * from "@/modules/registries/hooks/use-registries";
export * from "@/modules/repositories/hooks/use-repo-providers";
export * from "@/modules/service-catalog/hooks/use-catalog";
export * from "@/modules/observability/hooks/use-logs";
export * from "@/modules/blueprints/hooks/use-blueprints";
export * from "@/modules/blueprints/hooks/use-platform-apps";
