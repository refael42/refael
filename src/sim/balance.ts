import { BALANCE } from '../data/balance';
import type { MapDef } from '../data/maps';
import { STEP_SEC } from '../data/sim';
import { createBot, type Hire, type Purchase } from './bot';
import { createGame } from './game/create';
import { stepGame } from './game/step';

// Headless pacing check: a greedy bot plays for a while and we look for boredom (long stretches
// with nothing to buy) and for runaway inflation (upgrades or income exploding).

export interface Sample {
  time: number;
  coins: string;
  /** Coins earned during the last sample window, per minute. */
  perMinute: number;
  served: number;
  walkouts: number;
  rating: number;
  levels: Record<string, number>;
}

export interface DeadZone {
  start: number;
  seconds: number;
  /** What the bot finally bought when the wait ended (null = still waiting at the end). */
  then: Purchase | null;
}

export interface BalanceReport {
  seconds: number;
  purchases: Purchase[];
  hires: Hire[];
  /** Team size at the end, and how many quit along the way. */
  team: number;
  quits: number;
  samples: Sample[];
  deadZones: DeadZone[];
  /** Minutes in which the bot bought suspiciously many upgrades. */
  bulkMinutes: { minute: number; count: number }[];
  /** Sample windows where income jumped by more than `BALANCE.incomeJump` at once. */
  incomeJumps: { time: number; factor: number }[];
  firsts: { upgrade: number | null; milestone: number | null; table: number | null; burger: number | null; hire: number | null; building: number | null };
  /** When the restaurant reached each quest level (index 0 = level 2). */
  levelUps: number[];
}

export interface BalanceOptions {
  map: MapDef;
  seconds: number;
  seed: number;
  reaction?: number;
  /** Chef trophies from earlier branches (a second or later run). */
  trophies?: number;
}

const firstTime = (purchases: Purchase[], test: (p: Purchase) => boolean): number | null => purchases.find(test)?.time ?? null;

export function runBalance(o: BalanceOptions): BalanceReport {
  const s = createGame(o.map, o.seed, { trophies: o.trophies ?? 0 });
  const bot = createBot({ reaction: o.reaction ?? BALANCE.reactionSeconds, helpStaff: true, buy: true });
  const samples: Sample[] = [];
  const steps = Math.round(o.seconds / STEP_SEC);
  const sampleEvery = Math.round(BALANCE.sampleSeconds / STEP_SEC);
  let lastEarned = 0;
  let quits = 0;
  const levelUps: number[] = [];
  for (let i = 1; i <= steps; i++) {
    bot.act(s);
    stepGame(s, STEP_SEC);
    quits += s.notices.filter((n) => n.kind === 'quit' && n.time === s.time).length;
    while (levelUps.length < s.quests.level - 1) levelUps.push(s.time);
    if (i % sampleEvery === 0) {
      const earned = s.stats.earned.toNumber();
      samples.push({
        time: s.time,
        coins: s.coins.toString(),
        perMinute: ((earned - lastEarned) * 60) / BALANCE.sampleSeconds,
        served: s.stats.served,
        walkouts: s.stats.walkouts,
        rating: s.rating,
        levels: { ...s.levels },
      });
      lastEarned = earned;
    }
  }
  const p = bot.purchases;

  // Hiring someone is a purchase too: it ends a wait just like an upgrade does.
  const actions: Purchase[] = [...p, ...bot.hires.map((h) => ({ time: h.time, item: `hire ${h.role}`, level: 1, cost: 0 }))].sort((a, b) => a.time - b.time);
  const deadZones: DeadZone[] = [];
  let prev = 0;
  for (const purchase of actions) {
    if (purchase.time - prev > BALANCE.deadZoneSeconds) deadZones.push({ start: prev, seconds: purchase.time - prev, then: purchase });
    prev = purchase.time;
  }
  if (s.time - prev > BALANCE.deadZoneSeconds) deadZones.push({ start: prev, seconds: s.time - prev, then: null });

  const perMinute = new Map<number, number>();
  for (const purchase of p) {
    const m = Math.floor(purchase.time / 60);
    perMinute.set(m, (perMinute.get(m) ?? 0) + 1);
  }
  const bulkMinutes = [...perMinute].filter(([, n]) => n > BALANCE.bulkPerMinute).map(([minute, count]) => ({ minute, count }));

  // Against the best so far: a slow minute (a payday, a trial shift) followed by a normal one is
  // not an explosion; income far above anything before it is. Two minutes at a time: two
  // five-star review bonuses landing in the same minute are luck, not a runaway economy.
  const incomeJumps: BalanceReport['incomeJumps'] = [];
  const smooth = (i: number) => (i > 0 ? (samples[i]!.perMinute + samples[i - 1]!.perMinute) / 2 : samples[i]!.perMinute);
  let best = samples[0] ? smooth(0) : 0;
  for (let i = 1; i < samples.length; i++) {
    const factor = best > 0 ? smooth(i) / best : 0;
    if (factor > BALANCE.incomeJump) incomeJumps.push({ time: samples[i]!.time, factor });
    best = Math.max(best, smooth(i));
  }

  return {
    seconds: s.time,
    purchases: p,
    hires: bot.hires,
    team: s.staff.length,
    quits,
    samples,
    deadZones,
    bulkMinutes,
    incomeJumps,
    firsts: {
      upgrade: firstTime(p, () => true),
      milestone: firstTime(p, (x) => x.level === 10),
      table: firstTime(p, (x) => x.item === 'tables'),
      burger: firstTime(p, (x) => x.item === 'burger'),
      hire: bot.hires[0]?.time ?? null,
      building: firstTime(p, (x) => x.item === 'building'),
    },
    levelUps,
  };
}
