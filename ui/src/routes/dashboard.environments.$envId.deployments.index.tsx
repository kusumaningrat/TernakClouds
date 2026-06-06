import { createFileRoute } from "@tanstack/react-router";
import { DeploymentsListPage } from "@/modules/deployments/pages/deployments-list";

export const Route = createFileRoute("/dashboard/environments/$envId/deployments/")({
  head: () => ({ meta: [{ title: "Deployments · TernakClouds" }] }),
  component: DeploymentsListPage,
});
