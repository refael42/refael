import { describe, expect, it } from 'vitest';
import { Dish } from '../src/data/dishes';
import { STAND_MAP } from '../src/data/maps';
import { STYLE, STYLES } from '../src/data/styles';
import { big } from '../src/sim/big';
import { createGame } from '../src/sim/game/create';
import { dishPrice } from '../src/sim/game/customers';
import { makeSave, parseSave, restoreGame } from '../src/sim/save';
import { setStyle, styleCost, styleNow, styleOrder, stylesOpen } from '../src/sim/styles';

// Owner, idea 6: "styles for the restaurant: Japanese, Italian, Mexican. Each changes the look and the music, and has its own dishes".

const JAPANESE = STYLES.findIndex((s) => s.id === 'japanese');
const MEXICAN = STYLES.findIndex((s) => s.id === 'mexican');

describe('restaurant styles', () => {
  it('open with the bistro; the first change is free, the next costs income', () => {
    const s = createGame(STAND_MAP, 4);
    expect(stylesOpen(s)).toBe(false);
    expect(setStyle(s, JAPANESE)).toBe(false);
    s.mods.building = STYLE.minTier;
    expect(styleCost(s).toNumber()).toBe(0);
    expect(setStyle(s, JAPANESE)).toBe(true);
    expect(styleNow(s)).toBe(JAPANESE);
    expect(setStyle(s, JAPANESE)).toBe(false);
    expect(styleCost(s).gt(0)).toBe(true);
    s.coins = big(0);
    expect(setStyle(s, MEXICAN)).toBe(false);
    s.coins = big(1e9);
    expect(setStyle(s, MEXICAN)).toBe(true);
    expect(s.coins.lt(1e9)).toBe(true);
  });

  it("the style's dishes sell for more and draw a share of the orders; classic changes nothing", () => {
    const s = createGame(STAND_MAP, 4);
    s.mods.building = STYLE.minTier;
    s.mods.menu[Dish.Burger] = true;
    const plain = dishPrice(s, Dish.Burger).toNumber();
    expect(styleOrder(s, 3)).toBe(-1);
    setStyle(s, MEXICAN);
    expect(dishPrice(s, Dish.Burger).toNumber()).toBe(Math.floor(plain * STYLE.dishPrice));
    const ids = Array.from({ length: 3000 }, (_, i) => i);
    const share = ids.filter((id) => styleOrder(s, id) === Dish.Burger).length / ids.length;
    expect(share).toBeGreaterThan(STYLE.dishChance * 0.8);
    expect(share).toBeLessThan(STYLE.dishChance * 1.2);
    // A style dish not on the menu is never asked for.
    expect(ids.some((id) => styleOrder(s, id) === Dish.Steak)).toBe(false);
  });

  it('every style has its look, music and dishes; it is saved', () => {
    for (const st of STYLES.slice(1)) {
      expect(st.dishes.length).toBeGreaterThan(0);
      expect(st.wall).toMatch(/^#/);
      expect(st.music).not.toBe('music');
    }
    const s = createGame(STAND_MAP, 4);
    s.mods.building = STYLE.minTier;
    setStyle(s, JAPANESE);
    const r = parseSave(JSON.stringify(makeSave(s, 0)));
    if (!r.ok) throw new Error('save');
    expect(restoreGame(r.save, 2).style).toEqual({ id: JAPANESE, changes: 1 });
  });
});
