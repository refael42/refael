"use client";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { createRuleAction, deleteRuleAction, updateRuleAction } from "@/app/actions/rules";
import { Field, OptionSelect, type Option } from "@/components/common/field";
import { useAction } from "@/components/common/use-action";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/misc";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export interface RuleVM {
  id: string;
  name: string;
  pred: string;
  succ: string;
  predKeyword: string | null;
  succKeyword: string | null;
  scope: "same_area" | "same_room";
  lag: number;
  active: boolean;
  source: "system" | "custom" | "learned";
  editable: boolean;
  accepted: number;
  rejected: number;
}

const EMPTY = { name: "", pred: null as string | null, succ: null as string | null, pk: "", sk: "", scope: "same_area", lag: "0" };

export function RulesManager({ rules, trades, canEdit }: { rules: RuleVM[]; trades: Option[]; canEdit: boolean }) {
  const { call, pending } = useAction();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState(EMPTY);
  const scopes: Option[] = [
    { value: "same_area", label: t.templates.scopes.same_area },
    { value: "same_room", label: t.templates.scopes.same_room },
  ];

  return (
    <div className="flex flex-col gap-3">
      {canEdit && (
        <Button className="self-start" onClick={() => setOpen(true)}>
          <Plus />
          {t.templates.newRule}
        </Button>
      )}
      {rules.map((r) => (
        <div key={r.id} className={cn("flex flex-col gap-2 rounded-lg border p-3", !r.active && "opacity-60")}>
          <div className="flex items-start justify-between gap-2">
            <div className="flex flex-col gap-1">
              <span className="font-medium">{r.name}</span>
              <span className="flex flex-wrap items-center gap-1 text-sm">
                <Badge variant="outline">{r.pred}{r.predKeyword ? ` · "${r.predKeyword}"` : ""}</Badge>
                <ArrowLeft className="h-3.5 w-3.5 text-muted-foreground" />
                <Badge variant="outline">{r.succ}{r.succKeyword ? ` · "${r.succKeyword}"` : ""}</Badge>
                {r.lag > 0 && <Badge variant="secondary">{`+${r.lag}h`}</Badge>}
              </span>
              <span className="text-xs text-muted-foreground">
                {t.templates.scopes[r.scope]} · {t.templates.source[r.source]} · {t.templates.feedback(r.accepted, r.rejected)}
              </span>
            </div>
            {r.editable && canEdit ? (
              <div className="flex items-center gap-2">
                <Switch checked={r.active} disabled={pending} onCheckedChange={(v) => call(() => updateRuleAction(r.id, { active: v }))} aria-label={t.templates.active} />
                <Button variant="ghost" size="icon" disabled={pending} onClick={() => call(() => deleteRuleAction(r.id))} aria-label={t.app.delete}>
                  <Trash2 />
                </Button>
              </div>
            ) : (
              <Badge variant="secondary">{t.templates.source.system}</Badge>
            )}
          </div>
        </div>
      ))}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.templates.newRule}</DialogTitle>
          </DialogHeader>
          <Field label={t.templates.name}>
            <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t.templates.predecessor}>
              <OptionSelect value={f.pred} onChange={(v) => setF({ ...f, pred: v })} options={trades} placeholder="—" />
            </Field>
            <Field label={t.templates.successor}>
              <OptionSelect value={f.succ} onChange={(v) => setF({ ...f, succ: v })} options={trades} placeholder="—" />
            </Field>
            <Field label={`${t.templates.predKeyword} ${t.app.optional}`}>
              <Input value={f.pk} onChange={(e) => setF({ ...f, pk: e.target.value })} />
            </Field>
            <Field label={`${t.templates.succKeyword} ${t.app.optional}`}>
              <Input value={f.sk} onChange={(e) => setF({ ...f, sk: e.target.value })} />
            </Field>
            <Field label={t.templates.scope}>
              <OptionSelect value={f.scope} onChange={(v) => setF({ ...f, scope: v ?? "same_area" })} options={scopes} />
            </Field>
            <Field label={t.templates.lag}>
              <Input type="number" min={0} value={f.lag} onChange={(e) => setF({ ...f, lag: e.target.value })} />
            </Field>
          </div>
          <DialogFooter>
            <Button
              disabled={pending || !f.name.trim() || !f.pred || !f.succ}
              onClick={async () => {
                const id = await call(
                  () =>
                    createRuleAction({
                      name: f.name,
                      predecessor_trade_id: f.pred!,
                      successor_trade_id: f.succ!,
                      predecessor_keyword: f.pk || null,
                      successor_keyword: f.sk || null,
                      scope: f.scope as "same_area" | "same_room",
                      lag_hours: Number(f.lag) || 0,
                    }),
                  t.app.saved,
                );
                if (id) {
                  setOpen(false);
                  setF(EMPTY);
                }
              }}
            >
              {t.app.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
