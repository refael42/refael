"use client";
import { CornerDownLeft, Loader2, MessageCircle, ShieldAlert, Sparkles, SquareCheckBig } from "lucide-react";
import Link from "next/link";
import { Fragment, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { askAction } from "@/app/actions/qa";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { t } from "@/lib/i18n";
import type { Answer, Source } from "@/lib/services/qa";

const ICON = { task: SquareCheckBig, message: MessageCircle, blocker: ShieldAlert } as const;

function AnswerText({ answer, sources }: { answer: Answer["answer"]; sources: Source[] }) {
  const byRef = new Map(sources.map((s) => [s.ref, s]));
  const pieces = answer.split(/(\[[TMB]\d+\])/g);
  return (
    <p className="whitespace-pre-wrap leading-relaxed">
      {pieces.map((p, i) => {
        const m = p.match(/^\[([TMB]\d+)\]$/);
        const src = m ? byRef.get(m[1]) : null;
        if (!m) return <Fragment key={i}>{p}</Fragment>;
        return src ? (
          <Link key={i} href={src.href} className="mx-0.5 rounded bg-primary/10 px-1 text-xs font-semibold text-primary hover:bg-primary/20" title={src.label}>
            {m[1]}
          </Link>
        ) : (
          <Fragment key={i}>{p}</Fragment>
        );
      })}
    </p>
  );
}

export function AskBox({ initial }: { initial?: string }) {
  const [q, setQ] = useState(initial ?? "");
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<Answer[]>([]);
  const asked = useRef(false);

  async function ask(question: string) {
    if (!question.trim()) return;
    setBusy(true);
    const res = await askAction(question);
    setBusy(false);
    if (!res.ok) return toast.error(res.error);
    setHistory((h) => [res.data, ...h]);
    setQ("");
  }

  useEffect(() => {
    if (initial && !asked.current) {
      asked.current = true;
      void ask(initial);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial]);

  return (
    <div className="flex flex-col gap-4">
      <form
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void ask(q);
        }}
      >
        <div className="relative">
          <Textarea
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
            }}
            placeholder={t.ask.placeholder}
            rows={2}
            className="pe-24 text-base"
          />
          <Button type="submit" size="sm" className="absolute bottom-2 end-2" disabled={busy || !q.trim()}>
            {busy ? <Loader2 className="animate-spin" /> : <CornerDownLeft />}
            {t.ask.ask}
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {t.ask.examples.map((ex) => (
            <button key={ex} type="button" onClick={() => ask(ex)} disabled={busy} className="rounded-full border px-3 py-1 text-xs hover:bg-accent">
              {ex}
            </button>
          ))}
        </div>
      </form>

      {busy && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t.ask.thinking}
        </p>
      )}

      {history.map((a, i) => (
        <Card key={i}>
          <CardContent className="flex flex-col gap-3 p-4">
            <p className="flex items-start gap-2 font-semibold">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              {a.question}
            </p>
            <AnswerText answer={a.answer} sources={a.sources} />
            {a.sources.length > 0 && (
              <div className="flex flex-col gap-1 border-t pt-3">
                <span className="text-xs font-semibold text-muted-foreground">{t.ask.sources}</span>
                {a.sources.map((s) => {
                  const Icon = ICON[s.kind];
                  return (
                    <Link key={s.ref} href={s.href} className="flex items-center gap-2 rounded px-1 py-0.5 text-sm hover:bg-accent">
                      <span className="w-8 shrink-0 text-xs font-semibold text-primary">{s.ref}</span>
                      <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="truncate">{s.label}</span>
                    </Link>
                  );
                })}
              </div>
            )}
            {a.engine === "local" && <p className="text-[11px] text-muted-foreground">{t.ask.noKey}</p>}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
