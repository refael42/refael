import { DAILY, GIFT, VIP } from '../data/retention';
import { big, type Big } from './big';
import { emit, Ev } from './game/events';
import type { Customer, GameState } from './game/types';
import { grantCoins, incomeRate } from './shop';

// The daily gift, the VIP guests and the presents on the sidewalk (src/data/retention.ts). Pure
// and deterministic: the chances come from a hash of ids, not from the game's dice, so adding
// them did not change anything else the simulation does.

/** A number in [0, 1) from an integer: the same input always gives the same answer. */
export function hash01(n: number): number {
  const h = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return h - Math.floor(h);
}

/** Coins worth `seconds` of the restaurant's recent income. */
const incomeFor = (s: GameState, seconds: number): Big => incomeRate(s).mul(seconds).floor();

// ---------- VIP guests ----------

/** Called for each newcomer leading a party: now and then they are a VIP. */
export function maybeVip(s: GameState, c: Customer): void {
  if (s.time < VIP.afterSeconds || s.time - s.lastVip < VIP.gapSeconds) return;
  if (s.customers.some((x) => x.vip)) return;
  if (hash01(c.id * 7.31 + s.city) >= VIP.chance) return;
  c.vip = true;
  c.rank = 3;
  s.lastVip = s.time;
  emit(s, Ev.VipArrives, c.x, c.y);
}

/** A VIP pays: their bonus follows the service grade, sometimes with gems. */
export function vipBonus(s: GameState, c: Customer, stars: number): void {
  if (!c.vip) return;
  const coins = incomeFor(s, (VIP.bonusSeconds * stars) / 5).max(10);
  const gems = hash01(c.id * 3.77 + 1) < VIP.gemChance ? VIP.gems : 0;
  grantCoins(s, coins);
  s.gems += gems;
  emit(s, Ev.Vip, c.x, c.y, coins.toNumber(), gems);
}

// ---------- presents on the sidewalk ----------

/** A present shows up now and then on the sidewalk by the door, and goes if nobody takes it. */
export function updateGift(s: GameState): void {
  if (s.gift && s.time >= s.gift.until) s.gift = null;
  if (s.gift || s.construction || s.time < s.nextGift) return;
  const door = s.map.doors[0]!.outside;
  const side = hash01(s.tick) < 0.5 ? -1 : 1;
  s.gift = { x: door.x + side * (1.5 + hash01(s.tick + 1) * 2), y: door.y + 0.6, until: s.time + GIFT.staysSeconds };
  s.nextGift = s.time + GIFT.everySeconds;
  emit(s, Ev.GiftAppears, s.gift.x, s.gift.y);
}

export function openGift(s: GameState): void {
  const g = s.gift;
  if (!g) return;
  s.gift = null;
  const gems = hash01(s.tick * 1.13 + 5) < GIFT.gemChance ? GIFT.gems : 0;
  const coins = gems > 0 ? big(0) : incomeFor(s, GIFT.coinSeconds).max(25);
  grantCoins(s, coins);
  s.gems += gems;
  emit(s, Ev.Gift, g.x, g.y, coins.toNumber(), gems);
}

// ---------- the daily gift ----------

/** Which day of the streak today's gift is (1..7), and whether it is still there to take. */
export function dailyToday(daily: GameState['daily'], today: string, yesterday: string): { day: number; ready: boolean } {
  if (daily.last === today) return { day: daily.streak, ready: false };
  const day = daily.last === yesterday ? (daily.streak % DAILY.rewards.length) + 1 : 1;
  return { day, ready: true };
}

export function claimDaily(s: GameState, today: string, yesterday: string): boolean {
  const { day, ready } = dailyToday(s.daily, today, yesterday);
  if (!ready) return false;
  const r = DAILY.rewards[day - 1]!;
  const coins = r.minutes > 0 ? incomeFor(s, r.minutes * 60).max(50 * day) : big(0);
  grantCoins(s, coins);
  s.gems += r.gems;
  if (r.boostMult && r.boostMinutes) {
    const left = s.time < s.boost.until && s.boost.mult === r.boostMult ? s.boost.until - s.time : 0;
    s.boost = { mult: r.boostMult, until: s.time + left + r.boostMinutes * 60 };
  }
  s.daily = { last: today, streak: day };
  emit(s, Ev.Daily, 0, 0, coins.toNumber(), r.gems, day);
  return true;
}
