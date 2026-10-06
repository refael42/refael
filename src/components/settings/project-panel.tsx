"use client";
import { Building2 } from "lucide-react";
import { useState } from "react";
import { buildStructureAction, setSetupModeAction, updateProjectAction } from "@/app/actions/project";
import { Field } from "@/components/common/field";
import { useAction } from "@/components/common/use-action";
import { StructureFields, emptyStructure, toStructureInput } from "@/components/setup/structure-fields";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/misc";
import { t } from "@/lib/i18n";

export function ProjectPanel({
  project,
}: {
  project: { name: string; address: string | null; start_date: string | null; target_date: string | null; setup_mode: boolean };
}) {
  const { call, pending } = useAction();
  const [name, setName] = useState(project.name);
  const [address, setAddress] = useState(project.address ?? "");
  const [start, setStart] = useState(project.start_date ?? "");
  const [target, setTarget] = useState(project.target_date ?? "");
  const [structure, setStructure] = useState(emptyStructure);

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t.setup.projectDetails}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Field label={t.setup.projectName} htmlFor="pp-name">
            <Input id="pp-name" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label={t.setup.address} htmlFor="pp-address">
            <Input id="pp-address" value={address} onChange={(e) => setAddress(e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t.setup.startDate} htmlFor="pp-start">
              <Input id="pp-start" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
            </Field>
            <Field label={t.setup.targetDate} htmlFor="pp-target">
              <Input id="pp-target" type="date" value={target} onChange={(e) => setTarget(e.target.value)} />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              id="pp-setup"
              checked={project.setup_mode}
              disabled={pending}
              onCheckedChange={(v) => call(() => setSetupModeAction(!!v), v ? t.app.saved : t.setup.activated)}
            />
            {t.setup.setupModeLabel}
          </label>
          <Button
            className="self-start"
            disabled={pending || !name.trim()}
            onClick={() => call(() => updateProjectAction({ name, address, startDate: start || null, targetDate: target || null }), t.app.saved)}
          >
            {t.app.save}
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="h-4 w-4" />
            {t.setup.addStructure}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <StructureFields value={structure} onChange={setStructure} />
          <Button
            variant="outline"
            className="self-start"
            disabled={pending}
            onClick={() => call(() => buildStructureAction(toStructureInput(structure)), (r) => t.setup.structureAdded(r.floors, r.apartments))}
          >
            {t.setup.addStructure}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
