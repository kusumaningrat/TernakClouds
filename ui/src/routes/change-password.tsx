import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { Shield, KeyRound, Eye, EyeOff, Loader2, AlertCircle } from "lucide-react";
import { useState } from "react";
import { isAuthenticated } from "@/lib/auth";
import { useChangePassword } from "@/lib/queries";
import { toast } from "sonner";
import { extractError } from "@/lib/toast-helpers";

export const Route = createFileRoute("/change-password")({
  beforeLoad: () => {
    if (typeof window !== "undefined" && !isAuthenticated()) {
      throw redirect({ to: "/login" });
    }
  },
  head: () => ({ meta: [{ title: "Change password · TernakClouds" }] }),
  component: ChangePasswordPage,
});

function ChangePasswordPage() {
  const navigate = useNavigate();
  const changePassword = useChangePassword();

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNext, setShowNext] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (next !== confirm) {
      setError("New passwords don't match.");
      return;
    }
    if (next.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    setError("");
    try {
      await changePassword.mutateAsync({ current_password: current, new_password: next });
      toast.success("Password updated. Welcome!");
      void navigate({ to: "/dashboard" });
    } catch (err: unknown) {
      setError(extractError(err, "Failed to update password."));
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center gap-2.5 font-semibold mb-10">
          <div className="size-9 rounded-md bg-[image:var(--gradient-primary)] grid place-items-center shadow-[var(--shadow-glow)]">
            <Shield className="size-4 text-primary-foreground" />
          </div>
          <span className="text-lg">
            Ternak<span className="text-primary">Clouds</span>
          </span>
        </div>

        {/* Heading */}
        <div className="mb-8">
          <div className="size-12 rounded-xl bg-primary/10 grid place-items-center mb-4">
            <KeyRound className="size-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Set your password</h1>
          <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
            Your account was created by an administrator. Please set a new password before
            continuing.
          </p>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          {/* Current (temporary) password */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Temporary password</label>
            <div className="relative">
              <input
                required
                type={showCurrent ? "text" : "password"}
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3 py-2.5 pr-10 rounded-lg bg-secondary border border-border focus:border-primary outline-none transition text-sm"
              />
              <button
                type="button"
                onClick={() => setShowCurrent((p) => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition"
              >
                {showCurrent ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>

          {/* New password */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">New password</label>
            <div className="relative">
              <input
                required
                minLength={8}
                type={showNext ? "text" : "password"}
                value={next}
                onChange={(e) => setNext(e.target.value)}
                placeholder="Min. 8 characters"
                className="w-full px-3 py-2.5 pr-10 rounded-lg bg-secondary border border-border focus:border-primary outline-none transition text-sm"
              />
              <button
                type="button"
                onClick={() => setShowNext((p) => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition"
              >
                {showNext ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>

          {/* Confirm */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Confirm new password
            </label>
            <input
              required
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border focus:border-primary outline-none transition text-sm"
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
              <AlertCircle className="size-4 shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={changePassword.isPending || !current || !next || !confirm}
            className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium shadow-[var(--shadow-glow)] hover:opacity-90 transition disabled:opacity-60 mt-2 flex items-center justify-center gap-2"
          >
            {changePassword.isPending && <Loader2 className="size-4 animate-spin" />}
            Set password & continue
          </button>
        </form>
      </div>
    </div>
  );
}
