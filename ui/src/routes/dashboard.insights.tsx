import { createFileRoute, Link } from "@tanstack/react-router";
import { DashboardTopbar } from "@/components/DashboardTopbar";
import { useWorkspaceContext } from "@/lib/workspace-context";
import { useEnvironmentContext } from "@/lib/environment-context";
import {
  useCatalog,
  useEnvironments,
  useAllServiceDeployments,
} from "@/lib/queries";
import type { ServiceDeployment } from "@/lib/types";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Circle,
  Layers,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { useMemo } from "react";

export const Route = createFileRoute("/dashboard/insights")({
  head: () => ({ meta: [{ title: "Insights · TernakClouds" }] }),
  component: InsightsPage,
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

type ServiceHealth = "healthy" | "degraded" | "critical" | "undeployed";

function computeOverallHealth(deployments: ServiceDeployment[]): ServiceHealth {
  if (deployments.length === 0) return "undeployed";
  const statuses = deployments.map((d) => d.status?.toLowerCase() ?? "");
  if (statuses.every((s) => s === "running")) return "healthy";
  if (statuses.some((s) => s === "dead" || s === "failed")) return "critical";
  return "degraded";
}

const HEALTH_CONFIG: Record<ServiceHealth, { icon: React.ElementType; label: string; dot: string; badge: string }> = {
  healthy:    { icon: CheckCircle2,  label: "Healthy",      dot: "bg-success",             badge: "text-success bg-success/10 border-success/20" },
  degraded:   { icon: AlertTriangle, label: "Degraded",     dot: "bg-warning",             badge: "text-warning bg-warning/10 border-warning/20" },
  critical:   { icon: XCircle,       label: "Critical",     dot: "bg-destructive",         badge: "text-destructive bg-destructive/10 border-destructive/20" },
  undeployed: { icon: Circle,        label: "Not deployed", dot: "bg-muted-foreground/30", badge: "text-muted-foreground bg-secondary border-border" },
};

function ScoreBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${Math.min(value, 100)}%` }} />
      </div>
      <span className="text-xs font-mono font-medium w-8 text-right">{value}</span>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function InsightsPage() {
  const { selectedWorkspace } = useWorkspaceContext();
  const { selectedEnvironment } = useEnvironmentContext();
  const slug = selectedWorkspace?.slug ?? "";

  const { data: catalog, isLoading: catalogLoading } = useCatalog();
  const { data: environments, isLoading: envsLoading } = useEnvironments(slug);
  const envSlugs = useMemo(() => (environments ?? []).map((e) => e.slug), [environments]);
  const deploymentQueries = useAllServiceDeployments(slug, envSlugs);

  const isLoading = catalogLoading || envsLoading;

  const serviceHealthData = useMemo(() => {
    const visibleEnvs = selectedEnvironment ? [selectedEnvironment] : (environments ?? []);

    return (catalog ?? []).map((item) => {
      const allDeps = visibleEnvs.flatMap((env) => {
        const globalIdx = (environments ?? []).findIndex((e) => e.id === env.id);
        return (deploymentQueries[globalIdx]?.data ?? []).filter((d) => d.catalog_name === item.name);
      });

      const health = computeOverallHealth(allDeps);
      const envCount = new Set(allDeps.map((d) => d.environment_id)).size;

      const readiness =
        health === "healthy" ? 80 : health === "degraded" ? 50 : health === "critical" ? 20 : 0;
      const risk =
        health === "critical" ? 75 : health === "degraded" ? 45 : health === "healthy" ? 10 : 30;

      return { item, health, allDeps, envCount, readiness, risk };
    });
  }, [catalog, environments, selectedEnvironment, deploymentQueries]);

  const counts = useMemo(() =>
    serviceHealthData.reduce((acc, s) => {
      acc[s.health] = (acc[s.health] ?? 0) + 1;
      return acc;
    }, {} as Record<ServiceHealth, number>),
    [serviceHealthData],
  );

  const totalServices = serviceHealthData.length;
  const healthPercent = totalServices > 0 ? Math.round(((counts.healthy ?? 0) / totalServices) * 100) : 0;
  const avgReadiness  = totalServices > 0 ? Math.round(serviceHealthData.reduce((s, x) => s + x.readiness, 0) / totalServices) : 0;
  const issueCount    = (counts.critical ?? 0) + (counts.degraded ?? 0);

  return (
    <div className="flex flex-col h-full">
      <DashboardTopbar breadcrumbs={["Insights"]} />
      <div className="px-6 pt-5 pb-4 border-b border-border">
        <div className="label-mono text-muted-foreground mb-1">Insights</div>
        <h1 className="text-2xl font-bold tracking-tight">Workspace Insights</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Service health, readiness, and reliability across all environments
        </p>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-6">
        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="size-4 animate-spin" /> Computing insights…
          </div>
        ) : (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                {
                  label: "OVERALL HEALTH",
                  value: `${healthPercent}%`,
                  sub: `${counts.healthy ?? 0}/${totalServices} services healthy`,
                  barValue: healthPercent,
                  barColor: healthPercent >= 80 ? "bg-success" : healthPercent >= 50 ? "bg-warning" : "bg-destructive",
                  textColor: healthPercent >= 80 ? "text-success" : healthPercent >= 50 ? "text-warning" : "text-destructive",
                },
                {
                  label: "READINESS",
                  value: String(avgReadiness),
                  sub: "avg across services",
                  barValue: avgReadiness,
                  barColor: "bg-primary",
                  textColor: "text-primary",
                },
                {
                  label: "ISSUES",
                  value: String(issueCount),
                  sub: `${counts.critical ?? 0} critical · ${counts.degraded ?? 0} degraded`,
                  barValue: null,
                  barColor: "",
                  textColor: issueCount === 0 ? "text-success" : "text-warning",
                },
                {
                  label: "SERVICES",
                  value: String(totalServices),
                  sub: `${totalServices - (counts.undeployed ?? 0)} deployed · ${counts.undeployed ?? 0} idle`,
                  barValue: null,
                  barColor: "",
                  textColor: "text-foreground",
                },
              ].map(({ label, value, sub, barValue, barColor, textColor }) => (
                <div key={label} className="glass rounded-xl p-4">
                  <div className="label-mono text-muted-foreground mb-2">{label}</div>
                  <div className={`text-3xl font-bold font-mono ${textColor}`}>{value}</div>
                  {barValue !== null && (
                    <ScoreBar value={barValue} color={barColor} />
                  )}
                  <div className="text-[10px] text-muted-foreground mt-1">{sub}</div>
                </div>
              ))}
            </div>

            {/* Health breakdown */}
            <section>
              <h2 className="text-sm font-semibold mb-3">Health breakdown</h2>
              <div className="grid grid-cols-2 gap-2">
                {(["healthy", "degraded", "critical", "undeployed"] as ServiceHealth[]).map((h) => {
                  const { label, dot } = HEALTH_CONFIG[h];
                  const count = counts[h] ?? 0;
                  const pct = totalServices > 0 ? Math.round((count / totalServices) * 100) : 0;
                  return (
                    <div key={h} className="glass rounded-xl p-3 flex items-center gap-3">
                      <span className={`size-2.5 rounded-full shrink-0 ${dot}`} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium">{label}</div>
                        <div className="h-1 bg-secondary rounded-full mt-1.5 overflow-hidden">
                          <div className={`h-full rounded-full ${dot}`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                      <span className="font-mono text-sm font-medium shrink-0">{count}</span>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Per-service health matrix */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold">Service health matrix</h2>
                <Link
                  to="/dashboard/services"
                  className="text-xs text-muted-foreground hover:text-primary transition flex items-center gap-1"
                >
                  View catalog <ChevronRight className="size-3" />
                </Link>
              </div>
              <div className="glass rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="px-5 py-3 text-left label-mono text-muted-foreground font-medium">SERVICE</th>
                      <th className="px-4 py-3 text-left label-mono text-muted-foreground font-medium">HEALTH</th>
                      <th className="px-4 py-3 text-left label-mono text-muted-foreground font-medium">READINESS</th>
                      <th className="px-4 py-3 text-left label-mono text-muted-foreground font-medium">RISK</th>
                      <th className="px-4 py-3 text-left label-mono text-muted-foreground font-medium">ENVIRONMENTS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {serviceHealthData.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-5 py-10 text-center text-muted-foreground">
                          No services in catalog.
                        </td>
                      </tr>
                    ) : (
                      serviceHealthData.map(({ item, health, envCount, readiness, risk }) => {
                        const { icon: Icon, label, badge } = HEALTH_CONFIG[health];
                        return (
                          <tr key={item.id} className="border-b border-border last:border-0 hover:bg-accent/40 transition-colors">
                            <td className="px-5 py-3">
                              <Link
                                to="/dashboard/services/$serviceName"
                                params={{ serviceName: item.name }}
                                className="flex items-center gap-2.5 group"
                              >
                                <div className="size-7 rounded bg-secondary grid place-items-center shrink-0">
                                  <Layers className="size-3.5 text-muted-foreground group-hover:text-primary transition" />
                                </div>
                                <div>
                                  <div className="font-medium text-sm group-hover:text-primary transition">
                                    {item.display_name || item.name}
                                  </div>
                                  <div className="text-[10px] font-mono text-muted-foreground">{item.name}</div>
                                </div>
                              </Link>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded border label-mono ${badge}`}>
                                <Icon className="size-2.5" />
                                {label.toUpperCase()}
                              </span>
                            </td>
                            <td className="px-4 py-3 w-28">
                              <ScoreBar value={readiness} color="bg-primary" />
                            </td>
                            <td className="px-4 py-3 w-28">
                              <ScoreBar
                                value={risk}
                                color={risk >= 60 ? "bg-destructive" : risk >= 35 ? "bg-warning" : "bg-success"}
                              />
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-xs font-mono text-muted-foreground">
                                {envCount}/{(environments ?? []).length}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
