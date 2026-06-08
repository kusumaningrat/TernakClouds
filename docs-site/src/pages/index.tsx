import Link from "@docusaurus/Link";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import Layout from "@theme/Layout";
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
import styles from "./index.module.css";

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

export default function Home() {
  const { siteConfig } = useDocusaurusContext();

  return (
    <Layout
      title={siteConfig.title}
      description="Internal Developer Platform — centralize authentication, access control, and deployment operations."
    >
      {/* Hero */}
      <section className={styles.hero}>
        <div className={styles.heroGrid} />
        <div className={styles.heroGlow} />
        <div className={styles.heroContent}>
          <div className={styles.heroBadge}>
            <span className={styles.heroBadgeDot} />
            Internal Developer Platform · TernakClouds Engineering
          </div>
          <h1 className={styles.heroTitle}>
            One platform.{" "}
            <span className={styles.heroGradient}>Every guardrail.</span>
          </h1>
          <p className={styles.heroSubtitle}>
            TernakClouds IDP is the internal platform built by the platform
            engineering team to centralize authentication, access control,
            department isolation, and deployment operations — all in one
            auditable console.
          </p>
          <div className={styles.heroCta}>
            <Link to="/docs/introduction/overview" className={styles.ctaPrimary}>
              Read the docs <BookOpen size={16} />
            </Link>
            <a href="#features" className={styles.ctaSecondary}>
              Explore features <ArrowRight size={16} />
            </a>
          </div>
        </div>
      </section>

      {/* Goals */}
      <section className={styles.sectionAlt} id="goals">
        <div className={styles.container}>
          <div className={styles.sectionHeader}>
            <div className={styles.eyebrow}>Why we built this</div>
            <h2 className={styles.sectionTitle}>Platform goals</h2>
            <p className={styles.sectionSubtitle}>
              The platform was designed around three core principles that guide
              every design decision and feature we ship.
            </p>
          </div>
          <div className={styles.grid3}>
            {goals.map((g) => (
              <div key={g.title} className={styles.card}>
                <div className={styles.cardIcon}>
                  <g.icon size={24} />
                </div>
                <h3 className={styles.cardTitle}>{g.title}</h3>
                <p className={styles.cardDesc}>{g.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className={styles.section} id="features">
        <div className={styles.container}>
          <div className={styles.sectionHeader}>
            <div className={styles.eyebrow}>Platform capabilities</div>
            <h2 className={styles.sectionTitle}>What the platform does</h2>
          </div>
          <div className={styles.grid3}>
            {features.map((f) => (
              <div key={f.title} className={styles.featureCard}>
                <div className={styles.featureIcon}>
                  <f.icon size={20} />
                </div>
                <h3 className={styles.cardTitle}>{f.title}</h3>
                <p className={styles.cardDesc}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Security */}
      <section className={styles.sectionAlt}>
        <div className={styles.container}>
          <div className={styles.splitGrid}>
            <div>
              <div className={styles.eyebrow}>Security primitives</div>
              <h2 className={styles.sectionTitle}>
                JWT auth. RBAC. Department isolation.
              </h2>
              <p className={styles.sectionSubtitle}>
                Short-lived access tokens with rotating refresh, fine-grained
                permissions, and strict department scoping ensure that every
                action is authorized, audited, and scoped to the right team.
              </p>
              <ul className={styles.checkList}>
                {securityPoints.map((t) => (
                  <li key={t} className={styles.checkItem}>
                    <CheckCircle2 size={16} className={styles.checkIcon} />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
            <div className={styles.codeCard}>
              <p className={styles.codeComment}>
                // Access is scoped to the actor's department
              </p>
              <pre className={styles.codeBlock}>
                {`{
  "actor":      "alex.dev@ternak.clouds",
  "permission": "deploy_services",
  "department": "payments",
  "service":    "payments-api",
  "status":     "queued",
  "audit_id":   "evt_01HZJK4Q…"
}`}
              </pre>
              <div className={styles.codeFooter}>
                {["RBAC verified", "Dept scope: payments", "Audit logged"].map(
                  (label) => (
                    <div key={label} className={styles.codeBadge}>
                      <CheckCircle2 size={13} /> {label}
                    </div>
                  )
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Personas */}
      <section className={styles.section}>
        <div className={styles.container}>
          <div className={styles.sectionHeader}>
            <div className={styles.eyebrow}>Personas</div>
            <h2 className={styles.sectionTitle}>
              Built for admins, devs, and SREs.
            </h2>
          </div>
          <div className={styles.grid3}>
            {personas.map((w) => (
              <div key={w.title} className={styles.card}>
                <div className={styles.personaTag}>
                  <w.icon size={14} /> {w.tag}
                </div>
                <h3 className={styles.personaTitle}>{w.title}</h3>
                <p className={styles.cardDesc}>{w.desc}</p>
                <ul className={styles.personaList}>
                  {w.points.map((p) => (
                    <li key={p} className={styles.personaPoint}>
                      <span className={styles.personaDot} />
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className={styles.section}>
        <div className={styles.container}>
          <div className={styles.ctaBanner}>
            <div className={styles.heroGrid} style={{ borderRadius: 16 }} />
            <div className={styles.ctaBannerContent}>
              <h2 className={styles.ctaBannerTitle}>
                Ready to get started?
              </h2>
              <p className={styles.ctaBannerSubtitle}>
                Full guides for setup, RBAC configuration, runtimes, and more.
              </p>
              <Link
                to="/docs/introduction/overview"
                className={styles.ctaPrimary}
              >
                Read the docs <BookOpen size={16} />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
}
