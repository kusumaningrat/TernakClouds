import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard/environments/$envId/services")({
  component: () => <Outlet />,
});
