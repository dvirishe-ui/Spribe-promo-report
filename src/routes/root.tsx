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
    <div className="no-print border-b border-border bg-surface-raised/60">
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-2 px-4 py-1.5 text-xs text-muted-foreground lg:px-8">
        <p className="flex items-center gap-2">
          <FlaskConical className="size-3.5" />
          These are example numbers.{" "}
          <Link to="/data" className="text-primary hover:underline">
            Enter your own
          </Link>
        </p>
        <button onClick={removeSample} className="hover:text-foreground hover:underline">
          Clear examples
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
              SPRIBE Promo Reports
            </footer>
            <AppToaster />
          </div>
        </ConfirmProvider>
      </DataProvider>
    </ThemeProvider>
  );
}
