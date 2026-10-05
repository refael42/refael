import type { SkCanvas } from '@shopify/react-native-skia';
import { ECONOMY } from '../../data/economy';
import { formatNumber } from '../../sim/format';
import type { Hud } from '../../sim/snapshot';
import type { RenderAssets } from '../assets';
import type { FxState, HudAnchors } from './fx';
import { sprXf } from './primitives';
import { drawText, textWidth } from './text';

export interface HudLayout {
  left: number;
  top: number;
  right: number;
}

const PANEL_H = 34;

/** Where coins/stars fly to; must match drawHud's layout. */
export function hudAnchors(layout: HudLayout): HudAnchors {
  'worklet';
  return {
    coinX: layout.left + 20,
    coinY: layout.top + PANEL_H / 2,
    ratingX: layout.right - 70,
    ratingY: layout.top + PANEL_H / 2,
    centerX: (layout.left + layout.right) / 2,
    centerY: layout.top + 150,
  };
}

function bounce(t: number, since: number): number {
  'worklet';
  const age = t - since;
  return age < 0 || age > 0.5 ? 1 : 1 + Math.sin(age * Math.PI * 4) * 0.16 * (1 - age / 0.5);
}

function panel(c: SkCanvas, A: RenderAssets, x: number, y: number, w: number, h: number): void {
  'worklet';
  const rr = { rect: { x, y, width: w, height: h }, rx: h / 2, ry: h / 2 };
  c.drawRRect(rr, A.paints.panel);
  c.drawRRect(rr, A.paints.panelEdge);
}

/** Coin counter (rolling digits, bounces when coins land), rating stars and the combo badge. */
export function drawHud(c: SkCanvas, A: RenderAssets, hud: Hud, s: FxState, t: number, dt: number, layout: HudLayout): void {
  'worklet';
  // Roll toward the coins that have actually landed; spending (target drops) snaps instantly.
  const target = Math.max(0, hud.coins - s.pending);
  if (!Number.isFinite(target) || target < s.rolling) s.rolling = target;
  else s.rolling += (target - s.rolling) * Math.min(1, dt * 9);
  if (Math.abs(target - s.rolling) < 0.5) s.rolling = target;
  const text = Number.isFinite(s.rolling) ? formatNumber(s.rolling) : hud.coinsText;

  const b = bounce(t, s.coinBounce);
  const tw = textWidth(A, text, 1.35);
  c.save();
  c.translate(layout.left, layout.top + PANEL_H / 2);
  c.scale(b, b);
  panel(c, A, 0, -PANEL_H / 2, tw + 52, PANEL_H);
  sprXf(c, A, A.S.coin, 20, 0, 0, 2.1, 2.1, A.paints.plain);
  drawText(c, A, text, 40, 0.5, 1.35, A.paints.gold, 0);
  c.restore();

  // Rating: five stars filled to the current value.
  const rb = bounce(t, s.ratingBounce);
  const starsX = layout.right - 112;
  const rText = (Math.floor(hud.rating * 10) / 10).toFixed(1);
  c.save();
  c.translate(starsX, layout.top + PANEL_H / 2);
  c.scale(rb, rb);
  panel(c, A, -6, -PANEL_H / 2, 118, PANEL_H);
  for (let i = 0; i < 5; i++) {
    const sx = 10 + i * 15;
    sprXf(c, A, A.S.starGray, sx, 0, 0, 1.1, 1.1, A.paints.plain);
    const fillPart = Math.max(0, Math.min(1, hud.rating - i));
    if (fillPart > 0) {
      c.save();
      c.clipRect({ x: sx - 8, y: -10, width: 16 * fillPart, height: 20 }, 1, true);
      sprXf(c, A, A.S.star, sx, 0, 0, 1.1, 1.1, A.paints.plain);
      c.restore();
    }
  }
  drawText(c, A, rText, 103, 0.5, 0.95, A.paints.plain, 0.5);
  c.restore();

  // Combo badge while payments keep chaining.
  const sinceCombo = t - hud.comboAt;
  if (hud.combo >= 2 && sinceCombo >= 0 && sinceCombo < ECONOMY.comboWindowSeconds) {
    const pulse = 1 + Math.sin(t * 8) * 0.05;
    const fade = Math.min(1, (ECONOMY.comboWindowSeconds - sinceCombo) / 1.5);
    A.paints.orange.setAlphaf(fade);
    drawText(c, A, 'x' + hud.combo + '!', layout.left + 30, layout.top + PANEL_H + 18, 1.5 * pulse, A.paints.orange, 0.5);
    A.paints.orange.setAlphaf(1);
  }
}
