import { createRouter, createRoute, createRootRoute, Outlet } from "@tanstack/react-router";
import { Landing } from "./pages/Landing";
import { Docs } from "./pages/Docs";

const rootRoute = createRootRoute({ component: Outlet });

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: Landing,
});

const docsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/docs",
  component: Docs,
});

const routeTree = rootRoute.addChildren([indexRoute, docsRoute]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
