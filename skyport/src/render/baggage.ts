/**
 * Baggage on the move (owner request: the conveyor looked flat, its animation
 * poor): the check-in conveyors with their moving belts and the bags riding
 * them into the baggage room, and the claim carousels turning with a bag for
 * every passenger waiting at them. Real time drives the motion (it is only
 * the look); which bags are on a carousel comes from the game state.
 */
import { BAG_KINDS, BELT_FRAMES, BELT_PIECE, BELT_Z, CAROUSEL_BAG_R } from './art/baggage';
import { isoX, isoY } from './iso';
import type { SnapWriter } from './scene';
import type { SpriteSet } from './sprites';
import { hash01 } from '../sim/hash';
import { terms } from '../sim/game/terminal';
import { PST, type GameState } from '../sim/game/types';

type Line = readonly (readonly [number, number])[];

/** Conveyor speed (tiles a second); the ribs and the bags move together. */
export const BELT_SPEED = 0.42;
/** Rib spacing on a belt piece (tiles): BELT_FRAMES frames make one. */
const RIB = BELT_PIECE / 5;
/** Carousel turning speed (radians a second), and the plate step its frames cycle through. */
const CAROUSEL_SPEED = 0.42;
const PLATE = (Math.PI * 2) / 28;

/** Length of a polyline. */
function lengthOf(line: Line): number {
  let d = 0;
  for (let i = 1; i < line.length; i++) d += Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1]);
  return d;
}

/** The point at distance d along a polyline, and whether that leg runs along y. */
export function pointAt(line: Line, d: number): { x: number; y: number; alongY: boolean } {
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1];
    const b = line[i];
    const seg = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (d <= seg || i === line.length - 1) {
      const k = seg > 0 ? Math.min(1, Math.max(0, d / seg)) : 0;
      return { x: a[0] + (b[0] - a[0]) * k, y: a[1] + (b[1] - a[1]) * k, alongY: Math.abs(b[1] - a[1]) > Math.abs(b[0] - a[0]) };
    }
    d -= seg;
  }
  const p = line[line.length - 1];
  return { x: p[0], y: p[1], alongY: false };
}

/** Distance along a polyline of the point on it nearest (x, y), and how far that point is. */
function project(line: Line, x: number, y: number): { d: number; dist: number } {
  let best = { d: 0, dist: Infinity };
  let run = 0;
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1];
    const b = line[i];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const l2 = dx * dx + dy * dy;
    const k = l2 > 0 ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / l2)) : 0;
    const dist = Math.hypot(x - a[0] - k * dx, y - a[1] - k * dy);
    if (dist < best.dist) best = { d: run + k * Math.sqrt(l2), dist };
    run += Math.sqrt(l2);
  }
  return best;
}

/** Bags riding the check-in conveyors (one is put on behind the counter at each check-in). */
export class BeltBags {
  belts: Line[] = [];
  private lens: number[] = [];
  readonly bags: { belt: number; d: number; kind: number }[] = [];

  setBelts(belts: Line[]): void {
    this.belts = belts.filter((b) => b.length > 1);
    this.lens = this.belts.map(lengthOf);
    this.bags.length = 0;
  }

  /** A bag checked in at a counter at (x, y): onto the nearest conveyor, just behind it. */
  add(x: number, y: number): void {
    let best = -1;
    let at = { d: 0, dist: Infinity };
    this.belts.forEach((line, i) => {
      const p = project(line, x, y);
      if (p.dist < at.dist) {
        at = p;
        best = i;
      }
    });
    if (best < 0 || at.dist > 2 || this.bags.length > 40) return;
    this.bags.push({ belt: best, d: at.d, kind: Math.floor(Math.random() * BAG_KINDS) });
  }

  update(dt: number): void {
    for (const b of this.bags) b.d += BELT_SPEED * dt;
    // (gone into the baggage room at the end)
    for (let i = this.bags.length - 1; i >= 0; i--) if (this.bags[i].d >= this.lens[this.bags[i].belt] - 0.05) this.bags.splice(i, 1);
  }
}

/**
 * Draws the conveyors (pieces with moving ribs), the bags on them, and the
 * carousels (base, bags, island) with their bags turning.
 */
export function drawBaggage(w: SnapWriter, s: GameState, sp: SpriteSet, time: number, bags: BeltBags, visible: (x: number, y: number, r: number) => boolean): void {
  // the conveyors, piece by piece along each leg
  const ribFrame = Math.floor((time * BELT_SPEED * BELT_FRAMES) / RIB) % BELT_FRAMES;
  for (const line of bags.belts) {
    for (let i = 1; i < line.length; i++) {
      const a = line[i - 1];
      const b = line[i];
      const seg = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (seg < 0.05) continue;
      const alongY = Math.abs(b[1] - a[1]) > Math.abs(b[0] - a[0]);
      const forward = alongY ? b[1] > a[1] : b[0] > a[0];
      const n = Math.max(1, Math.ceil(seg / BELT_PIECE - 0.2));
      for (let k = 0; k < n; k++) {
        // (pieces end to end; the last one sits flush with the leg's end)
        const c = Math.min(seg - BELT_PIECE / 2, BELT_PIECE / 2 + k * BELT_PIECE);
        const t = seg > 0 ? Math.max(0, c) / seg : 0;
        const x = a[0] + (b[0] - a[0]) * t;
        const y = a[1] + (b[1] - a[1]) * t;
        const sx = isoX(x, y);
        const sy = isoY(x, y);
        if (visible(sx, sy, 30)) w.sprite(sp.beltPiece(alongY, ribFrame, forward), sx, sy, 1, x + y - 0.2);
      }
    }
  }
  for (const bag of bags.bags) {
    const p = pointAt(bags.belts[bag.belt], bag.d);
    const sx = isoX(p.x, p.y);
    const sy = isoY(p.x, p.y, BELT_Z);
    if (visible(sx, sy, 20)) w.sprite(sp.beltBag(bag.kind, p.alongY), sx, sy, 1, p.x + p.y - 0.1);
  }

  // the carousels: a bag for each passenger waiting there, turning with the belt
  for (const T of terms(s)) {
    const cs = T.st.carousels ?? [T.st.claim];
    const waiting: number[][] = cs.map(() => []);
    for (const p of s.people) if (p.state === PST.atClaim && (p.term ?? 0) === T.t) waiting[p.flight % cs.length].push(p.id);
    cs.forEach((c, i) => {
      const cx = isoX(c[0], c[1]);
      const cy = isoY(c[0], c[1]);
      if (!visible(cx, cy, 40)) return;
      const ids = waiting[i];
      const turn = ids.length > 0 ? time * CAROUSEL_SPEED : 0;
      const frame = Math.floor((turn / PLATE) * BELT_FRAMES) % BELT_FRAMES;
      w.sprite(sp.carouselBase(frame), cx, cy, 1, c[0] + c[1] - 0.6);
      w.sprite(sp.carouselIsland, cx, cy, 1, c[0] + c[1]);
      for (const id of ids.slice(0, 12)) {
        const a = hash01(id * 7 + 3) * Math.PI * 2 + turn;
        const bx = c[0] + Math.cos(a) * CAROUSEL_BAG_R;
        const by = c[1] + Math.sin(a) * CAROUSEL_BAG_R;
        // (lying along the belt: its length along the direction it moves)
        const alongY = Math.abs(Math.cos(a)) > Math.abs(Math.sin(a));
        w.sprite(sp.beltBag(Math.floor(hash01(id * 5 + 1) * BAG_KINDS), alongY), isoX(bx, by), isoY(bx, by, BELT_Z), 1, bx + by);
      }
    });
  }
}
