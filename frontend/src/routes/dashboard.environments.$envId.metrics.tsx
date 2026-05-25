import { createFileRoute, useParams } from "@tanstack/react-router";
import { DashboardTopbar } from "@/components/DashboardTopbar";
import { LineChart, Construction } from "lucide-react";

export const Route = createFileRoute("/dashboard/environments/$envId/metrics")({
  head: () => ({ meta: [{ title: "Metrics · TernakClouds" }] }),
  component: EnvMetricsPage,
});

function EnvMetricsPage() {
  const { envId } = useParams({ from: "/dashboard/environments/$envId/metrics" });
  const envName = envId.charAt(0).toUpperCase() + envId.slice(1).replace(/-/g, " ");
  return (
    <>
      <DashboardTopbar title="Metrics" subtitle={`Performance metrics for ${envName}.`} />
      <main className="p-6 flex flex-col items-center justify-center py-32 text-center gap-4">
        <div className="size-14 rounded-2xl bg-secondary grid place-items-center">
          <LineChart className="size-7 text-muted-foreground" />
        </div>
        <div>
          <h2 className="font-semibold text-lg">Metrics</h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-xs">
            Performance and resource metrics for <span className="font-mono">{envId}</span> are
            coming soon.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground px-3 py-1.5 rounded-full border border-border bg-secondary">
          <Construction className="size-3.5" /> Under construction
        </span>
      </main>
    </>
  );
}
