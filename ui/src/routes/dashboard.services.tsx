import { createFileRoute, Link } from "@tanstack/react-router";
import { DashboardTopbar } from "@/components/DashboardTopbar";
import { useCatalog } from "@/lib/queries";
import type { CatalogItem } from "@/lib/types";
import {
  Plus,
  Loader2,
  Search,
  Rocket,
  X,
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
import { useMemo, useState } from "react";

export const Route = createFileRoute("/dashboard/services")({
  head: () => ({ meta: [{ title: "Service Catalog · TernakClouds" }] }),
  component: ServiceCatalogPage,
});

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

export function inferCategory(item: CatalogItem): Exclude<Category, "All"> {
  const text = `${item.name} ${item.display_name}`;
  for (const [pattern, cat] of CATEGORY_PATTERNS) {
    if (pattern.test(text)) return cat;
  }
  return "Application";
}

type CategoryConfig = { icon: LucideIcon; color: string; bg: string };

export const CATEGORY_CONFIG: Record<Exclude<Category, "All">, CategoryConfig> = {
  Database: { icon: Database, color: "text-blue-600", bg: "bg-blue-500/10" },
  Cache: { icon: Zap, color: "text-amber-600", bg: "bg-amber-500/10" },
  "Message Broker": { icon: Radio, color: "text-purple-600", bg: "bg-purple-500/10" },
  "Object Storage": { icon: HardDrive, color: "text-teal-600", bg: "bg-teal-500/10" },
  Monitoring: { icon: Activity, color: "text-orange-600", bg: "bg-orange-500/10" },
  Networking: { icon: Network, color: "text-slate-600", bg: "bg-slate-500/10" },
  "AI Services": { icon: Cpu, color: "text-violet-600", bg: "bg-violet-500/10" },
  Application: { icon: Box, color: "text-primary", bg: "bg-primary/10" },
};

// ─── Catalog card ───────────────────────────────────────────────────────────────

function CatalogServiceCard({
  item,
  category,
}: {
  item: CatalogItem;
  category: Exclude<Category, "All">;
}) {
  const { icon: Icon, color, bg } = CATEGORY_CONFIG[category];

  return (
    <div className="group flex flex-col rounded-xl border border-border bg-card overflow-hidden transition-all hover:shadow-md">
      {/* Clickable body → service detail */}
      <Link
        to="/dashboard/services/$serviceName"
        params={{ serviceName: item.name }}
        className="p-4 flex-1 flex flex-col gap-3 hover:bg-accent/20 transition-colors"
      >
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

        {item.description ? (
          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
            {item.description}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground/40 italic">No description available</p>
        )}
      </Link>

      {/* Actions footer */}
      <div className="px-4 py-3 bg-muted/30 border-t border-border/50 flex items-center gap-2">
        <Link
          to="/dashboard/deploy/$serviceName"
          params={{ serviceName: item.name }}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition"
        >
          <Rocket className="size-3.5" /> Deploy
        </Link>
        <Link
          to="/dashboard/services/$serviceName"
          params={{ serviceName: item.name }}
          className="flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded-md bg-secondary text-muted-foreground hover:text-foreground transition"
        >
          Details
        </Link>
      </div>
    </div>
  );
}

// ─── Loading skeleton ───────────────────────────────────────────────────────────

function CardSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden animate-pulse">
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
      </div>
      <div className="px-4 py-3 bg-muted/30 border-t border-border/50">
        <div className="h-8 bg-muted rounded-md" />
      </div>
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────────

function ServiceCatalogPage() {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<Category>("All");

  const { data: catalog, isLoading } = useCatalog();

  const rows = useMemo(
    () => (catalog ?? []).map((item) => ({ item, category: inferCategory(item) })),
    [catalog],
  );

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
      return true;
    });
  }, [rows, search, activeCategory]);

  const categoryCounts = useMemo(() => {
    const counts: Partial<Record<Category, number>> = { All: rows.length };
    for (const row of rows) {
      counts[row.category] = (counts[row.category] ?? 0) + 1;
    }
    return counts;
  }, [rows]);

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
                  {rows.length} service{rows.length !== 1 ? "s" : ""} available to deploy
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

          {/* Category chips */}
          <div className="flex items-center gap-2 mt-3 overflow-x-auto pb-1 scrollbar-none">
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
                Add your first service to start deploying infrastructure components and application
                templates.
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
                Try a different search term or category.
              </p>
              <button
                onClick={() => {
                  setSearch("");
                  setActiveCategory("All");
                }}
                className="text-xs text-primary hover:underline"
              >
                Clear filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filtered.map(({ item, category }) => (
                <CatalogServiceCard
                  key={item.id}
                  item={item}
                  category={category as Exclude<Category, "All">}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
