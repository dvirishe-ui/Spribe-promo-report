import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

/**
 * Lightweight follow-up actions: what needs doing, who owns it, by when, and
 * which promo or operator it's about. Saved in this browser for now; the same
 * shape can move to a shared store once there is a backend.
 */

export type ActionStatus = "open" | "doing" | "done";

export interface FollowUp {
  id: string;
  title: string;
  owner: string;
  status: ActionStatus;
  /** YYYY-MM-DD or "" */
  due: string;
  promoId?: string;
  operator?: string;
  notes: string;
  createdAt: string;
}

const KEY = "spribe-report-actions-v1";

function load(): FollowUp[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

interface ActionsValue {
  actions: FollowUp[];
  add: (a: Omit<FollowUp, "id" | "createdAt" | "status"> & { status?: ActionStatus }) => FollowUp;
  update: (id: string, patch: Partial<FollowUp>) => void;
  remove: (id: string) => void;
  /** Panel visibility, so any page can open it */
  open: boolean;
  setOpen: (o: boolean) => void;
  /** Prefill for a new action, set by "Save as action" buttons */
  draft: Partial<FollowUp> | null;
  startDraft: (d: Partial<FollowUp>) => void;
  clearDraft: () => void;
}

const Ctx = createContext<ActionsValue | null>(null);

export function ActionsProvider({ children }: { children: ReactNode }) {
  const [actions, setActions] = useState<FollowUp[]>(load);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Partial<FollowUp> | null>(null);

  const persist = useCallback((fn: (a: FollowUp[]) => FollowUp[]) => {
    setActions((prev) => {
      const next = fn(prev);
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        // keep working in memory
      }
      return next;
    });
  }, []);

  const value: ActionsValue = {
    actions,
    add: (a) => {
      const item: FollowUp = {
        id: `a_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
        createdAt: new Date().toISOString(),
        status: a.status ?? "open",
        title: a.title,
        owner: a.owner,
        due: a.due,
        promoId: a.promoId,
        operator: a.operator,
        notes: a.notes,
      };
      persist((list) => [item, ...list]);
      return item;
    },
    update: (id, patch) => persist((list) => list.map((x) => (x.id === id ? { ...x, ...patch } : x))),
    remove: (id) => persist((list) => list.filter((x) => x.id !== id)),
    open,
    setOpen,
    draft,
    startDraft: (d) => {
      setDraft(d);
      setOpen(true);
    },
    clearDraft: () => setDraft(null),
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useActions() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useActions must be used within ActionsProvider");
  return ctx;
}
