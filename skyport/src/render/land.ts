/**
 * The land around the airport on the map (owner request: grow to the sides
 * like Hay Day or Clash of Clans): obstacles on wild plots, a sign with the
 * price on the plots for sale, workers and dust while a plot is cleared, each
 * facility built from pieces that grow with its level, scaffolding while it is
 * built, and a coin bubble when it has coins to collect.
 */
import { FACILITIES, type PlotDef } from '../data/land';
import { Big } from '../sim/big';
import { formatBig } from '../sim/format';
import { canBuyPlot, facilityCap, landPlots, obstaclesOf, plotCost } from '../sim/game/land';
import type { GameState, PlotState } from '../sim/game/types';
import { OUTFITS } from './art/people';
import { isoX, isoY } from './iso';
import type { SnapWriter } from './scene';
import { dirIndex, GLOW_COLORS, TREE_KINDS, type SpriteSet } from './sprites';
import { overlayText } from './text';

const CREW = Math.max(0, OUTFITS.findIndex((o) => o.id === 'crew'));
const PINE = Math.max(0, TREE_KINDS.indexOf('pine'));
const ROUND = Math.max(0, TREE_KINDS.indexOf('round'));
const BIRCH = Math.max(0, TREE_KINDS.indexOf('birch'));
/** Car variants for parked cars (the bus left out). */
const PARKED = [0, 1, 2, 3, 4, 5];

/** A facility's coins are worth collecting from this share of its cap (the bubble shows). */
export const COLLECT_AT = 0.25;

/** Where a plot's coin bubble shows (world-screen px), or null when it has nothing to collect. */
export function collectSpot(s: GameState, pl: PlotDef): { x: number; y: number } | null {
  const p = s.land.plots[pl.id];
  if (!p || p.state !== 2 || p.lv <= 0 || p.left > 0) return null;
  const cap = facilityCap(s, p);
  if (cap <= 0 || p.store < cap * COLLECT_AT || p.store < 1) return null;
  const cx = (pl.box[0] + pl.box[2]) / 2;
  const cy = (pl.box[1] + pl.box[3]) / 2;
  return { x: isoX(cx, cy), y: isoY(cx, cy, 1.9) };
}

/** Where the sign of a plot for sale stands (tiles). */
export function signSpot(pl: PlotDef): [number, number] {
  return [pl.box[0] + 0.5, pl.box[1] + 0.45];
}

export function drawLand(w: SnapWriter, s: GameState, sp: SpriteSet, time: number, inv: number, visible: (x: number, y: number, r: number) => boolean): void {
  const plots = landPlots(s);
  if (plots.length === 0) return;
  const at = (sprite: number, x: number, y: number, depth = x + y, scale = 1) => {
    const sx = isoX(x, y);
    const sy = isoY(x, y);
    if (visible(sx, sy, 90)) w.sprite(sprite, sx, sy, scale, depth);
  };
  for (const pl of plots) {
    const [x0, y0, x1, y1] = pl.box;
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    if (!visible(isoX(cx, cy), isoY(cx, cy), 260)) continue;
    const p = s.land.plots[pl.id];
    if (!p || p.state === 1) {
      drawWild(w, s, sp, pl, p, time, inv, at);
      continue;
    }
    drawFacility(sp, pl, p, time, at);
    if (p.left > 0 && p.f >= 0) {
      // being built: a crane and the progress
      at(sp.crane, cx - 0.4, cy - 0.3, cx + cy + 0.3);
      w.bar(isoX(cx, cy), isoY(cx, cy, 2.4), 56, 1 - p.left / Math.max(0.001, p.total), 0xf59e0b);
    }
    const bubble = collectSpot(s, pl);
    if (bubble) {
      // a coin bubble that bobs, with a gold halo (tap it to collect)
      const k = Math.max(1, inv * 0.75) * (1 + Math.sin(time * 4 + pl.id) * 0.06);
      const by = bubble.y - Math.abs(Math.sin(time * 2.2 + pl.id)) * 6;
      w.fx(sp.glow(GLOW_COLORS.gold), bubble.x, by, 3.8 * k, 1);
      w.over(sp.icon('coin'), bubble.x, by, 1.2 * k);
    }
  }
}

function drawWild(
  w: SnapWriter,
  s: GameState,
  sp: SpriteSet,
  pl: PlotDef,
  p: PlotState | undefined,
  time: number,
  inv: number,
  at: (sprite: number, x: number, y: number, depth?: number, scale?: number) => void,
): void {
  const obs = obstaclesOf(pl);
  const done = p ? 1 - p.left / Math.max(0.001, p.total) : 0;
  // (as the clearing runs, the obstacles go one by one)
  const gone = Math.floor(done * obs.length);
  obs.forEach((o, k) => {
    if (k < gone) return;
    const L = sp.land;
    switch (o.kind) {
      case 'tree':
        return at(sp.tree(k % 2 ? ROUND : BIRCH, 1 + (k % 2)), o.x, o.y);
      case 'pine':
        return at(sp.tree(PINE, 2), o.x, o.y);
      case 'rock':
        return at(sp.rock, o.x, o.y, o.x + o.y, 1.8);
      case 'boulder':
        return at(L.boulder, o.x, o.y);
      case 'bush':
        return at(L.bush, o.x, o.y);
      case 'stump':
        return at(L.stump, o.x, o.y);
      case 'shed':
        return at(L.shed, o.x, o.y);
      case 'hay':
        return at(L.hay, o.x, o.y);
    }
  });
  const [x0, y0, x1, y1] = pl.box;
  if (p) {
    // the clearing crew at the next obstacle: two workers, dust, and the progress
    const next = obs[Math.min(obs.length - 1, gone)];
    for (let i = 0; i < 2; i++) {
      const wx = next.x - 0.35 + i * 0.7;
      const wy = next.y + 0.35;
      const frame = Math.floor(time * 6 + i * 2) % 4;
      at(sp.person(CREW, false, i === 1, frame), wx, wy);
    }
    if (Math.floor(time * 3) % 2 === 0) w.fx(sp.puff, isoX(next.x, next.y), isoY(next.x, next.y, 0.2), 1.2 + 0.3 * Math.sin(time * 5), 0.6);
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    w.bar(isoX(cx, cy), isoY(cx, cy, 1.8), 60, done, 0x22c55e);
    return;
  }
  // for sale (the first row, or south of a plot that is the airport's): the sign, and the price over it when it can be bought now
  if (pl.row > 0 && s.land.plots[pl.id - 100]?.state !== 2) return;
  const [sx, sy] = signSpot(pl);
  at(sp.land.sign, sx, sy, sx + sy + 0.2);
  if (!canBuyPlot(s, pl.id)) return;
  const price = formatBig(Big.fromNumber(plotCost(s)));
  overlayText(w, sp, price, isoX(sx, sy), isoY(sx, sy, 0.95), 0.75 * Math.max(0.8, inv * 0.7), 0);
}

/** A facility's pieces: they multiply and grow with its level. */
function drawFacility(sp: SpriteSet, pl: PlotDef, p: PlotState, time: number, at: (sprite: number, x: number, y: number, depth?: number, scale?: number) => void): void {
  const [x0, y0, x1, y1] = pl.box;
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const lv = Math.max(1, p.lv);
  const L = sp.land;
  const car = (k: number, x: number, y: number, heading: number) => at(sp.car(PARKED[(pl.id * 7 + k * 3) % PARKED.length], dirIndex(heading)), x, y);
  switch (FACILITIES[p.f]?.id) {
    case 'rental': {
      at(L.rental(lv), x0 + 1.05, cy);
      const n = 2 + 2 * lv;
      for (let k = 0; k < n; k++) {
        const col = Math.floor(k / 2);
        const top = k % 2 === 0;
        car(k, x0 + 2.52 + col * 0.65, top ? y0 + 1.0 : y1 - 0.9, top ? -Math.PI / 2 : Math.PI / 2);
      }
      break;
    }
    case 'parking': {
      const n = 4 + 4 * lv;
      const per = Math.floor((x1 - x0 - 0.7) / 0.65);
      const rows = [y0 + 0.9, cy + 0.5, y1 - 0.75];
      for (let k = 0; k < n; k++) {
        const r = Math.floor(k / per) % 3;
        const c = k % per;
        car(k, x0 + 0.92 + c * 0.65, rows[r], r === 2 ? Math.PI / 2 : -Math.PI / 2);
      }
      at(sp.ticketBooth, x0 + 0.45, cy - 0.1);
      break;
    }
    case 'solar':
      for (let r = 0; r < Math.min(5, lv); r++) for (let c = 0; c < 3; c++) at(L.solar, x0 + 0.35 + c * 1.85, y0 + 0.75 + r * 0.72, x0 + 0.35 + c * 1.85 + 0.8 + y0 + 0.75 + r * 0.72);
      break;
    case 'school': {
      at(L.hangar(lv), x0 + 1.4, y0 + 1.3);
      for (let i = 0; i < Math.min(4, lv); i++) at(L.trainer(i), x0 + 1.0 + i * 1.25, y1 - 1.0);
      // one of them flies circuits over the field
      if (lv >= 2) {
        const a = time * 0.5 + pl.id;
        const px = cx + Math.cos(a) * 2.4;
        const py = cy + Math.sin(a) * 1.4;
        at(L.trainer(2), px, py, 1000 + px + py);
      }
      break;
    }
    case 'logistics': {
      at(L.warehouse(Math.min(3, lv)), x0 + 1.8, y0 + 1.45);
      if (lv >= 4) at(L.warehouse(lv - 3), x0 + 4.5, y0 + 1.45);
      for (let i = 0; i < lv; i++) at(L.truck(i), x0 + 0.9 + i * 1.0, y1 - 0.75);
      break;
    }
    case 'garden': {
      at(L.fountain(Math.floor(time * 3)), cx, cy);
      const beds: [number, number][] = [
        [cx - 1.6, cy - 1.1],
        [cx + 1.6, cy + 1.1],
        [cx + 1.6, cy - 1.1],
        [cx - 1.6, cy + 1.1],
        [cx - 2.5, cy],
        [cx + 2.5, cy],
      ];
      for (let i = 0; i < Math.min(beds.length, lv + 1); i++) at(L.flowers(i), beds[i][0], beds[i][1]);
      const trees: [number, number][] = [
        [x0 + 0.5, y0 + 0.5],
        [x1 - 0.5, y1 - 0.5],
        [x1 - 0.5, y0 + 0.5],
        [x0 + 0.5, y1 - 0.5],
        [cx - 0.9, y0 + 0.45],
        [cx + 0.9, y1 - 0.45],
        [x0 + 0.45, cy + 0.9],
      ];
      for (let i = 0; i < Math.min(trees.length, 2 + lv); i++) at(sp.tree(i % 2 ? BIRCH : ROUND, 1 + (i % 2)), trees[i][0], trees[i][1]);
      for (let i = 0; i < lv; i++) at(sp.bench, cx - 0.9 + (i % 2) * 1.5, cy + (i < 2 ? -0.55 : 0.4));
      break;
    }
  }
}
