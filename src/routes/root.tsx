import { Link, Outlet } from "@tanstack/react-router";
import { Toaster } from "sonner";
import { FlaskConical } from "lucide-react";
import { AppHeader } from "@/components/report/AppHeader";
import { ConfirmProvider } from "@/components/report/Confirm";
import { DefinitionsDialog } from "@/components/report/DefinitionsDialog";
import { SelectionBar } from "@/components/report/SelectionBar";
import { ViewProvider } from "@/lib/view";
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

function AccessBanner() {
  const { accessOperator, setAccessOperator } = useData();
  if (!accessOperator) return null;
  return (
    <div className="no-print border-b border-primary/30 bg-primary/10">
      <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-2 px-4 py-1.5 text-xs lg:px-8">
        <p>
          <strong className="font-semibold">Viewing as {accessOperator}.</strong> Other operators are hidden — this previews an operator-restricted login.
        </p>
        <button onClick={() => setAccessOperator(null)} className="text-primary hover:underline">
          Back to internal view
        </button>
      </div>
    </div>
  );
}

function SampleBanner() {
  const { hasSample, editable, removeSample } = useData();
  if (!hasSample || !editable) return null;
  return (
    <div className="no-print border-b border-border bg-surface-raised/60">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-2 px-4 py-1.5 text-xs text-muted-foreground lg:px-8">
        <p className="flex items-center gap-2">
          <FlaskConical className="size-3.5" />
          <span>
            <strong className="font-semibold text-foreground">Demo data.</strong> Every promo, operator, aggregator and number here is
            fictional.{" "}
            <Link to="/data" className="text-primary hover:underline">
              Add real data
            </Link>
          </span>
        </p>
        <button onClick={removeSample} className="hover:text-foreground hover:underline">
          Clear demo data
        </button>
      </div>
    </div>
  );
}

export function RootLayout() {
  return (
    <ThemeProvider>
      <DataProvider>
        <ViewProvider>
        <ConfirmProvider>
          <div className="flex min-h-screen flex-col">
            <AppHeader />
            <AccessBanner />
            <SampleBanner />
            <div className="flex-1">
              <Outlet />
            </div>
            <footer className="no-print flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-t border-border px-4 pb-16 pt-5 text-center text-xs text-muted-foreground lg:px-8">
              <span>SPRIBE Promo Reports · aggregate data only, no individual players</span>
              <DefinitionsDialog>
                <button className="text-primary hover:underline">How numbers are calculated</button>
              </DefinitionsDialog>
            </footer>
            <AppToaster />
            <SelectionBar />
          </div>
        </ConfirmProvider>
        </ViewProvider>
      </DataProvider>
    </ThemeProvider>
  );
}
