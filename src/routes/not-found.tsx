import { Link, useRouter, type ErrorComponentProps } from "@tanstack/react-router";
import { RotateCcw, SearchX, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/report/bits";

export function NotFoundPage() {
  return (
    <main className="mx-auto max-w-[1600px] px-4 py-16 lg:px-8">
      <EmptyState icon={SearchX} title="Nothing here">
        That page or promo doesn't exist — it may have been deleted or renamed.
        <div className="mt-4">
          <Button asChild>
            <Link to="/">Back to the dashboard</Link>
          </Button>
        </div>
      </EmptyState>
    </main>
  );
}

/** Shown when a page fails to draw: a way back instead of a dead end. */
export function RouteErrorPage({ error, reset }: ErrorComponentProps) {
  const router = useRouter();
  return (
    <main className="mx-auto max-w-[1600px] px-4 py-16 lg:px-8">
      <EmptyState icon={TriangleAlert} title="This page couldn't load">
        Something in this view failed to draw. Your data is safe — try again, or go back to the overview.
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <Button
            onClick={() => {
              reset();
              void router.invalidate();
            }}
          >
            <RotateCcw className="size-4" /> Try again
          </Button>
          <Button asChild variant="outline">
            <Link to="/">Back to the overview</Link>
          </Button>
        </div>
        {error instanceof Error && error.message && <p className="mt-4 text-[11px] text-muted-foreground">Details: {error.message}</p>}
      </EmptyState>
    </main>
  );
}
