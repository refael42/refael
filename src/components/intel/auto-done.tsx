"use client";
import { Undo2, Zap } from "lucide-react";
import { undoEventAction } from "@/app/actions/intel";
import { useAction } from "@/components/common/use-action";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fmtDateTime, t } from "@/lib/i18n";
import type { EventCard } from "@/lib/services/intel";

/** What the system did by itself from the PM's WhatsApp messages, each with the message and an undo. */
export function AutoDone({ cards, canUndo }: { cards: EventCard[]; canUndo: boolean }) {
  const { call, pending } = useAction();
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Zap className="h-4 w-4" />
          {t.waAct.autoTitle}
        </CardTitle>
        <p className="text-xs text-muted-foreground">{t.waAct.autoHint}</p>
      </CardHeader>
      <CardContent className="flex flex-col divide-y p-0">
        {cards.map((c) => (
          <div key={c.event.id} className="flex flex-wrap items-start gap-2 px-4 py-2.5 text-sm">
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="font-medium">{String(c.event.extracted?.auto_line ?? c.event.summary)}</span>
              {c.text && <span className="line-clamp-2 whitespace-pre-wrap text-xs text-muted-foreground">“{c.text}”</span>}
              <span className="text-xs text-muted-foreground">{fmtDateTime(c.event.decided_at ?? c.event.occurred_at)}</span>
            </span>
            {canUndo && c.event.resolved.undo && (
              <Button size="sm" variant="ghost" disabled={pending} onClick={() => call(() => undoEventAction(c.event.id), t.waAct.undoneToast)}>
                <Undo2 />
                {t.waAct.undo}
              </Button>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
