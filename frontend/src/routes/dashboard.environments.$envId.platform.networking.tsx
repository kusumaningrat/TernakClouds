import { createFileRoute, useParams } from "@tanstack/react-router";
import { CapabilityPage } from "@/components/CapabilityPage";

export const Route = createFileRoute("/dashboard/environments/$envId/platform/networking")({
  head: () => ({ meta: [{ title: "Networking · TernakClouds" }] }),
  component: NetworkingCapabilityPage,
});

function NetworkingCapabilityPage() {
  const { envId } = useParams({
    from: "/dashboard/environments/$envId/platform/networking",
  });
  return (
    <CapabilityPage
      envId={envId}
      capName="networking"
      title="Networking"
      subtitle="Service mesh and service discovery."
      endpointPlaceholders={{ consul: "https://consul.internal:8500" }}
    />
  );
}
