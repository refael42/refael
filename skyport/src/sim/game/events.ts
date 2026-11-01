import { EVENT_TTL } from './constants';
import type { GameEvent, GameEventKind, GameState } from './types';

export function pushEvent(s: GameState, kind: GameEventKind, x = 0, y = 0, a = 0, b = 0, c = 0): void {
  s.events.push({ id: s.nextEventId++, kind, t: s.time, x, y, a, b, c });
}

export function pruneEvents(s: GameState): void {
  const cutoff = s.time - EVENT_TTL;
  let i = 0;
  while (i < s.events.length && s.events[i].t < cutoff) i++;
  if (i > 0) s.events.splice(0, i);
}

/** Events newer than lastId, for UI consumers that remember what they saw. */
export function eventsSince(s: GameState, lastId: number): GameEvent[] {
  const out: GameEvent[] = [];
  for (const e of s.events) if (e.id > lastId) out.push(e);
  return out;
}
