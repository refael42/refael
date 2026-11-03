/**
 * Goals: one at a time, they lead a new player through the game (first plane,
 * first upgrade, first worker, a second airline, the next airport...). Each
 * shows what to do and how far along you are, and pays a small reward. Text
 * lives in i18n (goal.<id>, goalHow.<id>).
 */
import { roleIndex, STAFF_ROLES } from '../../data/staff';
import { tierDef } from '../../data/tiers';
import { Big } from '../big';
import { pushEvent } from './events';
import type { GameState } from './types';

/** Which button the "show me" hand points at. */
export type GoalTarget = 'flight' | 'upgrades' | 'staff' | 'airlines' | 'airport' | 'supplies' | 'board' | null;

export interface GoalDef {
  id: string;
  /** Coins at the dirt strip (grows with the tier's pay). */
  reward: number;
  target: GoalTarget;
  /** How far along: done when have >= need. */
  progress: (s: GameState) => { have: number; need: number };
}

const upg = (s: GameState, id: string) => s.upg[id] ?? 0;
const role = (s: GameState, id: Parameters<typeof roleIndex>[0]) => s.staff.filter((m) => m.role === roleIndex(id)).length;
const one = (ok: boolean) => ({ have: ok ? 1 : 0, need: 1 });

export const GOALS: readonly GoalDef[] = [
  { id: 'firstFlight', reward: 30, target: 'flight', progress: (s) => ({ have: Math.min(1, s.stats.served), need: 1 }) },
  { id: 'serve5', reward: 50, target: 'flight', progress: (s) => ({ have: Math.min(5, s.stats.served), need: 5 }) },
  { id: 'firstUpgrade', reward: 40, target: 'upgrades', progress: (s) => one(Object.values(s.upg).some((l) => l > 0)) },
  { id: 'firstHire', reward: 60, target: 'staff', progress: (s) => ({ have: Math.min(1, s.staff.length), need: 1 }) },
  { id: 'stand2', reward: 100, target: 'upgrades', progress: (s) => ({ have: Math.min(2, s.standsBuilt), need: 2 }) },
  {
    id: 'fullCrew',
    reward: 150,
    target: 'staff',
    progress: (s) => {
      const roles = STAFF_ROLES.filter((r) => r.unlockTier <= 1);
      return { have: roles.filter((r) => role(s, r.id) > 0).length, need: roles.length };
    },
  },
  { id: 'secondAirline', reward: 150, target: 'airlines', progress: (s) => ({ have: Math.min(2, s.contracts.length), need: 2 }) },
  { id: 'tier2', reward: 200, target: 'airport', progress: (s) => one(s.tier >= 2) },
  { id: 'ils', reward: 150, target: 'upgrades', progress: (s) => one(upg(s, 'ils') > 0) },
  { id: 'fuelFarm', reward: 150, target: 'upgrades', progress: (s) => one(upg(s, 'fuelFarm') > 0) },
  { id: 'stands5', reward: 250, target: 'upgrades', progress: (s) => ({ have: Math.min(5, s.standsBuilt), need: 5 }) },
  { id: 'tier3', reward: 400, target: 'airport', progress: (s) => one(s.tier >= 3) },
  { id: 'mechanic', reward: 300, target: 'staff', progress: (s) => one(role(s, 'mechanic') > 0) },
  { id: 'mediumStand', reward: 300, target: 'upgrades', progress: (s) => one(upg(s, 'standMed') > 0) },
  { id: 'hangar', reward: 400, target: 'upgrades', progress: (s) => one(upg(s, 'hangar') > 0) },
  { id: 'firstCheck', reward: 300, target: 'supplies', progress: (s) => one(s.stats.checks > 0) },
  { id: 'tier4', reward: 600, target: 'airport', progress: (s) => one(s.tier >= 4) },
  { id: 'gates', reward: 600, target: 'upgrades', progress: (s) => one(upg(s, 'gates') > 0) },
  { id: 'cargo', reward: 600, target: 'upgrades', progress: (s) => one(upg(s, 'cargoApron') > 0) },
  { id: 'tier5', reward: 1000, target: 'airport', progress: (s) => one(s.tier >= 5) },
  { id: 'helipad', reward: 800, target: 'upgrades', progress: (s) => one(upg(s, 'helipad') > 0) },
];

/** The goal to work on now (null when all are done). */
export function currentGoal(s: GameState): GoalDef | null {
  return GOALS[s.goal] ?? null;
}

export function goalReward(s: GameState, g: GoalDef): number {
  return Math.round(g.reward * tierDef(s.tier).pay);
}

/** Done goals pay their reward and the next one comes up (several at once if you are ahead). */
export function updateGoals(s: GameState): void {
  // (a few times a second is plenty)
  if (s.tick % 10 !== 0) return;
  for (let g = currentGoal(s); g; g = currentGoal(s)) {
    const p = g.progress(s);
    if (p.have < p.need) return;
    const reward = goalReward(s, g);
    s.money = s.money.add(Big.fromNumber(reward));
    s.stats.earned = s.stats.earned.add(Big.fromNumber(reward));
    pushEvent(s, 'goalDone', 0, 0, s.goal, reward);
    s.goal++;
  }
}

/** For saves from before goals existed: skip what is already done, without paying for it. */
export function skipDoneGoals(s: GameState): void {
  for (let g = currentGoal(s); g; g = currentGoal(s)) {
    const p = g.progress(s);
    if (p.have < p.need) return;
    s.goal++;
  }
}
