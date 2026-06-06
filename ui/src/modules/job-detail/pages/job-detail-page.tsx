import { useParams, useSearch, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2, AlertTriangle, ArrowLeft, Square, Play, Terminal } from "lucide-react";
import { DashboardTopbar } from "@/components/DashboardTopbar";
import { useWorkspaceContext } from "@/lib/workspace-context";
import {
  useNomadJob,
  useNomadAllocations,
  useNomadDeployments,
  useStopJob,
  useStartJob,
} from "@/lib/queries";
import { StopModal } from "../components/stop-modal";
import { LogsDrawer } from "../components/logs-drawer";
import { JobOverview } from "../components/job-overview";
import { AllocationsSection } from "../components/allocations-section";
import { DeploymentHistorySection } from "../components/deployment-history-section";

export function JobDetailPage() {
  const { envId, jobId } = useParams({ from: "/dashboard/environments/$envId/deployments/$jobId" });
  const { namespace } = useSearch({ from: "/dashboard/environments/$envId/deployments/$jobId" });
  const { selectedWorkspace } = useWorkspaceContext();
  const slug = selectedWorkspace?.slug ?? "";

  const [showStop, setShowStop] = useState(false);
  const [showLogs, setShowLogs] = useState(false);

  const {
    data: detail,
    isLoading: jobLoading,
    error: jobError,
  } = useNomadJob(slug, envId, jobId, namespace);
  const { data: allocs = [], isLoading: allocsLoading } = useNomadAllocations(
    slug,
    envId,
    jobId,
    namespace,
  );
  const { data: deployments = [], isLoading: deploymentsLoading } = useNomadDeployments(
    slug,
    envId,
    jobId,
    namespace,
  );

  const stopJob = useStopJob();
  const startJob = useStartJob();

  const canStop = detail?.Status === "running" || detail?.Status === "pending";
  const canStart = detail?.Status === "dead";

  const handleStop = async (purge: boolean) => {
    await stopJob.mutateAsync({ slug, envSlug: envId, jobID: jobId, namespace, purge });
    setShowStop(false);
  };

  return (
    <>
      <DashboardTopbar
        title={detail?.Name ?? jobId}
        subtitle={`Job detail · namespace: ${namespace}`}
      />

      <main className="p-6 space-y-8">
        <div className="flex items-center justify-between">
          <Link
            to="/dashboard/environments/$envId/deployments"
            params={{ envId }}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition"
          >
            <ArrowLeft className="size-3.5" /> Back to Deployments
          </Link>

          {detail && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowLogs(true)}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-border text-muted-foreground hover:bg-accent transition"
              >
                <Terminal className="size-3.5" /> Logs
              </button>
              {canStop && (
                <button
                  onClick={() => setShowStop(true)}
                  disabled={stopJob.isPending}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-destructive/40 text-destructive hover:bg-destructive/10 transition disabled:opacity-50"
                >
                  {stopJob.isPending ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Square className="size-3.5" />
                  )}{" "}
                  Stop
                </button>
              )}
              {canStart && (
                <button
                  onClick={() =>
                    void startJob.mutateAsync({ slug, envSlug: envId, jobID: jobId, namespace })
                  }
                  disabled={startJob.isPending}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-success/40 text-success hover:bg-success/10 transition disabled:opacity-50"
                >
                  {startJob.isPending ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Play className="size-3.5" />
                  )}{" "}
                  Start
                </button>
              )}
            </div>
          )}
        </div>

        {jobLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
            <Loader2 className="size-4 animate-spin" /> Loading job details…
          </div>
        )}
        {jobError && !jobLoading && (
          <div className="flex items-center gap-2 text-sm text-destructive py-4">
            <AlertTriangle className="size-4" /> Failed to load job details
          </div>
        )}

        {!jobLoading && detail && (
          <section className="space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Overview
            </p>
            <JobOverview detail={detail} />
          </section>
        )}

        {!jobLoading && detail && (
          <section className="space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Allocations {!allocsLoading && `(${allocs.length})`}
            </p>
            <AllocationsSection allocs={allocs} isLoading={allocsLoading} />
          </section>
        )}

        {!jobLoading && detail && (
          <section className="space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Deployment History
            </p>
            <DeploymentHistorySection
              deployments={deployments}
              isLoading={deploymentsLoading}
              jobType={detail.Type}
            />
          </section>
        )}
      </main>

      {showStop && detail && (
        <StopModal
          jobName={detail.Name}
          isPending={stopJob.isPending}
          onConfirm={(purge) => void handleStop(purge)}
          onCancel={() => setShowStop(false)}
        />
      )}
      {showLogs && detail && (
        <LogsDrawer
          jobID={jobId}
          jobName={detail.Name}
          slug={slug}
          envId={envId}
          namespace={namespace}
          onClose={() => setShowLogs(false)}
        />
      )}
    </>
  );
}
