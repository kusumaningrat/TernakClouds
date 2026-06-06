import { Loader2 } from "lucide-react";
import type { NomadDeploymentStub } from "@/lib/types";
import { formatTime, DEPLOY_STATUS } from "../utils/status";

export function DeploymentHistorySection({
  deployments,
  isLoading,
  jobType,
}: {
  deployments: NomadDeploymentStub[];
  isLoading: boolean;
  jobType: string;
}) {
  if (jobType !== "service") {
    return (
      <p className="text-sm text-muted-foreground py-4">
        Deployment history is only tracked for <span className="font-mono">service</span> type jobs.
      </p>
    );
  }
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
        <Loader2 className="size-4 animate-spin" /> Loading deployments…
      </div>
    );
  }
  if (deployments.length === 0) {
    return <p className="text-sm text-muted-foreground py-4">No deployments recorded.</p>;
  }

  const sorted = [...deployments].sort((a, b) => b.ModifyTime - a.ModifyTime).slice(0, 10);

  return (
    <div className="space-y-2">
      {sorted.map((dep: NomadDeploymentStub) => {
        const st = DEPLOY_STATUS[dep.Status] ?? {
          dot: "bg-muted-foreground",
          text: "text-muted-foreground",
        };
        return (
          <div key={dep.ID} className="rounded-lg border border-border bg-card p-3 space-y-2">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1.5">
                <span className={`size-1.5 rounded-full shrink-0 ${st.dot}`} />
                <span className={`text-[11px] font-semibold capitalize ${st.text}`}>
                  {dep.Status}
                </span>
              </div>
              <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-secondary border border-border text-muted-foreground">
                v{dep.JobVersion}
              </span>
              {dep.StatusDescription && (
                <span className="text-[11px] text-muted-foreground">{dep.StatusDescription}</span>
              )}
              <span className="text-[11px] font-mono text-muted-foreground ml-auto">
                {formatTime(dep.ModifyTime)}
              </span>
            </div>
            {dep.TaskGroups && Object.keys(dep.TaskGroups).length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1 border-t border-border">
                {Object.entries(dep.TaskGroups).map(([tg, tgs]) => (
                  <div key={tg} className="flex items-center gap-2 text-[11px]">
                    <span className="font-mono font-medium text-foreground truncate">{tg}</span>
                    <span className="text-muted-foreground shrink-0">
                      {tgs.PlacedAllocs}/{tgs.DesiredTotal} placed
                    </span>
                    <span className="text-success shrink-0">{tgs.HealthyAllocs} healthy</span>
                    {tgs.UnhealthyAllocs > 0 && (
                      <span className="text-destructive shrink-0">
                        {tgs.UnhealthyAllocs} unhealthy
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
