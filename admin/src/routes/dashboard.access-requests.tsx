import { createFileRoute } from "@tanstack/react-router";
import { DashboardTopbar } from "@/components/DashboardTopbar";
import { QueryError } from "@/components/QueryError";
import {
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  User,
  Building2,
  AlertCircle,
  Inbox,
  ChevronDown,
} from "lucide-react";
import { useState } from "react";
import {
  useAccessRequestsPending,
  useApproveAccessRequest,
  useDenyAccessRequest,
} from "@/lib/queries";
import type { AccessRequest } from "@/lib/types";

export const Route = createFileRoute("/dashboard/access-requests")({
  head: () => ({ meta: [{ title: "Access Requests · TernakClouds" }] }),
  component: AccessRequestsPage,
});

const ROLE_OPTIONS = [
  { value: "", label: "Keep requested role" },
  { value: "developer", label: "Developer" },
  { value: "viewer", label: "Viewer" },
];

function RequestCard({ req }: { req: AccessRequest }) {
  const approve = useApproveAccessRequest();
  const deny = useDenyAccessRequest();
  const [roleOverride, setRoleOverride] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleApprove() {
    setError(null);
    try {
      await approve.mutateAsync({
        id: req.id,
        input: roleOverride ? { role: roleOverride } : undefined,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to approve");
    }
  }

  async function handleDeny() {
    setError(null);
    try {
      await deny.mutateAsync(req.id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to deny");
    }
  }

  const isBusy = approve.isPending || deny.isPending;

  return (
    <div className="glass rounded-xl border border-border p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="size-9 rounded-lg bg-secondary grid place-items-center shrink-0">
            <User className="size-4 text-muted-foreground" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium">
              {req.first_name} {req.last_name}
            </div>
            <div className="text-xs text-muted-foreground truncate">{req.email}</div>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 shrink-0">
          <Clock className="size-3" /> Pending
        </span>
      </div>

      {/* Details */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Building2 className="size-3.5 shrink-0" />
          <span className="truncate">{req.workspace_name}</span>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <span className="capitalize font-medium text-foreground">{req.requested_role}</span>
          <span>requested</span>
        </div>
      </div>

      {req.reason && (
        <p className="text-xs text-muted-foreground bg-secondary rounded-lg px-3 py-2 border border-border">
          "{req.reason}"
        </p>
      )}

      {/* Role override + actions */}
      <div className="flex items-center gap-2 pt-1">
        <div className="relative flex-1">
          <select
            value={roleOverride}
            onChange={(e) => setRoleOverride(e.target.value)}
            disabled={isBusy}
            className="w-full appearance-none rounded-lg border border-border bg-secondary px-3 py-1.5 text-xs pr-7 focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
          >
            {ROLE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 size-3 text-muted-foreground" />
        </div>
        <button
          onClick={() => void handleApprove()}
          disabled={isBusy}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs hover:bg-green-700 disabled:opacity-50 transition"
        >
          {approve.isPending ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <CheckCircle2 className="size-3" />
          )}
          Approve
        </button>
        <button
          onClick={() => void handleDeny()}
          disabled={isBusy}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-destructive/40 text-destructive text-xs hover:bg-destructive/10 disabled:opacity-50 transition"
        >
          {deny.isPending ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <XCircle className="size-3" />
          )}
          Deny
        </button>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function AccessRequestsPage() {
  const { data: requests, isLoading, isError, error } = useAccessRequestsPending();

  return (
    <>
      <DashboardTopbar
        title="Access Requests"
        subtitle="Review pending workspace access requests from users."
      />
      <main className="p-6 max-w-3xl mx-auto space-y-4">
        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm justify-center py-12">
            <Loader2 className="size-4 animate-spin" /> Loading requests…
          </div>
        ) : isError ? (
          <QueryError error={error} />
        ) : (requests?.length ?? 0) === 0 ? (
          <div className="glass rounded-xl border border-dashed border-border p-12 text-center space-y-3">
            <Inbox className="size-8 text-muted-foreground mx-auto" />
            <p className="text-sm text-muted-foreground">No pending access requests.</p>
          </div>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              {requests!.length} pending request{requests!.length !== 1 ? "s" : ""}
            </p>
            <div className="space-y-3">
              {requests!.map((req) => (
                <RequestCard key={req.id} req={req} />
              ))}
            </div>
          </>
        )}
      </main>
    </>
  );
}
