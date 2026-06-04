import { Link } from "@tanstack/react-router";
import { CheckCircle2, Circle, ChevronRight, X } from "lucide-react";
import { useState } from "react";

interface ChecklistItem {
  id: string;
  label: string;
  done: boolean;
  link?: string;
}

interface GettingStartedChecklistProps {
  items: ChecklistItem[];
}

export function GettingStartedChecklist({ items }: GettingStartedChecklistProps) {
  const [dismissed, setDismissed] = useState(false);

  const doneCount = items.filter((i) => i.done).length;
  const allDone = doneCount === items.length;

  if (dismissed || allDone) return null;

  const pct = Math.round((doneCount / items.length) * 100);

  return (
    <div className="glass rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">Getting started</h3>
          <span className="text-[10px] label-mono text-muted-foreground">
            {doneCount}/{items.length}
          </span>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="p-1 rounded hover:bg-accent transition text-muted-foreground"
          title="Dismiss"
        >
          <X className="size-3.5" />
        </button>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-secondary">
        <div
          className="h-full bg-primary transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Items */}
      <div className="divide-y divide-border">
        {items.map((item) => (
          <div
            key={item.id}
            className={`flex items-center gap-3 px-4 py-2.5 ${
              item.done ? "opacity-50" : ""
            }`}
          >
            {item.done ? (
              <CheckCircle2 className="size-3.5 text-success shrink-0" />
            ) : (
              <Circle className="size-3.5 text-muted-foreground/40 shrink-0" />
            )}
            <span className={`text-xs flex-1 ${item.done ? "line-through text-muted-foreground" : "text-foreground"}`}>
              {item.label}
            </span>
            {!item.done && item.link && (
              <Link
                to={item.link as never}
                className="text-[10px] label-mono text-primary hover:underline shrink-0"
              >
                DO IT <ChevronRight className="size-2.5 inline" />
              </Link>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
