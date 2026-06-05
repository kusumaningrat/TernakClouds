import { createFileRoute, Link } from "@tanstack/react-router";
import { DashboardTopbar } from "@/components/DashboardTopbar";
import { useWorkspaceContext } from "@/lib/workspace-context";
import { useEnvironmentContext } from "@/lib/environment-context";
import { useEnvironments } from "@/lib/queries";
import { ScrollText, Globe, ChevronRight, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/dashboard/logs")({
  head: () => ({ meta: [{ title: "Logs · TernakClouds" }] }),
  component: LogsPage,
});

function LogsPage() {
  const { selectedWorkspace } = useWorkspaceContext();
  const { selectedEnvironment, setSelectedEnvironment } = useEnvironmentContext();
  const slug = selectedWorkspace?.slug ?? "";
  const { data: environments } = useEnvironments(slug);

  // If an environment is selected, redirect the user straight into that env's log stream
  if (selectedEnvironment) {
    return (
      <>
        <DashboardTopbar title="Logs" subtitle={`Streaming logs for ${selectedEnvironment.name}`} />
        <main className="p-6 space-y-4 overflow-auto">
          <div className="glass rounded-xl p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="size-9 rounded-lg bg-secondary grid place-items-center shrink-0">
                <Globe className="size-4 text-muted-foreground" />
              </div>
              <div>
                <div className="font-semibold text-sm">{selectedEnvironment.name}</div>
                <div className="text-xs text-muted-foreground font-mono">
                  {selectedEnvironment.slug}
                </div>
              </div>
            </div>
            <Link
              to="/dashboard/environments/$envId/logs"
              params={{ envId: selectedEnvironment.slug }}
              className="flex items-center justify-between px-4 py-3 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition"
            >
              <div className="flex items-center gap-2">
                <ScrollText className="size-4" />
                <span className="text-sm font-medium">
                  Open log stream for {selectedEnvironment.name}
                </span>
              </div>
              <ArrowRight className="size-4" />
            </Link>
          </div>

          <div>
            <p className="text-xs text-muted-foreground mb-3 px-1">Other environments</p>
            <div className="space-y-2">
              {(environments ?? [])
                .filter((e) => e.id !== selectedEnvironment.id)
                .map((env) => (
                  <Link
                    key={env.id}
                    to="/dashboard/environments/$envId/logs"
                    params={{ envId: env.slug }}
                    className="glass rounded-xl p-4 flex items-center gap-3 hover:bg-accent/50 transition group"
                  >
                    <div className="size-8 rounded-lg bg-secondary grid place-items-center shrink-0">
                      <ScrollText className="size-4 text-muted-foreground group-hover:text-primary transition" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{env.name}</div>
                      <div className="text-xs text-muted-foreground font-mono">{env.slug}</div>
                    </div>
                    <ChevronRight className="size-4 text-muted-foreground" />
                  </Link>
                ))}
            </div>
          </div>
        </main>
      </>
    );
  }

  // No environment selected — show picker
  return (
    <>
      <DashboardTopbar title="Logs" subtitle="Select an environment to stream logs." />
      <main className="p-6 space-y-4 overflow-auto">
        <p className="text-sm text-muted-foreground">
          Use the environment switcher at the top right, or pick an environment below.
        </p>
        <div className="space-y-2">
          {(environments ?? []).map((env) => (
            <Link
              key={env.id}
              to="/dashboard/environments/$envId/logs"
              params={{ envId: env.slug }}
              className="glass rounded-xl p-4 flex items-center gap-3 hover:bg-accent/50 transition group"
              onClick={() => setSelectedEnvironment(env)}
            >
              <div className="size-8 rounded-lg bg-secondary grid place-items-center shrink-0">
                <ScrollText className="size-4 text-muted-foreground group-hover:text-primary transition" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm">{env.name}</div>
                <div className="text-xs text-muted-foreground font-mono">{env.slug}</div>
              </div>
              <ChevronRight className="size-4 text-muted-foreground" />
            </Link>
          ))}
        </div>
        {(environments ?? []).length === 0 && (
          <div className="glass rounded-xl p-8 text-center">
            <ScrollText className="size-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm font-medium">No environments</p>
            <p className="text-xs text-muted-foreground mt-1">
              Create an environment first to stream logs.
            </p>
          </div>
        )}
      </main>
    </>
  );
}
