"use client";
import { GitCompare, History, Pencil } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { updatePlanAction } from "@/app/actions/plans";
import { Field, OptionSelect, type Option } from "@/components/common/field";
import { useAction } from "@/components/common/use-action";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/misc";
import type { PlanDiscipline } from "@/lib/db/types";
import { fmtDate, t } from "@/lib/i18n";
import { UploadPlan } from "./upload-plan";

export interface PlanInfoVM {
  id: string;
  title: string;
  discipline: PlanDiscipline | null;
  sheet: string | null;
  revision: string | null;
  version: number;
  isCurrent: boolean;
  currentId: string | null;
  previousId: string | null;
  changeNote: string | null;
  areaIds: string[];
  createdAt: string;
  versions: Array<{ id: string; version: number; revision: string | null; createdAt: string; isCurrent: boolean }>;
}

const DISCIPLINES: PlanDiscipline[] = ["architecture", "structure", "electrical", "plumbing", "hvac", "fire", "landscape", "other"];

/** The plan's title bar: what it is, which version, its history, and (for the PM) editing and a new version. */
export function PlanDetails({ plan, areas, canEdit }: { plan: PlanInfoVM; areas: Option[]; canEdit: boolean }) {
  const [open, setOpen] = useState(false);
  const areaName = useMemo(() => new Map(areas.map((a) => [a.value, a.label])), [areas]);
  const named = plan.areaIds.map((id) => areaName.get(id)).filter(Boolean) as string[];
  return (
    <div className="flex shrink-0 flex-col gap-2 border-b p-3">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-lg font-bold">{plan.title}</h1>
        {plan.discipline && <Badge variant="secondary">{t.plans.disciplines[plan.discipline]}</Badge>}
        {plan.sheet && <Badge variant="outline">{`${t.plans.sheet} ${plan.sheet}`}</Badge>}
        {plan.revision && <Badge variant="outline">{`${t.plans.revision} ${plan.revision}`}</Badge>}
        <Badge variant={plan.isCurrent ? "default" : "destructive"}>
          {t.plans.version(plan.version)} · {plan.isCurrent ? t.plans.current : t.plans.old}
        </Badge>
      </div>
      {!plan.isCurrent && plan.currentId && (
        <p className="text-sm text-destructive">
          {t.plans.oldHint} ·{" "}
          <Link href={`/plans/${plan.currentId}`} className="font-medium underline">
            {t.plans.goCurrent}
          </Link>
        </p>
      )}
      {plan.changeNote && <p className="text-sm text-muted-foreground">{plan.changeNote}</p>}
      {named.length > 0 && <p className="truncate text-xs text-muted-foreground">{named.join(" · ")}</p>}
      <div className="flex flex-wrap items-center gap-2">
        {plan.previousId && (
          <Button asChild size="sm" variant="outline">
            <Link href={`/plans/${plan.id}/compare`}>
              <GitCompare />
              {t.plans.compare}
            </Link>
          </Button>
        )}
        {plan.versions.length > 1 && (
          <details className="relative">
            <summary className="flex cursor-pointer list-none items-center gap-1 rounded-md border px-3 py-1.5 text-sm">
              <History className="h-4 w-4" />
              {t.plans.versions} ({plan.versions.length})
            </summary>
            <div className="absolute z-20 mt-1 flex min-w-56 flex-col rounded-md border bg-background p-1 shadow-md">
              {plan.versions.map((v) => (
                <Link key={v.id} href={`/plans/${v.id}`} className={`rounded px-2 py-1.5 text-sm hover:bg-accent ${v.id === plan.id ? "font-bold" : ""}`}>
                  {t.plans.version(v.version)}
                  {v.revision ? ` · ${t.plans.revision} ${v.revision}` : ""} · <span className="num">{fmtDate(v.createdAt)}</span>
                  {v.isCurrent ? ` · ${t.plans.current}` : ""}
                </Link>
              ))}
            </div>
          </details>
        )}
        {canEdit && plan.isCurrent && <UploadPlan supersedesId={plan.id} />}
        {canEdit && (
          <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
            <Pencil />
            {t.plans.editDetails}
          </Button>
        )}
      </div>
      {canEdit && <EditDialog plan={plan} areas={areas} open={open} onOpenChange={setOpen} />}
    </div>
  );
}

function EditDialog({ plan, areas, open, onOpenChange }: { plan: PlanInfoVM; areas: Option[]; open: boolean; onOpenChange: (v: boolean) => void }) {
  const [title, setTitle] = useState(plan.title);
  const [discipline, setDiscipline] = useState<string | null>(plan.discipline);
  const [sheet, setSheet] = useState(plan.sheet ?? "");
  const [revision, setRevision] = useState(plan.revision ?? "");
  const [note, setNote] = useState(plan.changeNote ?? "");
  const [picked, setPicked] = useState<Set<string>>(new Set(plan.areaIds));
  const [filter, setFilter] = useState("");
  const { call, pending } = useAction();
  const shown = areas.filter((a) => !filter || a.label.includes(filter));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.plans.editDetails}</DialogTitle>
        </DialogHeader>
        <Field label={t.plans.uploadTitle}>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field label={t.plans.discipline}>
          <OptionSelect value={discipline} onChange={setDiscipline} options={DISCIPLINES.map((d) => ({ value: d, label: t.plans.disciplines[d] }))} noneLabel={t.app.none} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t.plans.sheet}>
            <Input value={sheet} onChange={(e) => setSheet(e.target.value)} dir="ltr" />
          </Field>
          <Field label={t.plans.revision}>
            <Input value={revision} onChange={(e) => setRevision(e.target.value)} />
          </Field>
        </div>
        <Field label={t.plans.changeNote}>
          <Input value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">{t.plans.areas}</span>
          <DialogDescription className="text-xs">{t.plans.areasHint}</DialogDescription>
          <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="דירה 12" className="h-8" />
          <div className="grid max-h-48 grid-cols-2 gap-1 overflow-y-auto rounded-md border p-2 sm:grid-cols-3">
            {shown.map((a) => (
              <label key={a.value} className="flex items-center gap-1.5 text-sm">
                <Checkbox
                  checked={picked.has(a.value)}
                  onCheckedChange={(v) =>
                    setPicked((p) => {
                      const n = new Set(p);
                      if (v) n.add(a.value);
                      else n.delete(a.value);
                      return n;
                    })
                  }
                />
                <span className="truncate">{a.label}</span>
              </label>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button
            disabled={pending || !title.trim()}
            onClick={async () => {
              const ok = await call(
                () =>
                  updatePlanAction(plan.id, {
                    title,
                    discipline: (discipline as PlanDiscipline | null) ?? null,
                    sheet,
                    revision,
                    changeNote: note,
                    areaIds: [...picked],
                  }),
                t.app.saved,
              );
              if (ok !== null) onOpenChange(false);
            }}
          >
            {t.app.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
