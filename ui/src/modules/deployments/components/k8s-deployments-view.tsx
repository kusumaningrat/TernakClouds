import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Loader2, AlertTriangle, RefreshCw, Search } from "lucide-react";
import type { K8sDeploymentStub } from "@/lib/types";
import { useK8sNamespaces, useK8sDeployments } from "@/lib/queries";
import type { DrawerTarget, K8sFilter } from "../types";
import { formatDate } from "../utils/format";
import { RowActions } from "./row-actions";
import { LogDrawer } from "./log-drawer";
import { DetailsDrawer } from "./details-drawer";

function K8sDeploymentRow({
  dep,
  envId,
  onLogs,
  onDetails,
}: {
  dep: K8sDeploymentStub;
  envId: string;
  onLogs: () => void;
  onDetails: () => void;
}) {
  const isHealthy = dep.ready >= dep.desired && dep.desired > 0;
  const isScaledDown = dep.desired === 0;

  return (
    <tr className="border-b border-border hover:bg-accent/30 transition-colors">
      <td className="px-3 py-3">
        <Link
          to="/dashboard/environments/$envId/deployments/k8s/$namespace/$name"
          params={{ envId, namespace: dep.namespace, name: dep.name }}
          className="font-medium text-sm hover:text-primary transition font-mono"
        >
          {dep.name}
        </Link>
        <div className="text-[11px] font-mono text-muted-foreground mt-0.5">{dep.namespace}</div>
      </td>
      <td className="px-3 py-3">
        <div className="flex items-center gap-1.5">
          <span
            className={`inline-block size-2 rounded-full shrink-0 ${
              isScaledDown ? "bg-muted-foreground" : isHealthy ? "bg-success" : "bg-yellow-500"
            }`}
          />
          <span
            className={`text-xs font-medium ${
              isScaledDown
                ? "text-muted-foreground"
                : isHealthy
                  ? "text-success"
                  : "text-yellow-500"
            }`}
          >
            {isScaledDown ? "scaled down" : isHealthy ? "healthy" : "degraded"}
          </span>
        </div>
      </td>
      <td className="px-3 py-3 text-xs font-mono text-muted-foreground">
        {dep.ready}/{dep.desired}
      </td>
      <td className="px-3 py-3 text-xs font-mono text-muted-foreground">{dep.upToDate}</td>
      <td className="px-3 py-3 text-xs font-mono text-muted-foreground">{dep.available}</td>
      <td className="px-3 py-3 text-xs text-muted-foreground whitespace-nowrap">
        {formatDate(dep.createdAt)}
      </td>
      <td className="px-3 py-2">
        <RowActions onLogs={onLogs} onDetails={onDetails} />
      </td>
    </tr>
  );
}

export function K8sDeploymentsListView({ slug, envId }: { slug: string; envId: string }) {
  const [filter, setFilter] = useState<K8sFilter>("all");
  const [namespace, setNamespace] = useState("default");
  const [search, setSearch] = useState("");
  const [logTarget, setLogTarget] = useState<DrawerTarget | null>(null);
  const [detailsTarget, setDetailsTarget] = useState<DrawerTarget | null>(null);

  const { data: namespaces = [] } = useK8sNamespaces(slug, envId);
  const {
    data: deployments = [],
    isLoading,
    isFetching,
    error,
    refetch,
    dataUpdatedAt,
  } = useK8sDeployments(slug, envId, namespace);

  const filtered = deployments
    .filter((d) => {
      if (filter === "active") return d.desired > 0;
      if (filter === "scaled-down") return d.desired === 0;
      return true;
    })
    .filter(
      (d) =>
        !search ||
        d.name.toLowerCase().includes(search.toLowerCase()) ||
        d.namespace.toLowerCase().includes(search.toLowerCase()),
    );

  const filterBtns: { key: K8sFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "active", label: "Active" },
    { key: "scaled-down", label: "Scaled down" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search deployments…"
            className="pl-8 pr-3 py-1.5 text-xs rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary/50 w-52"
          />
        </div>
        {namespaces.length > 0 && (
          <select
            value={namespace}
            onChange={(e) => setNamespace(e.target.value)}
            className="text-xs px-2 py-1 rounded-md border border-border bg-background font-mono focus:outline-none focus:ring-1 focus:ring-primary/50"
          >
            {namespaces.map((ns) => (
              <option key={ns.name} value={ns.name}>
                {ns.name}
              </option>
            ))}
          </select>
        )}
        <div className="flex rounded-md border border-border overflow-hidden text-xs">
          {filterBtns.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-2.5 py-1 transition ${
                filter === key
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-accent text-muted-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {!isLoading && (
          <span className="text-xs text-muted-foreground">
            {filtered.length}
            {filtered.length !== deployments.length ? `/${deployments.length}` : ""} deployment
            {deployments.length !== 1 ? "s" : ""}
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
          <Loader2 className="size-4 animate-spin" /> Loading deployments…
        </div>
      )}
      {error && !isLoading && (
        <div className="flex items-center gap-2 text-sm text-destructive py-4">
          <AlertTriangle className="size-4" /> Failed to fetch deployments from Kubernetes
        </div>
      )}
      {!isLoading && !error && filtered.length === 0 && (
        <div className="py-16 text-center text-sm text-muted-foreground">
          {deployments.length === 0
            ? "No deployments found."
            : "No deployments match the current filter."}
        </div>
      )}

      {!isLoading && !error && filtered.length > 0 && (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/50">
                {["Deployment", "Status", "Ready", "Up-to-date", "Available", "Created", ""].map(
                  (h) => (
                    <th
                      key={h}
                      className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody className="bg-background">
              {filtered.map((dep) => (
                <K8sDeploymentRow
                  key={`${dep.namespace}/${dep.name}`}
                  dep={dep}
                  envId={envId}
                  onLogs={() => setLogTarget({ kind: "k8s", dep })}
                  onDetails={() => setDetailsTarget({ kind: "k8s", dep })}
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
