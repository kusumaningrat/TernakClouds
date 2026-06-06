import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { DashboardTopbar } from "@/components/DashboardTopbar";
import { useWorkspaceContext } from "@/lib/workspace-context";
import { useK8sServiceDetail } from "@/lib/queries";
import { Loader2, AlertTriangle, ArrowLeft } from "lucide-react";

export const Route = createFileRoute(
  "/dashboard/environments/$envId/services/k8s/$namespace/$name",
)({
  head: () => ({ meta: [{ title: "K8s Service · TernakClouds" }] }),
  component: K8sServiceDetailPage,
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const SERVICE_TYPE_COLOR: Record<string, string> = {
  ClusterIP: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  NodePort: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  LoadBalancer: "bg-success/10 text-success border-success/20",
  ExternalName: "bg-purple-500/10 text-purple-500 border-purple-500/20",
};

// ─── Page ─────────────────────────────────────────────────────────────────────

function K8sServiceDetailPage() {
  const { envId, namespace, name } = useParams({
    from: "/dashboard/environments/$envId/services/k8s/$namespace/$name",
  });
  const { selectedWorkspace } = useWorkspaceContext();
  const slug = selectedWorkspace?.slug ?? "";

  const { data: detail, isLoading, error } = useK8sServiceDetail(slug, envId, namespace, name);

  const typeCls =
    SERVICE_TYPE_COLOR[detail?.type ?? ""] ?? "bg-secondary text-muted-foreground border-border";

  return (
    <>
      <DashboardTopbar title={name} subtitle={`K8s Service · namespace: ${namespace}`} />

      <main className="p-6 space-y-8">
        {/* Back */}
        <Link
          to="/dashboard/environments/$envId/services"
          params={{ envId }}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition"
        >
          <ArrowLeft className="size-3.5" /> Services
        </Link>

        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
            <Loader2 className="size-4 animate-spin" /> Loading service…
          </div>
        )}
        {error && !isLoading && (
          <div className="flex items-center gap-2 text-sm text-destructive py-4">
            <AlertTriangle className="size-4" /> Failed to load service details
          </div>
        )}

        {!isLoading && detail && (
          <>
            {/* Header with type badge */}
            <div className="flex items-center gap-3">
              <span className={`text-xs font-medium px-2 py-1 rounded border ${typeCls}`}>
                {detail.type}
              </span>
            </div>

            {/* Overview */}
            <section className="space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Overview
              </p>
              <div className="rounded-lg border border-border bg-card p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                    Namespace
                  </p>
                  <span className="text-sm font-mono text-foreground">{detail.namespace}</span>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                    Cluster IP
                  </p>
                  <span className="text-sm font-mono text-foreground">
                    {detail.clusterIP || "—"}
                  </span>
                </div>
                {detail.type === "LoadBalancer" && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                      Load Balancer IP
                    </p>
                    <span className="text-sm font-mono text-foreground">
                      {(() => {
                        const ips = [
                          ...(detail.loadBalancerIPs ?? []),
                          ...(detail.externalIPs ?? []),
                        ];
                        return ips.length > 0 ? ips.join(", ") : "Pending…";
                      })()}
                    </span>
                  </div>
                )}
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                    Type
                  </p>
                  <span className={`text-xs font-medium px-1.5 py-0.5 rounded border ${typeCls}`}>
                    {detail.type}
                  </span>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                    Created
                  </p>
                  <span className="text-sm text-foreground">{formatDate(detail.createdAt)}</span>
                </div>
              </div>
            </section>

            {/* Ports */}
            {detail.ports && detail.ports.length > 0 && (
              <section className="space-y-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Ports
                </p>
                <div className="rounded-lg border border-border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-secondary/50">
                        {["Port", "Protocol", "NodePort"].map((h) => (
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
                      {detail.ports.map((p, i) => (
                        <tr key={i} className="border-b border-border last:border-0">
                          <td className="px-3 py-2.5 font-mono text-sm">{p.port}</td>
                          <td className="px-3 py-2.5 text-xs text-muted-foreground font-mono">
                            {p.protocol}
                          </td>
                          <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">
                            {p.nodePort != null ? p.nodePort : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* External IPs */}
            {detail.externalIPs && detail.externalIPs.length > 0 && (
              <section className="space-y-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  External IPs
                </p>
                <div className="flex flex-wrap gap-2">
                  {detail.externalIPs.map((ip) => (
                    <span
                      key={ip}
                      className="text-xs font-mono px-2 py-1 rounded bg-secondary border border-border text-foreground"
                    >
                      {ip}
                    </span>
                  ))}
                </div>
              </section>
            )}

            {/* Selector */}
            {Object.keys(detail.selector ?? {}).length > 0 && (
              <section className="space-y-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Selector
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(detail.selector).map(([k, v]) => (
                    <span
                      key={k}
                      className="text-[11px] font-mono px-2 py-0.5 rounded bg-secondary border border-border text-muted-foreground"
                    >
                      {k}=<span className="text-foreground">{v}</span>
                    </span>
                  ))}
                </div>
              </section>
            )}

            {/* Endpoints */}
            <section className="space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Endpoints
              </p>
              {detail.endpoints && detail.endpoints.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {detail.endpoints.map((ep) => (
                    <span
                      key={ep}
                      className="text-xs font-mono px-2 py-1 rounded bg-secondary border border-border text-foreground"
                    >
                      {ep}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No endpoints.</p>
              )}
            </section>
          </>
        )}
      </main>
    </>
  );
}
