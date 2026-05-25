import { createFileRoute } from "@tanstack/react-router";
import { DashboardTopbar } from "@/components/DashboardTopbar";
import { Shield, Clock, CheckCircle2, XCircle, Send, Loader2, ChevronDown } from "lucide-react";
import { useState } from "react";
import {
  useAccessRequestsMine,
  useCreateAccessRequest,
  useWorkspaceDirectory,
} from "@/lib/queries";
import type { AccessRequest } from "@/lib/types";

export const Route = createFileRoute("/dashboard/no-access")({
  head: () => ({ meta: [{ title: "Request Access · TernakClouds" }] }),
  component: NoAccessPage,
});

const ROLES = [
  { value: "developer", label: "Developer", description: "Deploy and manage workloads" },
  { value: "viewer", label: "Viewer", description: "Read-only access" },
];

function StatusBadge({ status }: { status: AccessRequest["status"] }) {
  if (status === "pending")
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs bg-yellow-500/10 text-yellow-500 border border-yellow-500/20">
        <Clock className="size-3" /> Pending
      </span>
    );
  if (status === "approved")
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs bg-green-500/10 text-green-500 border border-green-500/20">
        <CheckCircle2 className="size-3" /> Approved
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs bg-destructive/10 text-destructive border border-destructive/20">
      <XCircle className="size-3" /> Denied
    </span>
  );
}

function RequestForm({ onDone }: { onDone: () => void }) {
  const { data: workspaces, isLoading: isLoadingWs } = useWorkspaceDirectory();
  const createRequest = useCreateAccessRequest();

  const [workspaceId, setWorkspaceId] = useState("");
  const [role, setRole] = useState("developer");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await createRequest.mutateAsync({ workspace_id: workspaceId, requested_role: role, reason });
      onDone();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to submit request");
    }
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">Workspace</label>
        {isLoadingWs ? (
          <div className="flex items-center gap-2 text-muted-foreground text-xs py-2">
            <Loader2 className="size-3 animate-spin" /> Loading workspaces…
          </div>
        ) : (
          <div className="relative">
            <select
              value={workspaceId}
              onChange={(e) => setWorkspaceId(e.target.value)}
              required
              className="w-full appearance-none rounded-lg border border-border bg-secondary px-3 py-2 text-sm pr-8 focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">Select a workspace…</option>
              {workspaces?.map((ws) => (
                <option key={ws.id} value={ws.id}>
                  {ws.name}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">Requested Role</label>
        <div className="grid grid-cols-2 gap-2">
          {ROLES.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => setRole(r.value)}
              className={`rounded-lg border px-3 py-2 text-left transition ${
                role === r.value
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-secondary hover:bg-accent"
              }`}
            >
              <div className="text-sm font-medium">{r.label}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{r.description}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">
          Reason <span className="text-muted-foreground/60">(optional)</span>
        </label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          placeholder="e.g. Need deployment access for payments-api service"
          className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/50"
        />
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onDone}
          className="px-3 py-1.5 rounded-lg border border-border text-sm hover:bg-accent transition"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={createRequest.isPending || !workspaceId}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm hover:bg-primary/90 disabled:opacity-50 transition"
        >
          {createRequest.isPending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Send className="size-3.5" />
          )}
          Submit Request
        </button>
      </div>
    </form>
  );
}

function NoAccessPage() {
  const { data: requests, isLoading } = useAccessRequestsMine();
  const [showForm, setShowForm] = useState(false);

  const pending = requests?.filter((r) => r.status === "pending") ?? [];
  const hasPending = pending.length > 0;

  return (
    <>
      <DashboardTopbar
        title="Workspace Access"
        subtitle="You don't have access to any workspace yet."
      />
      <main className="p-6 max-w-2xl mx-auto space-y-6">
        {/* Hero card */}
        <div className="glass rounded-2xl border border-border p-8 text-center space-y-4">
          <div className="size-14 rounded-2xl bg-secondary grid place-items-center mx-auto">
            <Shield className="size-7 text-muted-foreground" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">No Workspace Access</h2>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              You're not a member of any workspace. Request access and a platform admin will review
              your request.
            </p>
          </div>
          {!showForm && (
            <div className="flex items-center justify-center gap-3 pt-1">
              <button
                onClick={() => setShowForm(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm hover:bg-primary/90 transition"
              >
                <Send className="size-4" /> Request Workspace Access
              </button>
              {hasPending && (
                <span className="text-xs text-muted-foreground">
                  {pending.length} pending request{pending.length > 1 ? "s" : ""}
                </span>
              )}
            </div>
          )}
          {showForm && (
            <div className="text-left border-t border-border pt-5 mt-5">
              <h3 className="text-sm font-medium mb-4">New Access Request</h3>
              <RequestForm onDone={() => setShowForm(false)} />
            </div>
          )}
        </div>

        {/* Request history */}
        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm justify-center py-4">
            <Loader2 className="size-4 animate-spin" /> Loading requests…
          </div>
        ) : (requests?.length ?? 0) > 0 ? (
          <div className="glass rounded-xl border border-border overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <h3 className="text-sm font-medium">Your Requests</h3>
            </div>
            <div className="divide-y divide-border">
              {requests!.map((req) => (
                <div key={req.id} className="px-4 py-3 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{req.workspace_name}</div>
                    <div className="text-xs text-muted-foreground capitalize">
                      {req.requested_role}
                      {req.reason && ` · ${req.reason}`}
                    </div>
                  </div>
                  <StatusBadge status={req.status} />
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </main>
    </>
  );
}
