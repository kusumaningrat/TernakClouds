import { createFileRoute } from "@tanstack/react-router";
import { DashboardTopbar } from "@/components/DashboardTopbar";
import { Rocket, RotateCw, ShieldCheck, GitBranch, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/dashboard/deployments")({
  head: () => ({ meta: [{ title: "Deployment Controls · TernakClouds" }] }),
  component: DeploymentsPage,
});

const services = [
  {
    name: "payments-api",
    env: "production",
    version: "v4.12.3",
    dept: "Payments",
    status: "healthy",
    traffic: "1.2k rps",
  },
  {
    name: "auth-service",
    env: "production",
    version: "v2.8.0",
    dept: "Platform",
    status: "healthy",
    traffic: "890 rps",
  },
  {
    name: "billing-worker",
    env: "production",
    version: "v1.4.7",
    dept: "Billing",
    status: "deploying",
    traffic: "—",
  },
  {
    name: "search-indexer",
    env: "production",
    version: "v0.9.2",
    dept: "Data",
    status: "degraded",
    traffic: "320 rps",
  },
  {
    name: "notifications",
    env: "production",
    version: "v3.1.0",
    dept: "Payments",
    status: "healthy",
    traffic: "540 rps",
  },
];

function DeploymentsPage() {
  return (
    <>
      <DashboardTopbar
        title="Deployment controls"
        subtitle="Trigger deploys and restarts — authorization is enforced per action."
      />
      <main className="p-6 space-y-4">
        <div className="glass rounded-xl p-4 flex items-start gap-3 border border-primary/20">
          <ShieldCheck className="size-5 text-primary mt-0.5" />
          <div className="text-sm">
            <div className="font-medium">Your active scope</div>
            <div className="text-muted-foreground text-xs font-mono mt-0.5">
              role:platform_admin · permissions:[deploy_services, restart_services,
              rollback_services] · dept:payments,platform
            </div>
          </div>
        </div>

        <div className="glass rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50 text-xs uppercase text-muted-foreground tracking-wider">
              <tr>
                <th className="text-left font-medium px-5 py-3">Service</th>
                <th className="text-left font-medium px-5 py-3">Department</th>
                <th className="text-left font-medium px-5 py-3">Version</th>
                <th className="text-left font-medium px-5 py-3">Status</th>
                <th className="text-left font-medium px-5 py-3">Traffic</th>
                <th className="text-right font-medium px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {services.map((s) => (
                <tr key={s.name} className="hover:bg-secondary/30 transition">
                  <td className="px-5 py-4">
                    <div className="font-medium font-mono">{s.name}</div>
                    <div className="text-xs text-muted-foreground">{s.env}</div>
                  </td>
                  <td className="px-5 py-4">
                    <span className="px-2 py-0.5 rounded bg-secondary text-xs">{s.dept}</span>
                  </td>
                  <td className="px-5 py-4 font-mono text-xs">{s.version}</td>
                  <td className="px-5 py-4">
                    <span
                      className={`inline-flex items-center gap-1.5 text-xs ${
                        s.status === "healthy"
                          ? "text-success"
                          : s.status === "deploying"
                            ? "text-warning"
                            : "text-destructive"
                      }`}
                    >
                      <span
                        className={`size-1.5 rounded-full bg-current ${s.status === "deploying" ? "animate-pulse" : ""}`}
                      />
                      {s.status}
                    </span>
                  </td>
                  <td className="px-5 py-4 font-mono text-xs text-muted-foreground">{s.traffic}</td>
                  <td className="px-5 py-4">
                    <div className="flex justify-end gap-2">
                      <button className="text-xs px-2.5 py-1.5 rounded-md bg-secondary hover:bg-accent inline-flex items-center gap-1.5">
                        <RotateCw className="size-3" /> Restart
                      </button>
                      <button className="text-xs px-2.5 py-1.5 rounded-md bg-primary text-primary-foreground hover:opacity-90 inline-flex items-center gap-1.5">
                        <Rocket className="size-3" /> Deploy
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="grid lg:grid-cols-2 gap-4">
          <div className="glass rounded-xl p-5">
            <h3 className="font-semibold flex items-center gap-2">
              <GitBranch className="size-4 text-primary" /> Pending approvals
            </h3>
            <div className="mt-4 space-y-3">
              {[
                { svc: "billing-worker", actor: "jordan.t", reason: "release v1.4.8" },
                { svc: "search-indexer", actor: "sam.r", reason: "config rollback" },
              ].map((a) => (
                <div
                  key={a.svc}
                  className="flex items-center justify-between p-3 rounded-md bg-secondary/60"
                >
                  <div>
                    <div className="text-sm font-medium font-mono">{a.svc}</div>
                    <div className="text-xs text-muted-foreground">
                      {a.actor} · {a.reason}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button className="text-xs px-2.5 py-1.5 rounded bg-destructive/15 text-destructive hover:bg-destructive/25">
                      Deny
                    </button>
                    <button className="text-xs px-2.5 py-1.5 rounded bg-success/15 text-success hover:bg-success/25">
                      Approve
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="glass rounded-xl p-5">
            <h3 className="font-semibold flex items-center gap-2">
              <AlertTriangle className="size-4 text-warning" /> Recent denials
            </h3>
            <div className="mt-4 space-y-2 font-mono text-xs">
              {[
                "403 · sam.r · deploy_services · payments-api",
                "403 · noah.p · restart_services · auth-service",
                "403 · jordan.t · manage_secrets · billing-worker",
              ].map((l) => (
                <div
                  key={l}
                  className="flex items-center gap-2 p-2 rounded bg-destructive/5 border border-destructive/15"
                >
                  <span className="text-destructive">●</span> {l}
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
