import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { ApiError } from "./lib/api";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Don't retry when the server says "no provider configured" (503)
        // or any other definitive client/server error — retrying just spams the console.
        retry: (failureCount, error) => {
          if (
            error instanceof ApiError &&
            (error.status === 503 || error.status === 404 || error.status === 403)
          ) {
            return false;
          }
          return failureCount < 2;
        },
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
