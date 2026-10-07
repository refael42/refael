import { BUS } from '../../data/events';
import { hash01 } from '../retention';
import { emote, touristArrives } from './customers';
import { emit, Ev } from './events';
import type { GameState } from './types';
import { Emote } from '../types';

// The tourist bus (src/data/events.ts): a wave of guests at once, a little rush to handle. Its
// timing comes from a hash of the time it is decided, not from the game's dice, so a game
// without buses (the first minutes) plays exactly as before.

const between = (range: readonly [number, number], r: number) => range[0] + (range[1] - range[0]) * r;

/** When the bus after this one comes. */
const nextGap = (s: GameState) => between(BUS.gapSeconds, hash01(s.tick * 0.77 + 3.3));

/** The bus sets off for the stop now (also the settings' test button). */
export function startBus(s: GameState): void {
  if (s.bus || s.construction) return;
  const aboard = Math.round(between(BUS.guests, hash01(s.tick * 1.91 + 0.7)));
  const { x, y } = s.map.busStop;
  s.bus = { x, y, door: { ...s.map.busDoor }, arrive: s.time, leave: Infinity, aboard, nextDrop: s.time + BUS.driveSeconds + 0.4 };
  emit(s, Ev.Bus, x, y, aboard);
}

export function updateBus(s: GameState): void {
  const bus = s.bus;
  if (!bus) {
    if (s.time >= Math.max(s.nextBus, BUS.firstSeconds) && s.stats.served >= BUS.minServed) startBus(s);
    return;
  }
  if (s.time >= bus.leave + BUS.driveSeconds) {
    s.bus = null;
    s.nextBus = s.time + nextGap(s);
    return;
  }
  if (bus.leave < Infinity || s.time < bus.nextDrop) return;
  // Closing time for the building work, or waited long enough for room in the line: off it goes.
  const waited = s.time - (bus.arrive + BUS.driveSeconds);
  if (bus.aboard <= 0 || s.construction || waited > BUS.waitSeconds) {
    bus.leave = s.time + 0.6;
    return;
  }
  const c = touristArrives(s, { x: bus.door.x + (hash01(s.tick) - 0.5) * 0.3, y: bus.door.y });
  if (!c) {
    // The line is full: the next one waits on the step.
    bus.nextDrop = s.time + 0.5;
    return;
  }
  emote(c, Emote.Exclaim);
  bus.aboard -= 1;
  bus.nextDrop = s.time + BUS.dropSeconds;
}
