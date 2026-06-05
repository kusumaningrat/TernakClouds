import { createFileRoute, Link } from "@tanstack/react-router";
import { DashboardTopbar } from "@/components/DashboardTopbar";
import { useWorkspaceContext } from "@/lib/workspace-context";
import { useEnvironments, useRegistries, useRepoProviders } from "@/lib/queries";
import {
  Server,
  Container,
  GitFork,
  Users,
  KeyRound,
  Building2,
  ChevronRight,
  Loader2,
} from "lucide-react";

export const Route = createFileRoute("/dashboard/settings")({
  head: () => ({ meta: [{ title: "Settings · TernakClouds" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { selectedWorkspace } = useWorkspaceContext();
  const slug = selectedWorkspace?.slug ?? "";

  const { data: environments, isLoading: envsLoading } = useEnvironments(slug);
  const { data: registries } = useRegistries(slug);
  const { data: repoProviders } = useRepoProviders(slug);

  return (
    <>
      <DashboardTopbar
        title="Settings"
        subtitle="Platform configuration — runtimes, registries, repositories, and access control."
      />
      <main className="p-6 space-y-8 overflow-auto">

        {/* Runtimes — per environment */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="font-semibold text-sm">Runtimes</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Configure the compute provider for each environment.
              </p>
            </div>
          </div>
          {envsLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Loading…
            </div>
          ) : (
            <div className="space-y-2">
              {(environments ?? []).map((env) => (
                <Link
                  key={env.id}
                  to="/dashboard/environments/$envId/platform/runtime"
                  params={{ envId: env.slug }}
                  className="glass rounded-xl p-4 flex items-center gap-3 hover:bg-accent/50 transition group"
                >
                  <div className="size-8 rounded-lg bg-secondary grid place-items-center shrink-0">
                    <Server className="size-4 text-muted-foreground group-hover:text-primary transition" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{env.name}</div>
                    <div className="text-xs text-muted-foreground font-mono">{env.slug}</div>
                  </div>
                  <span className="text-[11px] text-muted-foreground">Configure runtime</span>
                  <ChevronRight className="size-4 text-muted-foreground" />
                </Link>
              ))}
              {(environments ?? []).length === 0 && !envsLoading && (
                <div className="glass rounded-xl p-6 text-center">
                  <p className="text-sm text-muted-foreground">No environments configured.</p>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Registries */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="font-semibold text-sm">Container registries</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Connect registries to pull and push service images.
              </p>
            </div>
            <Link
              to="/dashboard/registries"
              className="text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-accent transition flex items-center gap-1.5"
            >
              <Container className="size-3.5" /> Manage
            </Link>
          </div>
          <div className="glass rounded-xl p-4 flex items-center gap-3">
            <div className="size-8 rounded-lg bg-secondary grid place-items-center shrink-0">
              <Container className="size-4 text-muted-foreground" />
            </div>
            <div className="flex-1">
              <div className="font-medium text-sm">
                {(registries ?? []).length} registr{(registries ?? []).length === 1 ? "y" : "ies"} connected
              </div>
              <div className="text-xs text-muted-foreground">Harbor, Docker Hub, GHCR, ECR supported</div>
            </div>
            <ChevronRight className="size-4 text-muted-foreground" />
          </div>
        </section>

        {/* Repositories */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="font-semibold text-sm">Repository providers</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Connect GitHub or GitLab to enable GitOps workflows.
              </p>
            </div>
            <Link
              to="/dashboard/repositories"
              className="text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-accent transition flex items-center gap-1.5"
            >
              <GitFork className="size-3.5" /> Manage
            </Link>
          </div>
          <div className="glass rounded-xl p-4 flex items-center gap-3">
            <div className="size-8 rounded-lg bg-secondary grid place-items-center shrink-0">
              <GitFork className="size-4 text-muted-foreground" />
            </div>
            <div className="flex-1">
              <div className="font-medium text-sm">
                {(repoProviders ?? []).length} provider{(repoProviders ?? []).length === 1 ? "" : "s"} connected
              </div>
              <div className="text-xs text-muted-foreground">GitHub and GitLab supported</div>
            </div>
            <ChevronRight className="size-4 text-muted-foreground" />
          </div>
        </section>

        {/* Access control */}
        <section>
          <div className="mb-3">
            <h2 className="font-semibold text-sm">Access control</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Manage platform roles, permissions, and workspace membership.
            </p>
          </div>
          <div className="space-y-2">
            {([
              {
                to: "/dashboard/roles",
                label: "Roles & Permissions",
                desc: "Define and assign platform roles",
                icon: KeyRound,
              },
              {
                to: "/dashboard/users",
                label: "Platform Members",
                desc: "All users across the platform",
                icon: Users,
              },
              {
                to: "/dashboard/workspaces",
                label: "All Workspaces",
                desc: "Manage workspace isolation",
                icon: Building2,
              },
              {
                to: "/dashboard/departments",
                label: "Departments",
                desc: "Organisational structure",
                icon: Building2,
              },
            ] as const).map(({ to, label, desc, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                className="glass rounded-xl p-4 flex items-center gap-3 hover:bg-accent/50 transition group"
              >
                <div className="size-8 rounded-lg bg-secondary grid place-items-center shrink-0">
                  <Icon className="size-4 text-muted-foreground group-hover:text-primary transition" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">{label}</div>
                  <div className="text-xs text-muted-foreground">{desc}</div>
                </div>
                <ChevronRight className="size-4 text-muted-foreground" />
              </Link>
            ))}
          </div>
        </section>

        {/* Logs backends — per environment */}
        <section>
          <div className="mb-3">
            <h2 className="font-semibold text-sm">Logs backends</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Configure log aggregation providers per environment.
            </p>
          </div>
          <div className="space-y-2">
            {(environments ?? []).map((env) => (
              <Link
                key={env.id}
                to="/dashboard/environments/$envId/platform/logs"
                params={{ envId: env.slug }}
                className="glass rounded-xl p-4 flex items-center gap-3 hover:bg-accent/50 transition group"
              >
                <div className="size-8 rounded-lg bg-secondary grid place-items-center shrink-0">
                  <Server className="size-4 text-muted-foreground group-hover:text-primary transition" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">{env.name}</div>
                  <div className="text-xs text-muted-foreground font-mono">{env.slug}</div>
                </div>
                <span className="text-[11px] text-muted-foreground">Configure</span>
                <ChevronRight className="size-4 text-muted-foreground" />
              </Link>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
