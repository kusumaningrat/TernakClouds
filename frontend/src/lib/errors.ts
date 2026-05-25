import type { ApiError } from './api';

export interface FriendlyError {
  title: string;
  description: string;
}

export function friendlyError(error: ApiError | Error | null | undefined): FriendlyError {
  if (!error) return { title: "Something went wrong", description: "An unexpected error occurred." };

  const status = (error as ApiError).status;

  switch (status) {
    case 401:
      return {
        title: "Session expired",
        description: "Your session has expired. Please sign in again.",
      };
    case 403:
      return {
        title: "Access denied",
        description: "You don't have permission to view this. Contact your workspace admin.",
      };
    case 404:
      return {
        title: "Not found",
        description: "The requested resource does not exist.",
      };
    case 503:
      return {
        title: "Provider not configured",
        description: "A required provider is not set up for this environment.",
      };
    case 500:
    case 502:
      return {
        title: "Server error",
        description: "Something went wrong on our end. Please try again.",
      };
    default:
      if (!status) {
        return {
          title: "Connection error",
          description: "Unable to reach the server. Check your network connection.",
        };
      }
      return {
        title: "Request failed",
        description: error.message || "An unexpected error occurred.",
      };
  }
}
