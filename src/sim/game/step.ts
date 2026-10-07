import { DISHES } from '../../data/dishes';
import { EMOTE_SECONDS } from '../../data/sim';
import { nextTableSpot } from './build';
import { barSlotPoint, counterBefore, landFlyingDrinks } from './bar';
import { styleIndex } from '../../data/tables';
import { UPGRADES } from '../../data/upgrades';
import { canBuy, levelOf, tierOf, upgradeDef } from '../economy/upgrades';
import { bestBuy } from '../economy/value';
import { packSnapshot, type Snapshot } from '../snapshot';
import type { CharacterView, PropView } from '../types';
import { Bubble, PropKind } from '../types';
import { DAY } from '../../data/staff';
import { updateApplicants } from './applicants';
import { applyCommands } from './commands';
import { updateConstruction } from './construction';
import { finishWork, UPGRADE_QUIET } from './purchase';
import { updateWorks } from './works';
import { updateArrivals, updateCustomers } from './customers';
import { emit, Ev, packEvents, pruneEvents } from './events';
import { anchorPoints, siteOf } from './purchase';
import { landFlyingDishes, updateStaff, updateTables } from './staff';
import { OrderState, TableState, type GameState } from './types';
import { updateWalkers } from './walkers';
import { updateWorkers } from './workers';
import { syncFamilyTables } from './create';
import { parking, slotPoint } from './packing';
import { logEarnings } from '../shop';
import { weatherOn } from '../weather';
import { updateGift } from '../retention';
import { updateBus } from './bus';
import { updateDeliveries } from './delivery';
import { isWeekend } from '../calendar';
import { CITIES } from '../../data/franchise';

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
  // Crews down tools during the building show (the room is being rebuilt under them).
  if (!s.construction) updateWorks(s, dt, (w) => finishWork(s, w));
  updateArrivals(s);
  updateDeliveries(s);
  updateCustomers(s, dt);
  updateStaff(s, dt);
  updateWorkers(s, dt);
  updateApplicants(s, dt);
  landFlyingDishes(s);
  landFlyingDrinks(s);
  updateTables(s, dt);
  // A family table bought while its table for two was busy grows once the guests are gone.
  if (s.mods.family > 0) for (const t of syncFamilyTables(s)) emit(s, Ev.Upgrade, t.x, t.y, 1, UPGRADE_QUIET, PropKind.Table);
  logEarnings(s);
  updateGift(s);
  updateBus(s);
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
    // level packs what is on it: the dirty plates, or each chair's dish (+1, 0 = none) in base 16.
    const dishes = t.dishes.reduce((sum, d, seat) => sum + (d + 1) * 16 ** seat, 0);
    // Each chair's drink (+1, 0 = none) in base 8.
    const drinks = t.drinks.reduce((sum, d, seat) => sum + (d + 1) * 8 ** seat, 0);
    const look = {
      extra: dirty ? 0 : drinks,
      variant: dirty ? 2 : t.state === TableState.Occupied && dishes > 0 ? 1 : 0,
      level: dirty ? t.plates : dishes,
      // Every chair its style has (a family table for four, a long table for six).
      active: t.seats > 2,
      since: t.since,
      style: styleIndex(t.style),
    };
    out.push(
      prop(t.propId, PropKind.Table, t.x, t.y, {
        ...look,
        progress: t.state === TableState.Cleaning ? t.progress : 0,
        bubble: t.state === TableState.Dirty && t.waiter < 0 ? Bubble.Clean : 0,
      }),
    );
    // A long table's back half: the same plates and looks, drawn a tile further back.
    if (t.backId >= 0 && t.style === 'long') out.push(prop(t.backId, PropKind.TableBack, t.x, t.y - 1, look));
  }
  const rail = s.map.ticketRail;
  let ticket = 0;
  for (const o of s.orders) {
    if (o.state === OrderState.Ready) {
      const p = slotPoint(s, o);
      // level 1: a delivery, in its takeaway box (on the deliveries' own pass while packers work).
      const lift = o.lane && s.map.packing ? s.map.packing.passTop : s.map.passTop;
      out.push(prop(o.id, PropKind.PassDish, p.x, p.y, { variant: o.dish, level: (o.delivery ? 1 : 0) + (o.checked ? 2 : 0), active: true, lift, since: o.since, depthBias: 1 }));
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
  // Drinks waiting on the bar's pass (they bob and sparkle like dishes), and in front of the guests at the bar.
  const barTop = s.map.bar.passTop;
  for (const d of s.drinks) {
    if (d.state !== OrderState.Ready) continue;
    const p = barSlotPoint(s, d.slot);
    out.push(prop(SYNTH * 2 + d.id, PropKind.Drink, p.x, p.y, { variant: d.drink, active: true, lift: barTop, since: d.since, depthBias: 1 }));
  }
  for (const c of s.customers) {
    if (c.stool < 0 || c.sipping < 0) continue;
    const p = counterBefore(s, c.stool);
    out.push(prop(SYNTH * 2 + c.id, PropKind.Drink, p.x, p.y, { variant: c.sipping, lift: barTop, depthBias: 1 }));
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
  const spot = s.tables.length < s.map.tables.length ? nextTableSpot(s) : null;
  if (spot) out.push(prop(SYNTH - 3, PropKind.TableSlot, spot.x, spot.y, { variant: affordable(PropKind.TableSlot), depthBias: -0.4, style: styleIndex(spot.style) }));
  const stoveSpot = s.map.stoves[s.stoves.length];
  if (stoveSpot) out.push(prop(SYNTH - 4, PropKind.StoveSlot, stoveSpot.stove.x, stoveSpot.stove.y, { variant: affordable(PropKind.StoveSlot), depthBias: -0.4 }));
  if (s.construction) out.push(...scaffolding(s.construction));
  // A present on the sidewalk, waiting for a tap (`since`: when it goes).
  if (s.gift) out.push(prop(SYNTH - 50, PropKind.Gift, s.gift.x, s.gift.y, { since: s.gift.until }));
  // The tourist bus: drawn where it stops, the renderer drives it in and out (`since` = it set
  // off toward the stop, `progress` = when it pulls away, 0 = not yet). Nothing walks on the road,
  // so it is drawn over the sidewalk behind it.
  if (s.bus) out.push(prop(SYNTH - 51, PropKind.Bus, s.bus.x, s.bus.y, { since: s.bus.arrive, progress: s.bus.leave < Infinity ? s.bus.leave : 0, active: s.bus.aboard > 0, depthBias: 2 }));
  // Each courier's scooter by the curb; while they are out it rides off and back (the renderer
  // drives it: `since` = left, `progress` = back).
  for (const st of s.staff) {
    if (st.role !== 'courier' || st.leaving) continue;
    const p = parking(s, st.slot, false);
    const job = st.job?.kind === 'deliver' && st.job.phase === 'away' ? st.job : null;
    out.push(prop(SYNTH - 400 - st.slot, PropKind.Scooter, p.x, p.y, { variant: st.slot, active: job !== null, since: job?.left ?? 0, progress: job?.back ?? 0 }));
  }
  // The weekend: flags along the front of the restaurant.
  if (isWeekend(s.day)) {
    const b = s.map.building;
    for (let x = b.x0 + 0.5, i = 0; x < b.x1; x++, i++) out.push(prop(SYNTH - 300 - i, PropKind.Bunting, x, b.y1, { variant: i % 2, depthBias: 0.6 }));
  }
  // Festival trophies won, on show by the door.
  s.festival.trophies.forEach((theme, i) => {
    const p = s.map.trophySpots[i];
    if (p) out.push(prop(SYNTH - 60 - i, PropKind.Trophy, p.x, p.y, { variant: theme }));
  });
  // Big upgrades in progress: a crate where a showpiece goes in, a barrier in front of a station.
  for (const w of s.works) {
    const p = siteOf(s, w);
    const crate = w.at !== null;
    out.push(prop(SYNTH - 200 - w.id, PropKind.WorkSite, p.x + (crate ? 0 : 0.35), p.y + (crate ? 0 : 0.55), { variant: crate ? 1 : 0, since: w.lastTap, depthBias: 0.5 }));
  }
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
  // The best buy right now gets a gold star instead of the arrow.
  const best = bestBuy(s.levels, s.map, (def) => canBuy(def, s.levels, s.coins, s.map));
  const bestAt = best ? badges.findIndex((v, i) => i % 3 === 2 && v === best.anchor) : -1;
  const bestBadge = bestAt >= 0 ? badges.splice(bestAt - 2, 3) : [];
  return { tiers, dishTiers, badges, bestBadge };
}

export function gameSnapshot(s: GameState, seq: number): Snapshot {
  // The "for sale" sign comes down while the lot is being built on.
  const props = s.construction ? s.props.filter((p) => p.kind !== PropKind.SaleSign) : s.props;
  // A courier out on a ride is on the scooter, not on the map.
  return packSnapshot([...s.staff.filter((st) => !st.away), ...s.customers, ...s.walkers, ...s.applicants], [...props, ...dynamicProps(s)], seq, s.time, {
    events: packEvents(s),
    dayPhase: s.dayTime / DAY.seconds,
    // A copy: in dev builds arrays sent to the UI thread are frozen, and this one keeps changing.
    bumps: [...s.bumpAt],
    weather: weatherOn(s.day),
    city: s.city % CITIES.length,
    works: s.works.flatMap((w) => {
      const p = siteOf(s, w);
      return [p.x, p.y, w.total > 0 ? 1 - w.left / w.total : 1, Math.max(0, w.left), upgradeDef(w.item).anchor];
    }),
    ...upgradeViews(s),
  });
}
