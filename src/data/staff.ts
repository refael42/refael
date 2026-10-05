import type { Look } from './looks';
import { LOOKS } from './scenes';

// Staff: roles, what stats do, wages, morale and energy. The restaurant opens with only a cook;
// everyone else is hired from applicants who show up at the door.

export type Role = 'cook' | 'waiter' | 'washer' | 'host' | 'cleaner' | 'manager';
export const ROLE_LIST: readonly Role[] = ['cook', 'waiter', 'washer', 'host', 'cleaner', 'manager'];

export type StatId = 'speed' | 'quality' | 'charm' | 'stamina';
export const STAT_IDS: readonly StatId[] = ['speed', 'quality', 'charm', 'stamina'];

export interface RoleDef {
  role: Role;
  /** Tiles per second at speed 5. */
  walkSpeed: number;
  /** Uniform; the face and hair come from the person. */
  look: Look;
  /** Daily wage at level 1, counted in fries sold (wages follow the menu's prices). */
  wageDishes: number;
  /** How many fit in the stand. Cooks are limited by stoves instead. */
  cap: number;
  /** How often applicants want this job (relative). */
  weight: number;
  /** Applicants only show up for this job once the team is this big... */
  minTeam: number;
  /** ...and has at least this many of these jobs (a shift manager needs waiters to run). */
  needs?: Partial<Record<Role, number>>;
  /** The stats this job uses most; level-ups mostly improve these. */
  primary: readonly [StatId, StatId];
}

export const ROLES: Record<Role, RoleDef> = {
  cook: { role: 'cook', walkSpeed: 1.8, look: LOOKS.cook, wageDishes: 3, cap: 0, weight: 2, minTeam: 0, primary: ['speed', 'quality'] },
  waiter: { role: 'waiter', walkSpeed: 1.7, look: LOOKS.waiter, wageDishes: 2.5, cap: 3, weight: 4, minTeam: 0, primary: ['speed', 'charm'] },
  washer: { role: 'washer', walkSpeed: 1.5, look: LOOKS.washer, wageDishes: 2, cap: 1, weight: 3, minTeam: 0, primary: ['speed', 'stamina'] },
  host: { role: 'host', walkSpeed: 1.5, look: LOOKS.host, wageDishes: 2.5, cap: 1, weight: 2, minTeam: 3, primary: ['charm', 'speed'] },
  cleaner: { role: 'cleaner', walkSpeed: 1.6, look: LOOKS.cleaner, wageDishes: 2, cap: 2, weight: 2, minTeam: 3, primary: ['speed', 'stamina'] },
  manager: { role: 'manager', walkSpeed: 1.7, look: LOOKS.manager, wageDishes: 5, cap: 1, weight: 2, minTeam: 5, needs: { waiter: 2 }, primary: ['charm', 'stamina'] },
};

/**
 * The shift manager (owner request) runs the waiters from the end of the pass: calls out ready
 * dishes (the guest who has waited the longest first), keeps the floor team quick, fresh and in
 * good spirits, and walks over to calm the most impatient guest now and then. Effects scale
 * with their charm (and how well they work right now).
 */
export const SHIFT = {
  /** Waiters' work speed with a manager on shift (at charm 5). */
  waiterSpeed: 0.2,
  /** Share of the waiters' tiredness the manager takes away. */
  drainCut: 0.4,
  /** Morale the floor team (waiters, host, cleaners) gains per minute. */
  moralePerMinute: 0.08,
  /** A table visit every this many seconds (at speed 5), to a guest whose patience is below `calmBelow`. */
  calmEverySeconds: 9,
  calmBelow: 0.7,
  /** Seconds at the table, and the share of the guest's patience it gives back. */
  talkSeconds: 1.4,
  calmPatience: 0.35,
} as const;

export const STARTING_STAFF: readonly Role[] = ['cook'];

export const STAFF = {
  /** Stats run 1..10; 5 is average. Each point away from 5 changes the effect by `perPoint`. */
  stat: { min: 1, max: 10, average: 5, perPoint: 0.06 },
  /** Energy 0..1: drains while working (less with stamina), refills while idle. */
  energy: { drainPerSecond: 1 / 160, staminaPerPoint: 0.1, recoverPerSecond: 1 / 20, tired: 0.25, slowestAt0: 0.55 },
  /** Morale 0..1: speed scales from `slowest` (0) to `fastest` (1). Below `quit` at payday = they quit. */
  morale: {
    start: 0.75,
    slowest: 0.7,
    fastest: 1.1,
    paid: 0.05,
    unpaid: -0.35,
    bonus: 0.3,
    scold: -0.15,
    raiseYes: 0.2,
    raiseNo: -0.2,
    gossip: -0.04,
    quit: 0.12,
    unpaidDaysToQuit: 2,
  },
  /** Scolding: a short burst of speed, paid for in morale. */
  scold: { seconds: 25, speedBonus: 0.25 },
  /** XP per finished job; level n needs `first * growth^(n-1)` more. */
  xp: { perJob: 1, first: 12, growth: 1.6 },
  /** Daily chance a good worker asks for a raise, and by how much. */
  raise: { minLevel: 2, minDaysBetween: 2, chance: 0.3, amount: 0.2, maxAmount: 0.5 },
  /** Wage multiplier per level above 1. */
  wagePerLevel: 0.25,
  /** Signing fee, in days of wage. Training costs `trainDays * level` days of wage. Bonus = one day. */
  signingDays: 1,
  trainDays: 3,
  /** Offering less: the cut, and the base chance they accept. */
  negotiate: { cut: 0.2, accept: 0.55, perLevel: -0.06 },
  /** Uniform upgrades: a silver badge from this level, gold from the next. */
  rankLevels: [3, 6],
} as const;

/**
 * Applicants: the first comes fast (first hire < 2 min), then every so often. A kitchen with no
 * cook gets a cook applicant almost at once (a trial shift costs nothing: never a dead end).
 */
export const APPLICANTS = { firstSeconds: 20, gap: { min: 35, max: 70 }, patienceSeconds: 70, maxWaiting: 2, levelUpChance: 0.35, noCookSeconds: 8 } as const;

/** One in-game day; wages are paid when it ends. */
export const DAY = { seconds: 120 } as const;

export const KITCHEN = {
  /** Plates the restaurant owns; all start clean. The clean-dishes loop cycles them. */
  plates: 5,
  /** Seconds for the dishwasher to wash and polish one plate. */
  washSeconds: 3,
  /** A player tap at the sink scrubs this share of a plate. */
  handWashTapBoost: 0.34,
  /** The cook turns to the pass and sets the plate down. */
  plateSeconds: 0.45,
  /** The waiter wipes a table before carrying the dirty plate away. */
  bussSeconds: 0.7,
  /** Waiters hand dishes over / pick plates up this fast. */
  handoffSeconds: 0.35,
  /** The host takes this long (at speed 5) to welcome the first person in line. */
  hostSeconds: 2.5,
} as const;
