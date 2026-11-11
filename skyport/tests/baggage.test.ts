import { describe, expect, it } from 'vitest';

import { BeltBags, BELT_SPEED, pointAt } from '../src/render/baggage';
import { BAG_KINDS } from '../src/render/art/baggage';
import { layoutOf } from '../src/sim/game/layout';

const T1 = layoutOf(3).terminal.belt;

describe('bags on the check-in conveyor', () => {
  it('a bag goes on just behind the counter it was checked in at', () => {
    const b = new BeltBags();
    b.setBelts([T1]);
    const counter = layoutOf(3).terminal.counters[0];
    b.add(counter[0], counter[1]);
    expect(b.bags).toHaveLength(1);
    const p = pointAt(T1, b.bags[0].d);
    expect(Math.abs(p.x - counter[0])).toBeLessThan(0.05);
    expect(Math.abs(p.y - counter[1])).toBeLessThan(0.6);
    expect(b.bags[0].kind).toBeGreaterThanOrEqual(0);
    expect(b.bags[0].kind).toBeLessThan(BAG_KINDS);
  });

  it('it rides at the belt speed, turns the corner, and is gone into the baggage room at the end', () => {
    const b = new BeltBags();
    b.setBelts([T1]);
    b.add(T1[0][0], T1[0][1]);
    b.update(1);
    expect(b.bags[0].d).toBeCloseTo(BELT_SPEED);
    // (the first leg runs along x, the second along y)
    expect(pointAt(T1, 0.5).alongY).toBe(false);
    const leg1 = Math.abs(T1[1][0] - T1[0][0]);
    expect(pointAt(T1, leg1 + 0.5).alongY).toBe(true);
    for (let i = 0; i < 60; i++) b.update(0.5);
    expect(b.bags).toHaveLength(0);
  });

  it('a counter far from every conveyor puts nothing on', () => {
    const b = new BeltBags();
    b.setBelts([T1]);
    b.add(T1[0][0] + 10, T1[0][1] + 10);
    expect(b.bags).toHaveLength(0);
  });

  it('every terminal with a conveyor gets its own', () => {
    const L = layoutOf(7);
    const b = new BeltBags();
    b.setBelts([L.terminal.belt, L.t3!.st.belt, L.t4!.st.belt]);
    expect(b.belts).toHaveLength(3);
    const c = L.t4!.st.counters[0];
    b.add(c[0], c[1]);
    expect(b.bags[0].belt).toBe(2);
  });
});
