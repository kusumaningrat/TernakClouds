import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Loader2, AlertTriangle, RefreshCw, Search } from "lucide-react";
import type { NomadJobStub } from "@/lib/types";
import { useNomadNamespaces, useNomadJobs } from "@/lib/queries";
import type { DrawerTarget } from "../types";
import { JOB_STATUS_DOT, JOB_STATUS_TEXT, formatTime } from "../utils/format";
import { RowActions } from "./row-actions";
import { LogDrawer } from "./log-drawer";
import { DetailsDrawer } from "./details-drawer";

function JobRow({
  job,
  envId,
  namespace,
  onLogs,
  onDetails,
}: {
  job: NomadJobStub;
  envId: string;
  namespace: string;
  onLogs: () => void;
  onDetails: () => void;
}) {
  const dotCls = JOB_STATUS_DOT[job.Status] ?? "bg-muted-foreground";
  const textCls = JOB_STATUS_TEXT[job.Status] ?? "text-muted-foreground";

  return (
    <tr className="border-b border-border hover:bg-accent/30 transition-colors">
      <td className="px-3 py-3">
        <Link
          to="/dashboard/environments/$envId/deployments/$jobId"
          params={{ envId, jobId: job.ID }}
          search={{ namespace }}
          className="font-medium text-sm hover:text-primary transition"
        >
          {job.Name}
        </Link>
        <div className="text-[11px] font-mono text-muted-foreground mt-0.5 truncate max-w-[220px]">
          {job.ID}
        </div>
      </td>
      <td className="px-3 py-3">
        <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-secondary border border-border text-muted-foreground">
          {job.Type}
        </span>
      </td>
      <td className="px-3 py-3">
        <div className="flex items-center gap-1.5">
          <span className={`inline-block size-2 rounded-full shrink-0 ${dotCls}`} />
          <span className={`text-xs capitalize font-medium ${textCls}`}>{job.Status}</span>
        </div>
      </td>
      <td className="px-3 py-3 text-xs text-muted-foreground font-mono">
        {(job.Datacenters ?? []).join(", ") || "—"}
      </td>
      <td className="px-3 py-3 text-xs text-muted-foreground whitespace-nowrap">
        {formatTime(job.SubmitTime)}
      </td>
      <td className="px-3 py-2">
        <RowActions onLogs={onLogs} onDetails={onDetails} />
      </td>
    </tr>
  );
}

export function JobsListView({ slug, envId }: { slug: string; envId: string }) {
  const [namespace, setNamespace] = useState("default");
  const [search, setSearch] = useState("");
  const [logTarget, setLogTarget] = useState<DrawerTarget | null>(null);
  const [detailsTarget, setDetailsTarget] = useState<DrawerTarget | null>(null);

  const { data: namespaces = [] } = useNomadNamespaces(slug, envId);
  const {
    data: jobs = [],
    isLoading,
    isFetching,
    error,
    refetch,
    dataUpdatedAt,
  } = useNomadJobs(slug, envId, namespace);

  const filtered = search
    ? jobs.filter(
        (j) =>
          j.Name.toLowerCase().includes(search.toLowerCase()) ||
          j.ID.toLowerCase().includes(search.toLowerCase()),
      )
    : jobs;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search jobs…"
            className="pl-8 pr-3 py-1.5 text-xs rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary/50 w-48"
          />
        </div>
        {namespaces.length > 0 && (
          <select
            value={namespace}
            onChange={(e) => setNamespace(e.target.value)}
            className="text-xs px-2 py-1 rounded-md border border-border bg-background font-mono focus:outline-none focus:ring-1 focus:ring-primary/50"
          >
            {namespaces.map((ns) => (
              <option key={ns.Name} value={ns.Name}>
                {ns.Name}
              </option>
            ))}
          </select>
        )}
        {!isLoading && (
          <span className="text-xs text-muted-foreground">
            {filtered.length}
            {filtered.length !== jobs.length ? `/${jobs.length}` : ""} job
            {jobs.length !== 1 ? "s" : ""}
          </span>
        )}
        {dataUpdatedAt > 0 && !isLoading && (
          <span className="text-xs text-muted-foreground/60">
            · updated{" "}
            {new Date(dataUpdatedAt).toLocaleTimeString(undefined, {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })}
          </span>
        )}
        <div className="flex-1" />
        <button
          onClick={() => void refetch()}
          disabled={isFetching}
          className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md border border-border hover:bg-accent transition disabled:opacity-60"
        >
          <RefreshCw className={`size-3.5 ${isFetching ? "animate-spin" : ""}`} />
          {isFetching ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
          <Loader2 className="size-4 animate-spin" /> Loading jobs…
        </div>
      )}
      {error && !isLoading && (
        <div className="flex items-center gap-2 text-sm text-destructive py-4">
          <AlertTriangle className="size-4" /> Failed to fetch jobs from Nomad
        </div>
      )}
      {!isLoading && !error && filtered.length === 0 && (
        <div className="py-16 text-center text-sm text-muted-foreground">
          {jobs.length === 0 ? `No jobs in namespace ${namespace}.` : "No jobs match the search."}
        </div>
      )}

      {!isLoading && !error && filtered.length > 0 && (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/50">
                {["Job", "Type", "Status", "Datacenters", "Submitted", ""].map((h) => (
                  <th
                    key={h}
                    className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-background">
              {filtered.map((job) => (
                <JobRow
                  key={job.ID}
                  job={job}
                  envId={envId}
                  namespace={namespace}
                  onLogs={() => setLogTarget({ kind: "nomad", job, namespace })}
                  onDetails={() => setDetailsTarget({ kind: "nomad", job, namespace })}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {logTarget && (
        <LogDrawer
          slug={slug}
          envSlug={envId}
          target={logTarget}
          onClose={() => setLogTarget(null)}
        />
      )}
      {detailsTarget && (
        <DetailsDrawer target={detailsTarget} onClose={() => setDetailsTarget(null)} />
      )}
    </div>
  );
}
