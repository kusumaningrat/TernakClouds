import { Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";
import {
  ShieldCheck,
  KeyRound,
  Users,
  Building2,
  Rocket,
  Activity,
  GitBranch,
  Terminal,
  Lock,
  CheckCircle2,
  ArrowRight,
  BookOpen,
} from "lucide-react";

export function Landing() {
  return (
    <div className="min-h-screen">
      <SiteHeader />

      {/* Hero */}
      <section id="about" className="relative overflow-hidden">
        <div className="absolute inset-0 grid-bg opacity-40 pointer-events-none" />
        <div className="absolute inset-0" style={{ background: "var(--gradient-hero)" }} />
        <div className="relative mx-auto max-w-7xl px-6 pt-24 pb-28 text-center">
          <div
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full glass text-xs mb-8"
            style={{ color: "var(--muted-foreground)" }}
          >
            <span
              className="size-1.5 rounded-full animate-pulse"
              style={{ background: "var(--color-success)" }}
            />
            Internal Developer Platform · TernakClouds Engineering
          </div>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight max-w-4xl mx-auto leading-[1.05]">
            One platform.{" "}
            <span className="text-gradient">Every guardrail.</span>
          </h1>
          <p
            className="mt-6 text-lg max-w-2xl mx-auto"
            style={{ color: "var(--muted-foreground)" }}
          >
            TernakClouds IDP is the internal platform built by the platform engineering team
            to centralize authentication, access control, department isolation, and deployment
            operations — all in one auditable console.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/docs"
              className="px-5 py-3 rounded-md font-medium inline-flex items-center gap-2 shadow-[var(--shadow-glow)]"
              style={{ background: "var(--color-primary)", color: "var(--primary-foreground)" }}
            >
              Read the docs <BookOpen className="size-4" />
            </Link>
            <a
              href="#features"
              className="px-5 py-3 rounded-md glass inline-flex items-center gap-2 hover:opacity-80 transition"
            >
              Explore features <ArrowRight className="size-4" />
            </a>
          </div>
        </div>
      </section>

      {/* Goals */}
      <section id="goals" className="border-y border-border" style={{ background: "color-mix(in oklab, var(--card) 30%, transparent)" }}>
        <div className="mx-auto max-w-7xl px-6 py-20">
          <div className="text-center mb-14">
            <div
              className="text-xs uppercase tracking-widest mb-3"
              style={{ color: "var(--color-primary)" }}
            >
              Why we built this
            </div>
            <h2 className="text-4xl font-bold tracking-tight">Platform goals</h2>
            <p className="mt-4 max-w-2xl mx-auto" style={{ color: "var(--muted-foreground)" }}>
              The platform was designed around three core principles that guide every design
              decision and feature we ship.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {goals.map((g) => (
              <div key={g.title} className="glass rounded-xl p-8 text-center">
                <div
                  className="size-12 rounded-xl grid place-items-center mb-5 mx-auto"
                  style={{ background: "var(--color-secondary)" }}
                >
                  <g.icon className="size-6" style={{ color: "var(--color-primary)" }} />
                </div>
                <h3 className="text-lg font-semibold">{g.title}</h3>
                <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
                  {g.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-7xl px-6 py-24">
        <div className="text-center mb-14">
          <div
            className="text-xs uppercase tracking-widest mb-3"
            style={{ color: "var(--color-primary)" }}
          >
            Platform capabilities
          </div>
          <h2 className="text-4xl font-bold tracking-tight">What the platform does</h2>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((f) => (
            <div key={f.title} className="glass rounded-xl p-6 hover:border-primary/40 transition group">
              <div
                className="size-10 rounded-lg grid place-items-center mb-4 group-hover:opacity-80 transition"
                style={{ background: "var(--color-secondary)" }}
              >
                <f.icon className="size-5" style={{ color: "var(--color-primary)" }} />
              </div>
              <h3 className="font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Security band */}
      <section
        className="border-y border-border"
        style={{ background: "color-mix(in oklab, var(--card) 30%, transparent)" }}
      >
        <div className="mx-auto max-w-7xl px-6 py-20 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <div
              className="text-xs uppercase tracking-widest mb-3"
              style={{ color: "var(--color-primary)" }}
            >
              Security primitives
            </div>
            <h2 className="text-4xl font-bold tracking-tight">
              JWT auth. RBAC. Department isolation.
            </h2>
            <p className="mt-4 leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
              Short-lived access tokens with rotating refresh, fine-grained permissions, and strict
              department scoping ensure that every action is authorized, audited, and scoped to the
              right team.
            </p>
            <ul className="mt-6 space-y-3 text-sm">
              {securityPoints.map((t) => (
                <li key={t} className="flex items-start gap-3">
                  <CheckCircle2
                    className="size-4 mt-0.5 shrink-0"
                    style={{ color: "var(--color-success)" }}
                  />{" "}
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="glass rounded-xl p-6 font-mono text-xs leading-relaxed">
            <div className="mb-3" style={{ color: "var(--muted-foreground)" }}>
              // Access is scoped to the actor's department
            </div>
            <pre style={{ color: "var(--color-foreground)" }}>
              {`{
  "actor":      "alex.dev@ternak.io",
  "permission": "deploy_services",
  "department": "payments",
  "service":    "payments-api",
  "status":     "queued",
  "audit_id":   "evt_01HZJK4Q…"
}`}
            </pre>
            <div className="flex items-center gap-4 mt-4 pt-4 border-t border-border">
              {["RBAC verified", "Dept scope: payments", "Audit logged"].map((label) => (
                <div
                  key={label}
                  className="flex items-center gap-1.5 text-xs"
                  style={{ color: "var(--color-success)" }}
                >
                  <CheckCircle2 className="size-3.5" /> {label}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Who uses it */}
      <section className="mx-auto max-w-7xl px-6 py-24">
        <div className="text-center mb-14">
          <div
            className="text-xs uppercase tracking-widest mb-3"
            style={{ color: "var(--color-primary)" }}
          >
            Personas
          </div>
          <h2 className="text-4xl font-bold tracking-tight">Built for admins, devs, and SREs.</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-5">
          {personas.map((w) => (
            <div key={w.title} className="glass rounded-xl p-7">
              <div
                className="flex items-center gap-2 text-xs uppercase tracking-widest mb-3"
                style={{ color: "var(--color-primary)" }}
              >
                <w.icon className="size-4" /> {w.tag}
              </div>
              <h3 className="text-xl font-semibold">{w.title}</h3>
              <p className="mt-2 text-sm" style={{ color: "var(--muted-foreground)" }}>
                {w.desc}
              </p>
              <ul className="mt-5 space-y-2 text-sm">
                {w.points.map((p) => (
                  <li key={p} className="flex items-start gap-2">
                    <span
                      className="mt-1.5 size-1.5 rounded-full shrink-0"
                      style={{ background: "var(--color-primary)" }}
                    />{" "}
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Docs CTA */}
      <section className="mx-auto max-w-5xl px-6 pb-24">
        <div className="relative glass rounded-2xl p-12 text-center overflow-hidden">
          <div className="absolute inset-0 grid-bg opacity-30" />
          <div className="relative">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
              Documentation coming soon.
            </h2>
            <p className="mt-3" style={{ color: "var(--muted-foreground)" }}>
              We're writing full guides for setup, RBAC configuration, API reference, and more.
            </p>
            <Link
              to="/docs"
              className="mt-7 inline-flex items-center gap-2 px-6 py-3 rounded-md font-medium shadow-[var(--shadow-glow)]"
              style={{ background: "var(--color-primary)", color: "var(--primary-foreground)" }}
            >
              Preview the docs <BookOpen className="size-4" />
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-border">
        <div
          className="mx-auto max-w-7xl px-6 py-10 flex flex-col md:flex-row justify-between gap-4 text-sm"
          style={{ color: "var(--muted-foreground)" }}
        >
          <div>© {new Date().getFullYear()} TernakClouds · Platform Engineering</div>
          <div className="flex gap-6">
            <Link to="/docs" className="hover:opacity-100 opacity-70 transition">
              Docs
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

const goals = [
  {
    icon: ShieldCheck,
    title: "Secure by default",
    desc: "Every action is authenticated, authorized, and scoped. No implicit trust — permissions are explicit, short-lived, and audited end-to-end.",
  },
  {
    icon: Building2,
    title: "Team isolation",
    desc: "Department boundaries are enforced at the data layer. Teams can only see and act on resources they own — cross-team leakage is impossible by design.",
  },
  {
    icon: Rocket,
    title: "Faster, safer delivery",
    desc: "Platform teams ship infrastructure guardrails so product teams can move fast without breaking things. Approvals, audit logs, and rollback are built in.",
  },
];

const features = [
  {
    icon: ShieldCheck,
    title: "JWT authentication",
    desc: "Short-lived access tokens, rotating refresh, server-side revocation. Sessions are stateless and auditable.",
  },
  {
    icon: KeyRound,
    title: "Role-based access control",
    desc: "Compose roles from granular permissions. Assign by user, team, or department with zero ambiguity.",
  },
  {
    icon: Building2,
    title: "Department isolation",
    desc: "Every query and mutation is scoped to the actor's department. Cross-team access is impossible by default.",
  },
  {
    icon: Users,
    title: "User & team management",
    desc: "Onboard developers, assign departments, and review who has what — all from a single console.",
  },
  {
    icon: Rocket,
    title: "Deployment controls",
    desc: "Gate deploy and restart actions behind permissions. Approvals, audit logs and rollback baked in.",
  },
  {
    icon: Activity,
    title: "Observability built in",
    desc: "Real-time deploy health, permission denials, and session telemetry on every protected route.",
  },
];

const securityPoints = [
  "Stateless JWT with refresh rotation & revocation lists",
  "Permission checks enforced server-side on every action",
  "Department-scoped queries — no cross-team data leakage",
  "Full audit trail for every privileged operation",
];

const personas = [
  {
    tag: "Admin",
    icon: Lock,
    title: "Govern access at scale",
    desc: "Manage every identity, role, and permission with full traceability.",
    points: [
      "Invite users and assign departments",
      "Compose roles from atomic permissions",
      "Audit every privilege change",
    ],
  },
  {
    tag: "Developer",
    icon: Terminal,
    title: "Operate safely in production",
    desc: "Run deploys with the confidence that authorization is enforced.",
    points: [
      "Trigger deployments within your scope",
      "Restart services you own",
      "View live deployment status and logs",
    ],
  },
  {
    tag: "SRE",
    icon: GitBranch,
    title: "Audit & respond",
    desc: "Trace every action back to a user, role, and JWT.",
    points: [
      "Real-time audit stream",
      "Revoke compromised sessions instantly",
      "Replay deployment timelines",
    ],
  },
];
