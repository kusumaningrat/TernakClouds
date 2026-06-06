import type { DeploymentRecord } from "@/lib/types";

export function shortSHA(sha?: string) {
  return sha ? sha.slice(0, 7) : null;
}

export function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function cicdPipelineUrl(rec: DeploymentRecord): string | null {
  if (rec.pr_url) return rec.pr_url;
  if (!rec.repo_name) return null;
  if (rec.cicd_provider === "github-actions") return `https://github.com/${rec.repo_name}/actions`;
  if (rec.cicd_provider === "gitlab-ci") return `https://gitlab.com/${rec.repo_name}/-/pipelines`;
  return null;
}

export function commitUrl(rec: DeploymentRecord): string | null {
  if (!rec.commit_sha || !rec.repo_name) return null;
  if (rec.cicd_provider === "gitlab-ci")
    return `https://gitlab.com/${rec.repo_name}/-/commit/${rec.commit_sha}`;
  return `https://github.com/${rec.repo_name}/commit/${rec.commit_sha}`;
}

export const STATUS_STYLES: Record<string, { dot: string; text: string; label: string }> = {
  provisioned: { dot: "bg-emerald-500", text: "text-emerald-600", label: "provisioned" },
  pending: { dot: "bg-amber-400", text: "text-amber-600", label: "pending" },
  failed: { dot: "bg-red-500", text: "text-red-600", label: "failed" },
  stopped: { dot: "bg-slate-400", text: "text-slate-500", label: "stopped" },
};

export function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLES[status] ?? STATUS_STYLES.pending;
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium ${s.text}`}>
      <span className={`size-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}
