"use client";
import { Check, MessageSquareQuote, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { applyEventAction, dismissEventAction } from "@/app/actions/intel";
import { useAction } from "@/components/common/use-action";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/misc";
import type { EventType } from "@/lib/db/types";
import { fmtDateTime, t } from "@/lib/i18n";
import type { EventCard } from "@/lib/services/intel";
import { cn } from "@/lib/utils";

const TONE: Record<EventType, string> = {
  reported_done: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  inspected_ok: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
  started: "bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200",
  commitment: "bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200",
  defect: "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200",
  blocker: "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200",
  material_missing: "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200",
  approval_missing: "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200",
  instruction_change: "bg-violet-100 text-violet-900 dark:bg-violet-950 dark:text-violet-200",
  new_task: "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-200",
  dependency_hint: "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-200",
};
const SHOWN = 6;

function Card({ card, canDecide }: { card: EventCard; canDecide: boolean }) {
  const { event: e } = card;
  const [picked, setPicked] = useState<Set<string>>(new Set(card.tasks.map((x) => x.id)));
  const [open, setOpen] = useState(false);
  const { call, pending } = useAction();
  const needsInfo = e.status === "needs_info";
  const visible = open ? card.tasks : card.tasks.slice(0, SHOWN);
  return (
    <div className={cn("flex flex-col gap-3 rounded-lg border p-4", needsInfo && "border-dashed")}>
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-bold", TONE[e.type])}>{t.intel.type[e.type]}</span>
        <span className="font-medium">{e.summary}</span>
      </div>

      <div className="flex gap-2 rounded-md bg-muted/50 px-3 py-2 text-sm">
        <MessageSquareQuote className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="whitespace-pre-wrap">{card.text ?? e.quote}</span>
          <span className="text-xs text-muted-foreground">
            <bdi>{card.author}</bdi> · <span className="num">{fmtDateTime(e.occurred_at)}</span>
            {card.sourceId && (
              <>
                {" "}
                · {t.intel.from}{" "}
                <Link href={`/sources/${card.sourceId}`} className="underline-offset-2 hover:underline">
                  {card.sourceTitle}
                </Link>
              </>
            )}
          </span>
        </div>
      </div>

      {needsInfo && e.note && <p className="text-sm text-amber-800 dark:text-amber-300">{e.note}</p>}

      {card.tasks.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">{t.intel.tasksAffected(card.tasks.length)}</span>
          {visible.map((task) => (
            <label key={task.id} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={picked.has(task.id)}
                disabled={!canDecide}
                onCheckedChange={(v) =>
                  setPicked((p) => {
                    const n = new Set(p);
                    if (v) n.add(task.id);
                    else n.delete(task.id);
                    return n;
                  })
                }
              />
              <span className="min-w-0 truncate">{task.title}</span>
              <Badge variant="outline" className="shrink-0">
                {t.status[task.status]}
              </Badge>
            </label>
          ))}
          {card.tasks.length > SHOWN && !open && (
            <button type="button" className="self-start text-xs text-primary" onClick={() => setOpen(true)}>
              {t.intel.showMore(card.tasks.length - SHOWN)}
            </button>
          )}
        </div>
      )}

      {canDecide && (
        <div className="flex flex-wrap gap-2">
          {!needsInfo && (
            <Button
              size="sm"
              disabled={pending || (card.tasks.length > 0 && picked.size === 0)}
              onClick={() => call(() => applyEventAction(e.id, card.tasks.length ? [...picked] : undefined), (r) => t.intel.applied(r.changed))}
            >
              <Check />
              {t.intel.apply(card.tasks.length ? picked.size : 0)}
            </Button>
          )}
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => call(() => dismissEventAction(e.id), t.app.saved)}>
            <X />
            {t.intel.dismiss}
          </Button>
        </div>
      )}
    </div>
  );
}

export function EventCards({ cards, canDecide }: { cards: EventCard[]; canDecide: boolean }) {
  return (
    <div className="flex flex-col gap-3">
      {cards.map((c) => (
        <Card key={c.event.id} card={c} canDecide={canDecide} />
      ))}
    </div>
  );
}
