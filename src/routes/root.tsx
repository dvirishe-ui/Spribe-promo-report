import { Link, Outlet } from "@tanstack/react-router";
import { Toaster } from "sonner";
import { FlaskConical } from "lucide-react";
import { AppHeader } from "@/components/report/AppHeader";
import { ConfirmProvider } from "@/components/report/Confirm";
import { DataProvider, useData } from "@/lib/store";
import { ThemeProvider, useTheme } from "@/lib/theme";

function AppToaster() {
  const { theme } = useTheme();
  return (
    <Toaster
      theme={theme}
      toastOptions={{
        style: {
          background: "var(--color-surface-raised)",
          color: "var(--color-foreground)",
          border: "1px solid var(--color-border)",
        },
      }}
    />
  );
}

function SampleBanner() {
  const { hasSample, editable, removeSample } = useData();
  if (!hasSample || !editable) return null;
  return (
    <div className="no-print border-b border-accent/30 bg-accent/10">
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-2 px-4 py-2 text-xs lg:px-8">
        <p className="flex items-center gap-2">
          <FlaskConical className="size-3.5 text-accent" />
          <span>
            <strong className="font-semibold">Sample numbers.</strong> Everything you see is placeholder data so the
            charts have something to draw. Put in your real numbers on the{" "}
            <Link to="/data" className="text-primary underline-offset-2 hover:underline">
              Data page
            </Link>{" "}
            or{" "}
            <Link to="/connect" className="text-primary underline-offset-2 hover:underline">
              connect the backoffice
            </Link>
            .
          </span>
        </p>
        <button onClick={removeSample} className="rounded-md border border-border px-2 py-1 hover:bg-surface-raised">
          Remove sample data
        </button>
      </div>
    </div>
  );
}

export function RootLayout() {
  return (
    <ThemeProvider>
      <DataProvider>
        <ConfirmProvider>
          <div className="flex min-h-screen flex-col">
            <AppHeader />
            <SampleBanner />
            <div className="flex-1">
              <Outlet />
            </div>
            <footer className="no-print border-t border-border px-4 py-5 text-center text-xs text-muted-foreground lg:px-8">
              SPRIBE Promo Performance Report · internal tool · numbers stay in your browser unless a data source is connected
            </footer>
            <AppToaster />
          </div>
        </ConfirmProvider>
      </DataProvider>
    </ThemeProvider>
  );
}
