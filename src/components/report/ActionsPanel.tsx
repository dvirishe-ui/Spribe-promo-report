import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useActions, type ActionStatus, type FollowUp } from "@/lib/actions";
import { useData } from "@/lib/store";
import { formatDay, todayIso } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { inputCls } from "./bits";

const STATUS: Array<{ v: ActionStatus; label: string }> = [
  { v: "open", label: "Open" },
  { v: "doing", label: "In progress" },
  { v: "done", label: "Done" },
];

/**
 * The follow-up list: a title, an owner, a due date, a link to the promo or
 * operator it's about, and notes. Deliberately small — not a project tool.
 */
export function ActionsPanel() {
  const { actions, add, update, remove, open, setOpen, draft, clearDraft } = useActions();
  const { metrics } = useData();
  const [form, setForm] = useState<Partial<FollowUp> | null>(null);
  const [filter, setFilter] = useState<"active" | "done">("active");

  useEffect(() => {
    if (draft) {
      setForm({ owner: "", due: "", notes: "", ...draft });
      clearDraft();
    }
  }, [draft, clearDraft]);

  const shown = actions.filter((a) => (filter === "done" ? a.status === "done" : a.status !== "done"));
  const promoName = (id?: string) => metrics.find((m) => m.promo.id === id)?.promo.name;
  const today = todayIso();

  const save = () => {
    if (!form?.title?.trim()) return toast.error("Give the action a title");
    add({ title: form.title.trim(), owner: form.owner ?? "", due: form.due ?? "", promoId: form.promoId, operator: form.operator, notes: form.notes ?? "" });
    setForm(null);
    toast.success("Action saved");
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent aria-describedby={undefined} className="flex w-full flex-col border-border bg-background p-0 sm:max-w-md">
        <div className="border-b border-border px-5 py-4">
          <SheetTitle className="font-display text-lg font-semibold">Follow-up actions</SheetTitle>
          <p className="text-xs text-muted-foreground">Saved from insights and promo reports. Stored in this browser.</p>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {form ? (
            <div className="space-y-2.5 rounded-xl border border-primary/40 bg-primary/5 p-3">
              <input className={inputCls} placeholder="What needs doing?" value={form.title ?? ""} onChange={(e) => setForm({ ...form, title: e.target.value })} autoFocus />
              <div className="grid grid-cols-2 gap-2">
                <input className={inputCls} placeholder="Owner" value={form.owner ?? ""} onChange={(e) => setForm({ ...form, owner: e.target.value })} />
                <input type="date" className={inputCls} aria-label="Due date" value={form.due ?? ""} onChange={(e) => setForm({ ...form, due: e.target.value })} />
              </div>
              <select className={inputCls} aria-label="Linked promotion" value={form.promoId ?? ""} onChange={(e) => {
                const m = metrics.find((x) => x.promo.id === e.target.value);
                setForm({ ...form, promoId: e.target.value || undefined, operator: m?.promo.operator ?? form.operator });
              }}>
                <option value="">No linked promotion</option>
                {[...metrics].sort((a, b) => b.promo.startDate.localeCompare(a.promo.startDate)).map((m) => (
                  <option key={m.promo.id} value={m.promo.id}>
                    {m.promo.name} · {m.promo.operator}
                  </option>
                ))}
              </select>
              <textarea className={cn(inputCls, "h-16 resize-y py-2")} placeholder="Notes" value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => setForm(null)}>
                  Cancel
                </Button>
                <Button size="sm" onClick={save}>
                  Save action
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="outline" className="w-full" onClick={() => setForm({ owner: "", due: "", notes: "" })}>
              <Plus className="size-4" /> New action
            </Button>
          )}

          <div className="flex gap-1 text-xs">
            {(["active", "done"] as const).map((f) => (
              <button key={f} onClick={() => setFilter(f)} className={cn("rounded-md px-2.5 py-1", filter === f ? "bg-surface-raised font-medium" : "text-muted-foreground")}>
                {f === "active" ? `Open (${actions.filter((a) => a.status !== "done").length})` : `Done (${actions.filter((a) => a.status === "done").length})`}
              </button>
            ))}
          </div>

          {shown.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {filter === "active" ? "No open actions. Use “Save as action” on an insight or in a report." : "Nothing done yet."}
            </p>
          ) : (
            <ul className="space-y-2">
              {shown.map((a) => {
                const overdue = a.due && a.due < today && a.status !== "done";
                return (
                  <li key={a.id} className="rounded-xl border border-border bg-surface p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className={cn("text-sm font-medium", a.status === "done" && "text-muted-foreground line-through")}>{a.title}</p>
                      <button aria-label="Delete action" onClick={() => remove(a.id)} className="text-muted-foreground hover:text-bad-ink">
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                      {a.owner && <span>{a.owner}</span>}
                      {a.due && <span className={cn(overdue && "font-medium text-bad-ink")}>{overdue ? "Overdue · " : "Due "}{formatDay(a.due, true)}</span>}
                      {a.promoId && promoName(a.promoId) && (
                        <Link to="/promo/$promoId" params={{ promoId: a.promoId }} onClick={() => setOpen(false)} className="text-primary hover:underline">
                          {promoName(a.promoId)}
                        </Link>
                      )}
                      {!a.promoId && a.operator && <span>{a.operator}</span>}
                    </div>
                    {a.notes && <p className="mt-1.5 text-xs text-muted-foreground">{a.notes}</p>}
                    <div className="mt-2 flex gap-1">
                      {STATUS.map((st) => (
                        <button
                          key={st.v}
                          onClick={() => update(a.id, { status: st.v })}
                          className={cn("rounded-full border px-2 py-0.5 text-[11px]", a.status === st.v ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:text-foreground")}
                        >
                          {st.label}
                        </button>
                      ))}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
