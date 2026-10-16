import { Link } from "@tanstack/react-router";
import { SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/report/bits";

export function NotFoundPage() {
  return (
    <main className="mx-auto max-w-[1400px] px-4 py-16 lg:px-8">
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
