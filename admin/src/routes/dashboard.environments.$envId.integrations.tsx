import { createFileRoute, Navigate, useParams } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard/environments/$envId/integrations")({
  component: IntegrationsRedirect,
});

function IntegrationsRedirect() {
  const { envId } = useParams({ from: "/dashboard/environments/$envId/integrations" });
  return (
    <Navigate to="/dashboard/environments/$envId/platform/runtime" params={{ envId }} replace />
  );
}
