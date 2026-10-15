import { it } from 'vitest';

// Crash guard (owner: "a few crashes"): random play in every building for a few minutes, with
// random taps and commands, saves and loads, purchases: nothing may throw, no position or
// drawn value may turn into NaN.
import { TIERS } from '../src/data/buildings';
import { mapForTier } from '../src/data/maps';
import { STEP_SEC } from '../src/data/sim';
import { UPGRADES } from '../src/data/upgrades';
import { SHOP } from '../src/data/shop';
import { OFFERS } from '../src/data/offers';
import { ROLE_LIST } from '../src/data/staff';
import { TABLE_STYLE_DEFS } from '../src/data/tables';
import { big } from '../src/sim/big';
import { queueCommand, tapTargets } from '../src/sim/game/commands';
import { createGame } from '../src/sim/game/create';
import { gameSnapshot, stepGame } from '../src/sim/game/step';
import { buildableTiles, tableAnchors } from '../src/sim/game/build';
import type { Command, GameState } from '../src/sim/game/types';
import { makeSave, parseSave, restoreGame } from '../src/sim/save';
import { grantPurchase } from '../src/sim/shop';
import { planReminders } from '../src/sim/reminders';

let seed = 1;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const pick = <T,>(a: readonly T[]): T | undefined => a[Math.floor(rnd() * a.length)];

function randomCommand(s: GameState, now: number): Command | null {
  const r = rnd();
  const staff = pick(s.staff);
  const table = pick(s.tables);
  if (r < 0.25) {
    const t = pick(tapTargets(s));
    return t ? t.command : null;
  }
  if (r < 0.4) return { type: 'buy', item: pick(UPGRADES)!.id, step: pick([1, 10, 'max'] as const) };
  if (r < 0.45) {
    const style = pick(TABLE_STYLE_DEFS)!.id;
    const at = pick(tableAnchors(s, style));
    return at ? { type: 'buy', item: 'tables', at, step: 1, style } : null;
  }
  if (r < 0.5) {
    const tiles = buildableTiles(s);
    const d = pick(UPGRADES.filter((u) => u.build));
    return d && tiles.length ? { type: 'buy', item: d.id, at: pick(tiles)! } : null;
  }
  if (r < 0.55 && table) {
    const style = pick(TABLE_STYLE_DEFS)!.id;
    const to = pick(tableAnchors(s, style, table.index));
    return to ? { type: 'moveTable', table: table.index, to, style } : null;
  }
  if (r < 0.58 && table) {
    const other = pick(s.tables);
    return other ? { type: 'joinTables', table: table.index, other: other.index } : null;
  }
  if (r < 0.6 && table) return { type: 'splitTable', table: table.index };
  if (r < 0.66 && staff) return pick<Command>([
    { type: 'fire', staff: staff.id },
    { type: 'bonus', staff: staff.id },
    { type: 'train', staff: staff.id, count: 10 },
    { type: 'scold', staff: staff.id },
    { type: 'reassign', staff: staff.id, role: pick(ROLE_LIST)! },
  ])!;
  if (r < 0.72) {
    const a = pick(s.applicants);
    return a ? pick<Command>([{ type: 'hire', applicant: a.id, trial: rnd() < 0.5 }, { type: 'negotiate', applicant: a.id }, { type: 'reject', applicant: a.id }])! : null;
  }
  if (r < 0.76) return { type: 'shop', item: pick(SHOP)!.id };
  if (r < 0.8) return pick<Command>([
    { type: 'rush', on: rnd() < 0.5 },
    { type: 'gift' },
    { type: 'daily', today: '2026-10-15', yesterday: '2026-10-14' },
    { type: 'festival', now },
    { type: 'festivalClaim' },
    { type: 'testBus' },
    { type: 'offers', now },
    { type: 'deal', now },
    { type: 'spin', now, paid: rnd() < 0.5 },
    { type: 'wheel' },
    { type: 'review', id: -1 },
    { type: 'wash' },
  ])!;
  if (r < 0.82 && s.works.length) return { type: 'hurry', work: 0 };
  if (r < 0.83) return { type: 'claim', quest: Math.floor(rnd() * 4) };
  if (r < 0.84) {
    const n = s.notices[0];
    return n ? { type: 'answer', notice: n.id, yes: rnd() < 0.5 } : null;
  }
  if (r < 0.845) return { type: 'branch' };
  return null;
}

function check(s: GameState, label: string) {
  for (const c of [...s.staff, ...s.customers, ...s.walkers]) {
    if (!Number.isFinite(c.x) || !Number.isFinite(c.y)) throw new Error(`${label}: NaN position (${'role' in c ? c.role : 'customer'})`);
  }
  if (!Number.isFinite(s.rating)) throw new Error(`${label}: rating NaN`);
  const snap = gameSnapshot(s, s.tick);
  for (let i = 0; i < snap.data.length; i++) {
    if (!Number.isNaN(snap.data[i]!)) continue;
    const o = i - (i % 26);
    throw new Error(`${label}: snapshot ${snap.data[i]} at field ${i % 26}, type ${snap.data[o]} kind/variant ${snap.data[o + 6]} ${snap.data[o + 7]} id ${snap.data[o + 5]}`);
  }
}

it('soak: random play in every building, saves and loads, branches', () => {
  const now = Date.UTC(2026, 9, 15, 12);
  TIERS.forEach((_, tier) => {
    seed = 1000 + tier * 77;
    let s = createGame(mapForTier(tier), 5 + tier, { levels: { building: tier }, coins: big(10).pow(10 + tier * 6), gems: 5000 });
    for (const o of OFFERS) grantPurchase(s, o.id, `tx-${tier}-${o.id}`, now);
    for (let i = 0; i < (4 * 60) / STEP_SEC; i++) {
      const cmd = rnd() < 0.15 ? randomCommand(s, now + i * 50) : null;
      if (cmd) queueCommand(s, cmd);
      try {
        stepGame(s, STEP_SEC);
      } catch (e) {
        throw new Error(`tier ${tier} step ${i} after ${JSON.stringify(cmd)}: ${(e as Error).stack}`);
      }
      if (i % 200 === 0) check(s, `tier ${tier} step ${i}`);
      if (i % 2400 === 1200) {
        planReminders(s, now, -120);
        const loaded = parseSave(JSON.stringify(makeSave(s, now)));
        if (!loaded.ok) throw new Error(`tier ${tier}: save did not load (${loaded.reason})`);
        s = restoreGame(loaded.save, 9 + i, now + 3600 * 1000);
      }
    }
  });
}, 600000);
