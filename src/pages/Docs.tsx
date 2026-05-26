import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";
import { ArrowLeft, BookOpen, ChevronRight } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

const rawFiles = import.meta.glob("../../docs/**/*.md", {
  eager: true,
  query: "?raw",
  import: "default",
}) as Record<string, string>;

function extractTitle(content: string): string {
  const match = content.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : "Untitled";
}

type DocArticle = { id: string; title: string; content: string };

const ORDER = [
  "introduction",
  "getting-started",
  "architecture",
  "runtimes",
  "logs",
  "authentication",
  "contributing",
];

const articles: DocArticle[] = Object.entries(rawFiles)
  .filter(([path]) => !path.endsWith("README.md"))
  .map(([path, content]) => {
    const dir = path.replace("../../docs/", "").split("/")[0];
    return { id: dir, title: extractTitle(content), content };
  })
  .sort((a, b) => ORDER.indexOf(a.id) - ORDER.indexOf(b.id));

const articleMap = Object.fromEntries(articles.map((a) => [a.id, a]));

const sidebar = [
  { title: "Getting Started", items: ["introduction", "getting-started"] },
  { title: "Platform", items: ["architecture", "runtimes"] },
  { title: "Observability", items: ["logs"] },
  { title: "Access Control", items: ["authentication"] },
  { title: "Contributing", items: ["contributing"] },
];

const mdComponents: Components = {
  h1: ({ children }) => (
    <h1 className="text-3xl font-bold tracking-tight mb-2">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2
      className="text-xl font-semibold mt-8 mb-3"
      style={{ color: "var(--color-foreground)" }}
    >
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3
      className="text-lg font-semibold mt-6 mb-2"
      style={{ color: "var(--color-foreground)" }}
    >
      {children}
    </h3>
  ),
  p: ({ children }) => (
    <p
      className="text-sm leading-7 my-3"
      style={{ color: "var(--muted-foreground)" }}
    >
      {children}
    </p>
  ),
  pre: ({ children }) => (
    <pre
      className="glass rounded-lg p-4 text-xs font-mono leading-relaxed overflow-x-auto my-4"
      style={{ color: "var(--color-foreground)" }}
    >
      {children}
    </pre>
  ),
  code: ({ children, className }) =>
    className ? (
      <code className={className}>{children}</code>
    ) : (
      <code
        className="font-mono text-xs rounded px-1 py-0.5"
        style={{
          background:
            "color-mix(in oklab, var(--color-primary) 10%, transparent)",
          color: "var(--color-foreground)",
        }}
      >
        {children}
      </code>
    ),
  ul: ({ children }) => (
    <ul
      className="my-3 text-sm space-y-1.5 pl-4 list-disc"
      style={{ color: "var(--muted-foreground)" }}
    >
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol
      className="my-3 text-sm space-y-1.5 pl-4 list-decimal"
      style={{ color: "var(--muted-foreground)" }}
    >
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="leading-7">{children}</li>,
  a: ({ href, children }) => (
    <a
      href={href}
      className="underline underline-offset-2 transition opacity-90 hover:opacity-100"
      style={{ color: "var(--color-primary)" }}
    >
      {children}
    </a>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold" style={{ color: "var(--color-foreground)" }}>
      {children}
    </strong>
  ),
  blockquote: ({ children }) => (
    <div
      className="glass rounded-lg p-4 my-4 border-l-2"
      style={{ borderLeftColor: "var(--color-primary)" }}
    >
      <p
        className="text-xs font-semibold uppercase tracking-widest mb-1"
        style={{ color: "var(--color-primary)" }}
      >
        Note
      </p>
      <div
        className="text-sm leading-6"
        style={{ color: "var(--muted-foreground)" }}
      >
        {children}
      </div>
    </div>
  ),
  table: ({ children }) => (
    <div className="overflow-x-auto my-4">
      <table className="w-full text-sm border-collapse">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th
      className="text-left px-3 py-2 font-semibold text-xs uppercase tracking-widest"
      style={{
        color: "var(--color-primary)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td
      className="px-3 py-2 text-sm"
      style={{
        color: "var(--muted-foreground)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      {children}
    </td>
  ),
  hr: () => <hr className="my-8" style={{ borderColor: "var(--border)" }} />,
};

export function Docs() {
  const [activeId, setActiveId] = useState(articles[0]?.id ?? "introduction");
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
              <BookOpen
                className="size-3.5"
                style={{ color: "var(--primary-foreground)" }}
              />
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
                          {isActive ? (
                            <ChevronRight className="size-3 shrink-0" />
                          ) : (
                            <span className="size-3 shrink-0" />
                          )}
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
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
                {active.content}
              </ReactMarkdown>
            </article>
          )}
        </main>
      </div>
    </div>
  );
}
