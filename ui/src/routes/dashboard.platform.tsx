import { createFileRoute, Link } from "@tanstack/react-router";
import { DashboardTopbar } from "@/components/DashboardTopbar";
import { useWorkspaceContext } from "@/lib/workspace-context";
import { useEnvironments, useRegistries, useRepoProviders } from "@/lib/queries";
import {
  Server,
  Package,
  GitFork,
  KeyRound,
  ChevronRight,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Globe,
} from "lucide-react";

export const Route = createFileRoute("/dashboard/platform")({
  head: () => ({ meta: [{ title: "Platform · TernakClouds" }] }),
  component: PlatformPage,
});

function PlatformPage() {
  const { selectedWorkspace } = useWorkspaceContext();
  const slug = selectedWorkspace?.slug ?? "";

  const { data: environments, isLoading: envsLoading } = useEnvironments(slug);
  const { data: registries } = useRegistries(slug);
  const { data: repoProviders } = useRepoProviders(slug);

  return (
    <div className="flex flex-col h-full">
      <DashboardTopbar breadcrumbs={["Platform"]} />
      <div className="px-6 pt-5 pb-4 border-b border-border">
        <div className="label-mono text-muted-foreground mb-1">Platform</div>
        <h1 className="text-2xl font-bold tracking-tight">Platform</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Infrastructure management — environments, runtimes, registries, and providers. Platform
          engineers only.
        </p>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-8 max-w-3xl">
        {/* Environments */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="font-semibold text-sm">Environments</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Each environment maps to a runtime. Developers deploy into environments; platform
                engineers manage the underlying runtime.
              </p>
            </div>
          </div>

          {envsLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Loader2 className="size-4 animate-spin" /> Loading…
            </div>
          ) : (environments ?? []).length === 0 ? (
            <div className="glass rounded-xl p-6 text-center">
              <p className="text-sm text-muted-foreground">No environments configured.</p>
              <Link
                to="/dashboard/environments"
                className="mt-3 inline-flex text-xs text-primary hover:underline"
              >
                Create first environment →
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {(environments ?? []).map((env) => (
                <div key={env.id} className="glass rounded-xl overflow-hidden">
                  <Link
                    to="/dashboard/environments/$envId"
                    params={{ envId: env.slug }}
                    className="flex items-center gap-3 p-4 hover:bg-accent/40 transition group"
                  >
                    <div className="size-8 rounded-lg bg-secondary grid place-items-center shrink-0 group-hover:bg-primary/10 transition">
                      <Globe className="size-4 text-muted-foreground group-hover:text-primary transition" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{env.name}</div>
                      <div className="text-xs text-muted-foreground font-mono">{env.slug}</div>
                    </div>
                    <ChevronRight className="size-4 text-muted-foreground shrink-0" />
                  </Link>
                  <div className="border-t border-border flex divide-x divide-border">
                    {[
                      {
                        to: "/dashboard/environments/$envId/platform/runtime" as const,
                        label: "RUNTIME",
                      },
                      {
                        to: "/dashboard/environments/$envId/platform/secrets" as const,
                        label: "SECRETS",
                      },
                      {
                        to: "/dashboard/environments/$envId/platform/logs" as const,
                        label: "LOGS",
                      },
                    ].map(({ to, label }) => (
                      <Link
                        key={label}
                        to={to}
                        params={{ envId: env.slug }}
                        className="flex-1 py-2 text-center text-[11px] label-mono text-muted-foreground hover:text-primary hover:bg-accent/30 transition"
                      >
                        {label}
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          <Link
            to="/dashboard/environments"
            className="mt-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition"
          >
            Manage all environments <ChevronRight className="size-3" />
          </Link>
        </section>

        {/* Container Registries */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="font-semibold text-sm">Container Registries</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Approved registries from which service images can be pulled.
              </p>
            </div>
            <Link
              to="/dashboard/registries"
              className="text-xs px-3 py-1.5 rounded border border-border hover:bg-accent transition text-muted-foreground"
            >
              Manage
            </Link>
          </div>
          <div className="glass rounded-xl p-4 flex items-center gap-3">
            <div className="size-8 rounded-lg bg-secondary grid place-items-center shrink-0">
              <Package className="size-4 text-muted-foreground" />
            </div>
            <div className="flex-1">
              <div className="font-medium text-sm">
                {(registries ?? []).length} registr{(registries ?? []).length === 1 ? "y" : "ies"}{" "}
                connected
              </div>
              <div className="text-xs text-muted-foreground">
                Harbor, Docker Hub, GHCR, ECR, GCR
              </div>
            </div>
            {(registries ?? []).length > 0 ? (
              <CheckCircle2 className="size-4 text-success shrink-0" />
            ) : (
              <AlertCircle className="size-4 text-warning shrink-0" />
            )}
          </div>
        </section>

        {/* Repository Providers */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="font-semibold text-sm">Repository Providers</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Connected Git providers for GitOps workflows and CI/CD generation.
              </p>
            </div>
            <Link
              to="/dashboard/repositories"
              className="text-xs px-3 py-1.5 rounded border border-border hover:bg-accent transition text-muted-foreground"
            >
              Manage
            </Link>
          </div>
          {(repoProviders ?? []).length === 0 ? (
            <div className="glass rounded-xl p-4 flex items-center gap-3">
              <AlertCircle className="size-4 text-warning shrink-0" />
              <div>
                <div className="text-sm font-medium">No repository providers connected</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Connect GitHub or GitLab to enable GitOps workflows.
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {(repoProviders ?? []).map((rp) => (
                <div key={rp.id} className="glass rounded-xl px-4 py-3 flex items-center gap-3">
                  <div className="size-7 rounded bg-secondary grid place-items-center shrink-0">
                    <GitFork className="size-3.5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{rp.name}</div>
                    <div className="text-[10px] text-muted-foreground font-mono">
                      {rp.provider_type}
                      {rp.base_url ? ` · ${rp.base_url}` : ""}
                    </div>
                  </div>
                  <CheckCircle2 className="size-3.5 text-success shrink-0" />
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Advanced admin links */}
        <section>
          <h2 className="font-semibold text-sm mb-3">Advanced</h2>
          <div className="glass rounded-xl overflow-hidden divide-y divide-border">
            {[
              {
                to: "/dashboard/environments" as const,
                label: "Manage Environments",
                desc: "Create, edit, and delete deployment environments",
              },
              {
                to: "/dashboard/registries" as const,
                label: "Manage Registries",
                desc: "Connect and configure container registries",
              },
              {
                to: "/dashboard/repositories" as const,
                label: "Manage Git Providers",
                desc: "Connect GitHub, GitLab and manage repo access",
              },
              {
                to: "/dashboard/deployment-controls" as const,
                label: "Deployment Controls",
                desc: "Deployment policies and approval gates",
              },
            ].map(({ to, label, desc }) => (
              <Link
                key={to}
                to={to}
                className="flex items-center gap-3 px-4 py-3 hover:bg-accent/40 transition group"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium group-hover:text-primary transition">
                    {label}
                  </div>
                  <div className="text-xs text-muted-foreground">{desc}</div>
                </div>
                <ChevronRight className="size-4 text-muted-foreground group-hover:text-primary transition shrink-0" />
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
