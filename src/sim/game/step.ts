import { DISHES } from '../../data/dishes';
import { EMOTE_SECONDS } from '../../data/sim';
import { UPGRADES } from '../../data/upgrades';
import { canBuy, levelOf, tierOf } from '../economy/upgrades';
import { packSnapshot, type Snapshot } from '../snapshot';
import type { CharacterView, PropView } from '../types';
import { Bubble, PropKind } from '../types';
import { DAY } from '../../data/staff';
import { updateApplicants } from './applicants';
import { applyCommands } from './commands';
import { updateConstruction } from './construction';
import { updateArrivals, updateCustomers } from './customers';
import { packEvents, pruneEvents } from './events';
import { anchorPoints } from './purchase';
import { landFlyingDishes, updateStaff, updateTables } from './staff';
import { OrderState, TableState, type GameState } from './types';
import { updateWalkers } from './walkers';
import { updateWorkers } from './workers';
import { logEarnings } from '../shop';

function tickTimers(c: CharacterView, dt: number): void {
  c.poseTime += dt;
  if (c.emote !== 0) {
    c.emoteTime += dt;
    if (c.emoteTime >= EMOTE_SECONDS) c.emote = 0;
  }
}

/** One fixed step of the restaurant. Pure and deterministic: same state + same taps = same result. */
export function stepGame(s: GameState, dt: number): void {
  s.tick += 1;
  s.time += dt;
  const everyone = [...s.staff, ...s.customers, ...s.walkers, ...s.applicants];
  for (const c of everyone) {
    c.prevX = c.x;
    c.prevY = c.y;
  }
  applyCommands(s);
  updateConstruction(s);
  updateArrivals(s);
  updateCustomers(s, dt);
  updateStaff(s, dt);
  updateWorkers(s, dt);
  updateApplicants(s, dt);
  landFlyingDishes(s);
  updateTables(s, dt);
  logEarnings(s);
  updateWalkers(s, dt);
  for (const c of [...s.staff, ...s.customers, ...s.walkers, ...s.applicants]) tickTimers(c, dt);
  pruneEvents(s);
}

function prop(id: number, kind: PropView['kind'], x: number, y: number, extra: Partial<PropView> = {}): PropView {
  return { id, kind, x, y, variant: 0, level: 0, active: false, lift: 0, since: 0, progress: 0, bubble: 0, depthBias: 0, ...extra };
}

/** Ids for synthetic props (tickets, plate stacks) that must not collide with entity ids. */
const SYNTH = 1_000_000;

function dynamicProps(s: GameState): PropView[] {
  const out: PropView[] = [];
  for (const t of s.tables) {
    const dirty = t.state === TableState.Dirty || t.state === TableState.Cleaning;
    // level packs what is on it: the dirty plates, or each chair's dish (+1, 0 = none) in base 8.
    const dishes = t.dishes.reduce((sum, d, seat) => sum + (d + 1) * 8 ** seat, 0);
    out.push(
      prop(t.propId, PropKind.Table, t.x, t.y, {
        variant: dirty ? 2 : t.state === TableState.Occupied && dishes > 0 ? 1 : 0,
        level: dirty ? t.plates : dishes,
        since: t.since,
        progress: t.state === TableState.Cleaning ? t.progress : 0,
        bubble: t.state === TableState.Dirty && t.waiter < 0 ? Bubble.Clean : 0,
      }),
    );
  }
  const rail = s.map.ticketRail;
  let ticket = 0;
  for (const o of s.orders) {
    if (o.state === OrderState.Ready) {
      const p = s.map.passSlots[o.slot]!;
      out.push(prop(o.id, PropKind.PassDish, p.x, p.y, { variant: o.dish, active: true, lift: s.map.passTop, since: o.since, depthBias: 1 }));
    } else if ((o.state === OrderState.Queued || o.state === OrderState.Cooking) && ticket < rail.max) {
      // Order tickets hang on the rail above the pass, oldest first.
      out.push(
        prop(SYNTH + o.id, PropKind.Ticket, rail.x, rail.y0 + ticket * rail.step, {
          variant: o.dish,
          active: o.state === OrderState.Cooking,
          lift: rail.lift,
          since: o.since,
          progress: o.progress,
          depthBias: 2,
        }),
      );
      ticket += 1;
    }
  }
  const noPlates = s.staff.some((st) => st.stalled === 'plates');
  out.push(
    prop(SYNTH - 1, PropKind.PlatesClean, s.map.cleanStack.x, s.map.cleanStack.y, {
      variant: s.cleanPlates,
      lift: s.map.sinkTop,
      depthBias: 1,
      bubble: noPlates ? Bubble.NoPlates : 0,
    }),
    prop(SYNTH - 2, PropKind.PlatesDirty, s.map.dirtyStack.x, s.map.dirtyStack.y, {
      variant: s.dirtyPlates,
      lift: s.map.sinkTop,
      depthBias: 1,
      progress: s.washProgress,
    }),
  );
  // The next table and stove spots show as ghosts you can buy (variant 1 = affordable now).
  const affordable = (kind: PropKind) => (UPGRADES.some((u) => u.anchor === kind && canBuy(u, s.levels, s.coins, s.map)) ? 1 : 0);
  const spot = s.map.tables[s.tables.length];
  if (spot) out.push(prop(SYNTH - 3, PropKind.TableSlot, spot.x, spot.y, { variant: affordable(PropKind.TableSlot), depthBias: -0.4 }));
  const stoveSpot = s.map.stoves[s.stoves.length];
  if (stoveSpot) out.push(prop(SYNTH - 4, PropKind.StoveSlot, stoveSpot.stove.x, stoveSpot.stove.y, { variant: affordable(PropKind.StoveSlot), depthBias: -0.4 }));
  if (s.construction) out.push(...scaffolding(s.construction));
  return out;
}

/** Scaffolding around the lot under construction: back and front edges, then the far side. */
function scaffolding(k: NonNullable<GameState['construction']>): PropView[] {
  const out: PropView[] = [];
  const { x0, y0, x1, y1 } = k.site;
  const add = (x: number, y: number, variant: number) =>
    out.push(prop(SYNTH - 100 - out.length, PropKind.Scaffold, x, y, { variant, since: k.start + out.length * 0.06 }));
  for (let x = x0 + 0.5; x < x1; x++) add(x, y0, 0);
  for (let y = y0 + 0.5; y < y1; y++) add(x1, y, 1);
  for (let x = x0 + 0.5; x < x1; x++) add(x, y1, 0);
  return out;
}

/** What upgrades look like right now: tiers per station and dish, and where to point arrows. */
function upgradeViews(s: GameState) {
  const kinds = Object.keys(PropKind).length;
  const tiers = new Array<number>(kinds).fill(0);
  const dishTiers = DISHES.map(() => 0);
  const badges: number[] = [];
  const badged = new Set<number>();
  for (const def of UPGRADES) {
    const level = levelOf(s.levels, def.id);
    if (def.restyle === 'anchor') tiers[def.anchor] = tierOf(level);
    else if (def.restyle === 'dish' && def.effect.dish !== undefined) dishTiers[def.effect.dish] = tierOf(level);
    if (badged.has(def.anchor) || def.anchor === PropKind.TableSlot || !canBuy(def, s.levels, s.coins, s.map)) continue;
    const at = anchorPoints(s, def.anchor)[0];
    if (!at) continue;
    badged.add(def.anchor);
    badges.push(at.x, at.y, def.anchor);
  }
  return { tiers, dishTiers, badges };
}

export function gameSnapshot(s: GameState, seq: number): Snapshot {
  // The "for sale" sign comes down while the lot is being built on.
  const props = s.construction ? s.props.filter((p) => p.kind !== PropKind.SaleSign) : s.props;
  return packSnapshot([...s.staff, ...s.customers, ...s.walkers, ...s.applicants], [...props, ...dynamicProps(s)], seq, s.time, {
    events: packEvents(s),
    dayPhase: s.dayTime / DAY.seconds,
    // A copy: in dev builds arrays sent to the UI thread are frozen, and this one keeps changing.
    bumps: [...s.bumpAt],
    ...upgradeViews(s),
  });
}
