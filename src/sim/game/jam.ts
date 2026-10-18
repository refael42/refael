import { JAM } from '../../data/staff';
import { UPGRADE_BY_ID } from '../../data/upgrades';
import { isMaxed, isUnlocked } from '../economy/upgrades';
import { OrderState, type GameState } from './types';
import { hasRoom } from './workers';

// The kitchen can't keep up (owner M40): tickets wait for a cook while waiters have nothing to
// carry, the very thing that made the owner ask why the waiters just stand there. The game counts
// how long that lasts and, past JAM.showAfter seconds, tells the player what helps most.

export type KitchenAdvice = 'hire' | 'stove' | 'speed';

/** Waiters with nothing to carry (a round of water counts: it is what they do when there is nothing else). */
const idle = (s: GameState) => s.staff.filter((st) => st.role === 'waiter' && !st.leaving && (!st.job || st.job.kind === 'home' || st.job.kind === 'care')).length;

export function updateJam(s: GameState, dt: number): void {
  // Nobody new comes while closed or building: a line of tickets then is the last of the service.
  const jammed = !s.closed && !s.construction && s.orders.filter((o) => o.state === OrderState.Queued).length >= JAM.queued && idle(s) >= JAM.idleWaiters;
  s.jam = jammed ? Math.min(JAM.max, s.jam + dt) : Math.max(0, s.jam - dt * 2);
}

/** What to tell the player, once the kitchen has been behind long enough (null: it keeps up). */
export function kitchenAdvice(s: GameState): KitchenAdvice | null {
  if (s.jam < JAM.showAfter) return null;
  // A free cook's post: hire. None: another stove makes one. All stoves bought: faster ones.
  if (hasRoom(s, 'cook')) return 'hire';
  const stoves = UPGRADE_BY_ID.stove2;
  if (stoves && isUnlocked(stoves, s.levels) && !isMaxed(stoves, s.levels, s.map)) return 'stove';
  return 'speed';
}
