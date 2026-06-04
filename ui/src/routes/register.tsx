import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { Shield } from "lucide-react";
import { useState } from "react";
import { isAuthenticated } from "@/lib/auth";
import { useRegister } from "@/lib/queries";

export const Route = createFileRoute("/register")({
  beforeLoad: () => {
    if (typeof window !== "undefined" && isAuthenticated()) {
      throw redirect({ to: "/dashboard" });
    }
  },
  head: () => ({ meta: [{ title: "Request access · TernakClouds" }] }),
  component: RegisterPage,
});

function RegisterPage() {
  const navigate = useNavigate();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [department, setDepartment] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const register = useRegister();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await register.mutateAsync({
        email,
        password,
        first_name: firstName,
        last_name: lastName,
        department_name: department,
      });
      setSuccess(true);
      setTimeout(() => void navigate({ to: "/login" }), 1500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Registration failed");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md glass rounded-2xl p-8">
        <Link to="/" className="flex items-center gap-2 font-semibold mb-6">
          <div className="size-8 rounded-md bg-[image:var(--gradient-primary)] grid place-items-center">
            <Shield className="size-4 text-primary-foreground" />
          </div>
          <span>
            Ternak<span className="text-primary">Clouds</span>
          </span>
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">Request access</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Create your account and join a department to get started.
        </p>
        <form
          onSubmit={(e) => {
            void handleSubmit(e);
          }}
          className="mt-6 space-y-4"
        >
          {error && (
            <div className="px-3 py-2.5 rounded-md bg-destructive/10 border border-destructive/30 text-sm text-destructive">
              {error}
            </div>
          )}
          {success && (
            <div className="px-3 py-2.5 rounded-md bg-success/10 border border-success/30 text-sm text-success">
              Account created! Redirecting to sign in…
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">First name</label>
              <input
                type="text"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Jamie"
                className="mt-1.5 w-full px-3 py-2.5 rounded-md bg-secondary border border-border focus:border-primary outline-none transition"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Last name</label>
              <input
                type="text"
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Chen"
                className="mt-1.5 w-full px-3 py-2.5 rounded-md bg-secondary border border-border focus:border-primary outline-none transition"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">Work email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jamie@company.com"
              className="mt-1.5 w-full px-3 py-2.5 rounded-md bg-secondary border border-border focus:border-primary outline-none transition"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">Department</label>
            <input
              type="text"
              required
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              placeholder="Payments · Platform · Data…"
              className="mt-1.5 w-full px-3 py-2.5 rounded-md bg-secondary border border-border focus:border-primary outline-none transition"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">Password</label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="mt-1.5 w-full px-3 py-2.5 rounded-md bg-secondary border border-border focus:border-primary outline-none transition"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">Minimum 8 characters</p>
          </div>

          <button
            type="submit"
            disabled={register.isPending || success}
            className="w-full py-2.5 rounded-md bg-primary text-primary-foreground font-medium shadow-[var(--shadow-glow)] hover:opacity-90 transition disabled:opacity-60"
          >
            {register.isPending ? "Creating account…" : "Create account"}
          </button>
        </form>
        <p className="mt-6 text-sm text-muted-foreground text-center">
          Already have access?{" "}
          <Link to="/login" className="text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
