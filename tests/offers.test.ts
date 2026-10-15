import { describe, expect, it } from 'vitest';
import { mapForTier, STAND_MAP } from '../src/data/maps';
import { HERO, HERO_BY_ID, HERO_TURNS, OFFER_BY_ID, OFFER_TIMES, OFFERS } from '../src/data/offers';
import { STEP_SEC } from '../src/data/sim';
import { big } from '../src/sim/big';
import { computeMods } from '../src/sim/economy/upgrades';
import { queueCommand } from '../src/sim/game/commands';
import { createGame } from '../src/sim/game/create';
import { stepGame } from '../src/sim/game/step';
import { capacity, headcount } from '../src/sim/game/workers';
import { openBranch } from '../src/sim/franchise';
import { heroOfTurn, offersAt, ownsHero, seeOffers, turnAt, turnEnds, worthOf } from '../src/sim/offers';
import { makeSave, parseSave, restoreGame } from '../src/sim/save';
import { grantPurchase } from '../src/sim/shop';
import type { GameState } from '../src/sim/game/types';

const HOUR = 3600 * 1000;
/** Some moment well after the turns began. */
const NOW = OFFER_TIMES.epoch + 100 * 24 * HOUR + 5 * HOUR;

const play = (s: GameState, seconds: number) => {
  for (let i = Math.round(seconds / STEP_SEC); i > 0; i--) stepGame(s, STEP_SEC);
};
const hero = (s: GameState, id: string) => s.staff.find((st) => st.hero === id);

describe('paid offers (owner M34)', () => {
  it('every pack is worth several times its money in plain gems', () => {
    for (const o of OFFERS) expect(worthOf(o, true)).toBeGreaterThan(2);
    // The starter pack is the best value of all (it is the one to hook a new player).
    expect(worthOf(OFFER_BY_ID.offer_starter!, true)).toBeGreaterThan(worthOf(OFFER_BY_ID.offer_hero!, true));
  });

  it('the starter pack lasts three days from the first look, then is gone for good', () => {
    const s = createGame(STAND_MAP, 1);
    seeOffers(s, NOW);
    expect(offersAt(s, NOW).map((o) => o.offer.kind)).toEqual(['starter', 'hero', 'mega']);
    const starter = offersAt(s, NOW)[0]!;
    expect(starter.ends).toBe(NOW + OFFER_TIMES.starterHours * HOUR);
    expect(starter.hero?.starter).toBe(true);
    // Seeing it again later does not restart its clock.
    seeOffers(s, NOW + 10 * HOUR);
    expect(offersAt(s, NOW + 71 * HOUR)[0]!.offer.kind).toBe('starter');
    expect(offersAt(s, NOW + 73 * HOUR)[0]!.offer.kind).toBe('hero');
  });

  it('heroes take turns of two days, the same on every phone, skipping the ones already owned', () => {
    const s = createGame(STAND_MAP, 2);
    const a = heroOfTurn(s, turnAt(NOW))!;
    expect(turnEnds(turnAt(NOW)) - NOW).toBeLessThanOrEqual(OFFER_TIMES.turnHours * HOUR);
    const b = heroOfTurn(s, turnAt(NOW + OFFER_TIMES.turnHours * HOUR))!;
    expect(a.id).not.toBe(b.id);
    expect(HERO_TURNS.some((h) => h.starter)).toBe(false);
    s.perks = { ...s.perks, [HERO.perkPrefix + a.id]: 1 };
    expect(heroOfTurn(s, turnAt(NOW))!.id).not.toBe(a.id);
    // All of them: the hero pack is gone, the mega pack still sells its gems.
    for (const h of HERO_TURNS) s.perks = { ...s.perks, [HERO.perkPrefix + h.id]: 1 };
    expect(heroOfTurn(s, turnAt(NOW))).toBeNull();
    expect(offersAt(s, NOW).map((o) => o.offer.kind)).toEqual(['starter', 'mega']);
  });

  it('the turn hero is fixed once seen, so buying one does not swap the card for the next', () => {
    const s = createGame(STAND_MAP, 3);
    seeOffers(s, NOW);
    const first = heroOfTurn(s, turnAt(NOW))!;
    expect(grantPurchase(s, 'offer_hero', 'tx-h', NOW)).toBe(true);
    expect(ownsHero(s, first.id)).toBe(true);
    const view = offersAt(s, NOW).find((o) => o.offer.kind === 'hero')!;
    expect(view.hero!.id).toBe(first.id);
    expect(view.bought).toBe(true);
    // The mega pack in the same turn: the hero is already there, so gems instead of a twin.
    const gems = s.gems;
    expect(grantPurchase(s, 'offer_mega', 'tx-m', NOW)).toBe(true);
    expect(s.gems).toBe(gems + OFFER_BY_ID.offer_mega!.gems + HERO.dupGems);
    expect(s.staff.filter((st) => st.hero === first.id)).toHaveLength(1);
  });

  it('the starter pack: gems, its hero walks in (mythic, no wage, on top of the places), the bonus for all', () => {
    const s = createGame(STAND_MAP, 4);
    const tipsBefore = s.mods.tips;
    const waiters = headcount(s, 'waiter');
    expect(grantPurchase(s, 'offer_starter', 'tx-s', NOW)).toBe(true);
    expect(grantPurchase(s, 'offer_starter', 'tx-s', NOW)).toBe(false);
    expect(s.gems).toBe(20 + 300);
    const sunny = hero(s, 'sunny')!;
    expect(sunny.rarity).toBe('mythic');
    expect(sunny.wage.eq(0)).toBe(true);
    expect(sunny.look).toEqual(HERO_BY_ID.sunny!.look);
    expect(s.mods.tips).toBeCloseTo(tipsBefore * HERO_BY_ID.sunny!.bonus.mult);
    expect(headcount(s, 'waiter')).toBe(waiters);
    expect(capacity(s, 'waiter')).toBeGreaterThanOrEqual(waiters);
    expect(offersAt(s, NOW).some((o) => o.offer.kind === 'starter')).toBe(false);
  });

  it('a hero cannot be fired, moved or trained, never quits and never asks for a raise', () => {
    const s = createGame(STAND_MAP, 5, { coins: big(1e9) });
    grantPurchase(s, 'offer_starter', 'tx-1', NOW);
    const sunny = hero(s, 'sunny')!;
    queueCommand(s, { type: 'fire', staff: sunny.id });
    queueCommand(s, { type: 'reassign', staff: sunny.id, role: 'cleaner' });
    queueCommand(s, { type: 'train', staff: sunny.id, count: 5 });
    play(s, 1);
    expect(sunny.leaving).toBe(false);
    expect(sunny.pendingRole).toBeNull();
    expect(sunny.level).toBe(HERO.level);
    sunny.morale = 0;
    s.coins = big(0);
    play(s, 400);
    expect(hero(s, 'sunny')).toBeDefined();
    expect(s.notices.some((n) => n.kind === 'raise' && n.staff === sunny.id)).toBe(false);
  });

  it('heroes stay heroes through a save, and join every new branch', () => {
    const s = createGame(mapForTier(2), 6, { levels: { building: 2 }, earned: big(1e9) });
    grantPurchase(s, 'offer_starter', 'tx-1', NOW);
    const loaded = parseSave(JSON.stringify(makeSave(s, NOW)));
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    const back = restoreGame(loaded.save, 7);
    expect(hero(back, 'sunny')?.rarity).toBe('mythic');
    expect(hero(back, 'sunny')?.look).toEqual(HERO_BY_ID.sunny!.look);
    expect(back.mods.tips).toBeCloseTo(computeMods(back.levels, back.perks, back.trophies).tips);
    expect(ownsHero(back, 'sunny')).toBe(true);
    expect(openBranch(back)).toBe(true);
    play(back, 3);
    expect(hero(back, 'sunny')).toBeDefined();
  });

  it('old saves (v15) load with nothing seen or bought', () => {
    const s = createGame(STAND_MAP, 8);
    const old = { ...makeSave(s, NOW), version: 15 } as Record<string, unknown>;
    delete old.offers;
    const loaded = parseSave(JSON.stringify(old));
    expect(loaded.ok && loaded.save.offers).toEqual({ starterSeen: 0, bought: [], pick: null, shown: -1 });
  });

  it('a purchase approved later still gives the hero of the turn it was bought in', () => {
    const s = createGame(STAND_MAP, 9);
    const then = NOW - OFFER_TIMES.turnHours * HOUR;
    const old = heroOfTurn(s, turnAt(then))!;
    seeOffers(s, NOW);
    expect(grantPurchase(s, 'offer_hero', 'tx-late', then)).toBe(true);
    expect(ownsHero(s, old.id)).toBe(true);
  });
});
