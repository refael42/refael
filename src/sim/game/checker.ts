import { CHECKER } from '../../data/staff';
import { setPose } from '../movement';
import { Facing, Pose } from '../types';
import { statFactor, workRate } from './people';
import { OrderState, type GameState, type Order, type Staff } from './types';
import { gainXp } from './workers';

// The checker (owner request: "a checker for the dishes"): stands at the head of the pass and
// looks over each dish that lands there before it goes out. A dish they passed sells for more.
// They never hold a dish up: one taken before they got to it simply goes out unchecked.

const nextToCheck = (s: GameState): Order | undefined => {
  let best: Order | undefined;
  for (const o of s.orders) if (o.state === OrderState.Ready && !o.checked && (!best || o.since < best.since)) best = o;
  return best;
};

/** One tick of the checker's shift; true while working. */
export function updateChecker(s: GameState, st: Staff, dt: number, walkTo: (to: { x: number; y: number }) => boolean, home: { x: number; y: number }): boolean {
  if (!walkTo(home)) return true;
  setPose(st, Pose.Idle);
  st.facing = Facing.FrontLeft;
  const job = st.job?.kind === 'check' ? st.job : null;
  const order = job ? s.orders.find((o) => o.id === job.order) : undefined;
  // Gone, taken off the pass, or already seen: on to the next.
  if (!order || order.state !== OrderState.Ready || order.checked) {
    st.job = null;
    st.jobTime = 0;
    if (st.leaving || st.pendingRole) return false;
    const next = nextToCheck(s);
    if (!next) return false;
    st.job = { kind: 'check', order: next.id };
    return true;
  }
  st.jobTime += dt * workRate(s, st) * statFactor(st.stats.speed);
  if (st.jobTime < CHECKER.seconds) return true;
  order.checked = true;
  order.quality *= 1 + CHECKER.quality * statFactor(st.stats.quality);
  gainXp(s, st);
  st.job = null;
  st.jobTime = 0;
  return true;
}
