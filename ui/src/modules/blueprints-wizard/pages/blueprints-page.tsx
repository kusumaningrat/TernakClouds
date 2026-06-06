import { useState, useMemo } from "react";
import { useParams } from "@tanstack/react-router";
import { Loader2, AlertCircle } from "lucide-react";
import { DashboardTopbar } from "@/components/DashboardTopbar";
import { useWorkspaceContext } from "@/lib/workspace-context";
import { useBlueprints, useCapabilities } from "@/lib/queries";
import type { Blueprint } from "@/lib/types";
import type { ApiError } from "@/lib/api";
import { hasDraft } from "../utils/spec";
import { BlueprintCard } from "../components/blueprint-card";
import { ProvisionWizard } from "../components/provision-wizard";
import { ProvisionedApplications } from "../components/provisioned-applications";

export function BlueprintsPage() {
  const { envId } = useParams({ from: "/dashboard/environments/$envId/blueprints" });
  const { selectedWorkspace } = useWorkspaceContext();
  const workspaceSlug = selectedWorkspace?.slug ?? "";

  const { data: blueprints, isLoading, error } = useBlueprints();
  const [provisioning, setProvisioning] = useState<Blueprint | null>(null);
  const [draftVersion, setDraftVersion] = useState(0);

  const blueprintDrafts = useMemo(() => {
    const map = new Map<string, boolean>();
    (blueprints ?? []).forEach((bp) => {
      map.set(bp.name, hasDraft(envId, bp.name));
    });
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blueprints, draftVersion, envId]);

  const { data: capabilities } = useCapabilities(workspaceSlug, envId);
  const hasNomad = (capabilities ?? []).some(
    (c) => c.capability_name === "runtime" && c.providers.some((p) => p.provider_name === "nomad"),
  );
  const hasK8s = (capabilities ?? []).some(
    (c) =>
      c.capability_name === "runtime" && c.providers.some((p) => p.provider_name === "kubernetes"),
  );
  const hasDocker = (capabilities ?? []).some(
    (c) => c.capability_name === "runtime" && c.providers.some((p) => p.provider_name === "docker"),
  );

  const appBluprints = (blueprints ?? []).filter((b) => b.category === "application");
  const infraBlueprints = (blueprints ?? []).filter((b) => b.category === "infrastructure");

  return (
    <div className="flex flex-col h-full">
      <DashboardTopbar
        title="Blueprints"
        subtitle="Choose a blueprint to provision a standardized application"
      />

      <div className="flex-1 overflow-auto p-6 space-y-8">
        {!hasNomad && !hasK8s && !hasDocker && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 flex items-start gap-3">
            <AlertCircle className="size-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <div className="text-sm font-medium text-amber-700">
                No runtime provider configured
              </div>
              <div className="text-xs text-amber-600 mt-0.5">
                Bind a runtime provider in <strong>Platform → Runtime</strong> before provisioning.
              </div>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading blueprints…
          </div>
        ) : error ? (
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="size-4" /> {(error as ApiError).message}
          </div>
        ) : (
          <>
            <section>
              <h2 className="text-base font-semibold mb-1">Application blueprints</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Reusable automation templates for application provisioning and deployment.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {appBluprints.map((bp) => (
                  <BlueprintCard
                    key={bp.id}
                    bp={bp}
                    onProvision={setProvisioning}
                    hasDraft={blueprintDrafts.get(bp.name)}
                  />
                ))}
              </div>
            </section>

            {infraBlueprints.length > 0 && (
              <section>
                <h2 className="text-base font-semibold mb-1">Infrastructure blueprints</h2>
                <p className="text-sm text-muted-foreground mb-4">
                  Managed infrastructure components provisioned via the platform.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {infraBlueprints.map((bp) => (
                    <BlueprintCard
                      key={bp.id}
                      bp={bp}
                      onProvision={setProvisioning}
                      hasDraft={blueprintDrafts.get(bp.name)}
                    />
                  ))}
                </div>
              </section>
            )}

            <ProvisionedApplications workspaceSlug={workspaceSlug} envSlug={envId} />
          </>
        )}
      </div>

      <ProvisionWizard
        open={!!provisioning}
        blueprint={provisioning}
        onClose={() => {
          setProvisioning(null);
          setDraftVersion((v) => v + 1);
        }}
        workspaceSlug={workspaceSlug}
        envSlug={envId}
      />
    </div>
  );
}
