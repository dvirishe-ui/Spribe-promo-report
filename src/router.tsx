import { createHashHistory, createRootRoute, createRoute, createRouter } from "@tanstack/react-router";
import { RootLayout } from "@/routes/root";
import { DashboardPage } from "@/routes/dashboard";
import { PromoReportPage } from "@/routes/promo-report";
import { DataPage } from "@/routes/data";
import { ConnectPage } from "@/routes/connect";
import { NotFoundPage } from "@/routes/not-found";

const rootRoute = createRootRoute({
  component: RootLayout,
  notFoundComponent: NotFoundPage,
});

const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  validateSearch: (s: Record<string, unknown>): { period?: string } =>
    typeof s.period === "string" ? { period: s.period } : {},
  component: DashboardPage,
});

const promoRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/promo/$promoId",
  component: PromoReportPage,
});

const dataRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/data",
  component: DataPage,
});

const connectRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/connect",
  component: ConnectPage,
});

const routeTree = rootRoute.addChildren([dashboardRoute, promoRoute, dataRoute, connectRoute]);

export const router = createRouter({
  routeTree,
  defaultNotFoundComponent: NotFoundPage,
  // Hash history: every route works from a single static file, no server rewrites needed.
  history: createHashHistory(),
  scrollRestoration: true,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
