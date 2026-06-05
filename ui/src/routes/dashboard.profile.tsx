import { createFileRoute } from "@tanstack/react-router";
import { DashboardTopbar } from "@/components/DashboardTopbar";
import {
  ShieldCheck,
  Shield,
  CheckCircle2,
  XCircle,
  Loader2,
  UserCircle,
  Copy,
  Check,
} from "lucide-react";
import { QueryError } from "@/components/QueryError";
import { useState } from "react";
import { toast } from "sonner";
import { useMe, useRoles } from "@/lib/queries";
import type { Permission } from "@/lib/types";

export const Route = createFileRoute("/dashboard/profile")({
  head: () => ({ meta: [{ title: "Profile · TernakClouds" }] }),
  component: ProfilePage,
});

// ─── Copyable ID badge ────────────────────────────────────────────────────────

function CopyableId({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    void navigator.clipboard.writeText(id).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <button
      onClick={handleCopy}
      title="Click to copy full ID"
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-secondary font-mono text-xs hover:bg-accent transition group"
    >
      <Shield className="size-3.5 text-muted-foreground" />
      <span className="text-muted-foreground">id:</span>
      <span className="truncate max-w-36">{id}</span>
      {copied ? (
        <Check className="size-3.5 text-success shrink-0" />
      ) : (
        <Copy className="size-3.5 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 transition" />
      )}
    </button>
  );
}

// ─── Permission chip ──────────────────────────────────────────────────────────

function PermChip({ name }: { name: string }) {
  const [resource, action] = name.split(":");
  const colors: Record<string, string> = {
    deployments: "bg-primary/10 text-primary border-primary/20",
    users: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    departments: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  };
  const cls = colors[resource] ?? "bg-secondary text-muted-foreground border-border";
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono border ${cls}`}
    >
      {resource}:{action}
    </span>
  );
}

// ─── Permission checker ───────────────────────────────────────────────────────

function PermissionChecker({ userId }: { userId: string }) {
  const [permInput, setPermInput] = useState("");
  const [permResult, setPermResult] = useState<{ checked: string; has: boolean } | null>(null);
  const [permChecking, setPermChecking] = useState(false);

  const checkPermission = async () => {
    if (!permInput.trim()) return;
    setPermChecking(true);
    try {
      const res = await fetch(
        `/api/v1/users/${userId}/permissions/${encodeURIComponent(permInput.trim())}`,
        { headers: { Authorization: `Bearer ${getToken()}` } },
      );
      const json = (await res.json()) as { data: { has_permission: boolean } };
      setPermResult({ checked: permInput.trim(), has: json.data.has_permission });
    } catch {
      toast.error("Permission check failed");
    } finally {
      setPermChecking(false);
    }
  };

  return (
    <div className="glass rounded-xl p-5">
      <h3 className="text-sm font-semibold flex items-center gap-2 mb-1">
        <Shield className="size-4 text-primary" /> Permission check
      </h3>
      <p className="text-xs text-muted-foreground mb-4">
        Verify whether your current roles grant a specific permission.
      </p>
      <div className="flex gap-2 flex-wrap">
        <input
          value={permInput}
          onChange={(e) => {
            setPermInput(e.target.value);
            setPermResult(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") void checkPermission();
          }}
          placeholder="e.g. deployments:exec"
          className="flex-1 min-w-48 px-3 py-2 rounded-md bg-secondary border border-border focus:border-primary outline-none text-sm font-mono"
        />
        <button
          onClick={() => {
            void checkPermission();
          }}
          disabled={permChecking || !permInput.trim()}
          className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition disabled:opacity-60 inline-flex items-center gap-2"
        >
          {permChecking && <Loader2 className="size-3.5 animate-spin" />}
          Check
        </button>
      </div>
      {permResult && (
        <div
          className={`mt-3 flex items-center gap-2 px-3 py-2.5 rounded-md text-sm ${
            permResult.has
              ? "bg-success/10 border border-success/30 text-success"
              : "bg-destructive/10 border border-destructive/30 text-destructive"
          }`}
        >
          {permResult.has ? (
            <CheckCircle2 className="size-4 shrink-0" />
          ) : (
            <XCircle className="size-4 shrink-0" />
          )}
          <span className="font-mono font-medium">{permResult.checked}</span>
          <span>{permResult.has ? "— permission granted" : "— permission denied"}</span>
        </div>
      )}
    </div>
  );
}

function getToken(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("Clouds_access_token") ?? "";
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function ProfilePage() {
  const { data: me, isLoading, error } = useMe();
  const { data: allRoles } = useRoles();

  if (isLoading) {
    return (
      <>
        <DashboardTopbar title="Profile" subtitle="Your identity and assigned permissions." />
        <main className="p-6 flex items-center justify-center py-24 text-muted-foreground gap-2">
          <Loader2 className="size-5 animate-spin" />
          <span className="text-sm">Loading profile…</span>
        </main>
      </>
    );
  }

  if (error) {
    return (
      <>
        <DashboardTopbar title="Profile" subtitle="Your identity and assigned permissions." />
        <main className="p-6">
          <QueryError error={error} />
        </main>
      </>
    );
  }

  const initials = me ? `${me.first_name.charAt(0)}${me.last_name.charAt(0)}`.toUpperCase() : "U";
  const roleById = new Map((allRoles ?? []).map((r) => [r.id, r]));

  return (
    <>
      <DashboardTopbar title="Profile" subtitle="Your identity and assigned permissions." />
      <main className="p-6 space-y-6">
        {/* Profile card */}
        <div className="glass rounded-xl p-6 flex flex-col sm:flex-row gap-5 items-start">
          <div className="size-16 rounded-full bg-accent grid place-items-center text-2xl font-bold shrink-0">
            {me ? initials : <UserCircle className="size-8" />}
          </div>
          <div className="flex-1 space-y-3">
            <div>
              <h2 className="text-xl font-semibold">
                {me?.first_name} {me?.last_name}
              </h2>
              <p className="text-sm text-muted-foreground font-mono">{me?.email}</p>
            </div>
            <div className="flex flex-wrap gap-3 text-xs">
              <span className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-secondary">
                {me?.is_active ? (
                  <CheckCircle2 className="size-3.5 text-success" />
                ) : (
                  <XCircle className="size-3.5 text-destructive" />
                )}
                {me?.is_active ? "Active" : "Inactive"}
              </span>
              <span className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-secondary font-mono">
                <Shield className="size-3.5 text-muted-foreground" />
                dept:{me?.department_id.slice(0, 8)}…
              </span>
              {me && <CopyableId id={me.id} />}
            </div>
          </div>
          <div className="text-right text-xs text-muted-foreground shrink-0">
            <div className="font-semibold text-foreground text-2xl font-mono">
              {me?.roles?.length ?? 0}
            </div>
            <div>role{me?.roles?.length !== 1 ? "s" : ""} assigned</div>
          </div>
        </div>

        {/* Assigned roles (read-only) */}
        <div>
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <ShieldCheck className="size-4 text-primary" />
            Assigned roles &amp; permissions
          </h3>
          {!me?.roles?.length ? (
            <p className="text-sm text-muted-foreground italic py-4 text-center">
              No roles assigned yet.
            </p>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              {me.roles.map((ur) => {
                const fullRole = roleById.get(ur.role_id);
                const perms = (fullRole?.role_permissions
                  ?.map((rp) => rp.permission)
                  .filter(Boolean) ?? []) as Permission[];

                return (
                  <div
                    key={ur.role_id}
                    className="glass rounded-xl p-4 border border-primary/30 bg-primary/5"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className="size-9 rounded-lg grid place-items-center bg-primary/20">
                        <ShieldCheck className="size-4 text-primary" />
                      </div>
                      <div>
                        <div className="font-medium text-sm capitalize">
                          {ur.role?.name ?? fullRole?.name ?? ur.role_id.slice(0, 8)}
                        </div>
                        {(ur.role?.description ?? fullRole?.description) && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {ur.role?.description ?? fullRole?.description}
                          </p>
                        )}
                      </div>
                    </div>
                    {perms.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {perms.map((p) => (
                          <PermChip key={p.id} name={p.name} />
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">
                        No permissions on this role
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {me && <PermissionChecker userId={me.id} />}
      </main>
    </>
  );
}
