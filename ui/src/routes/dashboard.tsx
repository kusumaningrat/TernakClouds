import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import { isAuthenticated } from "@/lib/auth";
import { WorkspaceProvider } from "@/lib/workspace-context";
import { EnvironmentProvider } from "@/lib/environment-context";

export const Route = createFileRoute("/dashboard")({
  beforeLoad: () => {
    if (typeof window !== "undefined" && !isAuthenticated()) {
      throw redirect({ to: "/login" });
    }
  },
  component: DashboardLayout,
});

function DashboardLayout() {
  return (
    <WorkspaceProvider>
      <EnvironmentProvider>
        {/* Each route page renders its own DashboardTopbar with page-specific breadcrumbs/title.
            Setup detection (no environments) is handled in dashboard.index.tsx — it shows a
            full-screen setup CTA or redirects to /setup rather than an empty dashboard. */}
        <div className="h-screen flex overflow-hidden">
          <DashboardSidebar />
          <div className="flex-1 flex flex-col min-w-0 overflow-auto">
            <Outlet />
          </div>
        </div>
      </EnvironmentProvider>
    </WorkspaceProvider>
  );
}
