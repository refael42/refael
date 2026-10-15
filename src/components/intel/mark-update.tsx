"use client";
import { Sparkles } from "lucide-react";
import Link from "next/link";
import { createContext, useContext, useState } from "react";
import { markAsEventAction } from "@/app/actions/intel";
import { Field, OptionSelect, type Option } from "@/components/common/field";
import { useAction } from "@/components/common/use-action";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import type { EventType } from "@/lib/db/types";
import { t } from "@/lib/i18n";

const TYPES: EventType[] = [
  "new_task",
  "defect",
  "reported_done",
  "inspected_ok",
  "started",
  "commitment",
  "material_missing",
  "approval_missing",
  "blocker",
  "instruction_change",
];

/** The area the message names ("…לדירה 15" → דירה 15, not דירה 1). */
function areaInText(text: string, areas: Option[]): string | null {
  const esc = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const hit = [...areas]
    .sort((a, b) => b.label.length - a.label.length)
    .find((a) => new RegExp(`${esc(a.label)}(?!\\d)`).test(text));
  return hit?.value ?? null;
}

interface MarkOptions {
  areas: Option[];
  contractors: Option[];
  defaultContractorId: string | null;
}

const Options = createContext<MarkOptions>({
  areas: [],
  contractors: [],
  defaultContractorId: null,
});

/** The choices for every message on the page, sent once. */
export function MarkUpdateOptions({
  children,
  ...value
}: MarkOptions & { children: React.ReactNode }) {
  return <Options.Provider value={value}>{children}</Options.Provider>;
}

/** "This message is an update" — for what the reader missed. Teaches it, too. */
export function MarkUpdate({ itemId, text }: { itemId: string; text: string }) {
  const { areas, contractors, defaultContractorId } = useContext(Options);
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<EventType>("new_task");
  const [area, setArea] = useState<string | null>(() =>
    areaInText(text, areas),
  );
  const [who, setWho] = useState<string | null>(defaultContractorId);
  const [quote, setQuote] = useState(text);
  const [done, setDone] = useState(false);
  const { call, pending } = useAction();

  if (done)
    return (
      <Link
        href="/updates"
        className="self-start text-xs font-medium text-primary underline-offset-4 hover:underline"
      >
        {t.intel.marked} ←
      </Link>
    );
  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 self-start px-2 text-xs text-muted-foreground"
        onClick={() => setOpen(true)}
      >
        <Sparkles className="h-3.5 w-3.5" />
        {t.intel.mark}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.intel.markTitle}</DialogTitle>
            <DialogDescription>{t.intel.markHint}</DialogDescription>
          </DialogHeader>
          <Field label={t.intel.markType}>
            <OptionSelect
              value={type}
              onChange={(v) => v && setType(v as EventType)}
              options={TYPES.map((k) => ({ value: k, label: t.intel.type[k] }))}
            />
          </Field>
          <Field label={t.intel.markArea}>
            <OptionSelect
              value={area}
              onChange={setArea}
              options={areas}
              noneLabel={t.intel.noArea}
            />
          </Field>
          <Field label={t.intel.markWho}>
            <OptionSelect
              value={who}
              onChange={setWho}
              options={contractors}
              noneLabel={t.intel.noWhoOption}
            />
          </Field>
          <Field label={t.intel.markText}>
            <Textarea
              value={quote}
              onChange={(ev) => setQuote(ev.target.value)}
              rows={3}
            />
          </Field>
          <DialogFooter>
            <Button
              disabled={pending || !quote.trim()}
              onClick={async () => {
                const r = await call(
                  () =>
                    markAsEventAction(itemId, {
                      type,
                      areaIds: area ? [area] : [],
                      contractorId: who,
                      quote,
                    }),
                  t.intel.marked,
                );
                if (r) {
                  setOpen(false);
                  setDone(true);
                }
              }}
            >
              {t.intel.markSave}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
