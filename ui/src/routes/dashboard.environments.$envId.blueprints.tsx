import { createFileRoute } from "@tanstack/react-router";
import { BlueprintsPage } from "@/modules/blueprints-wizard/pages/blueprints-page";

export const Route = createFileRoute("/dashboard/environments/$envId/blueprints")({
  head: () => ({ meta: [{ title: "Blueprints · TernakClouds" }] }),
  component: BlueprintsPage,
});
