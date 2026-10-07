import type { HudAnchors } from './fx';

// The HUD itself is a React Native overlay (src/ui/Hud.tsx: real fonts, crisp icons). The
// canvas only needs to know where its icons are, so flying coins and stars land on them.

export interface HudLayout {
  left: number;
  top: number;
  right: number;
}

/** Sizes shared by the overlay and the effects (px). */
export const HUD = {
  /** Height of the pills. */
  height: 40,
  /** The big icons stick out of the pills' left ends. */
  icon: 50,
  /** How far an icon pokes out past its pill's left edge. */
  iconOut: 6,
  ratingWidth: 112,
} as const;

/** Center of a pill's icon whose pill starts at x. A worklet: the canvas calls it every frame
 * on the UI thread, and a plain function called from there closes the app on phones. */
function iconCenter(pillLeft: number): number {
  'worklet';
  return pillLeft - HUD.iconOut + HUD.icon / 2;
}

/** Where coins/stars fly to: the coin and the star of the overlay. */
export function hudAnchors(layout: HudLayout): HudAnchors {
  'worklet';
  return {
    coinX: iconCenter(layout.left + HUD.iconOut),
    coinY: layout.top + HUD.height / 2,
    ratingX: iconCenter(layout.right - HUD.ratingWidth),
    ratingY: layout.top + HUD.height / 2,
    centerX: (layout.left + layout.right) / 2,
    centerY: layout.top + 150,
  };
}
