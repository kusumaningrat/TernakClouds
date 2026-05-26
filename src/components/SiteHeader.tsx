import { Link } from "@tanstack/react-router";
import { Shield } from "lucide-react";

function GithubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 2C6.477 2 2 6.477 2 12c0 4.418 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.009-.868-.013-1.703-2.782.604-3.369-1.341-3.369-1.341-.454-1.154-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0 1 12 6.836a9.59 9.59 0 0 1 2.504.337c1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.202 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.579.688.481C19.138 20.163 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
    </svg>
  );
}

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
          <a
            href="https://github.com/kusumaningrat/TernakClouds"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:opacity-100 opacity-70 transition"
            aria-label="GitHub"
          >
            <GithubIcon className="size-5" />
          </a>
        </nav>
      </div>
    </header>
  );
}
