import { createHashHistory, createRootRoute, createRoute, createRouter, redirect } from "@tanstack/react-router";
import { RootLayout } from "@/routes/root";
import { OverviewPage } from "@/routes/overview";
import { PromoReportPage } from "@/routes/promo-report";
import { ExplorePage } from "@/routes/explore";
import { CalendarPage } from "@/routes/calendar";
import { DataPage } from "@/routes/data";
import { NotFoundPage } from "@/routes/not-found";

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
const exploreRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/explore",
  // ?tab=compare|rank|missions|library|alerts (promotions when absent)
  validateSearch: (s: Record<string, unknown>): { tab?: string } => ({ tab: str(s.tab) }),
  component: ExplorePage,
});
// Old addresses keep working: Promotions and Insights now live in Explore.
const promotionsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/promotions",
  beforeLoad: () => {
    throw redirect({ to: "/explore", replace: true });
  },
});
const promoRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/promo/$promoId",
  // ?tab=missions&day=6 — lets insights link straight to the evidence.
  validateSearch: (s: Record<string, unknown>): { tab?: string; day?: number } => ({ tab: str(s.tab), day: int(s.day) }),
  component: PromoReportPage,
});
const insightsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/insights",
  validateSearch: (s: Record<string, unknown>): { tab?: string } => ({ tab: str(s.tab) }),
  beforeLoad: ({ search }) => {
    throw redirect({ to: "/explore", search: { tab: search.tab ?? "alerts" }, replace: true });
  },
});
const calendarRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/calendar",
  // ?view=list&month=2026-09&open=c:spribe-adventure-2026 — open an entry from elsewhere.
  validateSearch: (s: Record<string, unknown>): { view?: string; month?: string; week?: string; open?: string } => ({
    view: str(s.view),
    month: str(s.month),
    week: str(s.week),
    open: str(s.open),
  }),
  component: CalendarPage,
});
const dataRoute = createRoute({ getParentRoute: () => rootRoute, path: "/data", component: DataPage });

const routeTree = rootRoute.addChildren([
  overviewRoute,
  exploreRoute,
  promotionsRoute,
  promoRoute,
  insightsRoute,
  calendarRoute,
  dataRoute,
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
