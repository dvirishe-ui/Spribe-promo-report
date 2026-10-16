import { createHashHistory, createRootRoute, createRoute, createRouter } from "@tanstack/react-router";
import { RootLayout } from "@/routes/root";
import { OverviewPage } from "@/routes/overview";
import { PromotionsPage } from "@/routes/promotions";
import { PromoReportPage } from "@/routes/promo-report";
import { OperatorProfilePage, OperatorsPage } from "@/routes/operators";
import { InsightsPage } from "@/routes/insights";
import { CalendarPage } from "@/routes/calendar";
import { DataPage } from "@/routes/data";
import { NotFoundPage } from "@/routes/not-found";
import { SharePage, SharedOperatorPage } from "@/routes/share";

const rootRoute = createRootRoute({
  component: RootLayout,
  notFoundComponent: NotFoundPage,
});

const str = (v: unknown) => (typeof v === "string" && v ? v : undefined);
const int = (v: unknown) => {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isInteger(n) && n > 0 ? n : undefined;
};

const overviewRoute = createRoute({ getParentRoute: () => rootRoute, path: "/", component: OverviewPage });
const promotionsRoute = createRoute({ getParentRoute: () => rootRoute, path: "/promotions", component: PromotionsPage });
const promoRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/promo/$promoId",
  // ?tab=missions&day=6 — lets insights link straight to the evidence.
  validateSearch: (s: Record<string, unknown>): { tab?: string; day?: number } => ({ tab: str(s.tab), day: int(s.day) }),
  component: PromoReportPage,
});
const operatorsRoute = createRoute({ getParentRoute: () => rootRoute, path: "/operators", component: OperatorsPage });
const operatorRoute = createRoute({ getParentRoute: () => rootRoute, path: "/operators/$operator", component: OperatorProfilePage });
const insightsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/insights",
  validateSearch: (s: Record<string, unknown>): { tab?: string; ids?: string } => ({ tab: str(s.tab), ids: str(s.ids) }),
  component: InsightsPage,
});
const calendarRoute = createRoute({ getParentRoute: () => rootRoute, path: "/calendar", component: CalendarPage });
const dataRoute = createRoute({ getParentRoute: () => rootRoute, path: "/data", component: DataPage });
const shareRoute = createRoute({ getParentRoute: () => rootRoute, path: "/share/$promoId", component: SharePage });
const shareOperatorRoute = createRoute({ getParentRoute: () => rootRoute, path: "/share/operator/$operator", component: SharedOperatorPage });

const routeTree = rootRoute.addChildren([
  overviewRoute,
  promotionsRoute,
  promoRoute,
  operatorsRoute,
  operatorRoute,
  insightsRoute,
  calendarRoute,
  dataRoute,
  shareOperatorRoute,
  shareRoute,
]);

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
