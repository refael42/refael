"use client";
import { CheckCircle2, Phone, Plus, RotateCcw } from "lucide-react";
import { useState } from "react";
import { createBlockerAction, setBlockerStatusAction } from "@/app/actions/tasks";
import { Field } from "@/components/common/field";
import { useAction } from "@/components/common/use-action";
import { TaskPicker, type PickItem } from "@/components/tasks/task-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { fmtDate, t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export interface BlockerVM {
  id: string;
  title: string;
  owner: string | null;
  phone: string | null;
  status: "open" | "resolved";
  expected: string | null;
  blocksDirect: number;
  blocksTransitive: number;
  notes: string | null;
}

export function BlockersPanel({ blockers, canEdit, tasks }: { blockers: BlockerVM[]; canEdit: boolean; tasks: PickItem[] }) {
  const { call, pending } = useAction();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", owner_name: "", owner_phone: "", expected_date: "" });
  const [selected, setSelected] = useState<string[]>([]);

  async function create() {
    const ok = await call(
      () =>
        createBlockerAction(
          {
            title: form.title,
            owner_name: form.owner_name || null,
            owner_phone: form.owner_phone || null,
            expected_date: form.expected_date || null,
          },
          selected,
        ),
      t.app.saved,
    );
    if (ok !== null) {
      setOpen(false);
      setForm({ title: "", owner_name: "", owner_phone: "", expected_date: "" });
      setSelected([]);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {blockers.map((b) => (
        <div
          key={b.id}
          id={`blocker-${b.id}`}
          className={cn(
            "flex scroll-mt-20 flex-col gap-2 rounded-lg border p-3 target:ring-2 target:ring-state-blocked",
            b.status === "open" ? "border-state-blocked/40 bg-state-blocked/5" : "opacity-60",
          )}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex flex-col">
              <span className="font-medium">{b.title}</span>
              <span className="text-xs text-muted-foreground">
                {t.overview.owner}: {b.owner ?? t.app.unknown}
                {b.expected && ` · ${t.overview.expected}: ${fmtDate(b.expected)}`}
              </span>
            </div>
            <Badge variant={b.status === "open" ? "blocked" : "done"}>{b.status === "open" ? t.overview.open : t.overview.resolved}</Badge>
          </div>
          {b.notes && <p className="text-xs text-muted-foreground">{b.notes}</p>}
          <div className="flex flex-wrap items-center gap-2">
            {b.status === "open" && b.blocksTransitive > 0 && (
              <span className="text-sm font-medium text-state-blocked">{t.blocking.blocksCount(b.blocksDirect, b.blocksTransitive)}</span>
            )}
            <span className="flex-1" />
            {b.phone && (
              <Button asChild variant="outline" size="xs">
                <a href={`tel:${b.phone}`}>
                  <Phone />
                </a>
              </Button>
            )}
            {canEdit &&
              (b.status === "open" ? (
                <Button
                  size="xs"
                  variant="success"
                  disabled={pending}
                  onClick={() => call(() => setBlockerStatusAction(b.id, "resolved"), (n) => t.completion.releasedN(n))}
                >
                  <CheckCircle2 />
                  {t.overview.resolve}
                </Button>
              ) : (
                <Button size="xs" variant="outline" disabled={pending} onClick={() => call(() => setBlockerStatusAction(b.id, "open"), t.app.saved)}>
                  <RotateCcw />
                  {t.overview.reopen}
                </Button>
              ))}
          </div>
        </div>
      ))}
      {canEdit && (
        <Button variant="outline" onClick={() => setOpen(true)}>
          <Plus />
          {t.overview.addBlocker}
        </Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.overview.addBlocker}</DialogTitle>
          </DialogHeader>
          <Field label={t.overview.blockerTitle} htmlFor="bt">
            <Input id="bt" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t.overview.blockerOwner} htmlFor="bo">
              <Input id="bo" value={form.owner_name} onChange={(e) => setForm({ ...form, owner_name: e.target.value })} />
            </Field>
            <Field label={t.overview.blockerOwnerPhone} htmlFor="bp">
              <Input id="bp" dir="ltr" value={form.owner_phone} onChange={(e) => setForm({ ...form, owner_phone: e.target.value })} />
            </Field>
            <Field label={t.overview.blockerExpected} htmlFor="be">
              <Input id="be" type="date" value={form.expected_date} onChange={(e) => setForm({ ...form, expected_date: e.target.value })} />
            </Field>
          </div>
          <Field label={`${t.overview.blockerTasks} (${selected.length})`}>
            <TaskPicker
              items={tasks.map((x) => ({ ...x, label: selected.includes(x.value) ? `✓ ${x.label}` : x.label }))}
              value={null}
              onChange={(v) => setSelected((p) => (p.includes(v) ? p.filter((x) => x !== v) : [...p, v]))}
            />
          </Field>
          <DialogFooter>
            <Button disabled={pending || !form.title.trim()} onClick={create}>
              {t.app.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
