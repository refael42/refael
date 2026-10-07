"use client";
import { AlertTriangle, Pencil, Plus, RotateCcw, Save, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { resetFlowAction, saveFlowAction } from "@/app/actions/flow";
import { Field, OptionSelect, type Option } from "@/components/common/field";
import { useAction } from "@/components/common/use-action";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/misc";
import { Textarea } from "@/components/ui/textarea";
import { FEATURES, PARTS, PHASE_KEYS, PHASES, stageLevels, validateFlow, type FlowKind, type FlowStage, type PhaseKey } from "@/lib/flow/process";
import { t } from "@/lib/i18n";

/** PM edits the company's construction process: stages, prerequisites, waiting times. */
export function FlowEditor({
  initial,
  custom,
  trades,
  kind = "apartment",
  cross = [],
}: {
  initial: FlowStage[];
  custom: boolean;
  trades: Option[];
  kind?: FlowKind;
  /** apartment process: building stages it may wait for */
  cross?: Array<{ key: string; name: string }>;
}) {
  const [stages, setStages] = useState<FlowStage[]>(initial);
  const [dirty, setDirty] = useState(false);
  const [editing, setEditing] = useState<FlowStage | "new" | null>(null);
  const { call, pending } = useAction();
  const errors = useMemo(() => validateFlow(stages), [stages]);
  const levels = useMemo(() => {
    try {
      return stageLevels(stages);
    } catch {
      return new Map<string, number>();
    }
  }, [stages]);
  const ordered = [...stages].sort((a, b) => (levels.get(a.key) ?? 99) - (levels.get(b.key) ?? 99));
  const nameOf = (k: string, scope?: string) =>
    scope ? `${cross.find((s) => s.key === k)?.name ?? k} ${t.flow.fromBuilding}` : stages.find((s) => s.key === k)?.name ?? k;
  const tradeName = (k: string) => trades.find((o) => o.value === k)?.label ?? k;

  const update = (next: FlowStage[]) => {
    setStages(next);
    setDirty(true);
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">{t.flow.editHint}</p>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={custom ? "default" : "secondary"}>{custom ? t.flow.custom : t.flow.builtin}</Badge>
        <Button size="sm" variant="outline" onClick={() => setEditing("new")}>
          <Plus />
          {t.flow.addStage}
        </Button>
        <Button
          size="sm"
          disabled={pending || !dirty || errors.length > 0}
          onClick={async () => {
            const ok = await call(() => saveFlowAction(stages, kind), (n) => t.flow.saved(n));
            if (ok !== null) setDirty(false);
          }}
        >
          <Save />
          {t.flow.saveProcess}
        </Button>
        {custom && (
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => confirm(t.flow.resetConfirm) && call(() => resetFlowAction(kind), t.app.saved)}>
            <RotateCcw />
            {t.flow.resetProcess}
          </Button>
        )}
        {dirty && <span className="text-xs text-amber-700">{t.flow.unsaved}</span>}
      </div>
      {errors.length > 0 && (
        <div className="flex flex-col gap-1 rounded-md border border-state-blocked/40 bg-state-blocked/5 p-3 text-sm text-state-blocked">
          <span className="flex items-center gap-1 font-semibold">
            <AlertTriangle className="h-4 w-4" />
            {t.flow.errors}
          </span>
          {errors.map((e) => (
            <span key={e}>• {e}</span>
          ))}
        </div>
      )}
      <div className="rounded-lg border">
        {ordered.map((s) => (
          <div key={s.key} className="flex items-start gap-2 border-b p-3 last:border-b-0">
            <span className="num flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{levels.get(s.key) ?? "?"}</span>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="flex items-center gap-1.5 font-medium">
                <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: PHASES[s.phase]?.color }} />
                {s.name}
              </span>
              <span className="text-xs text-muted-foreground">
                {s.part ? `${PARTS[s.part]?.name ?? s.part} · ` : `${PHASES[s.phase]?.name} · `}
                {tradeName(s.trade)} · {t.flow.days(s.days)}
              </span>
              {s.when && <span className="text-xs font-medium text-violet-700 dark:text-violet-300">{FEATURES[s.when]?.only ?? s.when}</span>}
              {s.after.length > 0 && (
                <span className="text-xs">
                  {t.flow.requires}: {s.after.map((a) => `${nameOf(a.key, a.scope)}${a.lag ? ` (+${a.lag}h)` : ""}`).join(" · ")}
                </span>
              )}
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditing(s)} aria-label={t.flow.editStage}>
              <Pencil />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive"
              aria-label={t.flow.deleteStage}
              onClick={() =>
                confirm(t.flow.deleteStageConfirm) &&
                update(stages.filter((x) => x.key !== s.key).map((x) => ({ ...x, after: x.after.filter((a) => a.scope || a.key !== s.key) })))
              }
            >
              <Trash2 />
            </Button>
          </div>
        ))}
      </div>
      {editing && (
        <StageDialog
          stage={editing === "new" ? null : editing}
          all={stages}
          trades={trades}
          kind={kind}
          cross={cross}
          onClose={() => setEditing(null)}
          onSave={(st) => {
            update(editing === "new" ? [...stages, st] : stages.map((x) => (x.key === st.key ? st : x)));
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function StageDialog({
  stage,
  all,
  trades,
  kind,
  cross,
  onClose,
  onSave,
}: {
  stage: FlowStage | null;
  all: FlowStage[];
  trades: Option[];
  kind: FlowKind;
  cross: Array<{ key: string; name: string }>;
  onClose: () => void;
  onSave: (s: FlowStage) => void;
}) {
  const [f, setF] = useState<FlowStage>(
    stage ?? {
      key: `s_${Date.now().toString(36)}`,
      name: "",
      phase: "finish",
      trade: trades[0]?.value ?? "general",
      days: 1,
      after: [],
      description: "",
      ...(kind === "building" ? { part: "systems" } : {}),
    },
  );
  type Scope = "building" | undefined;
  const others: Array<{ key: string; name: string; scope: Scope }> = [
    ...all.filter((x) => x.key !== f.key).map((x) => ({ key: x.key, name: x.name, scope: undefined as Scope })),
    ...cross.map((x) => ({ key: x.key, name: `${x.name} ${t.flow.fromBuilding}`, scope: "building" as Scope })),
  ];
  const same = (a: { key: string; scope?: string }, k: string, scope: Scope) => a.key === k && (a.scope ?? undefined) === scope;
  const dep = (k: string, scope: Scope) => f.after.find((a) => same(a, k, scope));
  const setDep = (k: string, scope: Scope, patch: Partial<{ on: boolean; lag: number; why: string }>) =>
    setF((p) => {
      const has = p.after.some((a) => same(a, k, scope));
      if (patch.on === false) return { ...p, after: p.after.filter((a) => !same(a, k, scope)) };
      if (!has) return { ...p, after: [...p.after, { key: k, lag: patch.lag ?? 0, ...(scope ? { scope } : {}) }] };
      return {
        ...p,
        after: p.after.map((a) => (same(a, k, scope) ? { ...a, ...("lag" in patch ? { lag: patch.lag } : {}), ...("why" in patch ? { why: patch.why } : {}) } : a)),
      };
    });
  const featureOptions = Object.entries(FEATURES)
    .filter(([, v]) => kind === "apartment" || v.of === "building")
    .map(([k, v]) => ({ value: k, label: v.name }));

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{stage ? t.flow.editStage : t.flow.addStage}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t.flow.stageName}>
            <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoFocus />
          </Field>
          <Field label={t.flow.daysLabel}>
            <Input type="number" min={0.5} step={0.5} value={f.days} onChange={(e) => setF({ ...f, days: Number(e.target.value) })} />
          </Field>
          <Field label={t.flow.phaseLabel}>
            <OptionSelect value={f.phase} onChange={(v) => v && setF({ ...f, phase: v as PhaseKey })} options={PHASE_KEYS.map((k) => ({ value: k, label: PHASES[k].name }))} />
          </Field>
          <Field label={t.flow.tradeLabel}>
            <OptionSelect value={f.trade} onChange={(v) => v && setF({ ...f, trade: v })} options={trades} />
          </Field>
          <Field label={t.flow.whenLabel}>
            <OptionSelect
              value={f.when ?? null}
              onChange={(v) => setF((p) => ({ ...p, when: v ?? undefined }))}
              options={featureOptions}
              noneLabel={t.flow.always}
            />
          </Field>
          {kind === "building" && (
            <Field label={t.flow.partLabel}>
              <OptionSelect
                value={f.part ?? "systems"}
                onChange={(v) => v && setF({ ...f, part: v })}
                options={Object.entries(PARTS).map(([k, v]) => ({ value: k, label: v.name }))}
              />
            </Field>
          )}
        </div>
        <Field label={t.flow.descLabel}>
          <Textarea rows={2} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
        </Field>
        <Field label={t.flow.prereqs}>
          <div className="max-h-56 overflow-y-auto rounded-md border">
            {others.map((o) => {
              const d = dep(o.key, o.scope);
              return (
                <div key={`${o.scope ?? ""}:${o.key}`} className="flex flex-wrap items-center gap-2 border-b px-2 py-1.5 last:border-b-0">
                  <label className="flex flex-1 items-center gap-2 text-sm">
                    <Checkbox checked={!!d} onCheckedChange={(v) => setDep(o.key, o.scope, { on: !!v })} />
                    {o.name}
                  </label>
                  {d && (
                    <>
                      <Input
                        className="h-8 w-20"
                        type="number"
                        min={0}
                        value={d.lag ?? 0}
                        onChange={(e) => setDep(o.key, o.scope, { lag: Number(e.target.value) })}
                        aria-label={t.flow.lagLabel}
                        title={t.flow.lagLabel}
                      />
                      <Input className="h-8 w-40" value={d.why ?? ""} placeholder={t.flow.whyLabel} onChange={(e) => setDep(o.key, o.scope, { why: e.target.value })} />
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </Field>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            {t.app.cancel}
          </Button>
          <Button disabled={!f.name.trim() || !(f.days > 0)} onClick={() => onSave(f)}>
            {t.app.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
