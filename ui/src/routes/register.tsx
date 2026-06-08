import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { isAuthenticated } from "@/lib/auth";
import { ShieldOff } from "lucide-react";

export const Route = createFileRoute("/register")({
  beforeLoad: () => {
    if (typeof window !== "undefined" && isAuthenticated()) {
      throw redirect({ to: "/dashboard" });
    }
  },
  head: () => ({ meta: [{ title: "Registration closed · TernakClouds" }] }),
  component: RegisterClosedPage,
});

function RegisterClosedPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="max-w-sm w-full text-center space-y-6">
        <div className="size-16 rounded-2xl bg-secondary grid place-items-center mx-auto">
          <ShieldOff className="size-8 text-muted-foreground" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Self-registration is disabled</h1>
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
            Account creation is managed by your platform administrator. Contact your admin to get
            access.
          </p>
        </div>
        <Link
          to="/login"
          className="inline-flex items-center justify-center w-full px-4 py-2.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition text-sm font-medium"
        >
          Back to sign in
        </Link>
      </div>
    </div>
  );
}
