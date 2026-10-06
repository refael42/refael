"use client";
import { Field } from "@/components/common/field";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/misc";
import { FEATURES } from "@/lib/flow/process";
import { t } from "@/lib/i18n";

export interface StructureState {
  buildingName: string;
  floorFrom: string;
  floorTo: string;
  aptsPerFloor: string;
  firstApt: string;
  buildingFeatures: string[];
  gardenOnFirst: boolean;
  duplexOnTop: boolean;
}

export const emptyStructure: StructureState = {
  buildingName: "",
  floorFrom: "1",
  floorTo: "4",
  aptsPerFloor: "4",
  firstApt: "1",
  buildingFeatures: ["elevator"],
  gardenOnFirst: false,
  duplexOnTop: false,
};

export function toStructureInput(s: StructureState) {
  return {
    buildingName: s.buildingName,
    floorFrom: Number(s.floorFrom),
    floorTo: Number(s.floorTo),
    aptsPerFloor: Number(s.aptsPerFloor),
    firstApt: Number(s.firstApt),
    buildingFeatures: s.buildingFeatures,
    gardenOnFirst: s.gardenOnFirst,
    duplexOnTop: s.duplexOnTop,
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
      <div className="flex flex-col gap-2 text-sm">
        <span className="font-medium">{t.setup.buildingHas}</span>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {Object.entries(FEATURES)
            .filter(([, v]) => v.of === "building")
            .map(([k, v]) => (
              <label key={k} className="flex items-center gap-2">
                <Checkbox
                  id={`st-f-${k}`}
                  checked={value.buildingFeatures.includes(k)}
                  onCheckedChange={(on) =>
                    onChange({ ...value, buildingFeatures: on ? [...value.buildingFeatures, k] : value.buildingFeatures.filter((x) => x !== k) })
                  }
                />
                {v.name}
              </label>
            ))}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          <label className="flex items-center gap-2">
            <Checkbox id="st-garden" checked={value.gardenOnFirst} onCheckedChange={(on) => onChange({ ...value, gardenOnFirst: !!on })} />
            {t.setup.gardenOnFirst}
          </label>
          <label className="flex items-center gap-2">
            <Checkbox id="st-duplex" checked={value.duplexOnTop} onCheckedChange={(on) => onChange({ ...value, duplexOnTop: !!on })} />
            {t.setup.duplexOnTop}
          </label>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        {t.setup.structurePreview(floors, apts)} · {t.setup.structureHint}
      </p>
    </div>
  );
}
