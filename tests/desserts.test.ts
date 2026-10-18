import { describe, expect, it } from 'vitest';
import { CHEF_UNLOCKS } from '../src/data/chefUnlocks';
import { DESSERT, DESSERTS } from '../src/data/desserts';
import { STAND_MAP } from '../src/data/maps';
import { STEP_SEC } from '../src/data/sim';
import { queueCommand, tapTargets } from '../src/sim/game/commands';
import { createGame } from '../src/sim/game/create';
import { openDesserts } from '../src/sim/game/desserts';
import { stepGame } from '../src/sim/game/step';
import { CustomerState, type GameState } from '../src/sim/game/types';
import { Held } from '../src/sim/types';

// Menus and desserts (owner M45): the menu comes open in the hands; after the meal some ask
// for the dessert menu; desserts open with the chef's level; a waiter brings them, or a tap.

function play(s: GameState, seconds: number, each?: (s: GameState) => void) {
  for (let i = Math.round(seconds / STEP_SEC); i > 0; i--) {
    for (const c of s.customers) if (c.state === CustomerState.Queued && c.party === c.id) queueCommand(s, { type: 'seat', customer: c.id });
    stepGame(s, STEP_SEC);
    each?.(s);
  }
}

describe('menus and desserts', () => {
  it('each dessert opens at its own chef level, in order, and shows as a level unlock', () => {
    const levels = DESSERTS.map((d) => d.level);
    expect([...levels].sort((a, b) => a - b)).toEqual(levels);
    expect(new Set(levels).size).toBe(levels.length);
    for (const d of DESSERTS) expect(CHEF_UNLOCKS.some((u) => u.id === d.id && u.level === d.level && u.kind === 'dessert')).toBe(true);
    const s = createGame(STAND_MAP, 100);
    expect(openDesserts(s)).toHaveLength(0);
    s.chef.level = DESSERTS[2]!.level;
    expect(openDesserts(s)).toHaveLength(3);
  });

  it('guests open the menu, and before the chef level nobody asks for dessert', () => {
    const s = createGame(STAND_MAP, 101, { roster: ['cook', 'waiter', 'washer'] });
    s.chef.xp = -1e12; // stay at level 1: no desserts yet
    let opened = false;
    play(s, 200, (g) => {
      if (g.customers.some((c) => c.state === CustomerState.Reading && c.held === Held.MenuOpen)) opened = true;
      if (g.customers.some((c) => c.dessertPhase)) throw new Error('a dessert before its level');
    });
    expect(opened).toBe(true);
  });

  it('a waiter brings the dessert and it is on the bill; the main plate goes back to the dish pile', () => {
    const s = createGame(STAND_MAP, 102, { roster: ['cook', 'waiter', 'washer', 'waiter'] });
    s.chef.level = 30;
    s.chef.xp = -1e12;
    let menu = false;
    let waiting = false;
    let eaten = false;
    let carried = false;
    play(s, 500, (g) => {
      for (const c of g.customers) {
        if (c.dessertPhase === 'menu' && c.held === Held.DessertMenu) menu = true;
        if (c.dessertPhase === 'wait') waiting = true;
        if (c.dessertPhase === 'eat') eaten = true;
      }
      if (g.staff.some((st) => st.held === Held.DessertPlate)) carried = true;
    });
    expect(menu).toBe(true);
    expect(waiting).toBe(true);
    expect(carried).toBe(true);
    expect(eaten).toBe(true);
    expect(s.desserts.every((d) => s.customers.some((c) => c.id === d.customer))).toBe(true);
  });

  it('a tap on a guest waiting for dessert brings it at once', () => {
    const s = createGame(STAND_MAP, 103, { roster: ['cook', 'washer'] });
    s.chef.level = 12;
    s.chef.xp = -1e12;
    let tapped = false;
    play(s, 600, (g) => {
      if (tapped) return;
      // No waiter: the player serves the plates and clears the tables too.
      for (const x of tapTargets(g)) if (x.command.type === 'serve' || x.command.type === 'clean' || x.command.type === 'wash') queueCommand(g, x.command);
      const t = tapTargets(g).find((x) => x.command.type === 'dessert');
      if (t) {
        const id = (t.command as { customer: number }).customer;
        queueCommand(g, t.command);
        stepGame(g, STEP_SEC);
        expect(g.customers.find((c) => c.id === id)?.dessertPhase).toBe('eat');
        tapped = true;
      }
    });
    expect(tapped).toBe(true);
    expect(DESSERT.chance).toBeGreaterThan(0);
  });
});
