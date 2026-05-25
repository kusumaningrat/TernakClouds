import { createFileRoute } from "@tanstack/react-router";
import { DashboardTopbar } from "@/components/DashboardTopbar";
import { Layers, Construction } from "lucide-react";

export const Route = createFileRoute("/dashboard/services")({
  head: () => ({ meta: [{ title: "Services · TernakClouds" }] }),
  component: ServicesPage,
});

function ServicesPage() {
  return (
    <>
      <DashboardTopbar
        title="Services"
        subtitle="Register and manage microservices within this workspace."
      />
      <main className="p-6 flex flex-col items-center justify-center py-32 text-center gap-4">
        <div className="size-14 rounded-2xl bg-secondary grid place-items-center">
          <Layers className="size-7 text-muted-foreground" />
        </div>
        <div>
          <h2 className="font-semibold text-lg">Services</h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-xs">
            Service registry is coming soon. You'll be able to register, version and link services
            to environments here.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground px-3 py-1.5 rounded-full border border-border bg-secondary">
          <Construction className="size-3.5" /> Under construction
        </span>
      </main>
    </>
  );
}
