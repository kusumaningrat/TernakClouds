import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";
import { ArrowLeft, BookOpen, ChevronRight } from "lucide-react";
import { articles } from "./docs-content";

const sidebar = [
  {
    title: "Getting started",
    items: ["introduction", "installation", "auth-basics"],
  },
  {
    title: "Platform",
    items: ["architecture", "runtimes"],
  },
  {
    title: "Observability",
    items: ["logs-platform"],
  },
  {
    title: "Access control",
    items: ["rbac-concepts"],
  },
  {
    title: "User management",
    items: ["inviting-users", "managing-teams", "audit-logs"],
  },
  {
    title: "Contributing",
    items: ["contributing"],
  },
];

const articleMap = Object.fromEntries(articles.map((a) => [a.id, a]));

export function Docs() {
  const [activeId, setActiveId] = useState("introduction");
  const active = articleMap[activeId];

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />

      <div className="flex flex-1 mx-auto w-full max-w-7xl px-4 py-8 gap-8">
        {/* Sidebar */}
        <aside className="hidden md:flex flex-col w-60 shrink-0">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs mb-6 opacity-60 hover:opacity-100 transition"
          >
            <ArrowLeft className="size-3.5" /> Back to home
          </Link>

          <div className="flex items-center gap-2 mb-6">
            <div
              className="size-7 rounded-lg grid place-items-center shadow-[var(--shadow-glow)]"
              style={{ background: "var(--gradient-primary)" }}
            >
              <BookOpen className="size-3.5" style={{ color: "var(--primary-foreground)" }} />
            </div>
            <span className="font-semibold text-sm">Docs</span>
          </div>

          <nav className="space-y-5">
            {sidebar.map((section) => (
              <div key={section.title}>
                <p
                  className="text-xs uppercase tracking-widest font-semibold mb-2"
                  style={{ color: "var(--color-primary)" }}
                >
                  {section.title}
                </p>
                <ul className="space-y-0.5">
                  {section.items.map((id) => {
                    const article = articleMap[id];
                    if (!article) return null;
                    const isActive = activeId === id;
                    return (
                      <li key={id}>
                        <button
                          onClick={() => setActiveId(id)}
                          className="w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition"
                          style={
                            isActive
                              ? {
                                  background:
                                    "color-mix(in oklab, var(--color-primary) 12%, transparent)",
                                  color: "var(--color-primary)",
                                }
                              : { color: "var(--muted-foreground)" }
                          }
                        >
                          {isActive && <ChevronRight className="size-3 shrink-0" />}
                          {!isActive && <span className="size-3 shrink-0" />}
                          {article.title}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>
        </aside>

        {/* Mobile article picker */}
        <div className="md:hidden w-full mb-4">
          <select
            value={activeId}
            onChange={(e) => setActiveId(e.target.value)}
            className="w-full glass rounded-lg px-3 py-2 text-sm"
            style={{ color: "var(--color-foreground)", background: "var(--card)" }}
          >
            {sidebar.map((section) => (
              <optgroup key={section.title} label={section.title}>
                {section.items.map((id) => {
                  const article = articleMap[id];
                  if (!article) return null;
                  return (
                    <option key={id} value={id}>
                      {article.title}
                    </option>
                  );
                })}
              </optgroup>
            ))}
          </select>
        </div>

        {/* Article */}
        <main className="flex-1 min-w-0">
          {active && (
            <article>
              <h1 className="text-3xl font-bold tracking-tight mb-2">{active.title}</h1>
              <div
                className="h-px mb-8"
                style={{ background: "var(--border)" }}
              />
              {active.content}
            </article>
          )}
        </main>
      </div>
    </div>
  );
}
