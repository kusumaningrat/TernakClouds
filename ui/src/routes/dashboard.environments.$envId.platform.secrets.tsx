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
      namespaceConfig={{
        vault: {
          label: "KV mount",
          placeholder: "secret",
          hint: 'Name of your Vault KV v2 mount (run "vault secrets list"). Defaults to "secret" if blank — set it to "secrets" if that is your mount.',
        },
      }}
    />
  );
}
