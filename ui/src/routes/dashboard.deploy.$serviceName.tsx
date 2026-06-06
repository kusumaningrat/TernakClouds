import { createFileRoute } from "@tanstack/react-router";
import { DeployPage } from "@/modules/deploy-wizard/pages/deploy-page";

export const Route = createFileRoute("/dashboard/deploy/$serviceName")({
  head: ({ params }) => ({
    meta: [{ title: `Deploy ${params.serviceName} · TernakClouds` }],
  }),
  component: DeployPage,
});
