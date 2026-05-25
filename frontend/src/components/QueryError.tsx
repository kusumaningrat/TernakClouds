import { AlertCircle, ShieldOff, ServerCrash, WifiOff } from "lucide-react";
import { friendlyError } from "@/lib/errors";
import type { ApiError } from "@/lib/api";

const STATUS_ICON: Record<number, React.ElementType> = {
  403: ShieldOff,
  401: ShieldOff,
  503: ServerCrash,
  500: ServerCrash,
  502: ServerCrash,
};

export function QueryError({
  error,
  className = "",
}: {
  error: ApiError | Error | null | undefined;
  className?: string;
}) {
  const { title, description } = friendlyError(error);
  const status = (error as ApiError)?.status;
  const Icon = STATUS_ICON[status] ?? (status ? AlertCircle : WifiOff);

  return (
    <div className={`flex items-start gap-3 rounded-lg bg-destructive/8 border border-destructive/20 px-4 py-3 text-sm ${className}`}>
      <Icon className="size-4 text-destructive shrink-0 mt-0.5" />
      <div>
        <div className="font-medium text-destructive">{title}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{description}</div>
      </div>
    </div>
  );
}

// Inline variant — just the icon + single line, no card background.
export function QueryErrorInline({
  error,
}: {
  error: ApiError | Error | null | undefined;
}) {
  const { title } = friendlyError(error);
  const status = (error as ApiError)?.status;
  const Icon = STATUS_ICON[status] ?? AlertCircle;

  return (
    <span className="inline-flex items-center gap-1.5 text-destructive text-sm">
      <Icon className="size-4 shrink-0" />
      {title}
    </span>
  );
}
