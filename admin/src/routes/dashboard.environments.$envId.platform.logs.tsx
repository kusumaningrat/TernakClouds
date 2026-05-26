import { createFileRoute, useParams } from "@tanstack/react-router";
import { CapabilityPage } from "@/components/CapabilityPage";
import { useWorkspaceContext } from "@/lib/workspace-context";
import { useCapabilities, useCapability } from "@/lib/queries";
import { ScrollText } from "lucide-react";

export const Route = createFileRoute("/dashboard/environments/$envId/platform/logs")({
  head: () => ({ meta: [{ title: "Logs · TernakClouds" }] }),
  component: LogsCapabilityPage,
});

function LogProvidersInfo({ slug, envId, capName }: { slug: string; envId: string; capName: string }) {
  const { data: status } = useCapability(slug, envId, capName);
  const providers = status?.providers ?? [];
  if (providers.length === 0) return null;

  return (
    <section className="px-6 pb-8">
      <div className="border-t border-border pt-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="size-7 rounded-md bg-secondary grid place-items-center shrink-0">
            <ScrollText className="size-3.5 text-muted-foreground" />
          </div>
          <div>
            <h2 className="font-semibold text-sm">Connected Log Providers</h2>
            <p className="text-xs text-muted-foreground">
              These backends are available for log aggregation in this environment.
            </p>
          </div>
        </div>
        <div className="space-y-3">
          {providers.map((p) => (
            <div key={p.id} className="rounded-lg border border-border bg-background/50 p-4 space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-xs w-20 shrink-0">Provider</span>
                <span className="text-xs font-medium">{p.display_name || p.provider_name}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-xs w-20 shrink-0">Endpoint</span>
                <span className="font-mono text-xs truncate">{p.endpoint}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-xs w-20 shrink-0">Auth</span>
                <span className="text-xs capitalize">{p.credential_type}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function LogsCapabilityPage() {
  const { envId } = useParams({ from: "/dashboard/environments/$envId/platform/logs" });
  const { selectedWorkspace } = useWorkspaceContext();
  const slug = selectedWorkspace?.slug ?? "";
  const { data: capabilities } = useCapabilities(slug, envId);
  const hasLogsCapability = (capabilities ?? []).some((c) => c.capability_name === "logs");
  const capName = hasLogsCapability ? "logs" : "observability";

  return (
    <CapabilityPage
      envId={envId}
      capName={capName}
      title="Logs"
      subtitle={
        hasLogsCapability
          ? "Centralized log aggregation and streaming — Loki, OpenSearch, Elasticsearch."
          : "Compatibility mode: backend does not expose a dedicated logs capability yet."
      }
      endpointPlaceholders={{
        prometheus: "https://prometheus.internal:9090",
        loki: "https://loki.internal:3100",
        opensearch: "https://opensearch.internal:9200",
        elasticsearch: "https://elasticsearch.internal:9200",
      }}
      extraContent={slug ? <LogProvidersInfo slug={slug} envId={envId} capName={capName} /> : null}
    />
  );
}
