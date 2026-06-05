import { createFileRoute, Link } from "@tanstack/react-router";
import { DashboardTopbar } from "@/components/DashboardTopbar";
import { useWorkspaceContext } from "@/lib/workspace-context";
import {
  useMe,
  useAccessRequestsPending,
  useAccessRequestsMine,
  useApproveAccessRequest,
  useDenyAccessRequest,
  useWorkspaceMembers,
  useEnvironments,
} from "@/lib/queries";
import type { WorkspaceEnvironment } from "@/lib/types";
import {
  KeyRound,
  InboxIcon,
  Users,
  Clock,
  CheckCircle2,
  Loader2,
  Crown,
  ChevronRight,
} from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/dashboard/access")({
  head: () => ({ meta: [{ title: "Access · TernakClouds" }] }),
  component: AccessPage,
});

function isAdminOrManager(roles: { role?: { name?: string } }[] | undefined): boolean {
  return (
    roles?.some((ur) => {
      const n = (ur.role?.name ?? "").toLowerCase();
      return n === "admin" || n === "manager";
    }) ?? false
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

type Tab = "secrets" | "requests" | "members";

function AccessPage() {
  const { selectedWorkspace } = useWorkspaceContext();
  const slug = selectedWorkspace?.slug ?? "";
  const { data: me } = useMe();
  const privileged = isAdminOrManager(me?.roles);

  const [tab, setTab] = useState<Tab>(privileged ? "requests" : "secrets");

  const { data: pendingRequests, isLoading: pendingLoading } = useAccessRequestsPending();
  const { data: environments } = useEnvironments(slug);
  const { data: members, isLoading: membersLoading } = useWorkspaceMembers(slug);

  const pendingCount = privileged ? (pendingRequests?.length ?? 0) : 0;

  const TABS = [
    {
      id: "secrets" as Tab,
      label: "Secrets",
      icon: KeyRound,
      badge: undefined as number | undefined,
    },
    {
      id: "requests" as Tab,
      label: privileged ? "Requests" : "My requests",
      icon: privileged ? InboxIcon : Clock,
      badge: privileged && pendingCount > 0 ? pendingCount : undefined,
    },
    { id: "members" as Tab, label: "Members", icon: Users, badge: undefined as number | undefined },
  ];

  return (
    <>
      <DashboardTopbar title="Access" subtitle="Secrets, access requests, and team membership." />
      <main className="p-6 space-y-4 overflow-auto">
        {/* Tab bar */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-secondary w-fit">
          {TABS.map(({ id, label, icon: Icon, badge }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                tab === id
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="size-3.5" />
              {label}
              {badge !== undefined && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground min-w-[18px] text-center">
                  {badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {tab === "secrets" && <SecretsTab environments={environments ?? []} />}
        {tab === "requests" && privileged && (
          <PendingRequestsTab requests={pendingRequests ?? []} loading={pendingLoading} />
        )}
        {tab === "requests" && !privileged && <MyRequestsTab />}
        {tab === "members" && <MembersTab members={members ?? []} loading={membersLoading} />}
      </main>
    </>
  );
}

// ─── Secrets tab ──────────────────────────────────────────────────────────────

function SecretsTab({ environments }: { environments: WorkspaceEnvironment[] }) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Secret access grants are scoped per environment.
      </p>
      {environments.length === 0 ? (
        <div className="glass rounded-xl p-6 text-center">
          <p className="text-sm text-muted-foreground">No environments configured.</p>
        </div>
      ) : (
        environments.map((env) => (
          <Link
            key={env.id}
            to="/dashboard/environments/$envId/secrets"
            params={{ envId: env.slug }}
            className="glass rounded-xl p-4 flex items-center gap-3 hover:bg-accent/50 transition group"
          >
            <div className="size-8 rounded-lg bg-secondary grid place-items-center shrink-0">
              <KeyRound className="size-4 text-muted-foreground group-hover:text-primary transition" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm">{env.name}</div>
              <div className="text-xs text-muted-foreground font-mono">{env.slug}</div>
            </div>
            <ChevronRight className="size-4 text-muted-foreground" />
          </Link>
        ))
      )}
    </div>
  );
}

// ─── Pending requests tab ─────────────────────────────────────────────────────

type AccessRequest = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  reason?: string;
  requested_role: string;
  created_at: string;
};

function PendingRequestsTab({
  requests,
  loading,
}: {
  requests: AccessRequest[];
  loading: boolean;
}) {
  const approve = useApproveAccessRequest();
  const deny = useDenyAccessRequest();
  const [processing, setProcessing] = useState<string | null>(null);

  const handle = async (id: string, action: "approve" | "deny") => {
    setProcessing(id);
    try {
      if (action === "approve") await approve.mutateAsync({ id });
      else await deny.mutateAsync(id);
    } finally {
      setProcessing(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-4">
        <Loader2 className="size-4 animate-spin" /> Loading…
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <div className="glass rounded-xl p-8 text-center">
        <CheckCircle2 className="size-8 text-emerald-500 mx-auto mb-3" />
        <p className="text-sm font-medium">No pending requests</p>
        <p className="text-xs text-muted-foreground mt-1">
          All access requests have been reviewed.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {requests.map((req) => (
        <div key={req.id} className="glass rounded-xl p-4 flex items-start gap-3">
          <div className="size-8 rounded-full bg-secondary grid place-items-center shrink-0 text-xs font-semibold text-muted-foreground mt-0.5">
            {req.first_name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm">
              {req.first_name} {req.last_name}
            </div>
            <div className="text-xs text-muted-foreground">{req.email}</div>
            {req.reason && (
              <div className="text-xs text-muted-foreground mt-0.5 italic">"{req.reason}"</div>
            )}
            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-[10px] font-medium text-amber-600 bg-amber-500/10 px-1.5 py-0.5 rounded-full">
                {req.requested_role}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {formatDate(req.created_at)}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => void handle(req.id, "deny")}
              disabled={processing === req.id}
              className="text-xs px-2.5 py-1 rounded-lg border border-border hover:bg-accent transition disabled:opacity-50"
            >
              {processing === req.id ? <Loader2 className="size-3 animate-spin" /> : "Deny"}
            </button>
            <button
              onClick={() => void handle(req.id, "approve")}
              disabled={processing === req.id}
              className="text-xs px-2.5 py-1 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition disabled:opacity-50"
            >
              Approve
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── My requests tab (non-admin) ──────────────────────────────────────────────

function MyRequestsTab() {
  const { data: myRequests, isLoading } = useAccessRequestsMine();

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-4">
        <Loader2 className="size-4 animate-spin" /> Loading…
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Link
        to="/dashboard/no-access"
        className="flex items-center gap-3 px-4 py-3 rounded-xl border border-dashed border-border hover:bg-accent transition"
      >
        <Clock className="size-4 text-muted-foreground" />
        <span className="text-sm">Request elevated access →</span>
      </Link>
      {(myRequests ?? []).length === 0 ? (
        <div className="glass rounded-xl p-6 text-center">
          <p className="text-sm text-muted-foreground">No access requests submitted yet.</p>
        </div>
      ) : (
        (myRequests ?? []).map((req) => (
          <div key={req.id} className="glass rounded-xl px-4 py-3 flex items-center gap-3">
            <div
              className={`size-2 rounded-full shrink-0 ${
                req.status === "approved"
                  ? "bg-emerald-500"
                  : req.status === "denied"
                    ? "bg-red-500"
                    : "bg-amber-500"
              }`}
            />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium">{req.requested_role}</div>
              {req.reason && (
                <div className="text-xs text-muted-foreground truncate italic">"{req.reason}"</div>
              )}
            </div>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${
                req.status === "approved"
                  ? "text-emerald-600 bg-emerald-500/10"
                  : req.status === "denied"
                    ? "text-red-600 bg-red-500/10"
                    : "text-amber-600 bg-amber-500/10"
              }`}
            >
              {req.status}
            </span>
          </div>
        ))
      )}
    </div>
  );
}

// ─── Members tab ──────────────────────────────────────────────────────────────

type Member = {
  user_id: string;
  first_name: string;
  last_name: string;
  email?: string;
  role: string;
  joined_at: string;
};

function MembersTab({ members, loading }: { members: Member[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-4">
        <Loader2 className="size-4 animate-spin" /> Loading…
      </div>
    );
  }

  if (members.length === 0) {
    return (
      <div className="glass rounded-xl p-6 text-center">
        <p className="text-sm text-muted-foreground">No members found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {members.map((m) => (
        <div key={m.user_id} className="glass rounded-xl px-4 py-3 flex items-center gap-3">
          <div className="size-8 rounded-full bg-secondary grid place-items-center text-xs font-semibold text-muted-foreground shrink-0">
            {m.first_name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">
              {m.first_name} {m.last_name}
            </div>
            <div className="text-xs text-muted-foreground">since {formatDate(m.joined_at)}</div>
          </div>
          {m.role === "owner" ? (
            <span className="flex items-center gap-1 text-[10px] font-medium text-amber-600 bg-amber-500/10 px-1.5 py-0.5 rounded-full shrink-0">
              <Crown className="size-2.5" /> owner
            </span>
          ) : (
            <span className="text-[10px] text-muted-foreground bg-secondary px-1.5 py-0.5 rounded-full shrink-0">
              member
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
