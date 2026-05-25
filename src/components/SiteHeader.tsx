import { Link } from "@tanstack/react-router";
import { Shield } from "lucide-react";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 glass">
      <div className="mx-auto max-w-7xl flex items-center justify-between px-6 h-16">
        <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <div
            className="size-8 rounded-md grid place-items-center shadow-[var(--shadow-glow)]"
            style={{ background: "var(--gradient-primary)" }}
          >
            <Shield className="size-4" style={{ color: "var(--primary-foreground)" }} />
          </div>
          <span>
            Ternak<span style={{ color: "var(--color-primary)" }}>Clouds</span>
          </span>
        </Link>
        <nav className="hidden md:flex items-center gap-7 text-sm" style={{ color: "var(--muted-foreground)" }}>
          <a href="/#about" className="hover:opacity-100 opacity-70 transition">
            About
          </a>
          <a href="/#goals" className="hover:opacity-100 opacity-70 transition">
            Goals
          </a>
          <a href="/#features" className="hover:opacity-100 opacity-70 transition">
            Features
          </a>
          <Link to="/docs" className="hover:opacity-100 opacity-70 transition">
            Docs
          </Link>
        </nav>
      </div>
    </header>
  );
}
