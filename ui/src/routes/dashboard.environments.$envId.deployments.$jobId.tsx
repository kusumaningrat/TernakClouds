import { createFileRoute } from "@tanstack/react-router";
import { JobDetailPage } from "@/modules/job-detail/pages/job-detail-page";

export const Route = createFileRoute("/dashboard/environments/$envId/deployments/$jobId")({
  validateSearch: (search: Record<string, unknown>) => ({
    namespace: typeof search.namespace === "string" ? search.namespace : "default",
  }),
  head: () => ({ meta: [{ title: "Job Detail · TernakClouds" }] }),
  component: JobDetailPage,
});
