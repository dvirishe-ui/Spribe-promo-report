import { createHashHistory, createRootRoute, createRoute, createRouter } from "@tanstack/react-router";
import { RootLayout } from "@/routes/root";
import { DashboardPage } from "@/routes/dashboard";
import { PromoReportPage } from "@/routes/promo-report";
import { DataPage } from "@/routes/data";
import { NotFoundPage } from "@/routes/not-found";
import { SharePage } from "@/routes/share";

const rootRoute = createRootRoute({
  component: RootLayout,
  notFoundComponent: NotFoundPage,
});

const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
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

const shareRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/share/$promoId",
  component: SharePage,
});

const routeTree = rootRoute.addChildren([shareRoute, dashboardRoute, promoRoute, dataRoute]);

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
