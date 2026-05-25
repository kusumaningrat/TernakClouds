import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard/environments")({
  head: () => ({ meta: [{ title: "Environments · TernakClouds" }] }),
  component: EnvironmentsLayoutPage,
});

function EnvironmentsLayoutPage() {
  return <Outlet />;
}
