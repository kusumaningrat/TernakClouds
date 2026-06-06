import { useParams, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Loader2, Server } from "lucide-react";
import { DashboardTopbar } from "@/components/DashboardTopbar";
import { useWorkspaceContext } from "@/lib/workspace-context";
import { useCapability } from "@/lib/queries";
import { JobsListView } from "../components/nomad-jobs-view";
import { K8sDeploymentsListView } from "../components/k8s-deployments-view";
import { DockerContainersListView } from "../components/docker-containers-view";

type Tab = "nomad" | "k8s" | "docker";

export function DeploymentsListPage() {
  const { envId } = useParams({
    from: "/dashboard/environments/$envId/deployments/",
  });
  const { selectedWorkspace } = useWorkspaceContext();
  const slug = selectedWorkspace?.slug ?? "";

  const { data: status, isLoading: capLoading } = useCapability(slug, envId, "runtime");
  const hasNomad = (status?.providers ?? []).some((p) => p.provider_name === "nomad");
  const hasK8s = (status?.providers ?? []).some((p) => p.provider_name === "kubernetes");
  const hasDocker = (status?.providers ?? []).some((p) => p.provider_name === "docker");
  const hasAny = hasNomad || hasK8s || hasDocker;

  const [activeTab, setActiveTab] = useState<Tab>("nomad");

  useEffect(() => {
    if (capLoading) return;
    setActiveTab((prev) => {
      if (prev === "nomad" && hasNomad) return prev;
      if (prev === "k8s" && hasK8s) return prev;
      if (prev === "docker" && hasDocker) return prev;
      return hasNomad ? "nomad" : hasK8s ? "k8s" : "docker";
    });
  }, [hasNomad, hasK8s, hasDocker, capLoading]);

  const tabs: { key: Tab; label: string; enabled: boolean }[] = [
    { key: "nomad", label: "Nomad", enabled: hasNomad },
    { key: "k8s", label: "Kubernetes", enabled: hasK8s },
    { key: "docker", label: "Docker", enabled: hasDocker },
  ];

  return (
    <>
      <DashboardTopbar title="Deployments" subtitle="Release history for this environment." />

      {capLoading && (
        <main className="p-6 flex items-center justify-center py-32">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </main>
      )}

      {!capLoading && !hasAny && (
        <main className="p-6 flex flex-col items-center justify-center py-32 text-center gap-4">
          <div className="size-12 rounded-2xl bg-secondary grid place-items-center">
            <Server className="size-6 text-muted-foreground" />
          </div>
          <div>
            <p className="font-semibold">No runtime provider configured</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-xs">
              Bind a Nomad, Kubernetes, or Docker provider to the Runtime capability to view
              deployments.
            </p>
          </div>
          <Link
            to={`/dashboard/environments/${envId}/platform/runtime` as never}
            className="text-sm text-primary hover:underline"
          >
            Configure Runtime →
          </Link>
        </main>
      )}

      {!capLoading && hasAny && slug && (
        <main className="p-6 space-y-4">
          {tabs.filter((t) => t.enabled).length > 1 && (
            <div className="flex border-b border-border">
              {tabs.map(({ key, label, enabled }) =>
                enabled ? (
                  <button
                    key={key}
                    onClick={() => setActiveTab(key)}
                    className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition ${
                      activeTab === key
                        ? "border-primary text-foreground"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {label}
                  </button>
                ) : null,
              )}
            </div>
          )}

          {activeTab === "nomad" && hasNomad && (
            <JobsListView key={envId} slug={slug} envId={envId} />
          )}
          {activeTab === "k8s" && hasK8s && (
            <K8sDeploymentsListView key={envId} slug={slug} envId={envId} />
          )}
          {activeTab === "docker" && hasDocker && (
            <DockerContainersListView key={envId} slug={slug} envId={envId} />
          )}
        </main>
      )}
    </>
  );
}
