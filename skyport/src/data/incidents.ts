/**
 * Things that happen at the airport (M11): one row per kind. The scheduler
 * picks one now and then (by weight, among those the tier allows and that are
 * not cooling down). Text lives in i18n (inc.<kind>.title / .body).
 */
export type IncidentKind = 'storm' | 'birds' | 'fod' | 'emergency' | 'vip' | 'airshow';

export interface IncidentDef {
  kind: IncidentKind;
  /** First airport tier it can happen at. */
  minTier: number;
  /** Relative chance when an incident is due. */
  weight: number;
  /** Seconds it lasts once under way (0 = until it resolves). */
  duration: number;
  /** Seconds of warning before it starts (0 = no warning). */
  lead: number;
  /** Seconds before the same kind can come again. */
  cooldown: number;
}

export const INCIDENTS: readonly IncidentDef[] = [
  // lightning nearby: no landings, no takeoffs, no fueling on the ramp
  { kind: 'storm', minTier: 2, weight: 3, duration: 75, lead: 45, cooldown: 1200 },
  // a flock over the runway: the next plane to land takes a bird and needs an inspection
  { kind: 'birds', minTier: 3, weight: 3, duration: 60, lead: 0, cooldown: 600 },
  // debris on the runway: closed until the inspection car has driven out for it
  { kind: 'fod', minTier: 2, weight: 3, duration: 0, lead: 0, cooldown: 600 },
  // a plane declares an emergency: it lands first, the fire trucks stand by
  { kind: 'emergency', minTier: 2, weight: 2, duration: 0, lead: 0, cooldown: 1200 },
  // a VIP flight: red carpet, security, a big tip if all goes well
  { kind: 'vip', minTier: 2, weight: 3, duration: 0, lead: 0, cooldown: 700 },
  // an air show over the field: the runway closes, crowds come, tickets sell
  { kind: 'airshow', minTier: 2, weight: 2, duration: 60, lead: 120, cooldown: 2400 },
];

/** Seconds between incidents (a random pick in this range). */
export const INCIDENT_GAP: readonly [number, number] = [480, 900];

/** Weekend days of the game week (day 1 = Monday): more passengers fly. */
export const WEEKEND_PAX = 1.2;

export function incidentDef(kind: IncidentKind): IncidentDef {
  return INCIDENTS.find((d) => d.kind === kind) ?? INCIDENTS[0];
}
