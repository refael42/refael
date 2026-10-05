import { OFFLINE } from '../data/economy';
import type { MapDef } from '../data/maps';
import { STEP_SEC } from '../data/sim';
import { ZERO, type Big } from './big';
import { createBot } from './bot';
import { createGame } from './game/create';
import { stepGame } from './game/step';
import type { SaveData } from './save';

// Offline progress: instead of guessing, run the real simulation headless for a few minutes
// with the saved upgrades (staff seating people a bit slowly), measure coins per second, and
// pay a share of that for the time away (capped).

export interface OfflineEarnings {
  /** Real seconds away, and the part that counted (after the cap). */
  awaySeconds: number;
  paidSeconds: number;
  coins: Big;
}

/** Coins per second this restaurant makes with nobody tapping except slow seating. */
export function measureIncomeRate(map: MapDef, save: SaveData, seed: number): Big {
  const s = createGame(map, seed, { levels: save.levels, rating: save.rating, coins: ZERO });
  const bot = createBot({ reaction: OFFLINE.reactionSeconds, helpStaff: false, buy: false });
  const run = (seconds: number) => {
    for (let i = Math.round(seconds / STEP_SEC); i > 0; i--) {
      bot.act(s);
      stepGame(s, STEP_SEC);
    }
  };
  run(OFFLINE.warmupSeconds);
  const before = s.stats.earned;
  const measured = OFFLINE.sampleSeconds - OFFLINE.warmupSeconds;
  run(measured);
  return s.stats.earned.sub(before).div(measured);
}

export function offlineEarnings(map: MapDef, save: SaveData, now: number): OfflineEarnings | null {
  const awaySeconds = (now - save.savedAt) / 1000;
  if (!(awaySeconds >= OFFLINE.minSeconds)) return null;
  const paidSeconds = Math.min(awaySeconds, OFFLINE.capHours * 3600);
  // Seeded from the save time: the same save always measures the same rate.
  const rate = measureIncomeRate(map, save, Math.floor(save.savedAt % 2147483647));
  const coins = rate.mul(paidSeconds * OFFLINE.efficiency).floor();
  return coins.gt(0) ? { awaySeconds, paidSeconds, coins } : null;
}
