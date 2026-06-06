import { useState } from "react";
import { Loader2, AlertTriangle, RefreshCw, Search, Terminal, Settings2, Trash2 } from "lucide-react";
import type { DockerContainerStub } from "@/lib/types";
import { useDockerContainers, useRemoveDockerContainer } from "@/lib/queries";
import type { DrawerTarget } from "../types";
import { CONTAINER_STATE_DOT, CONTAINER_STATE_TEXT, formatPorts, formatCreated } from "../utils/format";
import { ActionBtn } from "./row-actions";
import { LogDrawer } from "./log-drawer";
import { DetailsDrawer } from "./details-drawer";

function DockerContainerRow({
  container,
  slug,
  envId,
  onLogs,
  onDetails,
}: {
  container: DockerContainerStub;
  slug: string;
  envId: string;
  onLogs: () => void;
  onDetails: () => void;
}) {
  const state = container.state?.toLowerCase() ?? "";
  const dotCls = CONTAINER_STATE_DOT[state] ?? "bg-muted-foreground";
  const textCls = CONTAINER_STATE_TEXT[state] ?? "text-muted-foreground";
  const shortId = container.id.slice(0, 12);
  const imgTag = container.image.includes(":") ? container.image : `${container.image}:latest`;

  const [confirming, setConfirming] = useState(false);
  const remove = useRemoveDockerContainer();

  const handleDelete = () => {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    remove.mutate(
      { slug, envSlug: envId, id: container.id },
      { onSettled: () => setConfirming(false) },
    );
  };

  return (
    <tr className="border-b border-border hover:bg-accent/30 transition-colors">
      <td className="px-3 py-3">
        <div className="font-medium text-sm font-mono">{container.name.replace(/^\//, "")}</div>
        <div className="text-[11px] font-mono text-muted-foreground mt-0.5">{shortId}</div>
      </td>
      <td className="px-3 py-3 text-xs font-mono text-muted-foreground max-w-[200px]">
        <div className="truncate">{imgTag}</div>
      </td>
      <td className="px-3 py-3">
        <div className="flex items-center gap-1.5">
          <span className={`inline-block size-2 rounded-full shrink-0 ${dotCls}`} />
          <span className={`text-xs capitalize font-medium ${textCls}`}>{state || "—"}</span>
        </div>
      </td>
      <td className="px-3 py-3 text-xs text-muted-foreground">{container.status}</td>
      <td className="px-3 py-3 text-xs font-mono text-muted-foreground whitespace-nowrap">
        {formatPorts(container.ports)}
      </td>
      <td className="px-3 py-3 text-xs text-muted-foreground whitespace-nowrap">
        {formatCreated(container.created)}
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-0.5">
          <ActionBtn onClick={onLogs} icon={Terminal} label="View logs" />
          <ActionBtn onClick={onDetails} icon={Settings2} label="Details" />
          {confirming ? (
            <div className="flex items-center gap-1 ml-1">
              <button
                onClick={() => setConfirming(false)}
                className="text-[10px] px-1.5 py-0.5 rounded hover:bg-accent text-muted-foreground transition"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={remove.isPending}
                className="text-[10px] px-1.5 py-0.5 rounded bg-destructive/15 text-destructive hover:bg-destructive/25 transition flex items-center gap-1 disabled:opacity-60"
              >
                {remove.isPending && <Loader2 className="size-2.5 animate-spin" />}
                Confirm
              </button>
            </div>
          ) : (
            <ActionBtn onClick={handleDelete} icon={Trash2} label="Stop & remove" />
          )}
        </div>
      </td>
    </tr>
  );
}

export function DockerContainersListView({ slug, envId }: { slug: string; envId: string }) {
  const [search, setSearch] = useState("");
  const [logTarget, setLogTarget] = useState<DrawerTarget | null>(null);
  const [detailsTarget, setDetailsTarget] = useState<DrawerTarget | null>(null);

  const {
    data: containers = [],
    isLoading,
    isFetching,
    error,
    refetch,
    dataUpdatedAt,
  } = useDockerContainers(slug, envId, true);

  const filtered = search
    ? containers.filter(
        (c) =>
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          c.image.toLowerCase().includes(search.toLowerCase()) ||
          c.id.startsWith(search.toLowerCase()),
      )
    : containers;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search containers…"
            className="pl-8 pr-3 py-1.5 text-xs rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary/50 w-48"
          />
        </div>
        {!isLoading && (
          <span className="text-xs text-muted-foreground">
            {filtered.length}
            {filtered.length !== containers.length ? `/${containers.length}` : ""} container
            {containers.length !== 1 ? "s" : ""}
          </span>
        )}
        {dataUpdatedAt > 0 && !isLoading && (
          <span className="text-xs text-muted-foreground/60">
            · updated{" "}
            {new Date(dataUpdatedAt).toLocaleTimeString(undefined, {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })}
          </span>
        )}
        <div className="flex-1" />
        <button
          onClick={() => void refetch()}
          disabled={isFetching}
          className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md border border-border hover:bg-accent transition disabled:opacity-60"
        >
          <RefreshCw className={`size-3.5 ${isFetching ? "animate-spin" : ""}`} />
          {isFetching ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
          <Loader2 className="size-4 animate-spin" /> Loading containers…
        </div>
      )}
      {error && !isLoading && (
        <div className="flex items-center gap-2 text-sm text-destructive py-4">
          <AlertTriangle className="size-4" /> Failed to fetch containers from Docker
        </div>
      )}
      {!isLoading && !error && filtered.length === 0 && (
        <div className="py-16 text-center text-sm text-muted-foreground">
          {containers.length === 0 ? "No containers found." : "No containers match the search."}
        </div>
      )}
      {!isLoading && !error && filtered.length > 0 && (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/50">
                {["Container", "Image", "State", "Status", "Ports", "Created", ""].map((h) => (
                  <th
                    key={h}
                    className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-background">
              {filtered.map((c) => (
                <DockerContainerRow
                  key={c.id}
                  container={c}
                  slug={slug}
                  envId={envId}
                  onLogs={() => setLogTarget({ kind: "docker", container: c })}
                  onDetails={() => setDetailsTarget({ kind: "docker", container: c })}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {logTarget && (
        <LogDrawer
          slug={slug}
          envSlug={envId}
          target={logTarget}
          onClose={() => setLogTarget(null)}
        />
      )}
      {detailsTarget && (
        <DetailsDrawer target={detailsTarget} onClose={() => setDetailsTarget(null)} />
      )}
    </div>
  );
}
