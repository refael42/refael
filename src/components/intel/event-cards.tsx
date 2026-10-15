"use client";
import { Check, MessageSquareQuote, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { applyEventAction, decideEventsAction, dismissEventAction } from "@/app/actions/intel";
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

/** Same text, ignoring punctuation and spacing (quotes are normalized). */
const flat = (x: string | null | undefined) => (x ?? "").replace(/[^\p{L}\p{N}]/gu, "");

/** The line the update came from, and — when it is part of a longer message — the whole message, folded. */
function Source({ card, quote }: { card: EventCard; quote: string | null }) {
  const partial = !!quote && !!card.text && flat(card.text) !== flat(quote);
  return (
    <div className="flex gap-2 rounded-md bg-muted/50 px-3 py-2 text-sm">
      <MessageSquareQuote className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className={cn("whitespace-pre-wrap", partial && "font-medium")}>{partial ? quote : card.text ?? quote}</span>
        {partial && (
          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer select-none">{t.intel.wholeMessage}</summary>
            <p className="mt-1 whitespace-pre-wrap">{card.text}</p>
          </details>
        )}
        <Meta card={card} />
      </div>
    </div>
  );
}

function Meta({ card }: { card: EventCard }) {
  return (
    <span className="text-xs text-muted-foreground">
      <bdi>{card.author}</bdi> · <span className="num">{fmtDateTime(card.event.occurred_at)}</span>
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
  );
}

/** Several updates from one message (a punch list): one card, a line each, one decision. */
function ListCard({ cards, canDecide }: { cards: EventCard[]; canDecide: boolean }) {
  const [picked, setPicked] = useState<Set<string>>(new Set(cards.map((c) => c.event.id)));
  const { call, pending } = useAction();
  const first = cards[0];
  return (
    <div className="flex flex-col gap-3 rounded-lg border p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-900 dark:bg-slate-800 dark:text-slate-200">
          {t.intel.listTitle(cards.length)}
        </span>
        <Meta card={first} />
      </div>
      {canDecide && <p className="text-xs text-muted-foreground">{t.intel.listHint}</p>}
      <div className="flex flex-col divide-y rounded-md border">
        {cards.map(({ event: e }) => (
          <label key={e.id} className="flex items-start gap-2 px-3 py-2 text-sm">
            <Checkbox
              className="mt-0.5"
              checked={picked.has(e.id)}
              disabled={!canDecide}
              onCheckedChange={(v) =>
                setPicked((p) => {
                  const n = new Set(p);
                  if (v) n.add(e.id);
                  else n.delete(e.id);
                  return n;
                })
              }
            />
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="flex flex-wrap items-center gap-1.5">
                <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-bold", TONE[e.type])}>{t.intel.type[e.type]}</span>
                <span className="font-medium">{e.summary}</span>
              </span>
              <span className="text-muted-foreground">{e.quote}</span>
            </span>
          </label>
        ))}
      </div>
      {first.text && (
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer select-none">{t.intel.wholeMessage}</summary>
          <p className="mt-1 whitespace-pre-wrap">{first.text}</p>
        </details>
      )}
      {canDecide && (
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            disabled={pending || picked.size === 0}
            onClick={() =>
              call(
                () => decideEventsAction([...picked], cards.map((c) => c.event.id).filter((id) => !picked.has(id))),
                (r) => t.intel.applied(r.changed || picked.size),
              )
            }
          >
            <Check />
            {t.intel.applyChecked(picked.size)}
          </Button>
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => call(() => decideEventsAction([], cards.map((c) => c.event.id)), t.app.saved)}>
            <X />
            {t.intel.dismissAll}
          </Button>
        </div>
      )}
    </div>
  );
}

/** A list line can be decided in one go when it needs no task picking (new tasks, defects, blockers…). */
const LISTABLE = new Set<EventType>(["new_task", "defect", "material_missing", "approval_missing", "blocker", "instruction_change"]);
const listable = (c: EventCard) => c.event.status === "proposed" && LISTABLE.has(c.event.type);

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

      <Source card={card} quote={e.quote} />

      {needsInfo && e.note && <p className="text-sm text-amber-800 dark:text-amber-300">{e.note}</p>}
      {e.extracted?.engine === "learned" && <p className="text-xs text-muted-foreground">{t.intel.learned}</p>}
      {e.extracted?.engine === "manual" && <p className="text-xs text-muted-foreground">{t.intel.manual}</p>}

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

/** List lines in the order they were written. */
function inMessageOrder(cards: EventCard[]): EventCard[] {
  const text = flat(cards[0].text);
  const at = (c: EventCard) => {
    const i = text.indexOf(flat(c.event.quote));
    return i < 0 ? Number.MAX_SAFE_INTEGER : i;
  };
  return [...cards].sort((a, b) => at(a) - at(b));
}

export function EventCards({ cards, canDecide }: { cards: EventCard[]; canDecide: boolean }) {
  // lines of one message that need no task picking are shown together
  const groups = new Map<string, EventCard[]>();
  for (const c of cards) {
    const key = c.event.source_item_id && listable(c) ? c.event.source_item_id : c.event.id;
    groups.set(key, [...(groups.get(key) ?? []), c]);
  }
  return (
    <div className="flex flex-col gap-3">
      {[...groups.values()].map((g) => (g.length > 1 ? inMessageOrder(g) : g)).map((g) =>
        g.length > 1 ? <ListCard key={g[0].event.id} cards={g} canDecide={canDecide} /> : <Card key={g[0].event.id} card={g[0]} canDecide={canDecide} />,
      )}
    </div>
  );
}
