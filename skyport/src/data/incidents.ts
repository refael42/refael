/**
 * Things that happen at the airport (M11): one row per kind. The scheduler
 * picks one now and then (by weight, among those the tier allows and that are
 * not cooling down). Text lives in i18n (inc.<kind>.title / .body).
 */
export type IncidentKind = 'storm' | 'birds' | 'fod' | 'emergency' | 'vip' | 'airshow' | 'medical' | 'celebrity' | 'historic';

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
  // a sick passenger on an inbound plane: the ambulance meets it at the stand
  { kind: 'medical', minTier: 2, weight: 3, duration: 0, lead: 0, cooldown: 700 },
  // a celebrity in a private plane: the press (buzz) or privacy (a tip)
  { kind: 'celebrity', minTier: 2, weight: 2, duration: 0, lead: 0, cooldown: 1500 },
  // a historic plane visits: it stands on show for a while and visitors buy tickets
  { kind: 'historic', minTier: 2, weight: 2, duration: 0, lead: 0, cooldown: 1800 },
];

/** Seconds between incidents (a random pick in this range). */
export const INCIDENT_GAP: readonly [number, number] = [480, 900];

/** Weekend days of the game week (day 1 = Monday): more passengers fly. */
export const WEEKEND_PAX = 1.2;

/** Seconds a medical case may wait (circling) before the patient is flown elsewhere. */
export const MEDICAL_DEADLINE = 300;
/** Seconds the paramedics take to carry the patient off. */
export const MEDICAL_WORK = 8;

/** A celebrity flight pays this much more than a normal one. */
export const CELEB_PAY = 3;
/** Seconds of buzz after a celebrity visit the press covered (more people want to fly). */
export const BUZZ_SECONDS = 600;
export const BUZZ_PAX = 1.15;

/**
 * Who comes on the special visits: the celebrity flies a private jet (a light
 * twin where the airport has no business-jet stand yet), the historic plane is
 * flown by a private owner.
 */
export const VISITORS = {
  celebAirline: 'velvet',
  celebPlanes: ['kestrel', 'finch'],
  historicAirline: 'puddle',
  historicPlane: 'heritage',
} as const;

/** Seconds a historic plane stands on show, and the ticket coins a second (x tier pay x rating). */
export const EXHIBIT_SECONDS = 180;
export const EXHIBIT_RATE = 0.5;

export function incidentDef(kind: IncidentKind): IncidentDef {
  return INCIDENTS.find((d) => d.kind === kind) ?? INCIDENTS[0];
}
