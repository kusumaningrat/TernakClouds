import { createFileRoute, useParams } from "@tanstack/react-router";
import { CapabilityPage } from "@/components/CapabilityPage";

export const Route = createFileRoute("/dashboard/environments/$envId/platform/secrets")({
  head: () => ({ meta: [{ title: "Secrets · TernakClouds" }] }),
  component: SecretsCapabilityPage,
});

function SecretsCapabilityPage() {
  const { envId } = useParams({
    from: "/dashboard/environments/$envId/platform/secrets",
  });
  return (
    <CapabilityPage
      envId={envId}
      capName="secrets"
      title="Secrets"
      subtitle="Secret management and dynamic credentials."
      endpointPlaceholders={{ vault: "https://vault.internal:8200" }}
    />
  );
}
