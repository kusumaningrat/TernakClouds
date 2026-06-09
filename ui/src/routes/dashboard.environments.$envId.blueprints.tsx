import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard/environments/$envId/blueprints")({
  beforeLoad: () => {
    throw redirect({ to: "/dashboard/blueprints", replace: true });
  },
  component: () => null,
});
