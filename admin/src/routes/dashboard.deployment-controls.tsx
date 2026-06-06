import { createFileRoute } from "@tanstack/react-router";
import { DashboardTopbar } from "@/components/DashboardTopbar";
import { Settings2, Construction } from "lucide-react";

export const Route = createFileRoute("/dashboard/deployment-controls")({
  head: () => ({ meta: [{ title: "Deployment Controls · TernakClouds" }] }),
  component: DeploymentControlsPage,
});

function DeploymentControlsPage() {
  return (
    <>
      <DashboardTopbar
        title="Deployment Controls"
        subtitle="Configure approval gates, rollback policies and deployment permissions."
      />
      <main className="p-6 flex flex-col items-center justify-center py-32 text-center gap-4">
        <div className="size-14 rounded-2xl bg-secondary grid place-items-center">
          <Settings2 className="size-7 text-muted-foreground" />
        </div>
        <div>
          <h2 className="font-semibold text-lg">Deployment Controls</h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-xs">
            Deployment policy management is coming soon. Define who can approve, deny and rollback
            deployments.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground px-3 py-1.5 rounded-full border border-border bg-secondary">
          <Construction className="size-3.5" /> Under construction
        </span>
      </main>
    </>
  );
}
