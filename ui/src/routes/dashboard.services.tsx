import { createFileRoute, Link } from "@tanstack/react-router";
import { DashboardTopbar } from "@/components/DashboardTopbar";
import { useWorkspaceContext } from "@/lib/workspace-context";
import { useEnvironmentContext } from "@/lib/environment-context";
import { useCatalog, useEnvironments, useAllServiceDeployments } from "@/lib/queries";
import type { ServiceDeployment, WorkspaceEnvironment } from "@/lib/types";
import {
  Plus,
  Loader2,
  Search,
  LayoutGrid,
  ScrollText,
  Rocket,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  X,
} from "lucide-react";
import { useMemo, useRef, useEffect, useState } from "react";

export const Route = createFileRoute("/dashboard/services")({
  head: () => ({ meta: [{ title: "Service Catalog · TernakClouds" }] }),
  component: ServiceCatalogPage,
});

// ─── Types ────────────────────────────────────────────────────────────────────

type HealthStatus = "healthy" | "warning" | "critical" | "inactive";

function deploymentHealth(d: ServiceDeployment | undefined): HealthStatus {
  if (!d) return "inactive";
  const s = d.status?.toLowerCase() ?? "";
  if (s === "running") return "healthy";
  if (s === "pending") return "warning";
  return "critical";
}

// ─── Environment health cell ──────────────────────────────────────────────────
// Shows a column of labeled dots — one per visible environment.
// All envs are shown; overflow is handled by the row's horizontal scroll.

const DOT_COLOR: Record<HealthStatus, string> = {
  healthy:  "bg-success",
  warning:  "bg-warning",
  critical: "bg-destructive",
  inactive: "bg-muted-foreground/25",
};

const DOT_LABEL_COLOR: Record<HealthStatus, string> = {
  healthy:  "text-success",
  warning:  "text-warning",
  critical: "text-destructive",
  inactive: "text-muted-foreground/40",
};

function EnvHealthPill({
  envSlug,
  health,
}: {
  envSlug: string;
  health: HealthStatus;
}) {
  const abbr = envSlug.slice(0, 3).toUpperCase();
  return (
    <div
      className="flex flex-col items-center gap-0.5 min-w-[28px]"
      title={`${envSlug}: ${health}`}
    >
      <span className={`inline-block size-2 rounded-full ${DOT_COLOR[health]}`} />
      <span className={`label-mono ${DOT_LABEL_COLOR[health]}`} style={{ fontSize: "9px" }}>
        {abbr}
      </span>
    </div>
  );
}

// ─── Alert banner ────────────────────────────────────────────────────────────

function AlertBanner({
  degradedCount,
  criticalCount,
  onFilter,
}: {
  degradedCount: number;
  criticalCount: number;
  onFilter: (h: HealthStatus) => void;
}) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed || (degradedCount === 0 && criticalCount === 0)) return null;

  const isCritical = criticalCount > 0;
  const count = isCritical ? criticalCount : degradedCount;
  const label = isCritical ? "critical" : "degraded";
  const status: HealthStatus = isCritical ? "critical" : "warning";

  return (
    <div
      className={`flex items-center gap-3 px-4 py-2.5 border-b text-xs font-medium ${
        isCritical
          ? "bg-destructive/8 border-destructive/20 text-destructive"
          : "bg-warning/8 border-warning/20 text-warning"
      }`}
    >
      <AlertTriangle className="size-3.5 shrink-0" />
      <span className="flex-1">
        {count} service{count !== 1 ? "s" : ""}{" "}
        {label} in the selected scope.{" "}
        <button
          onClick={() => onFilter(status)}
          className="underline underline-offset-2 hover:no-underline"
        >
          View affected services
        </button>
      </span>
      <button
        onClick={() => setDismissed(true)}
        className="p-0.5 rounded hover:bg-black/10 transition shrink-0"
        aria-label="Dismiss"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}

// ─── Deploy dropdown ──────────────────────────────────────────────────────────
// Inline action on each catalog row: lets developer pick an environment and
// navigate to that environment's deploy page without leaving the catalog.

function DeployDropdown({
  serviceName,
  environments,
}: {
  serviceName: string;
  environments: WorkspaceEnvironment[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  if (environments.length === 0) return null;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded bg-primary/10 text-primary hover:bg-primary/20 transition font-medium"
      >
        <Rocket className="size-3" />
        Deploy
        <ChevronDown className="size-3" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 w-44 glass-high rounded-lg overflow-hidden shadow-lg">
          <div className="px-3 py-1.5 border-b border-border">
            <span className="label-mono text-muted-foreground" style={{ fontSize: "9px" }}>
              CHOOSE ENVIRONMENT
            </span>
          </div>
          {environments.map((env) => (
            <Link
              key={env.id}
              to="/dashboard/environments/$envId/service-catalog"
              params={{ envId: env.slug }}
              onClick={() => setOpen(false)}
              className="flex items-center justify-between px-3 py-2 text-xs hover:bg-accent transition text-foreground"
            >
              <span className="font-medium">{env.name}</span>
              <ChevronRight className="size-3 text-muted-foreground" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Filter pill ──────────────────────────────────────────────────────────────

function FilterPill({
  label,
  active,
  dot,
  dotColor,
  count,
  onClick,
}: {
  label: string;
  active: boolean;
  dot?: boolean;
  dotColor?: string;
  count?: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition border ${
        active
          ? "bg-primary/10 text-primary border-primary/30"
          : "bg-transparent text-muted-foreground border-border hover:border-primary/30 hover:text-foreground"
      }`}
    >
      {dot && dotColor && (
        <span className={`inline-block size-1.5 rounded-full ${dotColor}`} />
      )}
      {label}
      {count !== undefined && (
        <span
          className={`text-[10px] px-1 rounded ${
            active ? "bg-primary/20 text-primary" : "bg-secondary text-muted-foreground"
          }`}
        >
          {count}
        </span>
      )}
    </button>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function ServiceCatalogPage() {
  const { selectedWorkspace } = useWorkspaceContext();
  const { selectedEnvironment } = useEnvironmentContext();
  const slug = selectedWorkspace?.slug ?? "";

  const [search, setSearch] = useState("");
  const [activeHealthFilter, setActiveHealthFilter] = useState<HealthStatus | null>(null);

  const { data: environments, isLoading: envsLoading } = useEnvironments(slug);
  const { data: catalog, isLoading: catalogLoading } = useCatalog();

  const envSlugs = useMemo(() => (environments ?? []).map((e) => e.slug), [environments]);
  const deploymentQueries = useAllServiceDeployments(slug, envSlugs);

  // In "All" mode show all envs; when a single env is selected show only that one.
  const visibleEnvs = useMemo(
    () => (selectedEnvironment ? [selectedEnvironment] : (environments ?? [])),
    [environments, selectedEnvironment],
  );

  // Build per-service rows with health data across all visible environments
  const rows = useMemo(() => {
    return (catalog ?? []).map((item) => {
      const envStatuses = visibleEnvs.map((env) => {
        const globalIdx = (environments ?? []).findIndex((e) => e.id === env.id);
        const deps = deploymentQueries[globalIdx]?.data ?? [];
        const dep = deps.find((d) => d.catalog_name === item.name);
        return { env, health: deploymentHealth(dep), dep };
      });

      const allDeps = (environments ?? []).flatMap((_, i) => deploymentQueries[i]?.data ?? []);
      const myDeps = allDeps.filter((d) => d.catalog_name === item.name);
      const latestDep = myDeps.sort(
        (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
      )[0];

      const overallHealth: HealthStatus =
        envStatuses.some((e) => e.health === "critical")
          ? "critical"
          : envStatuses.some((e) => e.health === "warning")
            ? "warning"
            : envStatuses.some((e) => e.health === "healthy")
              ? "healthy"
              : "inactive";

      return { item, envStatuses, latestDep, overallHealth };
    });
  }, [catalog, environments, visibleEnvs, deploymentQueries]);

  // Health counts for filter pills and alert banner
  const healthCounts = useMemo(
    () => ({
      healthy:  rows.filter((r) => r.overallHealth === "healthy").length,
      warning:  rows.filter((r) => r.overallHealth === "warning").length,
      critical: rows.filter((r) => r.overallHealth === "critical").length,
      inactive: rows.filter((r) => r.overallHealth === "inactive").length,
    }),
    [rows],
  );

  const filtered = useMemo(
    () =>
      rows.filter((row) => {
        if (
          search &&
          !row.item.name.toLowerCase().includes(search.toLowerCase()) &&
          !row.item.display_name.toLowerCase().includes(search.toLowerCase())
        ) {
          return false;
        }
        if (activeHealthFilter && row.overallHealth !== activeHealthFilter) return false;
        return true;
      }),
    [rows, search, activeHealthFilter],
  );

  const isLoading = envsLoading || catalogLoading;

  const deployedCount = rows.filter((r) => r.overallHealth !== "inactive").length;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <DashboardTopbar breadcrumbs={["Catalog", "Services"]} />
      <div className="flex flex-1 min-h-0 overflow-hidden">
      {/* ── Left filter panel ── */}
      <aside className="w-52 shrink-0 border-r border-border p-4 space-y-5 overflow-auto">
        <div>
          <div className="label-mono text-muted-foreground mb-3">HEALTH STATUS</div>
          <div className="space-y-1">
            <FilterPill
              label="All"
              active={activeHealthFilter === null}
              count={rows.length}
              onClick={() => setActiveHealthFilter(null)}
            />
            <FilterPill
              label="Healthy"
              active={activeHealthFilter === "healthy"}
              dot
              dotColor="bg-success"
              count={healthCounts.healthy}
              onClick={() =>
                setActiveHealthFilter((prev) => (prev === "healthy" ? null : "healthy"))
              }
            />
            <FilterPill
              label="Degraded"
              active={activeHealthFilter === "warning"}
              dot
              dotColor="bg-warning"
              count={healthCounts.warning}
              onClick={() =>
                setActiveHealthFilter((prev) => (prev === "warning" ? null : "warning"))
              }
            />
            <FilterPill
              label="Critical"
              active={activeHealthFilter === "critical"}
              dot
              dotColor="bg-destructive"
              count={healthCounts.critical}
              onClick={() =>
                setActiveHealthFilter((prev) => (prev === "critical" ? null : "critical"))
              }
            />
            <FilterPill
              label="Not deployed"
              active={activeHealthFilter === "inactive"}
              dot
              dotColor="bg-muted-foreground/30"
              count={healthCounts.inactive}
              onClick={() =>
                setActiveHealthFilter((prev) => (prev === "inactive" ? null : "inactive"))
              }
            />
          </div>
        </div>

        {/* Environment hint when "All" is selected */}
        {!selectedEnvironment && (environments ?? []).length > 0 && (
          <div>
            <div className="label-mono text-muted-foreground mb-2">ENVIRONMENTS</div>
            <div className="space-y-1">
              {(environments ?? []).map((env) => (
                <div key={env.id} className="flex items-center gap-2 text-xs text-muted-foreground px-1 py-0.5">
                  <span className="inline-block size-1.5 rounded-full bg-muted-foreground/40" />
                  {env.name}
                </div>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground/60 mt-2 leading-relaxed">
              Use the environment tabs in the topbar to filter by a single environment.
            </p>
          </div>
        )}
      </aside>

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Alert banner */}
        <AlertBanner
          degradedCount={healthCounts.warning}
          criticalCount={healthCounts.critical}
          onFilter={(h) => setActiveHealthFilter(h)}
        />

        {/* Page header */}
        <div className="px-6 pt-5 pb-4 border-b border-border">
          <div className="label-mono text-muted-foreground mb-1">Catalog › Services</div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Service Catalog</h1>
              {!isLoading && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {rows.length} service{rows.length !== 1 ? "s" : ""}
                  {rows.length > 0 && (
                    <>
                      {" · "}
                      <span className="text-success font-medium">{deployedCount} deployed</span>
                      {" · "}
                      {(environments ?? []).length} environment{(environments ?? []).length !== 1 ? "s" : ""}
                    </>
                  )}
                </p>
              )}
            </div>
            <Link
              to="/dashboard/environments"
              className="flex items-center gap-1.5 text-xs px-3 py-2 rounded bg-primary text-primary-foreground hover:bg-primary/90 transition font-medium shrink-0"
            >
              <Plus className="size-3.5" /> New Service
            </Link>
          </div>

          {/* Search */}
          <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded border border-border bg-input focus-within:border-primary/50 transition-colors w-80">
            <Search className="size-3.5 text-muted-foreground shrink-0" />
            <input
              className="bg-transparent outline-none flex-1 text-sm placeholder:text-muted-foreground/60"
              placeholder={`Search ${rows.length} services…`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="text-muted-foreground hover:text-foreground transition"
                aria-label="Clear search"
              >
                <X className="size-3" />
              </button>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground p-8 justify-center">
              <Loader2 className="size-4 animate-spin" /> Loading catalog…
            </div>
          ) : rows.length === 0 ? (
            // Empty state — no catalog items at all
            <div className="flex flex-col items-center justify-center p-12 text-center">
              <div className="size-14 rounded-2xl bg-secondary grid place-items-center mb-4">
                <LayoutGrid className="size-7 text-muted-foreground" />
              </div>
              <h2 className="text-base font-semibold mb-1">No services yet</h2>
              <p className="text-sm text-muted-foreground max-w-xs">
                Create your first service from a blueprint to see it here.
              </p>
              <Link
                to="/dashboard/environments"
                className="mt-4 inline-flex items-center gap-1.5 text-xs px-4 py-2 rounded bg-primary text-primary-foreground hover:bg-primary/90 transition font-medium"
              >
                <Plus className="size-3.5" /> Create first service
              </Link>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-6 py-3 text-left label-mono text-muted-foreground font-medium">
                    SERVICE
                  </th>
                  <th className="px-4 py-3 text-left label-mono text-muted-foreground font-medium">
                    {selectedEnvironment ? selectedEnvironment.name.toUpperCase() : "ENVIRONMENTS"}
                  </th>
                  <th className="px-4 py-3 text-left label-mono text-muted-foreground font-medium">
                    LAST DEPLOYED
                  </th>
                  <th className="px-6 py-3 text-right label-mono text-muted-foreground font-medium">
                    ACTIONS
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-muted-foreground text-sm">
                      {search
                        ? `No services match "${search}"`
                        : activeHealthFilter
                          ? `No services with status "${activeHealthFilter}"`
                          : "No services found."}
                    </td>
                  </tr>
                ) : (
                  filtered.map(({ item, envStatuses, latestDep, overallHealth }) => {
                    const deployedBy = latestDep?.deployed_by ?? null;
                    const updatedAt = latestDep
                      ? (() => {
                          const diff = Date.now() - new Date(latestDep.updated_at).getTime();
                          const m = Math.floor(diff / 60000);
                          if (m < 1) return "just now";
                          if (m < 60) return `${m}m ago`;
                          const h = Math.floor(m / 60);
                          if (h < 24) return `${h}h ago`;
                          return `${Math.floor(h / 24)}d ago`;
                        })()
                      : null;

                    return (
                      <tr
                        key={item.id}
                        className="border-b border-border hover:bg-accent/40 transition-colors group"
                      >
                        {/* Service identity */}
                        <td className="px-6 py-3.5">
                          <Link
                            to="/dashboard/services/$serviceName"
                            params={{ serviceName: item.name }}
                            className="flex items-center gap-3"
                          >
                            <div className="size-8 rounded bg-secondary grid place-items-center shrink-0 group-hover:bg-primary/10 transition-colors">
                              <LayoutGrid className="size-4 text-muted-foreground group-hover:text-primary transition-colors" />
                            </div>
                            <div>
                              <div className="font-medium text-sm text-foreground group-hover:text-primary transition-colors">
                                {item.display_name || item.name}
                              </div>
                              <div className="text-xs text-muted-foreground font-mono truncate max-w-[200px]">
                                {item.name}
                              </div>
                            </div>
                          </Link>
                        </td>

                        {/* Environment health — labeled dots for every visible env */}
                        <td className="px-4 py-3.5">
                          <div className="flex items-end gap-2.5 flex-wrap">
                            {envStatuses.map(({ env, health }) => (
                              <EnvHealthPill key={env.id} envSlug={env.slug} health={health} />
                            ))}
                          </div>
                        </td>

                        {/* Last deployed */}
                        <td className="px-4 py-3.5">
                          {updatedAt ? (
                            <div>
                              <div
                                className={`text-xs font-medium ${
                                  overallHealth === "critical"
                                    ? "text-destructive"
                                    : "text-foreground"
                                }`}
                              >
                                {overallHealth === "critical" ? `Failed ${updatedAt}` : updatedAt}
                              </div>
                              {deployedBy && (
                                <div className="text-[10px] text-muted-foreground/70 mt-0.5">
                                  by @{deployedBy}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground/50 italic">
                              Never deployed
                            </span>
                          )}
                        </td>

                        {/* Inline actions */}
                        <td className="px-6 py-3.5">
                          <div className="flex items-center gap-2 justify-end">
                            <Link
                              to="/dashboard/services/$serviceName"
                              params={{ serviceName: item.name }}
                              search={{ tab: "logs" } as never}
                              className="flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded bg-secondary text-muted-foreground hover:text-foreground transition"
                              title="View logs"
                            >
                              <ScrollText className="size-3" />
                              Logs
                            </Link>
                            <DeployDropdown
                              serviceName={item.name}
                              environments={environments ?? []}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}
