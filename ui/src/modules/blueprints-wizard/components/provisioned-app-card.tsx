import { useState } from "react";
import { Loader2, GitBranch, GitCommit, History, ChevronUp, ChevronDown, Trash2 } from "lucide-react";
import type { PlatformApp } from "@/lib/types";
import { useAppDeployments } from "@/lib/queries";
import { shortSHA, relativeTime, StatusBadge } from "../utils/deployment-history";
import { DeploymentHistoryRow } from "./deployment-history-row";
import { PageBar } from "./page-bar";

const HIST_LIMIT = 5;

export function ProvisionedAppCard({
  app,
  workspaceSlug,
  envSlug,
  onDelete,
}: {
  app: PlatformApp;
  workspaceSlug: string;
  envSlug: string;
  onDelete: (id: string, name: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [histPage, setHistPage] = useState(1);
  const { data: histData, isLoading: histLoading } = useAppDeployments(
    workspaceSlug,
    envSlug,
    expanded ? app.id : "",
    histPage,
    HIST_LIMIT,
  );

  const sha = shortSHA(app.commit_sha);
  const deployments = histData?.items ?? [];
  const totalPages = histData ? Math.max(1, Math.ceil(histData.total / HIST_LIMIT)) : 1;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* App summary row */}
      <div className="px-4 py-3 flex items-center gap-3">
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm">{app.name}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground font-mono">
              {app.blueprint_name}
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground font-mono">
              {app.runtime_provider}
            </span>
            <StatusBadge status={app.status} />
          </div>

          <div className="flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap">
            {app.repo_branch && (
              <span className="flex items-center gap-1 font-mono">
                <GitBranch className="size-3" />
                {app.repo_branch}
              </span>
            )}
            {sha && (
              <span className="flex items-center gap-1 font-mono">
                <GitCommit className="size-3" />
                {sha}
              </span>
            )}
            {(app.pr_number ?? 0) > 0 && (
              <span>
                PR{" "}
                {app.pr_url ? (
                  <a
                    href={app.pr_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    #{app.pr_number}
                  </a>
                ) : (
                  `#${app.pr_number}`
                )}
              </span>
            )}
            {app.spec?.cicd?.provider && (
              <span className="px-1 py-0.5 rounded bg-secondary text-[10px] font-mono">
                {app.spec.cicd.provider}
              </span>
            )}
            <span className="text-muted-foreground/60">· {relativeTime(app.created_at)}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => {
              setExpanded((e) => !e);
              setHistPage(1);
            }}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-medium bg-secondary hover:bg-accent text-muted-foreground transition"
          >
            <History className="size-3.5" />
            History
            {expanded ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
          </button>
          <button
            onClick={() => onDelete(app.id, app.name)}
            className="p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition"
            title="Delete application"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>

      {/* Deployment history panel */}
      {expanded && (
        <div className="border-t border-border bg-muted/20 px-4 py-3 space-y-0">
          <div className="flex items-center gap-2 pb-2">
            <History className="size-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">Deployment history</span>
            {histData && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground tabular-nums">
                {histData.total} total
              </span>
            )}
          </div>

          {histLoading ? (
            <div className="flex items-center gap-2 py-4 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" /> Loading…
            </div>
          ) : deployments.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4">No deployment records yet.</p>
          ) : (
            <div className="divide-y divide-border/50 mb-3">
              {deployments.map((rec) => (
                <DeploymentHistoryRow key={rec.id} rec={rec} />
              ))}
            </div>
          )}

          {histData && (
            <PageBar
              page={histPage}
              totalPages={totalPages}
              total={histData.total}
              limit={HIST_LIMIT}
              isLoading={histLoading}
              onPageChange={setHistPage}
            />
          )}
        </div>
      )}
    </div>
  );
}
