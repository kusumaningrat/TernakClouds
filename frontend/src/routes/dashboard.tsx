import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import { isAuthenticated } from "@/lib/auth";
import { WorkspaceProvider } from "@/lib/workspace-context";

export const Route = createFileRoute("/dashboard")({
  beforeLoad: () => {
    // Only enforce on the client — localStorage is not available during SSR
    if (typeof window !== "undefined" && !isAuthenticated()) {
      throw redirect({ to: "/login" });
    }
  },
  component: DashboardLayout,
});

function DashboardLayout() {
  return (
    <WorkspaceProvider>
      <div className="min-h-screen flex">
        <DashboardSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <Outlet />
        </div>
      </div>
    </WorkspaceProvider>
  );
}
