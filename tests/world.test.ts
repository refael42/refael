import { describe, expect, it } from 'vitest';
import { LINEUP } from '../src/data/scenes';
import { STEP_SEC } from '../src/data/sim';
import { facingFor } from '../src/sim/movement';
import { C, F, STRIDE } from '../src/sim/snapshot';
import { Facing } from '../src/sim/types';
import { createWorld, stepWorld, worldSnapshot } from '../src/sim/world';

function run(seconds: number) {
  const world = createWorld(LINEUP);
  const steps = Math.round(seconds / STEP_SEC);
  for (let i = 0; i < steps; i++) stepWorld(world, STEP_SEC);
  return world;
}

describe('scripted world (cast lineup)', () => {
  it('is deterministic', () => {
    expect(worldSnapshot(run(30), 1).data).toEqual(worldSnapshot(run(30), 1).data);
  });

  it('loops routines forever and triggers emotes', () => {
    const world = run(600);
    expect(world.characters.every((c) => Number.isFinite(c.x) && Number.isFinite(c.y))).toBe(true);
    const sawEmote = [0, 1, 2, 3, 4, 5].some((s) => run(s + 0.5).characters.some((c) => c.emote !== 0));
    expect(sawEmote).toBe(true);
  });
});

describe('render snapshot', () => {
  it('packs every entity in isometric back-to-front order', () => {
    const world = run(5);
    const snap = worldSnapshot(world, 7);
    expect(snap.seq).toBe(7);
    expect(snap.count).toBe(world.characters.length + world.props.length);
    expect(snap.data.length).toBe(snap.count * STRIDE);
    const depth = (i: number) => snap.data[i * STRIDE + F.x]! + snap.data[i * STRIDE + F.y]!;
    for (let i = 1; i < snap.count; i++) {
      // Lifted items get +1 (they sit on counters), so compare with that slack.
      expect(depth(i) + 1.05).toBeGreaterThanOrEqual(depth(i - 1));
    }
  });

  it('carries character look and state', () => {
    const world = createWorld(LINEUP);
    const snap = worldSnapshot(world, 1);
    const cook = world.characters.find((c) => c.look.outfit === 4)!;
    let found = false;
    for (let i = 0; i < snap.count; i++) {
      const o = i * STRIDE;
      if (snap.data[o + F.id] === cook.id) {
        found = true;
        expect(snap.data[o + C.outfit]).toBe(4);
        expect(snap.data[o + C.hat]).toBe(cook.look.hat);
      }
    }
    expect(found).toBe(true);
  });
});

describe('isometric facing', () => {
  it('maps floor directions to the four diagonal facings', () => {
    expect(facingFor(1, 0, Facing.FrontLeft)).toBe(Facing.FrontRight); // +x: down-right
    expect(facingFor(0, 1, Facing.FrontRight)).toBe(Facing.FrontLeft); // +y: down-left
    expect(facingFor(-1, 0, Facing.FrontRight)).toBe(Facing.BackLeft); // -x: up-left
    expect(facingFor(0, -1, Facing.FrontRight)).toBe(Facing.BackRight); // -y: up-right
  });
});
