import { toast } from "sonner";
import type { ExternalToast } from "sonner";

/**
 * Extracts a human-readable message from an unknown caught error.
 * Falls back to `fallback` when the value is not an Error instance.
 */
export function extractError(err: unknown, fallback = "An error occurred"): string {
  return err instanceof Error ? err.message : fallback;
}

/**
 * Shows a toast.error with a longer duration (6 s) so users have time to read it.
 * Accepts the same options as toast.error.
 */
export function toastError(message: string, opts?: ExternalToast): void {
  toast.error(message, { duration: 6000, ...opts });
}
