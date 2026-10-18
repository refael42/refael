import { sendLineHome } from './customers';
import type { GameState } from './types';

// The sign on the door (owner M38: "close the restaurant to guests after service, so upgrading is
// comfortable"). Closed: nobody new comes (no walk-ins, flyers, bus or delivery orders), the line
// goes home without a rating hit, and the guests at tables and at the bar finish their meal. The
// team stays and is paid as usual. Not saved: coming back to the game opens the doors again.

export function setClosed(s: GameState, closed: boolean): void {
  if (s.closed === closed) return;
  if (closed) {
    s.closed = true;
    s.closedAt = s.time;
    sendLineHome(s);
    return;
  }
  s.closed = false;
  // The income rate (time warps, coin packs) skips the time it was closed: the samples move on
  // by it, as if the doors had never shut.
  const gap = s.time - s.closedAt;
  for (const e of s.earnLog) e.time += gap;
}
