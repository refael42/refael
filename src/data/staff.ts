import type { Look } from './looks';
import { LOOKS } from './scenes';

// Staff roles. Hiring (M4) will add people to the roster; for now the restaurant opens with
// the roster below so the whole kitchen loop is visible.

export type Role = 'cook' | 'waiter' | 'washer';

export interface RoleDef {
  role: Role;
  /** Tiles per second. */
  walkSpeed: number;
  look: Look;
}

export const ROLES: Record<Role, RoleDef> = {
  cook: { role: 'cook', walkSpeed: 1.8, look: LOOKS.cook },
  waiter: { role: 'waiter', walkSpeed: 1.7, look: LOOKS.waiter },
  washer: { role: 'washer', walkSpeed: 1.5, look: LOOKS.washer },
};

export const STARTING_STAFF: readonly Role[] = ['cook', 'waiter', 'washer'];

export const KITCHEN = {
  /** Plates the restaurant owns; all start clean. The clean-dishes loop cycles them. */
  plates: 5,
  /** Seconds for the dishwasher to wash and polish one plate. */
  washSeconds: 3,
  /** A player tap at the sink scrubs this share of a plate. */
  handWashTapBoost: 0.34,
  /** The cook turns to the pass and sets the plate down. */
  plateSeconds: 0.45,
  /** The waiter wipes a table before carrying the dirty plate away. */
  bussSeconds: 0.7,
  /** Waiters hand dishes over / pick plates up this fast. */
  handoffSeconds: 0.35,
} as const;
