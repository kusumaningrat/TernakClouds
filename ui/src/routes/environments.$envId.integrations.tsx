import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/environments/$envId/integrations")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/dashboard/environments/$envId/integrations",
      params: { envId: params.envId },
    });
  },
});
