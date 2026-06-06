import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard/environments/$envId")({
  head: () => ({ meta: [{ title: "Environment · TernakClouds" }] }),
  component: EnvLayoutPage,
});

function EnvLayoutPage() {
  return <Outlet />;
}
