"use client";
import { FileSpreadsheet, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { importPlanAction, previewPlanAction } from "@/app/actions/import";
import { Field } from "@/components/common/field";
import { useAction } from "@/components/common/use-action";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/misc";
import { t } from "@/lib/i18n";

type Preview = Awaited<ReturnType<typeof previewPlanAction>> extends { ok: true; data: infer D } | { ok: false } ? D : never;

/** Upload a work-plan spreadsheet → preview → import into this project. */
export function ImportPlanCard() {
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [building, setBuilding] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [withDeps, setWithDeps] = useState(true);
  const { call, pending } = useAction();

  const form = () => {
    const f = new FormData();
    f.set("file", file!);
    f.set("building", building);
    f.set("dependencies", withDeps ? "1" : "0");
    return f;
  };

  return (
    <Card id="import">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileSpreadsheet className="h-4 w-4" />
          {t.importPlan.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">{t.importPlan.hint}</p>
        <input
          ref={input}
          id="plan-file"
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0] ?? null;
            setFile(f);
            setPreview(null);
            setWarnings([]);
            if (!f) return;
            const fd = new FormData();
            fd.set("file", f);
            const p = await call(() => previewPlanAction(fd));
            if (p) {
              setPreview(p);
              setBuilding(p.building);
            }
          }}
        />
        <Button variant="outline" className="self-start" disabled={pending} onClick={() => input.current?.click()}>
          <Upload />
          {pending && !preview ? t.importPlan.checking : file ? file.name : t.importPlan.choose}
        </Button>
        {preview && (
          <div className="flex flex-col gap-2 rounded-md border p-3 text-sm">
            {preview.title && <span className="font-semibold">{preview.title}</span>}
            <span>{t.importPlan.preview(preview.tasks, preview.people)}</span>
            <span className="text-muted-foreground">{t.importPlan.statuses(preview.done, preview.inProgress, preview.blocked)}</span>
            {preview.dependencyList.length > 0 && (
              <details className="text-xs">
                <summary className="cursor-pointer text-sm text-muted-foreground">{t.importPlan.deps(preview.dependencies)}</summary>
                <p className="my-1 text-muted-foreground">{t.importPlan.depsCheck}</p>
                <ul className="flex max-h-64 flex-col gap-0.5 overflow-y-auto">
                  {preview.dependencyList.map((d, i) => (
                    <li key={i}>
                      <span className="font-medium">{d.to}</span> <span className="text-muted-foreground">{t.importPlan.waitsFor}</span> {d.from}
                    </li>
                  ))}
                </ul>
              </details>
            )}
            {preview.dependencies > 0 && (
              <label className="flex items-center gap-2">
                <Checkbox id="plan-deps" checked={withDeps} onCheckedChange={(v) => setWithDeps(!!v)} />
                {t.importPlan.withDeps}
              </label>
            )}
            {preview.skipped.length > 0 && <span className="text-xs text-muted-foreground">{t.importPlan.skipped(preview.skipped.join(", "))}</span>}
            <ul className="list-inside list-disc text-xs text-muted-foreground">
              {preview.sample.map((s) => (
                <li key={s.number}>
                  {s.number}. {s.title} · {s.location} · {s.responsible}
                </li>
              ))}
            </ul>
            {preview.warnings.length > 0 && (
              <details className="text-xs text-amber-800 dark:text-amber-200">
                <summary>
                  {t.importPlan.warnings} ({preview.warnings.length})
                </summary>
                {preview.warnings.map((w) => (
                  <div key={w}>• {w}</div>
                ))}
              </details>
            )}
            <Field label={t.importPlan.building} htmlFor="plan-building">
              <Input id="plan-building" value={building} onChange={(e) => setBuilding(e.target.value)} className="max-w-xs" />
            </Field>
            <Button
              className="self-start"
              disabled={pending}
              onClick={async () => {
                const r = await call(() => importPlanAction(form()), (x) => t.importPlan.done(x.created, x.updated, x.dependencies, x.removedDependencies));
                if (r) {
                  setWarnings(r.warnings.filter((w) => !preview.warnings.includes(w)));
                  setPreview(null);
                  setFile(null);
                  if (input.current) input.current.value = "";
                }
              }}
            >
              {t.importPlan.run}
            </Button>
          </div>
        )}
        {warnings.length > 0 && (
          <div className="text-xs text-amber-800 dark:text-amber-200">
            {warnings.map((w) => (
              <div key={w}>• {w}</div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
