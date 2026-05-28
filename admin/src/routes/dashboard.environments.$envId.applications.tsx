import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { DashboardTopbar } from "@/components/DashboardTopbar";
import { useWorkspaceContext } from "@/lib/workspace-context";
import { usePlatformApps, useDeletePlatformApp } from "@/lib/queries";
import { useState } from "react";
import {
  Layers,
  Loader2,
  AlertCircle,
  Trash2,
  FileCode,
  Rocket,
  Globe,
  Cpu,
  Clock,
  Network,
  LayoutDashboard,
  Zap,
  X,
  CheckCircle,
  Timer,
  OctagonX,
} from "lucide-react";
import { toast } from "sonner";
import type { PlatformApp } from "@/lib/types";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

export const Route = createFileRoute("/dashboard/environments/$envId/applications")({
  head: () => ({ meta: [{ title: "Applications · TernakClouds" }] }),
  component: ApplicationsPage,
});

// ─── Status badge ──────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, { bg: string; text: string; icon: React.ElementType }> = {
  provisioned: { bg: "bg-emerald-500/15", text: "text-emerald-600", icon: CheckCircle },
  pending: { bg: "bg-amber-500/15", text: "text-amber-600", icon: Timer },
  failed: { bg: "bg-destructive/15", text: "text-destructive", icon: OctagonX },
  stopped: { bg: "bg-muted", text: "text-muted-foreground", icon: X },
};

function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.stopped;
  const Icon = style.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${style.bg} ${style.text}`}
    >
      <Icon className="size-2.5" />
      {status}
    </span>
  );
}

// ─── Blueprint icon lookup ─────────────────────────────────────────────────────

const BLUEPRINT_ICONS: Record<string, React.ElementType> = {
  "web-api": Globe,
  worker: Cpu,
  "cron-job": Clock,
  "internal-service": Network,
  "static-website": LayoutDashboard,
  "background-processor": Zap,
};

// ─── Manifest viewer ──────────────────────────────────────────────────────────

function ManifestDialog({ app, onClose }: { app: PlatformApp; onClose: () => void }) {
  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileCode className="size-4" />
            {app.name} — {app.runtime_provider} manifest
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-auto mt-2 rounded-md bg-secondary border border-border">
          <pre className="p-4 text-xs font-mono whitespace-pre leading-relaxed">
            {app.generated_manifest ?? "(no manifest stored)"}
          </pre>
        </div>
        <DialogFooter className="mt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md bg-secondary hover:bg-accent text-sm transition"
          >
            Close
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── App row ──────────────────────────────────────────────────────────────────

function AppRow({
  app,
  onDelete,
  onViewManifest,
  deleting,
}: {
  app: PlatformApp;
  onDelete: (app: PlatformApp) => void;
  onViewManifest: (app: PlatformApp) => void;
  deleting: boolean;
}) {
  const Icon = BLUEPRINT_ICONS[app.blueprint_name] ?? Layers;

  return (
    <tr className="border-b border-border last:border-0 hover:bg-muted/40 transition">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="size-7 rounded-md bg-secondary grid place-items-center shrink-0">
            <Icon className="size-3.5 text-muted-foreground" />
          </div>
          <div>
            <div className="font-medium text-sm">{app.name}</div>
            <div className="text-[11px] text-muted-foreground">{app.blueprint_name}</div>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <StatusBadge status={app.status} />
      </td>
      <td className="px-4 py-3">
        <span className="text-xs px-2 py-0.5 rounded bg-secondary text-muted-foreground font-mono">
          {app.runtime_provider}
        </span>
      </td>
      <td className="px-4 py-3 text-xs text-muted-foreground font-mono">
        {app.runtime_job_id || "—"}
      </td>
      <td className="px-4 py-3 text-xs text-muted-foreground">
        {new Date(app.created_at).toLocaleDateString()}
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex items-center gap-1.5 justify-end">
          {app.generated_manifest && (
            <button
              onClick={() => onViewManifest(app)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-secondary hover:bg-accent text-xs text-muted-foreground transition"
              title="View manifest"
            >
              <FileCode className="size-3.5" /> Manifest
            </button>
          )}
          <button
            onClick={() => onDelete(app)}
            disabled={deleting}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-secondary hover:bg-destructive/20 text-xs text-destructive transition disabled:opacity-50"
          >
            <Trash2 className="size-3.5" /> Remove
          </button>
        </div>
      </td>
    </tr>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

function ApplicationsPage() {
  const { envId } = useParams({ from: "/dashboard/environments/$envId/applications" });
  const { selectedWorkspace } = useWorkspaceContext();
  const workspaceSlug = selectedWorkspace?.slug ?? "";
  const navigate = useNavigate();

  const { data: apps, isLoading, error } = usePlatformApps(workspaceSlug, envId);
  const deleteApp = useDeletePlatformApp(workspaceSlug, envId);

  const [deleting, setDeleting] = useState<PlatformApp | null>(null);
  const [viewingManifest, setViewingManifest] = useState<PlatformApp | null>(null);

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      await deleteApp.mutateAsync(deleting.id);
      toast.success(`${deleting.name} removed`);
      setDeleting(null);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to remove application");
    }
  };

  return (
    <div className="flex flex-col h-full">
      <DashboardTopbar
        title="Applications"
        subtitle="Platform applications provisioned from blueprints"
        actions={
          <button
            onClick={() =>
              void navigate({ to: `/dashboard/environments/${envId}/blueprints` as never })
            }
            className="flex items-center gap-2 px-3 py-2 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition"
          >
            <Rocket className="size-3.5" /> New from blueprint
          </button>
        }
      />

      <div className="flex-1 overflow-auto p-6">
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading applications…
          </div>
        ) : error ? (
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="size-4" /> {error.message}
          </div>
        ) : !apps || apps.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-12 flex flex-col items-center text-center max-w-lg mx-auto">
            <div className="size-14 rounded-xl bg-secondary grid place-items-center mb-4">
              <Layers className="size-7 text-muted-foreground" />
            </div>
            <div className="font-semibold text-sm mb-1">No applications yet</div>
            <p className="text-xs text-muted-foreground mb-5 leading-relaxed">
              Provision your first application from a blueprint. The platform generates the runtime manifest and deploys it automatically.
            </p>
            <button
              onClick={() =>
                void navigate({ to: `/dashboard/environments/${envId}/blueprints` as never })
              }
              className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition"
            >
              <Rocket className="size-3.5" /> Browse blueprints
            </button>
          </div>
        ) : (
          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Application</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Runtime</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Job ID</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Provisioned</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {apps.map((app) => (
                  <AppRow
                    key={app.id}
                    app={app}
                    onDelete={setDeleting}
                    onViewManifest={setViewingManifest}
                    deleting={deleteApp.isPending && deleting?.id === app.id}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {viewingManifest && (
        <ManifestDialog app={viewingManifest} onClose={() => setViewingManifest(null)} />
      )}

      <AlertDialog
        open={!!deleting}
        onOpenChange={(v) => { if (!v) setDeleting(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove application?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{deleting?.name}</strong> will be stopped in <strong>{deleting?.runtime_provider}</strong> and removed from this environment. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { void handleDelete(); }}
              disabled={deleteApp.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteApp.isPending && <Loader2 className="size-3.5 animate-spin mr-1.5" />}
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
