"use client";
import { ArrowLeft, Brain } from "lucide-react";
import { useState } from "react";
import { applySuggestionsAction } from "@/app/actions/tasks";
import { useAction } from "@/components/common/use-action";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/misc";
import type { DependencySuggestion } from "@/lib/services/rules";
import { t } from "@/lib/i18n";

/** task id → title, for rendering suggestions that reference any project task */
export type SuggestionLabels = Record<string, string>;

/** Template-suggested dependencies: the PM ticks what to add. Nothing is applied otherwise. */
export function SuggestionsDialog({
  suggestions,
  labels,
  onDone,
}: {
  suggestions: DependencySuggestion[];
  labels: SuggestionLabels;
  onDone: () => void;
}) {
  const [checked, setChecked] = useState(() => suggestions.map((s) => !s.lowConfidence));
  const { call, pending } = useAction();

  async function apply(skipAll = false) {
    await call(
      () => applySuggestionsAction(suggestions.map((s, i) => ({ ...s, accept: !skipAll && checked[i] }))),
      (n) => (n ? t.ai.rulesApplied(n) : null),
    );
    onDone();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onDone()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            {t.tasks.suggestedDeps}
          </DialogTitle>
          <DialogDescription>{t.tasks.suggestedDepsHint}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          {suggestions.map((s, i) => (
            <label key={`${s.fromTaskId}-${s.toTaskId}`} className="flex cursor-pointer items-start gap-3 rounded-md border p-3">
              <Checkbox checked={checked[i]} onCheckedChange={(c) => setChecked((p) => p.map((x, j) => (j === i ? !!c : x)))} />
              <div className="flex flex-col gap-1 text-sm">
                <span className="flex flex-wrap items-center gap-1">
                  <span className="font-medium">{labels[s.fromTaskId] ?? "?"}</span>
                  <ArrowLeft className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-medium">{labels[s.toTaskId] ?? "?"}</span>
                </span>
                <span className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                  {t.tasks.ruleFrom(s.ruleName)}
                  {s.lagHours > 0 && <Badge variant="outline">{`${t.tasks.lagHours}: ${s.lagHours}`}</Badge>}
                  {s.ruleSource === "learned" && <Badge variant="secondary">{t.tasks.learned}</Badge>}
                  {s.lowConfidence && <Badge variant="blocked">{t.tasks.lowConfidence}</Badge>}
                </span>
              </div>
            </label>
          ))}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => apply(true)} disabled={pending}>
            {t.ai.dismiss}
          </Button>
          <Button onClick={() => apply()} disabled={pending}>
            {t.ai.approve}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
