import { createFileRoute, useParams } from "@tanstack/react-router";
import { DashboardTopbar } from "@/components/DashboardTopbar";
import { Settings2, Construction } from "lucide-react";

export const Route = createFileRoute("/dashboard/environments/$envId/settings")({
  head: () => ({ meta: [{ title: "Settings · TernakClouds" }] }),
  component: EnvSettingsPage,
});

function EnvSettingsPage() {
  const { envId } = useParams({ from: "/dashboard/environments/$envId/settings" });
  const envName = envId.charAt(0).toUpperCase() + envId.slice(1).replace(/-/g, " ");
  return (
    <>
      <DashboardTopbar title="Settings" subtitle={`Configuration for ${envName}.`} />
      <main className="p-6 flex flex-col items-center justify-center py-32 text-center gap-4">
        <div className="size-14 rounded-2xl bg-secondary grid place-items-center">
          <Settings2 className="size-7 text-muted-foreground" />
        </div>
        <div>
          <h2 className="font-semibold text-lg">Environment Settings</h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-xs">
            Configuration management for <span className="font-mono">{envId}</span> is coming soon.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground px-3 py-1.5 rounded-full border border-border bg-secondary">
          <Construction className="size-3.5" /> Under construction
        </span>
      </main>
    </>
  );
}
