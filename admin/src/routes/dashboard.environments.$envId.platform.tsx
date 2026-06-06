import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard/environments/$envId/platform")({
  head: () => ({ meta: [{ title: "Platform · TernakClouds" }] }),
  component: PlatformLayout,
});

function PlatformLayout() {
  return <Outlet />;
}
