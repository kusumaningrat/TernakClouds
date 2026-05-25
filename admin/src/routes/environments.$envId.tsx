import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/environments/$envId")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/dashboard/environments/$envId",
      params: { envId: params.envId },
    });
  },
});
