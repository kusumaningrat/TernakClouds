import { createFileRoute, useParams } from "@tanstack/react-router";
import { CapabilityPage } from "@/components/CapabilityPage";

export const Route = createFileRoute("/dashboard/environments/$envId/platform/storage")({
  head: () => ({ meta: [{ title: "Storage · TernakClouds" }] }),
  component: StorageCapabilityPage,
});

function StorageCapabilityPage() {
  const { envId } = useParams({
    from: "/dashboard/environments/$envId/platform/storage",
  });
  return (
    <CapabilityPage
      envId={envId}
      capName="storage"
      title="Storage"
      subtitle="Persistent and object storage."
      endpointPlaceholders={{ minio: "https://minio.internal:9000" }}
    />
  );
}
