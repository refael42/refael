import type { SkCanvas } from '@shopify/react-native-skia';
import { ECONOMY } from '../../data/economy';
import { formatNumber } from '../../sim/format';
import type { Hud } from '../../sim/snapshot';
import { HUD_PILL_H, type RenderAssets } from '../assets';
import type { FxState, HudAnchors } from './fx';
import { vecSpr } from './primitives';
import { drawTextSharp, textWidth } from './text';

export interface HudLayout {
  left: number;
  top: number;
  right: number;
}

const PANEL_H = HUD_PILL_H;
const COIN_SCALE = 2.6;
const COIN_TEXT = 1.7;
const STAR_SCALE = 1.35;
const STAR_STEP = 19;

/** Where coins/stars fly to; must match drawHud's layout. */
export function hudAnchors(layout: HudLayout): HudAnchors {
  'worklet';
  return {
    coinX: layout.left + PANEL_H / 2,
    coinY: layout.top + PANEL_H / 2,
    ratingX: layout.right - 90,
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

/** A chunky resort-style pill centered on y = 0: gradient body, gold rim, a soft top shine. */
function pill(c: SkCanvas, A: RenderAssets, x: number, w: number): void {
  'worklet';
  const h = PANEL_H;
  const rr = { rect: { x, y: -h / 2, width: w, height: h }, rx: h / 2, ry: h / 2 };
  c.drawRRect(rr, A.paints.hudFill);
  c.drawRRect(rr, A.paints.hudRim);
  c.drawRRect({ rect: { x: x + 5, y: -h / 2 + 4, width: w - 10, height: h / 2 - 3 }, rx: h / 3, ry: h / 3 }, A.paints.hudShine);
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

  // Coins: the coin sits on the pill's left end, the number in white with a dark outline.
  const b = bounce(t, s.coinBounce);
  const tw = textWidth(A, text, COIN_TEXT);
  c.save();
  c.translate(layout.left, layout.top + PANEL_H / 2);
  c.scale(b, b);
  pill(c, A, 0, tw + PANEL_H + 22);
  vecSpr(c, A, A.S.coin, PANEL_H / 2, 0, COIN_SCALE + Math.sin(t * 3) * 0.04);
  drawTextSharp(c, A, text, PANEL_H + 6, 0.5, COIN_TEXT, null, 0);
  c.restore();

  // Rating: five stars filled to the current value, then the number.
  const rb = bounce(t, s.ratingBounce);
  const rText = (Math.floor(hud.rating * 10) / 10).toFixed(1);
  const pillW = STAR_STEP * 5 + 60;
  c.save();
  c.translate(layout.right - pillW, layout.top + PANEL_H / 2);
  c.scale(rb, rb);
  pill(c, A, 0, pillW);
  for (let i = 0; i < 5; i++) {
    const sx = 18 + i * STAR_STEP;
    vecSpr(c, A, A.S.starGray, sx, 0, STAR_SCALE);
    const fillPart = Math.max(0, Math.min(1, hud.rating - i));
    if (fillPart > 0) {
      c.save();
      c.clipRect({ x: sx - 10, y: -12, width: 20 * fillPart, height: 24 }, 1, true);
      vecSpr(c, A, A.S.star, sx, 0, STAR_SCALE);
      c.restore();
    }
  }
  drawTextSharp(c, A, rText, pillW - 25, 0.5, 1.15, A.paints.gold, 0.5);
  c.restore();

  // Combo badge while payments keep chaining.
  const sinceCombo = t - hud.comboAt;
  if (hud.combo >= 2 && sinceCombo >= 0 && sinceCombo < ECONOMY.comboWindowSeconds) {
    const pulse = 1 + Math.sin(t * 8) * 0.05;
    const fade = Math.min(1, (ECONOMY.comboWindowSeconds - sinceCombo) / 1.5);
    A.paints.orange.setAlphaf(fade);
    drawTextSharp(c, A, 'x' + hud.combo + '!', layout.left + 34, layout.top + PANEL_H + 20, 1.6 * pulse, A.paints.orange, 0.5);
    A.paints.orange.setAlphaf(1);
  }
}
