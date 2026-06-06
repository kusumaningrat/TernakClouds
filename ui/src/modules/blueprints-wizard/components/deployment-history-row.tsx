import { GitBranch, GitCommit, ExternalLink } from "lucide-react";
import type { DeploymentRecord } from "@/lib/types";
import { shortSHA, relativeTime, cicdPipelineUrl, commitUrl, StatusBadge } from "../utils/deployment-history";

export function DeploymentHistoryRow({ rec }: { rec: DeploymentRecord }) {
  const sha = shortSHA(rec.commit_sha);
  const pipeline = cicdPipelineUrl(rec);
  const commit = commitUrl(rec);

  return (
    <div className="flex items-center gap-3 py-2 px-3 rounded-md hover:bg-muted/40 transition text-xs">
      <StatusBadge status={rec.status} />

      <div className="flex items-center gap-1.5 text-muted-foreground min-w-0 flex-1">
        {rec.repo_branch && (
          <span className="flex items-center gap-1 font-mono">
            <GitBranch className="size-3 shrink-0" />
            {rec.repo_branch}
          </span>
        )}
        {sha && (
          <>
            <span className="text-muted-foreground/40">@</span>
            {commit ? (
              <a
                href={commit}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 font-mono hover:text-primary transition"
              >
                <GitCommit className="size-3 shrink-0" />
                {sha}
              </a>
            ) : (
              <span className="flex items-center gap-1 font-mono">
                <GitCommit className="size-3 shrink-0" />
                {sha}
              </span>
            )}
          </>
        )}
        {(rec.pr_number ?? 0) > 0 && (
          <span className="text-muted-foreground/60">· PR #{rec.pr_number}</span>
        )}
        {rec.cicd_provider && (
          <span className="px-1 py-0.5 rounded bg-secondary text-[10px] font-mono">
            {rec.cicd_provider}
          </span>
        )}
      </div>

      <span className="text-muted-foreground shrink-0">{relativeTime(rec.created_at)}</span>

      {pipeline && (
        <a
          href={pipeline}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-primary hover:underline shrink-0"
        >
          <ExternalLink className="size-3" />
          {rec.pr_url ? "PR" : "Pipeline"}
        </a>
      )}
    </div>
  );
}
