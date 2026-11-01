/** Fictional destinations. Display names live in i18n under `city.<id>`. */
export type CityKind = 'beach' | 'business' | 'mountain' | 'capital' | 'island' | 'village';

export interface CityDef {
  id: string;
  kind: CityKind;
  /** Distance class, 1 = short hop, 5 = long haul. */
  range: number;
}

export const CITIES: readonly CityDef[] = [
  { id: 'ambervale', kind: 'village', range: 1 },
  { id: 'brightwater', kind: 'beach', range: 1 },
  { id: 'cedarpoint', kind: 'mountain', range: 1 },
  { id: 'dunmore', kind: 'village', range: 1 },
  { id: 'elmsford', kind: 'business', range: 2 },
  { id: 'foxhollow', kind: 'village', range: 1 },
  { id: 'goldcrest', kind: 'beach', range: 2 },
  { id: 'harborview', kind: 'business', range: 2 },
  { id: 'ironpeak', kind: 'mountain', range: 3 },
  { id: 'juniper', kind: 'island', range: 3 },
  { id: 'kestrelbay', kind: 'beach', range: 3 },
  { id: 'lumenport', kind: 'capital', range: 4 },
  { id: 'marisol', kind: 'island', range: 4 },
  { id: 'novaterra', kind: 'capital', range: 5 },
];
