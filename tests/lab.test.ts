import { describe, expect, it } from 'vitest';
import { Dish, DISHES } from '../src/data/dishes';
import { DISH_TASTE, FLAVORS, LAB, SAUCES, TOPPINGS } from '../src/data/lab';
import { STAND_MAP } from '../src/data/maps';
import { STEP_SEC } from '../src/data/sim';
import { big } from '../src/sim/big';
import { createGame } from '../src/sim/game/create';
import { dishPrice } from '../src/sim/game/customers';
import { Ev } from '../src/sim/game/events';
import { stepGame } from '../src/sim/game/step';
import type { GameState } from '../src/sim/game/types';
import { labOpen, setSignature, signatureFor, signatureOrder, startTest, taste, testCost } from '../src/sim/lab';
import { makeSave, parseSave, restoreGame } from '../src/sim/save';

// Owner, idea 2: "a recipe lab: combine ingredients and invent a new dish with your own name, price and design".

const game = (): GameState => {
  const s = createGame(STAND_MAP, 5);
  s.stats.served = LAB.minServed;
  s.coins = big(1e6);
  return s;
};
const run = (s: GameState, seconds: number) => {
  for (let i = 0; i < seconds / STEP_SEC; i++) stepGame(s, STEP_SEC);
};

describe('the recipe lab', () => {
  it('every dish has exactly a few perfect pairings, and every pair of flavors belongs to one dish', () => {
    const pairs = new Set<string>();
    for (const d of DISHES) {
      const want = DISH_TASTE[d.id]!;
      expect(want, d.nameKey).toBeDefined();
      expect(FLAVORS).toContain(want.hates);
      pairs.add([...want.wants].sort().join());
      let perfect = 0;
      let worst = 5;
      for (let a = 0; a < SAUCES.length; a++)
        for (let b = 0; b < TOPPINGS.length; b++) {
          const st = taste(d.id, a, b).stars;
          if (st === 5) perfect++;
          worst = Math.min(worst, st);
        }
      expect(perfect, d.nameKey).toBeGreaterThanOrEqual(1);
      expect(perfect, d.nameKey).toBeLessThanOrEqual(3);
      expect(worst).toBe(1);
    }
    expect(pairs.size).toBe(DISHES.length);
  });

  it('the notes explain the score: what is missing, what clashes, and when it is lopsided', () => {
    const fries = (s: string, t: string) => taste(Dish.Fries, SAUCES.findIndex((x) => x.id === s), TOPPINGS.findIndex((x) => x.id === t));
    expect(fries('tahini', 'pickles')).toMatchObject({ stars: 5, missing: [], clash: null, lopsided: false });
    expect(fries('tahini', 'cheese')).toMatchObject({ stars: 3, missing: ['tangy'] });
    expect(fries('date', 'pickles').clash).toBe('sweet');
    // Sushi wants spicy and crunch: the crispy chili sauce brings both alone (four stars), a topping should bring one.
    const sushi = taste(Dish.Sushi, SAUCES.findIndex((x) => x.id === 'crispChili'), TOPPINGS.findIndex((x) => x.id === 'herbs'));
    expect(sushi).toMatchObject({ stars: 4, lopsided: true });
  });

  it('a test costs coins, takes time, and goes into the notebook (a first perfect one pays gems)', () => {
    const s = createGame(STAND_MAP, 5);
    expect(labOpen(s)).toBe(false);
    s.stats.served = LAB.minServed;
    expect(startTest(s, Dish.Fries, 0, 1, 2, 'Chef Fries')).toBe(false); // no coins yet
    s.coins = big(1e6);
    expect(startTest(s, Dish.Burger, 0, 1, 2, 'Nope')).toBe(false); // not on the menu
    expect(startTest(s, Dish.Fries, 0, 1, 2, '   ')).toBe(false); // no name
    const cost = testCost(s, Dish.Fries);
    const gems = s.gems;
    expect(startTest(s, Dish.Fries, 0, 1, 2, '  Dana’s   golden fries ')).toBe(true);
    expect(s.coins.toNumber()).toBe(1e6 - cost.toNumber());
    expect(startTest(s, Dish.Fries, 1, 1, 2, 'Again')).toBe(false); // one at a time
    run(s, LAB.testSeconds - 2);
    expect(s.lab.book).toHaveLength(0);
    run(s, 3);
    expect(s.lab.book[0]).toMatchObject({ base: Dish.Fries, name: 'Dana’s golden fries', stars: 5, on: false });
    expect(s.gems).toBe(gems + LAB.perfectGems);
    expect(s.events.some((e) => e.type === Ev.LabDone && e.a === 5)).toBe(true);
    // The same dish's second perfect one pays nothing.
    startTest(s, Dish.Fries, 0, 1, 0, 'Again');
    run(s, LAB.testSeconds + 1);
    expect(s.gems).toBe(gems + LAB.perfectGems);
  });

  it('on the menu it sells for more and draws its own guests; one per dish, slots by building', () => {
    const s = game();
    const plain = dishPrice(s, Dish.Fries).toNumber();
    expect(signatureOrder(s, 7)).toBe(-1);
    startTest(s, Dish.Fries, 0, 1, 0, 'A');
    run(s, LAB.testSeconds + 1);
    startTest(s, Dish.Fries, 0, 0, 0, 'B');
    run(s, LAB.testSeconds + 1);
    // Newest first: B (three stars), then A (five).
    expect(setSignature(s, 1, true)).toBe(true);
    expect(signatureFor(s, Dish.Fries)?.name).toBe('A');
    expect(dishPrice(s, Dish.Fries).toNumber()).toBe(Math.floor(plain * (1 + 4 * LAB.pricePerStar)));
    expect(setSignature(s, 0, true)).toBe(true); // takes A's place
    expect(s.lab.book[1]!.on).toBe(false);
    const ids = Array.from({ length: 2000 }, (_, i) => i);
    const share = ids.filter((id) => signatureOrder(s, id) === Dish.Fries).length / ids.length;
    expect(share).toBeGreaterThan(LAB.orderChance * 0.6 * 0.7);
    expect(share).toBeLessThan(LAB.orderChance * 0.6 * 1.3);
    // A second dish needs a second slot (the stand has one).
    s.mods.menu[Dish.Burger] = true;
    startTest(s, Dish.Burger, 0, 1, 0, 'C');
    run(s, LAB.testSeconds + 1);
    expect(setSignature(s, 0, true)).toBe(false);
    s.mods.building = 2;
    expect(setSignature(s, 0, true)).toBe(true);
  });

  it('is saved, a running test included, and the stars cannot be faked', () => {
    const s = game();
    startTest(s, Dish.Fries, 0, 1, 3, 'Mine');
    run(s, LAB.testSeconds + 1);
    setSignature(s, 0, true);
    startTest(s, Dish.Fries, 2, 2, 1, 'Running');
    run(s, 10);
    const save = makeSave(s, 0);
    (save.lab!.book[0] as { stars: number }).stars = 1;
    const r = parseSave(JSON.stringify(save));
    if (!r.ok) throw new Error('save');
    const back = restoreGame(r.save, 3);
    expect(back.lab.book[0]).toMatchObject({ name: 'Mine', stars: 5, on: true, plate: 3 });
    expect(back.lab.test?.name).toBe('Running');
    run(back, LAB.testSeconds - 10 + 1);
    expect(back.lab.book[0]!.name).toBe('Running');
  });
});
