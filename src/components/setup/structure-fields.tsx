"use client";
import { Field } from "@/components/common/field";
import { Input } from "@/components/ui/input";
import { t } from "@/lib/i18n";

export interface StructureState {
  buildingName: string;
  floorFrom: string;
  floorTo: string;
  aptsPerFloor: string;
  firstApt: string;
}

export const emptyStructure: StructureState = { buildingName: "", floorFrom: "1", floorTo: "4", aptsPerFloor: "4", firstApt: "1" };

export function toStructureInput(s: StructureState) {
  return {
    buildingName: s.buildingName,
    floorFrom: Number(s.floorFrom),
    floorTo: Number(s.floorTo),
    aptsPerFloor: Number(s.aptsPerFloor),
    firstApt: Number(s.firstApt),
  };
}

export function structureCounts(s: StructureState) {
  const floors = Math.max(0, Number(s.floorTo) - Number(s.floorFrom) + 1) || 0;
  return { floors, apts: floors * (Number(s.aptsPerFloor) || 0) };
}

export function StructureFields({ value, onChange }: { value: StructureState; onChange: (v: StructureState) => void }) {
  const set = (k: keyof StructureState) => (e: React.ChangeEvent<HTMLInputElement>) => onChange({ ...value, [k]: e.target.value });
  const { floors, apts } = structureCounts(value);
  return (
    <div className="flex flex-col gap-3">
      <Field label={t.setup.buildingName} htmlFor="st-building">
        <Input id="st-building" value={value.buildingName} onChange={set("buildingName")} placeholder={t.setup.defaultBuilding} />
      </Field>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Field label={t.setup.floorFrom} htmlFor="st-from">
          <Input id="st-from" type="number" min={0} value={value.floorFrom} onChange={set("floorFrom")} />
        </Field>
        <Field label={t.setup.floorTo} htmlFor="st-to">
          <Input id="st-to" type="number" min={0} value={value.floorTo} onChange={set("floorTo")} />
        </Field>
        <Field label={t.setup.aptsPerFloor} htmlFor="st-apts">
          <Input id="st-apts" type="number" min={0} max={30} value={value.aptsPerFloor} onChange={set("aptsPerFloor")} />
        </Field>
        <Field label={t.setup.firstApt} htmlFor="st-first">
          <Input id="st-first" type="number" min={0} value={value.firstApt} onChange={set("firstApt")} />
        </Field>
      </div>
      <p className="text-xs text-muted-foreground">
        {t.setup.structurePreview(floors, apts)} · {t.setup.structureHint}
      </p>
    </div>
  );
}
