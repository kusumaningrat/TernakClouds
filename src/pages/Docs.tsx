import { Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";
import { BookOpen, Clock, ArrowLeft } from "lucide-react";

const sections = [
  {
    title: "Getting started",
    items: ["Introduction & overview", "Installation & setup", "Authentication basics"],
  },
  {
    title: "Access control",
    items: ["RBAC concepts", "Roles & permissions", "Department scoping"],
  },
  {
    title: "User management",
    items: ["Inviting users", "Managing teams", "Audit logs"],
  },
  {
    title: "Deployments",
    items: ["Deployment controls", "Approval workflows", "Rollback & recovery"],
  },
  {
    title: "Integrations",
    items: ["Kubernetes provider", "Registry providers", "Environment bindings"],
  },
  {
    title: "API reference",
    items: ["Authentication endpoints", "Users & roles API", "Deployments API"],
  },
];

export function Docs() {
  return (
    <div className="min-h-screen">
      <SiteHeader />

      <div className="mx-auto max-w-5xl px-6 py-20">
        {/* Back */}
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm mb-10 opacity-60 hover:opacity-100 transition"
        >
          <ArrowLeft className="size-4" /> Back to home
        </Link>

        {/* Header */}
        <div className="text-center mb-16">
          <div
            className="size-16 rounded-2xl grid place-items-center mx-auto mb-6 shadow-[var(--shadow-glow)]"
            style={{ background: "var(--gradient-primary)" }}
          >
            <BookOpen className="size-8" style={{ color: "var(--primary-foreground)" }} />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">Documentation</h1>
          <p className="mt-4 max-w-lg mx-auto" style={{ color: "var(--muted-foreground)" }}>
            Full guides, API references, and configuration docs for TernakClouds IDP are on
            their way. Here's what we're planning to cover.
          </p>
        </div>

        {/* Coming soon banner */}
        <div
          className="glass rounded-xl p-6 flex items-center gap-4 mb-12"
          style={{ borderColor: "oklch(0.78 0.16 75 / 0.4)" }}
        >
          <Clock className="size-5 shrink-0" style={{ color: "var(--color-warning)" }} />
          <div>
            <p className="font-medium">Docs are being written</p>
            <p className="text-sm mt-0.5" style={{ color: "var(--muted-foreground)" }}>
              This page is a preview of the documentation structure. Content will be published
              here once the platform reaches its first stable release.
            </p>
          </div>
        </div>

        {/* Planned sections */}
        <div className="grid md:grid-cols-2 gap-5">
          {sections.map((section) => (
            <div key={section.title} className="glass rounded-xl p-6">
              <h2 className="font-semibold mb-4">{section.title}</h2>
              <ul className="space-y-2">
                {section.items.map((item) => (
                  <li
                    key={item}
                    className="flex items-center gap-3 text-sm py-1.5 border-b border-border last:border-0"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    <span
                      className="size-1.5 rounded-full shrink-0 opacity-50"
                      style={{ background: "var(--color-primary)" }}
                    />
                    {item}
                    <span
                      className="ml-auto text-xs px-2 py-0.5 rounded-full"
                      style={{
                        background: "color-mix(in oklab, var(--color-warning) 15%, transparent)",
                        color: "var(--color-warning)",
                      }}
                    >
                      soon
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <p className="text-center text-sm mt-12" style={{ color: "var(--muted-foreground)" }}>
          © {new Date().getFullYear()} TernakClouds · Platform Engineering
        </p>
      </div>
    </div>
  );
}
