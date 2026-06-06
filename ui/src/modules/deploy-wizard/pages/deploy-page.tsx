import { useParams, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { ArrowLeft, Cpu, MemoryStick, Globe, Lock, Loader2 } from "lucide-react";
import { DashboardTopbar } from "@/components/DashboardTopbar";
import { useWorkspaceContext } from "@/lib/workspace-context";
import { useCatalog, useEnvironments } from "@/lib/queries";
import { inferCategory, CATEGORY_CONFIG } from "@/lib/catalog-category";
import { DeployForm } from "../components/deploy-form";

export function DeployPage() {
  const { serviceName } = useParams({ from: "/dashboard/deploy/$serviceName" });
  const { selectedWorkspace } = useWorkspaceContext();
  const workspaceSlug = selectedWorkspace?.slug ?? "";

  const { data: catalog, isLoading: catalogLoading } = useCatalog();
  const { data: environments, isLoading: envsLoading } = useEnvironments(workspaceSlug);

  const item = (catalog ?? []).find((c) => c.name === serviceName) ?? null;

  const [selectedEnvSlug, setSelectedEnvSlug] = useState("");

  useEffect(() => {
    if (environments?.length && !selectedEnvSlug) {
      setSelectedEnvSlug(environments[0].slug);
    }
  }, [environments, selectedEnvSlug]);

  const isLoading = catalogLoading || envsLoading;

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <DashboardTopbar breadcrumbs={["Catalog", "Deploy"]} />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="flex flex-col h-full">
        <DashboardTopbar breadcrumbs={["Catalog", "Deploy"]} />
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center p-8">
          <p className="text-muted-foreground text-sm">
            Service <span className="font-mono">{serviceName}</span> not found in catalog.
          </p>
          <Link
            to="/dashboard/services"
            className="text-primary text-sm hover:underline flex items-center gap-1.5"
          >
            <ArrowLeft className="size-3.5" /> Back to catalog
          </Link>
        </div>
      </div>
    );
  }

  const category = inferCategory(item);
  const categoryConfig = CATEGORY_CONFIG[category];
  const CategoryIcon = categoryConfig.icon;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <DashboardTopbar breadcrumbs={["Catalog", item.display_name || item.name, "Deploy"]} />

      <div className="flex-1 overflow-auto">
        <div className="max-w-2xl mx-auto px-6 py-8">
          <Link
            to="/dashboard/services"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition mb-6"
          >
            <ArrowLeft className="size-3.5" /> Back to catalog
          </Link>

          {/* Service info card */}
          <div className="flex items-start gap-4 p-4 rounded-xl border border-border bg-card mb-8">
            <div
              className={`size-10 rounded-xl ${categoryConfig.bg} grid place-items-center shrink-0`}
            >
              <CategoryIcon className={`size-5 ${categoryConfig.color}`} />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-base font-bold">{item.display_name || item.name}</h1>
              <span
                className={`inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded mt-0.5 ${categoryConfig.bg} ${categoryConfig.color}`}
              >
                {category}
              </span>
              {item.description && (
                <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                  {item.description}
                </p>
              )}
              <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
                {item.is_public_image ? (
                  <span className="flex items-center gap-1">
                    <Globe className="size-3" /> Public image
                  </span>
                ) : (
                  <span className="flex items-center gap-1">
                    <Lock className="size-3" /> Private image
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Cpu className="size-3" /> {item.default_cpu}m default
                </span>
                <span className="flex items-center gap-1">
                  <MemoryStick className="size-3" /> {item.default_memory} MB default
                </span>
              </div>
            </div>
          </div>

          {/* Environment selector */}
          <div className="mb-8">
            <p className="text-sm font-semibold mb-3">Deploy to</p>
            {(environments ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No environments available.{" "}
                <Link to="/dashboard/environments" className="text-primary hover:underline">
                  Create one first.
                </Link>
              </p>
            ) : (
              <div className="flex gap-2 flex-wrap">
                {(environments ?? []).map((env) => (
                  <button
                    key={env.id}
                    type="button"
                    onClick={() => setSelectedEnvSlug(env.slug)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium border transition ${
                      selectedEnvSlug === env.slug
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-secondary text-muted-foreground hover:border-primary/40 hover:text-foreground"
                    }`}
                  >
                    {env.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Deploy form */}
          {selectedEnvSlug && (
            <>
              <div className="border-t border-border pt-6 mb-5">
                <p className="text-sm font-semibold">Configuration</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Deployment settings for the selected environment.
                </p>
              </div>
              <DeployForm
                key={selectedEnvSlug}
                item={item}
                workspaceSlug={workspaceSlug}
                envSlug={selectedEnvSlug}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
