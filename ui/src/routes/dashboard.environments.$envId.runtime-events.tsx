import { createFileRoute, useParams } from "@tanstack/react-router";
import { DashboardTopbar } from "@/components/DashboardTopbar";
import { Zap, Construction } from "lucide-react";

export const Route = createFileRoute("/dashboard/environments/$envId/runtime-events")({
  head: () => ({ meta: [{ title: "Runtime Events · TernakClouds" }] }),
  component: EnvRuntimeEventsPage,
});

function EnvRuntimeEventsPage() {
  const { envId } = useParams({ from: "/dashboard/environments/$envId/runtime-events" });
  const envName = envId.charAt(0).toUpperCase() + envId.slice(1).replace(/-/g, " ");
  return (
    <>
      <DashboardTopbar title="Runtime Events" subtitle={`Real-time events from ${envName}.`} />
      <main className="p-6 flex flex-col items-center justify-center py-32 text-center gap-4">
        <div className="size-14 rounded-2xl bg-secondary grid place-items-center">
          <Zap className="size-7 text-muted-foreground" />
        </div>
        <div>
          <h2 className="font-semibold text-lg">Runtime Events</h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-xs">
            Live event stream for <span className="font-mono">{envId}</span> is coming soon.
            Includes container lifecycle, crash loops and autoscaling events.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground px-3 py-1.5 rounded-full border border-border bg-secondary">
          <Construction className="size-3.5" /> Under construction
        </span>
      </main>
    </>
  );
}
