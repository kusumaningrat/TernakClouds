import { Loader2 } from "lucide-react";
import type { NomadAllocationStub } from "@/lib/types";
import { formatTime, ALLOC_DOT, ALLOC_TEXT } from "../utils/status";

export function AllocationsSection({
  allocs,
  isLoading,
}: {
  allocs: NomadAllocationStub[];
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
        <Loader2 className="size-4 animate-spin" /> Loading allocations…
      </div>
    );
  }
  if (allocs.length === 0) {
    return <p className="text-sm text-muted-foreground py-4">No allocations found.</p>;
  }

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-secondary/50">
            {["Alloc ID", "Status", "Task Group", "Node", "Created"].map((h) => (
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
          {allocs.map((alloc) => {
            const dot = ALLOC_DOT[alloc.ClientStatus] ?? "bg-muted-foreground";
            const text = ALLOC_TEXT[alloc.ClientStatus] ?? "text-muted-foreground";
            return (
              <tr
                key={alloc.ID}
                className="border-b border-border last:border-0 hover:bg-accent/20 transition"
              >
                <td className="px-3 py-2.5 font-mono text-xs">{alloc.ID.slice(0, 8)}</td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-1.5">
                    <span className={`size-1.5 rounded-full shrink-0 ${dot}`} />
                    <span className={`text-xs capitalize font-medium ${text}`}>
                      {alloc.ClientStatus}
                    </span>
                  </div>
                </td>
                <td className="px-3 py-2.5 text-xs font-mono text-muted-foreground">
                  {alloc.TaskGroup}
                </td>
                <td className="px-3 py-2.5 text-xs text-muted-foreground">
                  {alloc.NodeName || "—"}
                </td>
                <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                  {formatTime(alloc.CreateTime)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
