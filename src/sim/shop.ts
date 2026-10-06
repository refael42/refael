import { FLASH } from '../data/events';
import { NAMES } from '../data/names';
import { GEMS, SHOP_BY_ID, STAR, WARP_MIN_PER_SECOND, type ShopItem } from '../data/shop';
import { ROLES, STAT_IDS, type StatId } from '../data/staff';
import { big, type Big } from './big';
import { computeMods } from './economy/upgrades';
import { emote } from './game/customers';
import { emit, Ev } from './game/events';
import { applicantLook, uniformLook, wageFor } from './game/people';
import { createStaff } from './game/staff';
import type { GameState } from './game/types';
import { hasRoom } from './game/workers';
import { advanceWorks } from './game/works';
import { hash01 } from './retention';
import { int } from './rng';
import { Emote } from './types';

// The item shop's rules: pure, like the rest of the sim. Gems in, effects out.

/** Seconds of history kept for the income rate. */
const RATE_WINDOW = 120;
const RATE_EVERY = 5;

/** Coins earned by serving so far (everything earned but what was handed out). */
const servedEarnings = (s: GameState) => s.stats.earned.sub(s.stats.granted);

/** Coins handed out (a prize, a present, a time warp...): spendable and earned, but not income. */
export function grantCoins(s: GameState, coins: Big): void {
  s.coins = s.coins.add(coins);
  s.stats.earned = s.stats.earned.add(coins);
  s.stats.granted = s.stats.granted.add(coins);
}

/** Samples coins earned now and then (time warps pay by the recent rate). */
export function logEarnings(s: GameState): void {
  const last = s.earnLog[s.earnLog.length - 1];
  if (last && s.time - last.time < RATE_EVERY) return;
  s.earnLog.push({ time: s.time, earned: servedEarnings(s) });
  while (s.earnLog.length > 2 && s.earnLog[0]!.time < s.time - RATE_WINDOW) s.earnLog.shift();
}

/** Coins per second lately (at least the warp minimum). */
export function incomeRate(s: GameState) {
  const first = s.earnLog[0];
  const span = first ? s.time - first.time : 0;
  const rate = first && span > 0 ? servedEarnings(s).sub(first.earned).div(span) : big(0);
  return rate.max(WARP_MIN_PER_SECOND);
}

/** The income multiplier running now (1 = no boost). */
export const boostNow = (s: GameState): number => (s.time < s.boost.until ? s.boost.mult : 1);

/** Can this be bought right now (enough gems, room for a star, a perk not owned yet)? `cost`: a deal's price. */
export function canShop(s: GameState, item: ShopItem, cost = item.kind === 'gems' ? 0 : item.cost): boolean {
  if (item.kind === 'gems') return false;
  if (s.gems < cost) return false;
  if (item.kind === 'star') return hasRoom(s, item.role);
  if (item.kind === 'perk' || item.kind === 'crew') return !s.perks[item.id];
  if (item.kind === 'boost') return boostNow(s) <= item.mult;
  return true;
}

function hireStar(s: GameState, role: ShopItem & { kind: 'star' }): void {
  const main = ROLES[role.role].primary;
  const stats = Object.fromEntries(STAT_IDS.map((k) => [k, main.includes(k) ? STAR.mainStat : STAR.otherStat])) as Record<StatId, number>;
  const traits = [...STAR.traits];
  const person = { name: int(s.rng, 0, NAMES.length), stats, traits, level: STAR.level, wage: wageFor(s, role.role, STAR.level, stats, traits) };
  const door = s.map.doors[0]!.inside;
  const st = createStaff(s, role.role, person, uniformLook(role.role, applicantLook(s.rng)), door);
  st.rank = 2;
  st.morale = 1;
  emote(st, Emote.Star);
  emit(s, Ev.Hired, door.x, door.y);
  s.staff.push(st);
  s.stats.hires += 1;
}

/** Spends gems on a shop item (`cost`: a deal's price). Returns whether it happened. */
export function buyShopItem(s: GameState, id: string, cost?: number): boolean {
  const item = SHOP_BY_ID[id];
  if (!item || item.kind === 'gems' || !canShop(s, item, cost ?? item.cost)) return false;
  s.gems -= cost ?? item.cost;
  switch (item.kind) {
    case 'boost': {
      // Buying the same boost again adds its time.
      const left = Math.max(0, s.boost.until - s.time);
      s.boost = { mult: item.mult, until: s.time + (boostNow(s) === item.mult ? left : 0) + item.minutes * 60 };
      break;
    }
    case 'warp': {
      const coins = incomeRate(s).mul(item.hours * 3600).floor();
      grantCoins(s, coins);
      emit(s, Ev.Bonus, 0, 0, coins.toNumber());
      // The skipped time passes for the crews too.
      advanceWorks(s, item.hours * 3600);
      break;
    }
    case 'crew':
      s.perks = { ...s.perks, [item.id]: 1 };
      break;
    case 'star':
      hireStar(s, item);
      break;
    case 'perk':
      s.perks = { ...s.perks, [item.id]: 1 };
      s.mods = computeMods(s.levels, s.perks, s.trophies);
      break;
  }
  return true;
}

// ---------- the flash deal ----------

const DEAL_MS = FLASH.everyHours * 3600 * 1000;

export interface Deal {
  /** The deal's number (a new one every few hours, the same on every phone). */
  slot: number;
  item: Exclude<ShopItem, { kind: 'gems' }>;
  /** Its price now, and the share taken off. */
  cost: number;
  off: number;
  /** When it ends (phone clock, ms). */
  ends: number;
  bought: boolean;
}

/** Today's deal at this moment. Deals that sell something already owned for good are skipped. */
export function dealAt(s: GameState, now: number): Deal | null {
  const slot = Math.floor(now / DEAL_MS);
  const deals = FLASH.deals;
  const start = Math.floor(hash01(slot * 1.37 + 0.5) * deals.length);
  for (let k = 0; k < deals.length; k++) {
    const d = deals[(start + k) % deals.length]!;
    const item = SHOP_BY_ID[d.item];
    if (!item || item.kind === 'gems') continue;
    if ((item.kind === 'perk' || item.kind === 'crew') && s.perks[item.id]) continue;
    const bought = s.flash.slot === slot && s.flash.bought;
    return { slot, item, cost: Math.max(1, Math.round(item.cost * (1 - d.off))), off: d.off, ends: (slot + 1) * DEAL_MS, bought };
  }
  return null;
}

/** Takes the deal (once). */
export function buyDeal(s: GameState, now: number): boolean {
  const deal = dealAt(s, now);
  if (!deal || deal.bought || !buyShopItem(s, deal.item.id, deal.cost)) return false;
  s.flash = { slot: deal.slot, bought: true };
  emit(s, Ev.Deal, 0, 0, deal.cost);
  return true;
}

/** Gems from a gem pack (a demo purchase) or a quest level-up. */
export function addGems(s: GameState, amount: number): void {
  if (Number.isFinite(amount) && amount > 0) s.gems += Math.floor(amount);
}

export { GEMS };
