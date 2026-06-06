// This file is a barrel re-export maintained for backward compatibility.
// All types now live in their respective modules/*/types.ts files.
// Existing imports from "@/lib/types" continue to work without any changes.

export * from "@/modules/auth/types";
export * from "@/modules/admin/types";
export * from "@/modules/workspaces/types";
export * from "@/modules/platform/types";
export * from "@/modules/secrets/types";
export * from "@/modules/registries/types";
export * from "@/modules/repositories/types";
export * from "@/modules/service-catalog/types";
export * from "@/modules/compute/types";
export * from "@/modules/observability/types";
export * from "@/modules/blueprints/types";
