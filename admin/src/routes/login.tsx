import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { Shield, Layers, Users, GitBranch, AlertCircle } from "lucide-react";
import { useState } from "react";
import { isAuthenticated } from "@/lib/auth";
import { useLogin } from "@/lib/queries";

export const Route = createFileRoute("/login")({
  beforeLoad: () => {
    if (typeof window !== "undefined" && isAuthenticated()) {
      throw redirect({ to: "/dashboard" });
    }
  },
  head: () => ({ meta: [{ title: "Sign in · TernakClouds" }] }),
  component: LoginPage,
});

const FEATURES = [
  {
    icon: Layers,
    title: "Unified control plane",
    description: "Manage environments, services, and deployments from a single dashboard.",
  },
  {
    icon: Users,
    title: "Team-based access",
    description: "Role and department scoped permissions — everyone sees exactly what they need.",
  },
  {
    icon: GitBranch,
    title: "Built for velocity",
    description: "Service catalog, secret management, and infrastructure in one place.",
  },
];

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const login = useLogin();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await login.mutateAsync({ email, password });
      void navigate({ to: "/dashboard" });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Incorrect email or password.");
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* ── Left brand panel ─────────────────────────────────────── */}
      <div className="relative hidden lg:flex flex-col justify-between p-12 border-r border-border overflow-hidden">
        <div className="absolute inset-0 grid-bg opacity-40" />
        <div className="absolute inset-0" style={{ background: "var(--gradient-hero)" }} />

        {/* Logo */}
        <div className="relative">
          <Link to="/" className="flex items-center gap-2.5 font-semibold">
            <div className="size-9 rounded-md bg-[image:var(--gradient-primary)] grid place-items-center shadow-[var(--shadow-glow)]">
              <Shield className="size-4 text-primary-foreground" />
            </div>
            <span className="text-lg">
              Ternak<span className="text-primary">Clouds</span>
            </span>
          </Link>
        </div>

        {/* Hero text */}
        <div className="relative space-y-8 max-w-sm">
          <div className="space-y-3">
            <h2 className="text-3xl font-bold tracking-tight leading-snug">
              Your platform,
              <br />
              <span className="text-gradient">your team's pace.</span>
            </h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              TernakClouds gives engineering teams a single control plane to deploy, secure, and
              govern their infrastructure — without the overhead.
            </p>
          </div>

          <div className="space-y-5">
            {FEATURES.map(({ icon: Icon, title, description }) => (
              <div key={title} className="flex items-start gap-3">
                <div className="size-8 rounded-lg bg-primary/10 grid place-items-center shrink-0 mt-0.5">
                  <Icon className="size-4 text-primary" />
                </div>
                <div>
                  <div className="text-sm font-medium">{title}</div>
                  <div className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                    {description}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer footnote */}
        <div className="relative text-xs text-muted-foreground">
          © {new Date().getFullYear()} TernakClouds · Internal Developer Platform
        </div>
      </div>

      {/* ── Right form ───────────────────────────────────────────── */}
      <div className="flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="lg:hidden mb-8">
            <Link to="/" className="inline-flex items-center gap-2 font-semibold">
              <div className="size-8 rounded-md bg-[image:var(--gradient-primary)] grid place-items-center">
                <Shield className="size-4 text-primary-foreground" />
              </div>
              <span>
                Ternak<span className="text-primary">Clouds</span>
              </span>
            </Link>
          </div>

          {/* Heading */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Sign in to continue to your workspace.
            </p>
          </div>

          {/* Form */}
          <form
            onSubmit={(e) => {
              void handleSubmit(e);
            }}
            className="space-y-4"
          >
            {error && (
              <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
                <AlertCircle className="size-4 shrink-0 mt-0.5" />
                {error}
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Email address</label>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border focus:border-primary outline-none transition text-sm"
                placeholder="you@company.com"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-muted-foreground">Password</label>
                <a
                  href="#"
                  className="text-xs text-muted-foreground hover:text-foreground transition"
                >
                  Forgot password?
                </a>
              </div>
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border focus:border-primary outline-none transition text-sm"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={login.isPending}
              className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium shadow-[var(--shadow-glow)] hover:opacity-90 transition disabled:opacity-60 mt-2"
            >
              {login.isPending ? "Signing in…" : "Continue"}
            </button>
          </form>

          {/* Divider */}
          {/* <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
            <div className="flex-1 h-px bg-border" />
            or
            <div className="flex-1 h-px bg-border" />
          </div> */}

          {/* SSO options */}
          {/* <div className="grid grid-cols-2 gap-3">
            <button className="py-2.5 rounded-lg glass hover:bg-secondary inline-flex items-center justify-center gap-2 text-sm transition">
              <svg viewBox="0 0 24 24" className="size-4 fill-current" aria-hidden>
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
              </svg>
              GitHub
            </button>
            <button className="py-2.5 rounded-lg glass hover:bg-secondary inline-flex items-center justify-center gap-2 text-sm transition">
              <Shield className="size-4" />
              SAML SSO
            </button>
          </div> */}

          {/* Register link */}
          <p className="mt-8 text-sm text-muted-foreground text-center">
            Don't have an account?{" "}
            <Link
              to="/register"
              className="text-foreground font-medium hover:text-primary transition"
            >
              Request access
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
