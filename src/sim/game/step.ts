import { EMOTE_SECONDS } from '../../data/sim';
import { formatBig } from '../format';
import { packSnapshot, type Snapshot } from '../snapshot';
import type { CharacterView, PropView } from '../types';
import { Bubble, PropKind } from '../types';
import { applyCommands } from './commands';
import { updateArrivals, updateCustomers } from './customers';
import { packEvents, pruneEvents } from './events';
import { updateKitchen, updateTables } from './kitchen';
import { updateWalkers } from './walkers';
import { OrderState, TableState, type GameState } from './types';

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
  s.cook.prevX = s.cook.x;
  s.cook.prevY = s.cook.y;
  for (const c of [...s.customers, ...s.walkers]) {
    c.prevX = c.x;
    c.prevY = c.y;
  }
  applyCommands(s);
  updateArrivals(s);
  updateCustomers(s, dt);
  updateKitchen(s, dt);
  updateTables(s, dt);
  updateWalkers(s, dt);
  tickTimers(s.cook, dt);
  for (const c of s.customers) tickTimers(c, dt);
  for (const w of s.walkers) tickTimers(w, dt);
  pruneEvents(s);
}

function dynamicProps(s: GameState): PropView[] {
  const out: PropView[] = [];
  for (const t of s.tables) {
    const dirty = t.state === TableState.Dirty || t.state === TableState.Cleaning;
    out.push({
      id: t.propId,
      kind: PropKind.Table,
      x: t.x,
      y: t.y,
      variant: dirty ? 2 : t.state === TableState.Occupied && t.dish >= 0 ? 1 : 0,
      level: Math.max(0, t.dish),
      active: false,
      lift: 0,
      since: t.since,
      progress: t.state === TableState.Cleaning ? t.progress : 0,
      bubble: t.state === TableState.Dirty ? Bubble.Clean : 0,
      depthBias: 0,
    });
  }
  for (const o of s.orders) {
    if (o.state !== OrderState.Ready) continue;
    const p = s.map.passSlots[o.slot]!;
    out.push({
      id: o.id,
      kind: PropKind.PassDish,
      x: p.x,
      y: p.y,
      variant: o.dish,
      level: 0,
      active: true,
      lift: s.map.passTop,
      since: o.since,
      progress: 0,
      bubble: 0,
      depthBias: 1,
    });
  }
  return out;
}

export function gameSnapshot(s: GameState, seq: number): Snapshot {
  return packSnapshot([s.cook, ...s.customers, ...s.walkers], [...s.props, ...dynamicProps(s)], seq, s.time, {
    events: packEvents(s),
    hud: { coins: s.coins.toNumber(), coinsText: formatBig(s.coins), rating: s.rating, combo: s.combo, comboAt: s.lastPayTime },
  });
}
