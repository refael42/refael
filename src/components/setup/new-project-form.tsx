"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createProjectAction } from "@/app/actions/project";
import { Field } from "@/components/common/field";
import { useAction } from "@/components/common/use-action";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { t } from "@/lib/i18n";
import { emptyStructure, StructureFields, toStructureInput } from "./structure-fields";

export function NewProjectForm({ needsCompany, today }: { needsCompany: boolean; today: string }) {
  const router = useRouter();
  const { call, pending } = useAction();
  const [company, setCompany] = useState("");
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [start, setStart] = useState(today);
  const [target, setTarget] = useState("");
  const [structure, setStructure] = useState(emptyStructure);

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const id = await call(
          () =>
            createProjectAction({
              companyName: company,
              name,
              address,
              startDate: start || null,
              targetDate: target || null,
              structure: toStructureInput(structure),
            }),
          t.setup.created,
        );
        if (id) router.push("/");
      }}
    >
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t.setup.projectDetails}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {needsCompany && (
            <Field label={t.setup.companyName} htmlFor="np-company">
              <Input id="np-company" value={company} onChange={(e) => setCompany(e.target.value)} required />
            </Field>
          )}
          <Field label={t.setup.projectName} htmlFor="np-name">
            <Input id="np-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={t.setup.projectNamePlaceholder} required autoFocus />
          </Field>
          <Field label={t.setup.address} htmlFor="np-address">
            <Input id="np-address" value={address} onChange={(e) => setAddress(e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t.setup.startDate} htmlFor="np-start">
              <Input id="np-start" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
            </Field>
            <Field label={t.setup.targetDate} htmlFor="np-target">
              <Input id="np-target" type="date" value={target} onChange={(e) => setTarget(e.target.value)} />
            </Field>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t.setup.structure}</CardTitle>
        </CardHeader>
        <CardContent>
          <StructureFields value={structure} onChange={setStructure} />
        </CardContent>
      </Card>
      <Button type="submit" size="lg" disabled={pending || !name.trim() || (needsCompany && !company.trim())}>
        {t.setup.create}
      </Button>
    </form>
  );
}
