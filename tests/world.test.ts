import { describe, expect, it } from 'vitest';
import { SCENES } from '../src/data/scenes';
import { STEP_SEC } from '../src/data/sim';
import { C, F, packSnapshot, STRIDE } from '../src/sim/snapshot';
import { addWanderers, removeWanderers } from '../src/sim/stress';
import { Facing, Pose } from '../src/sim/types';
import { createWorld, facingFor, stepWorld } from '../src/sim/world';

function run(seconds: number, wanderers = 0) {
  const world = createWorld(SCENES.styleTest);
  if (wanderers) addWanderers(world, SCENES.styleTest, wanderers);
  const steps = Math.round(seconds / STEP_SEC);
  for (let i = 0; i < steps; i++) stepWorld(world, STEP_SEC);
  return world;
}

describe('world simulation', () => {
  it('is deterministic: two runs give identical snapshots', () => {
    const a = packSnapshot(run(30, 20), 1);
    const b = packSnapshot(run(30, 20), 1);
    expect(a.data).toEqual(b.data);
  });

  it('moves walkers along their routine and records previous positions for interpolation', () => {
    const world = createWorld(SCENES.styleTest);
    const student = world.characters.find((c) => c.look.outfit === 3)!;
    const startY = student.y;
    stepWorld(world, STEP_SEC);
    expect(student.pose).toBe(Pose.Walk);
    expect(student.y).toBeLessThan(startY);
    expect(student.prevY).toBe(startY);
  });

  it('loops routines forever without getting stuck', () => {
    const world = run(600);
    for (const c of world.characters) expect(Number.isFinite(c.x) && Number.isFinite(c.y)).toBe(true);
    const waiter = world.characters.find((c) => c.look.outfit === 5)!;
    expect(waiter.step).toBeGreaterThanOrEqual(0);
  });

  it('stress walkers can be added and removed', () => {
    const world = run(1, 60);
    expect(world.characters.length).toBe(SCENES.styleTest.cast.length + 60);
    removeWanderers(world);
    expect(world.characters.length).toBe(SCENES.styleTest.cast.length);
  });
});

describe('render snapshot', () => {
  it('packs every entity sorted back-to-front', () => {
    const world = run(5);
    const snap = packSnapshot(world, 7);
    expect(snap.seq).toBe(7);
    expect(snap.count).toBe(world.characters.length + world.props.length);
    expect(snap.data.length).toBe(snap.count * STRIDE);
    for (let i = 1; i < snap.count; i++) {
      expect(snap.data[i * STRIDE + F.y]!).toBeGreaterThanOrEqual(snap.data[(i - 1) * STRIDE + F.y]!);
    }
  });

  it('carries character look and state', () => {
    const world = createWorld(SCENES.lineup);
    const snap = packSnapshot(world, 1);
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

describe('facingFor', () => {
  it('faces away when walking up, toward camera when walking down', () => {
    expect(facingFor(0, -10, Facing.FrontRight)).toBe(Facing.BackRight);
    expect(facingFor(-5, 10, Facing.FrontRight)).toBe(Facing.FrontLeft);
    expect(facingFor(10, -1, Facing.BackLeft)).toBe(Facing.FrontRight);
  });
});
