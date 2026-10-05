import { dishDef } from '../../data/dishes';
import { ECONOMY } from '../../data/economy';
import { setPose } from '../movement';
import { Emote, Pose, PropKind } from '../types';
import { emote, startEating } from './customers';
import { emit, Ev } from './events';
import { CustomerState, OrderState, TableState, type GameState, type Order } from './types';

function freePassSlot(s: GameState): number {
  for (let i = 0; i < s.map.passSlots.length; i++) {
    if (!s.orders.some((o) => o.state === OrderState.Ready && o.slot === i)) return i;
  }
  return -1;
}

/**
 * One cook, one order at a time, first come first served. A full pass blocks the cook: an
 * early, visible bottleneck that teaches the player to serve quickly.
 */
export function updateKitchen(s: GameState, dt: number): void {
  let cooking = s.orders.find((o) => o.state === OrderState.Cooking);
  if (!cooking) {
    cooking = s.orders.find((o) => o.state === OrderState.Queued);
    if (cooking) {
      cooking.state = OrderState.Cooking;
      cooking.since = s.time;
    }
  }
  let working = false;
  if (cooking) {
    if (cooking.progress < 1) {
      cooking.progress = Math.min(1, cooking.progress + dt / dishDef(cooking.dish).cookSeconds);
      working = true;
    }
    if (cooking.progress >= 1) {
      const slot = freePassSlot(s);
      if (slot >= 0) {
        cooking.state = OrderState.Ready;
        cooking.slot = slot;
        cooking.since = s.time;
        const p = s.map.passSlots[slot]!;
        emit(s, Ev.Ding, p.x, p.y);
        emote(s.cook, Emote.Star);
      } else if (s.cook.emote === 0) {
        emote(s.cook, Emote.Exclaim);
      }
    }
  }
  setPose(s.cook, working ? Pose.Cook : Pose.Idle);
  const stove = s.props.find((p) => p.kind === PropKind.Stove);
  if (stove) stove.active = working;

  const landed: Order[] = s.orders.filter((o) => o.state === OrderState.Flying && s.time >= o.landsAt);
  for (const order of landed) {
    s.orders.splice(s.orders.indexOf(order), 1);
    const c = s.customers.find((x) => x.id === order.customer);
    if (c && c.state === CustomerState.Waiting) startEating(s, c, order.dish);
  }
}

/** Manager action: tap a ready dish to send it flying to its customer's table. */
export function serveOrder(s: GameState, order: Order): void {
  const c = s.customers.find((x) => x.id === order.customer);
  if (!c || c.table < 0) return;
  const t = s.tables[c.table]!;
  const p = s.map.passSlots[order.slot]!;
  emit(s, Ev.DishFly, p.x, p.y, t.x, t.y, order.dish);
  order.state = OrderState.Flying;
  order.slot = -1;
  order.landsAt = s.time + ECONOMY.serveFlightSeconds;
}

export function updateTables(s: GameState, dt: number): void {
  for (const t of s.tables) {
    if (t.state !== TableState.Cleaning) continue;
    t.progress = Math.min(1, t.progress + dt / ECONOMY.cleanSeconds);
    if (t.progress >= 1) {
      t.state = TableState.Free;
      t.progress = 0;
      t.since = s.time;
      emit(s, Ev.Burst, t.x, t.y);
    }
  }
}
