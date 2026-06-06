import { createFileRoute, useParams } from "@tanstack/react-router";
import { DashboardTopbar } from "@/components/DashboardTopbar";
import { Shield, Construction } from "lucide-react";

export const Route = createFileRoute("/dashboard/environments/$envId/policies")({
  head: () => ({ meta: [{ title: "Policies · TernakClouds" }] }),
  component: EnvPoliciesPage,
});

function EnvPoliciesPage() {
  const { envId } = useParams({ from: "/dashboard/environments/$envId/policies" });
  return (
    <>
      <DashboardTopbar
        title="Policies"
        subtitle={`Access policies and permission grants for ${envId}.`}
      />
      <main className="p-6 flex flex-col items-center justify-center py-32 text-center gap-4">
        <div className="size-14 rounded-2xl bg-secondary grid place-items-center">
          <Shield className="size-7 text-muted-foreground" />
        </div>
        <div>
          <h2 className="font-semibold text-lg">Access Policies</h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            Environment-scoped access policies and permission grants for{" "}
            <span className="font-mono">{envId}</span> are coming soon.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground px-3 py-1.5 rounded-full border border-border bg-secondary">
          <Construction className="size-3.5" /> Under construction
        </span>
      </main>
    </>
  );
}
