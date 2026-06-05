import { createFileRoute, Link } from "@tanstack/react-router";
import { DashboardTopbar } from "@/components/DashboardTopbar";
import { useWorkspaceContext } from "@/lib/workspace-context";
import { useEnvironmentContext } from "@/lib/environment-context";
import { useCatalog, useEnvironments, useAllServiceDeployments } from "@/lib/queries";
import type { CatalogItem, ServiceDeployment, WorkspaceEnvironment } from "@/lib/types";
import {
  Plus,
  Loader2,
  Search,
  Rocket,
  X,
  ChevronDown,
  ChevronRight,
  Circle,
  LayoutGrid,
  Database,
  Zap,
  Radio,
  HardDrive,
  Activity,
  Network,
  Cpu,
  Box,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useMemo, useRef, useEffect, useState } from "react";

export const Route = createFileRoute("/dashboard/services")({
  head: () => ({ meta: [{ title: "Service Catalog · TernakClouds" }] }),
  component: ServiceCatalogPage,
});

// ─── Types ─────────────────────────────────────────────────────────────────────

type HealthStatus = "healthy" | "warning" | "critical" | "inactive";

function deploymentHealth(d: ServiceDeployment | undefined): HealthStatus {
  if (!d) return "inactive";
  const s = d.status?.toLowerCase() ?? "";
  if (s === "running") return "healthy";
  if (s === "pending") return "warning";
  return "critical";
}

// ─── Category system ────────────────────────────────────────────────────────────

const ALL_CATEGORIES = [
  "All",
  "Database",
  "Cache",
  "Message Broker",
  "Object Storage",
  "Monitoring",
  "Networking",
  "AI Services",
  "Application",
] as const;

type Category = (typeof ALL_CATEGORIES)[number];

const CATEGORY_PATTERNS: [RegExp, Exclude<Category, "All">][] = [
  [/postgres|mysql|mariadb|mongodb|mongo|cassandra|cockroach|clickhouse|tidb/i, "Database"],
  [/redis|memcached|dragonfly|keydb/i, "Cache"],
  [/rabbit|kafka|nats|pulsar|activemq/i, "Message Broker"],
  [/minio|seaweed|ceph|swift/i, "Object Storage"],
  [/prometheus|grafana|loki|jaeger|tempo|alertmanager|zipkin/i, "Monitoring"],
  [/nginx|traefik|haproxy|envoy|kong|caddy/i, "Networking"],
  [/ollama|llm|whisper|ai-/i, "AI Services"],
];

function inferCategory(item: CatalogItem): Exclude<Category, "All"> {
  const text = `${item.name} ${item.display_name}`;
  for (const [pattern, cat] of CATEGORY_PATTERNS) {
    if (pattern.test(text)) return cat;
  }
  return "Application";
}

type CategoryConfig = {
  icon: LucideIcon;
  color: string;
  bg: string;
};

const CATEGORY_CONFIG: Record<Exclude<Category, "All">, CategoryConfig> = {
  Database:         { icon: Database,  color: "text-blue-600",   bg: "bg-blue-500/10" },
  Cache:            { icon: Zap,       color: "text-amber-600",  bg: "bg-amber-500/10" },
  "Message Broker": { icon: Radio,     color: "text-purple-600", bg: "bg-purple-500/10" },
  "Object Storage": { icon: HardDrive, color: "text-teal-600",   bg: "bg-teal-500/10" },
  Monitoring:       { icon: Activity,  color: "text-orange-600", bg: "bg-orange-500/10" },
  Networking:       { icon: Network,   color: "text-slate-600",  bg: "bg-slate-500/10" },
  "AI Services":    { icon: Cpu,       color: "text-violet-600", bg: "bg-violet-500/10" },
  Application:      { icon: Box,       color: "text-primary",    bg: "bg-primary/10" },
};

// ─── Health config ──────────────────────────────────────────────────────────────

const HEALTH_BORDER: Record<HealthStatus, string> = {
  healthy:  "border-success/40",
  warning:  "border-warning/40",
  critical: "border-destructive/40",
  inactive: "border-border",
};

const HEALTH_ACCENT: Record<HealthStatus, string> = {
  healthy:  "bg-success",
  warning:  "bg-warning",
  critical: "bg-destructive",
  inactive: "bg-transparent",
};

const ENV_DOT: Record<HealthStatus, string> = {
  healthy:  "bg-success",
  warning:  "bg-warning",
  critical: "bg-destructive",
  inactive: "bg-muted-foreground/25",
};

// ─── Deploy dropdown ────────────────────────────────────────────────────────────

function DeployDropdown({
  serviceName,
  environments,
  variant = "ghost",
}: {
  serviceName: string;
  environments: WorkspaceEnvironment[];
  variant?: "primary" | "ghost";
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
        className={`flex items-center gap-1.5 rounded-md font-medium transition ${
          variant === "primary"
            ? "text-xs px-3 py-2 bg-primary text-primary-foreground hover:bg-primary/90 w-full justify-center"
            : "text-[11px] px-2.5 py-1.5 bg-secondary text-muted-foreground hover:text-foreground hover:bg-accent"
        }`}
      >
        <Rocket className="size-3" />
        Deploy
        <ChevronDown className="size-3" />
      </button>

      {open && (
        <div className="absolute right-0 bottom-full mb-1.5 z-50 w-48 glass-high rounded-lg overflow-hidden shadow-lg border border-border">
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

// ─── Catalog card ───────────────────────────────────────────────────────────────

function CatalogServiceCard({
  item,
  envStatuses,
  overallHealth,
  environments,
  category,
}: {
  item: CatalogItem;
  envStatuses: { env: WorkspaceEnvironment; health: HealthStatus }[];
  overallHealth: HealthStatus;
  environments: WorkspaceEnvironment[];
  category: Exclude<Category, "All">;
}) {
  const { icon: Icon, color, bg } = CATEGORY_CONFIG[category];
  const isDeployed = overallHealth !== "inactive";

  return (
    <div
      className={`group flex flex-col rounded-xl border bg-card overflow-hidden transition-all hover:shadow-md ${HEALTH_BORDER[overallHealth]}`}
    >
      {/* Health accent stripe */}
      <div className={`h-0.5 w-full ${isDeployed ? HEALTH_ACCENT[overallHealth] : "bg-transparent"}`} />

      {/* Clickable body → service detail */}
      <Link
        to="/dashboard/services/$serviceName"
        params={{ serviceName: item.name }}
        className="p-4 flex-1 flex flex-col gap-3 hover:bg-accent/20 transition-colors"
      >
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className={`size-8 rounded-lg ${bg} grid place-items-center shrink-0`}>
            <Icon className={`size-4 ${color}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors truncate">
              {item.display_name || item.name}
            </div>
            <span
              className={`inline-flex items-center mt-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded ${bg} ${color}`}
            >
              {category}
            </span>
          </div>
        </div>

        {/* Description */}
        {item.description ? (
          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
            {item.description}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground/40 italic">No description available</p>
        )}

        {/* Environment health row */}
        <div className="mt-auto pt-2 border-t border-border/50">
          {isDeployed ? (
            <div className="flex items-center gap-2 flex-wrap">
              {envStatuses.map(({ env, health }) => (
                <div
                  key={env.id}
                  className="flex items-center gap-1"
                  title={`${env.name}: ${health}`}
                >
                  <span className={`inline-block size-1.5 rounded-full ${ENV_DOT[health]}`} />
                  <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">
                    {env.slug.slice(0, 3)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/50">
              <Circle className="size-2.5" />
              Not deployed
            </div>
          )}
        </div>
      </Link>

      {/* Actions footer */}
      <div className="px-4 py-3 bg-muted/30 border-t border-border/50 flex items-center gap-2">
        {isDeployed ? (
          <>
            <Link
              to="/dashboard/services/$serviceName"
              params={{ serviceName: item.name }}
              className="flex-1 text-center text-[11px] px-2.5 py-1.5 rounded-md bg-secondary text-muted-foreground hover:text-foreground hover:bg-accent transition font-medium"
            >
              View Details
            </Link>
            <DeployDropdown serviceName={item.name} environments={environments} variant="ghost" />
          </>
        ) : (
          <DeployDropdown serviceName={item.name} environments={environments} variant="primary" />
        )}
      </div>
    </div>
  );
}

// ─── Loading skeleton ───────────────────────────────────────────────────────────

function CardSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden animate-pulse">
      <div className="h-0.5 bg-transparent" />
      <div className="p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className="size-8 rounded-lg bg-muted shrink-0" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3.5 bg-muted rounded w-3/4" />
            <div className="h-2.5 bg-muted rounded w-1/3" />
          </div>
        </div>
        <div className="space-y-1.5">
          <div className="h-2.5 bg-muted rounded" />
          <div className="h-2.5 bg-muted rounded w-5/6" />
        </div>
        <div className="pt-2 border-t border-border/50">
          <div className="h-2.5 bg-muted rounded w-1/3" />
        </div>
      </div>
      <div className="px-4 py-3 bg-muted/30 border-t border-border/50">
        <div className="h-7 bg-muted rounded-md" />
      </div>
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────────

function ServiceCatalogPage() {
  const { selectedWorkspace } = useWorkspaceContext();
  const { selectedEnvironment } = useEnvironmentContext();
  const slug = selectedWorkspace?.slug ?? "";

  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<Category>("All");
  const [activeHealthFilter, setActiveHealthFilter] = useState<HealthStatus | null>(null);

  const { data: environments, isLoading: envsLoading } = useEnvironments(slug);
  const { data: catalog, isLoading: catalogLoading } = useCatalog();

  const envSlugs = useMemo(() => (environments ?? []).map((e) => e.slug), [environments]);
  const deploymentQueries = useAllServiceDeployments(slug, envSlugs);

  const visibleEnvs = useMemo(
    () => (selectedEnvironment ? [selectedEnvironment] : (environments ?? [])),
    [environments, selectedEnvironment],
  );

  const rows = useMemo(() => {
    return (catalog ?? []).map((item) => {
      const category = inferCategory(item);

      const envStatuses = visibleEnvs.map((env) => {
        const globalIdx = (environments ?? []).findIndex((e) => e.id === env.id);
        const deps = deploymentQueries[globalIdx]?.data ?? [];
        const dep = deps.find((d) => d.catalog_name === item.name);
        return { env, health: deploymentHealth(dep) };
      });

      const overallHealth: HealthStatus =
        envStatuses.some((e) => e.health === "critical") ? "critical" :
        envStatuses.some((e) => e.health === "warning")  ? "warning" :
        envStatuses.some((e) => e.health === "healthy")  ? "healthy" :
        "inactive";

      return { item, category, envStatuses, overallHealth };
    });
  }, [catalog, environments, visibleEnvs, deploymentQueries]);

  const filtered = useMemo(() => {
    return rows.filter((row) => {
      if (
        search &&
        !row.item.name.toLowerCase().includes(search.toLowerCase()) &&
        !row.item.display_name.toLowerCase().includes(search.toLowerCase()) &&
        !row.item.description?.toLowerCase().includes(search.toLowerCase())
      ) {
        return false;
      }
      if (activeCategory !== "All" && row.category !== activeCategory) return false;
      if (activeHealthFilter && row.overallHealth !== activeHealthFilter) return false;
      return true;
    });
  }, [rows, search, activeCategory, activeHealthFilter]);

  const categoryCounts = useMemo(() => {
    const counts: Partial<Record<Category, number>> = { All: rows.length };
    for (const row of rows) {
      counts[row.category] = (counts[row.category] ?? 0) + 1;
    }
    return counts;
  }, [rows]);

  const healthCounts = useMemo(
    () => ({
      healthy:  rows.filter((r) => r.overallHealth === "healthy").length,
      warning:  rows.filter((r) => r.overallHealth === "warning").length,
      critical: rows.filter((r) => r.overallHealth === "critical").length,
      inactive: rows.filter((r) => r.overallHealth === "inactive").length,
    }),
    [rows],
  );

  const isLoading = envsLoading || catalogLoading;
  const deployedCount = rows.filter((r) => r.overallHealth !== "inactive").length;

  const hasActiveFilters = search || activeCategory !== "All" || activeHealthFilter;

  // Only show category tabs that have at least one item
  const visibleCategories = ALL_CATEGORIES.filter(
    (cat) => cat === "All" || (categoryCounts[cat] ?? 0) > 0,
  );

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <DashboardTopbar breadcrumbs={["Catalog", "Services"]} />

      <div className="flex-1 overflow-auto">
        {/* ── Page header ── */}
        <div className="px-6 pt-6 pb-4">
          <div className="flex items-start justify-between gap-4 mb-5">
            <div>
              <h1 className="text-xl font-bold tracking-tight">Service Catalog</h1>
              {!isLoading && rows.length > 0 && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {rows.length} service{rows.length !== 1 ? "s" : ""}{" · "}
                  <span className="text-success font-medium">{deployedCount} deployed</span>
                  {healthCounts.critical > 0 && (
                    <>
                      {" · "}
                      <span className="text-destructive font-medium">
                        {healthCounts.critical} critical
                      </span>
                    </>
                  )}
                  {" · "}
                  {(environments ?? []).length} environment
                  {(environments ?? []).length !== 1 ? "s" : ""}
                </p>
              )}
            </div>
            <Link
              to="/dashboard/environments"
              className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition font-medium shrink-0"
            >
              <Plus className="size-3.5" /> Add Service
            </Link>
          </div>

          {/* Search */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-input focus-within:border-primary/50 transition-colors max-w-lg">
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

          {/* Category + health filters */}
          <div className="flex items-center gap-2 mt-3 overflow-x-auto pb-1 scrollbar-none">
            {/* Category chips */}
            {visibleCategories.map((cat) => {
              const isActive = activeCategory === cat;
              const count = categoryCounts[cat] ?? 0;
              const config = cat !== "All" ? CATEGORY_CONFIG[cat] : null;

              return (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition border shrink-0 ${
                    isActive
                      ? "bg-primary/10 text-primary border-primary/30"
                      : "bg-transparent text-muted-foreground border-border hover:border-primary/30 hover:text-foreground"
                  }`}
                >
                  {config && <config.icon className="size-3" />}
                  {cat}
                  <span
                    className={`text-[10px] px-1 rounded ${
                      isActive ? "bg-primary/20 text-primary" : "bg-secondary text-muted-foreground"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}

            {/* Spacer + health alert chips */}
            <div className="ml-auto flex items-center gap-1.5 shrink-0">
              {healthCounts.critical > 0 && (
                <button
                  onClick={() =>
                    setActiveHealthFilter((v) => (v === "critical" ? null : "critical"))
                  }
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium border transition ${
                    activeHealthFilter === "critical"
                      ? "bg-destructive/10 text-destructive border-destructive/30"
                      : "bg-transparent text-destructive/70 border-destructive/20 hover:border-destructive/40"
                  }`}
                >
                  <span className="size-1.5 rounded-full bg-destructive inline-block" />
                  {healthCounts.critical} critical
                </button>
              )}
              {healthCounts.warning > 0 && (
                <button
                  onClick={() =>
                    setActiveHealthFilter((v) => (v === "warning" ? null : "warning"))
                  }
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium border transition ${
                    activeHealthFilter === "warning"
                      ? "bg-warning/10 text-warning border-warning/30"
                      : "bg-transparent text-warning/70 border-warning/20 hover:border-warning/40"
                  }`}
                >
                  <span className="size-1.5 rounded-full bg-warning inline-block" />
                  {healthCounts.warning} degraded
                </button>
              )}
              {hasActiveFilters && (
                <button
                  onClick={() => {
                    setSearch("");
                    setActiveCategory("All");
                    setActiveHealthFilter(null);
                  }}
                  className="text-[11px] text-muted-foreground hover:text-foreground px-2 py-1 transition"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── Card grid ── */}
        <div className="px-6 pb-8">
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <CardSkeleton key={i} />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="size-14 rounded-2xl bg-secondary grid place-items-center mb-4">
                <LayoutGrid className="size-7 text-muted-foreground" />
              </div>
              <h2 className="text-base font-semibold mb-1">No services in the catalog</h2>
              <p className="text-sm text-muted-foreground max-w-xs mb-4">
                Add your first service to start deploying infrastructure components and
                application templates.
              </p>
              <Link
                to="/dashboard/environments"
                className="inline-flex items-center gap-1.5 text-xs px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition font-medium"
              >
                <Plus className="size-3.5" /> Add first service
              </Link>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="size-14 rounded-2xl bg-secondary grid place-items-center mb-4">
                <Search className="size-7 text-muted-foreground" />
              </div>
              <h2 className="text-base font-semibold mb-1">No services match your filters</h2>
              <p className="text-sm text-muted-foreground max-w-xs mb-4">
                Try a different search term or clear the active filters.
              </p>
              <button
                onClick={() => {
                  setSearch("");
                  setActiveCategory("All");
                  setActiveHealthFilter(null);
                }}
                className="text-xs text-primary hover:underline"
              >
                Clear all filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filtered.map(({ item, category, envStatuses, overallHealth }) => (
                <CatalogServiceCard
                  key={item.id}
                  item={item}
                  category={category as Exclude<Category, "All">}
                  envStatuses={envStatuses}
                  overallHealth={overallHealth}
                  environments={environments ?? []}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
