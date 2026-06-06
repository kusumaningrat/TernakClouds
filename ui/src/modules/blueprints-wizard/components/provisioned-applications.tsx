import { useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { usePlatformApps, useDeletePlatformApp } from "@/lib/queries";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ProvisionedAppCard } from "./provisioned-app-card";
import { PageBar } from "./page-bar";

const APPS_LIMIT = 5;

export function ProvisionedApplications({
  workspaceSlug,
  envSlug,
}: {
  workspaceSlug: string;
  envSlug: string;
}) {
  const [appsPage, setAppsPage] = useState(1);
  const { data: appsData, isLoading } = usePlatformApps(
    workspaceSlug,
    envSlug,
    appsPage,
    APPS_LIMIT,
  );
  const deleteMutation = useDeletePlatformApp(workspaceSlug, envSlug);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);

  const apps = appsData?.items ?? [];
  const totalAppPages = appsData ? Math.max(1, Math.ceil(appsData.total / APPS_LIMIT)) : 1;

  const handleDelete = async (id: string) => {
    try {
      await deleteMutation.mutateAsync(id);
      toast.success("Application deleted");
      setConfirmDelete(null);
      if (apps.length === 1 && appsPage > 1) setAppsPage((p) => p - 1);
    } catch {
      toast.error("Failed to delete application");
    }
  };

  if (!appsData && isLoading)
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
        <Loader2 className="size-4 animate-spin" /> Loading applications…
      </div>
    );

  if (!appsData || appsData.total === 0) return null;

  return (
    <section>
      <div className="flex items-center gap-2 mb-1">
        <h2 className="text-base font-semibold">Provisioned Applications</h2>
        <span className="text-xs px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground tabular-nums">
          {appsData.total}
        </span>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Running application instances provisioned from blueprints. Expand each entry to view its
        full deployment history and CI/CD pipeline traceability.
      </p>

      <div className="space-y-3 mb-3">
        {apps.map((app) => (
          <ProvisionedAppCard
            key={app.id}
            app={app}
            workspaceSlug={workspaceSlug}
            envSlug={envSlug}
            onDelete={(id, name) => setConfirmDelete({ id, name })}
          />
        ))}
      </div>

      <PageBar
        page={appsPage}
        totalPages={totalAppPages}
        total={appsData.total}
        limit={APPS_LIMIT}
        isLoading={isLoading}
        onPageChange={setAppsPage}
      />

      {confirmDelete && (
        <Dialog
          open
          onOpenChange={(v) => {
            if (!v) setConfirmDelete(null);
          }}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Delete {confirmDelete.name}?</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              This will stop and remove the application. This action cannot be undone.
            </p>
            <DialogFooter className="pt-2">
              <button
                onClick={() => setConfirmDelete(null)}
                className="px-4 py-2 rounded-md bg-secondary hover:bg-accent text-sm transition"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleDelete(confirmDelete.id)}
                disabled={deleteMutation.isPending}
                className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-destructive text-destructive-foreground text-sm font-medium hover:opacity-90 transition disabled:opacity-60"
              >
                {deleteMutation.isPending ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Trash2 className="size-3.5" />
                )}
                Delete
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </section>
  );
}
