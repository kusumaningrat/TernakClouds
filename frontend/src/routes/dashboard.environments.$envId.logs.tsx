import { createFileRoute, useParams } from "@tanstack/react-router";
import { DashboardTopbar } from "@/components/DashboardTopbar";
import { ScrollText, Construction } from "lucide-react";

export const Route = createFileRoute("/dashboard/environments/$envId/logs")({
  head: () => ({ meta: [{ title: "Logs · TernakClouds" }] }),
  component: EnvLogsPage,
});

function EnvLogsPage() {
  const { envId } = useParams({ from: "/dashboard/environments/$envId/logs" });
  const envName = envId.charAt(0).toUpperCase() + envId.slice(1).replace(/-/g, " ");
  return (
    <>
      <DashboardTopbar title="Logs" subtitle={`Aggregated logs for ${envName}.`} />
      <main className="p-6 flex flex-col items-center justify-center py-32 text-center gap-4">
        <div className="size-14 rounded-2xl bg-secondary grid place-items-center">
          <ScrollText className="size-7 text-muted-foreground" />
        </div>
        <div>
          <h2 className="font-semibold text-lg">Logs</h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-xs">
            Log streaming for <span className="font-mono">{envId}</span> is coming soon.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground px-3 py-1.5 rounded-full border border-border bg-secondary">
          <Construction className="size-3.5" /> Under construction
        </span>
      </main>
    </>
  );
}
