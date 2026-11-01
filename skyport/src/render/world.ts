/**
 * Static world for a tier: the ground picture (recorded once) plus the list
 * of static sprites (buildings, trees) that need depth sorting with movers.
 */
import { FilterMode, MipmapMode, PaintStyle, Skia, TileMode, type SkCanvas, type SkPicture } from '@shopify/react-native-skia';

import type { TierLayout } from '../data/tiers';
import { hash01 } from '../sim/hash';
import { routeArrival, routeDeparture, routeLineUp } from '../sim/game/layout';
import { GroundPainter, rasterizeGround, recordPicture, type GroundTile } from './ground';
import { HALF_H, HALF_W, isoX, isoY } from './iso';
import { TREE_KINDS, TREE_SIZES, type SpriteSet } from './sprites';

export interface StaticSprite {
  sprite: number;
  x: number;
  y: number;
  depth: number;
  /** Screen-space radius for culling. */
  r: number;
}

export interface World {
  picture: SkPicture;
  /** The picture baked into image tiles. */
  tiles: GroundTile[];
  statics: StaticSprite[];
  /** World-screen bounds the camera center may move within. */
  bounds: { x0: number; y0: number; x1: number; y1: number };
  /** Windsock sprite placement (animated). */
  windsock: { x: number; y: number };
}

const GRASS_A = '#7fc46c';
const GRASS_B = '#78bd65';
const FARM_A = '#8cc76f';
const FARM_B = '#86c06a';
const DIRT = '#c9a06a';
const DIRT_EDGE = '#d9b885';
const DIRT_DARK = '#b38655';
const GRAVEL = '#cdbf9c';

/** Iso checkerboard as a repeating image shader (one draw for the whole ground). */
function checkerShader(a: string, b: string) {
  const W = HALF_W * 2;
  const H = HALF_H * 2;
  const surf = Skia.Surface.Make(W * 2, H * 2);
  if (!surf) return null;
  const c = surf.getCanvas();
  c.scale(2, 2);
  const p = Skia.Paint();
  p.setAntiAlias(false);
  p.setColor(Skia.Color(b));
  c.drawRect(Skia.XYWHRect(0, 0, W, H), p);
  p.setAntiAlias(true);
  p.setColor(Skia.Color(a));
  const pb = Skia.PathBuilder.Make();
  pb.moveTo(W / 2, 0);
  pb.lineTo(W, H / 2);
  pb.lineTo(W / 2, H);
  pb.lineTo(0, H / 2);
  pb.close();
  c.drawPath(pb.build(), p);
  surf.flush();
  const img = surf.makeImageSnapshot().makeNonTextureImage() ?? surf.makeImageSnapshot();
  // tile (0,0) diamond is centered at (0, H/2) in world-screen space
  const m = Skia.Matrix();
  m.translate(-W / 2, 0);
  m.scale(0.5, 0.5);
  return img.makeShaderOptions(TileMode.Repeat, TileMode.Repeat, FilterMode.Linear, MipmapMode.None, m);
}

/** A ribbon along a world polyline (flat [x, y, z...]) with constant world width. */
function ribbon(g: GroundPainter, path: number[], width: number, color: string): void {
  const n = path.length / 3;
  if (n < 2) return;
  const left: number[] = [];
  const right: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - 1) * 3;
    const b = Math.min(n - 1, i + 1) * 3;
    let dx = path[b] - path[a];
    let dy = path[b + 1] - path[a + 1];
    const len = Math.hypot(dx, dy) || 1;
    dx /= len;
    dy /= len;
    const x = path[i * 3];
    const y = path[i * 3 + 1];
    left.push(x - dy * width * 0.5, y + dx * width * 0.5);
    right.push(x + dy * width * 0.5, y - dx * width * 0.5);
  }
  const pts = left.slice();
  for (let i = right.length - 2; i >= 0; i -= 2) pts.push(right[i], right[i + 1]);
  g.poly(pts, color);
  // round caps
  g.ellipse(path[0], path[1], width / 2, width / 2, color, 12);
  g.ellipse(path[(n - 1) * 3], path[(n - 1) * 3 + 1], width / 2, width / 2, color, 12);
}

function drawField(g: GroundPainter, x0: number, y0: number, x1: number, y1: number, kind: number): void {
  const colors = [
    ['#d9c36a', '#c9b05a'],
    ['#9ccc65', '#8bbd57'],
    ['#b8865a', '#a77a50'],
    ['#e3d27f', '#d4c070'],
  ][kind % 4];
  g.rect(x0, y0, x1, y1, colors[0]);
  const rows = Math.floor((y1 - y0) / 0.35);
  const b = Skia.PathBuilder.Make();
  for (let i = 1; i < rows; i++) {
    const y = y0 + i * 0.35;
    b.moveTo(isoX(x0 + 0.1, y), isoY(x0 + 0.1, y));
    b.lineTo(isoX(x1 - 0.1, y), isoY(x1 - 0.1, y));
  }
  g.s.setColor(Skia.Color(colors[1]));
  g.s.setStrokeWidth(2.2);
  g.c.drawPath(b.build(), g.s);
}

export function buildWorld(L: TierLayout, sprites: SpriteSet): World {
  const W = L.world.w;
  const H = L.world.h;
  const F = L.field;
  const statics: StaticSprite[] = [];
  const minX = isoX(0, H) - 64;
  const maxX = isoX(W, 0) + 64;
  const minY = isoY(0, 0) - 64;
  const maxY = isoY(W, H) + 64;

  const picture = recordPicture(minX, minY, maxX - minX, maxY - minY, (c: SkCanvas) => {
    const g = new GroundPainter(c);
    // whole map: farmland checker
    const farm = checkerShader(FARM_A, FARM_B);
    const base = Skia.Paint();
    base.setStyle(PaintStyle.Fill);
    if (farm) base.setShader(farm);
    else base.setColor(Skia.Color(FARM_A));
    const world = Skia.PathBuilder.Make();
    world.moveTo(isoX(0, 0), isoY(0, 0));
    world.lineTo(isoX(W, 0), isoY(W, 0));
    world.lineTo(isoX(W, H), isoY(W, H));
    world.lineTo(isoX(0, H), isoY(0, H));
    world.close();
    c.drawPath(world.build(), base);

    // farm fields around the airfield
    const fields: [number, number, number, number][] = [
      [2, 30, 9, 36],
      [2, 37, 8, 43],
      [10, 32, 17, 38],
      [19, 33, 26, 40],
      [28, 32, 36, 37],
      [36, 20, 43, 27],
      [36, 9, 43, 16],
      [27, 4, 34, 10],
      [3, 3, 9, 9],
      [12, 4, 18, 11],
    ];
    fields.forEach((f, i) => drawField(g, f[0], f[1], f[2], f[3], i));
    // pond
    g.ellipse(39.5, 31.5, 3.2, 2.2, '#5aa9d6');
    g.ellipse(39.4, 31.4, 2.7, 1.7, '#6fc0ea');
    g.ellipse(38.6, 30.8, 0.9, 0.4, '#a6dcf7');

    // the airfield: mown grass checker
    const field = checkerShader(GRASS_A, GRASS_B);
    const fp = Skia.Paint();
    fp.setStyle(PaintStyle.Fill);
    if (field) fp.setShader(field);
    else fp.setColor(Skia.Color(GRASS_A));
    const fb = Skia.PathBuilder.Make();
    fb.moveTo(isoX(F.x0, F.y0), isoY(F.x0, F.y0));
    fb.lineTo(isoX(F.x1, F.y0), isoY(F.x1, F.y0));
    fb.lineTo(isoX(F.x1, F.y1), isoY(F.x1, F.y1));
    fb.lineTo(isoX(F.x0, F.y1), isoY(F.x0, F.y1));
    fb.close();
    c.drawPath(fb.build(), fp);

    // grass tufts and flowers (deterministic), batched by color
    const dots = ['#ffffff', '#ffd94a', '#ff8fa3'].map(() => Skia.PathBuilder.Make());
    const tufts = [Skia.PathBuilder.Make(), Skia.PathBuilder.Make()];
    for (let i = 0; i < 520; i++) {
      const x = hash01(i * 3 + 1) * W;
      const y = hash01(i * 3 + 2) * H;
      const k = hash01(i * 3 + 3);
      const inField = x > F.x0 && x < F.x1 && y > F.y0 && y < F.y1;
      if (inField && Math.abs(y - L.runway.y) < 1.2) continue;
      const sx = isoX(x, y);
      const sy = isoY(x, y);
      if (k < 0.12) {
        dots[k < 0.04 ? 0 : k < 0.08 ? 1 : 2].addCircle(sx, sy, 1.6);
      } else {
        const tb = tufts[k < 0.55 ? 0 : 1];
        tb.moveTo(sx, sy);
        tb.lineTo(sx - 2, sy - 4);
        tb.moveTo(sx, sy);
        tb.lineTo(sx + 1.5, sy - 5);
      }
    }
    ['#ffffff', '#ffd94a', '#ff8fa3'].forEach((col, i) => {
      g.f.setColor(Skia.Color(col));
      c.drawPath(dots[i].build(), g.f);
    });
    g.s.setStrokeWidth(1.4);
    ['#5fa54f', '#9ad57e'].forEach((col, i) => {
      g.s.setColor(Skia.Color(col));
      c.drawPath(tufts[i].build(), g.s);
    });

    // road and parking
    const road: number[] = [];
    for (const p of L.road) road.push(p[0], p[1], 0);
    ribbon(g, road, 1.15, '#8d8a85');
    ribbon(g, road, 0.95, '#a3a09a');
    const P = L.parking;
    g.rect(P.x0 - 0.08, P.y0 - 0.08, P.x1 + 0.08, P.y1 + 0.08, '#8d8a85');
    g.rect(P.x0, P.y0, P.x1, P.y1, '#a3a09a');
    for (let x = P.x0 + 0.65; x < P.x1; x += 0.65) g.line(x, P.y0 + 0.1, x, P.y0 + 0.9, '#ecebe6', 1.6);

    // apron gravel in front of the hut
    const st = L.stands[0];
    g.poly([L.hut[0] - 0.6, L.hut[1] + 1.3, st.pos[0] + 2.2, L.hut[1] + 1.3, st.pos[0] + 2.6, st.pos[1] + 1.6, L.hut[0] - 0.3, st.pos[1] + 1.4], GRAVEL);

    // taxi tracks (dirt)
    for (const path of [routeArrival(L, 0), routeDeparture(L, 0), routeLineUp(L)]) {
      ribbon(g, path, 0.85, DIRT_EDGE);
      ribbon(g, path, 0.62, DIRT);
    }
    // runway: dirt strip with lighter shoulders, worn center and tire marks
    const R = L.runway;
    const hw = R.width / 2;
    g.rect(R.x0 - 0.4, R.y - hw - 0.18, R.x1 + 0.4, R.y + hw + 0.18, DIRT_EDGE);
    g.rect(R.x0 - 0.2, R.y - hw, R.x1 + 0.2, R.y + hw, DIRT);
    g.rect(R.x0, R.y - 0.18, R.x1, R.y + 0.18, DIRT_DARK);
    const marks = Skia.PathBuilder.Make();
    for (let i = 0; i < 18; i++) {
      const x = R.x0 + 1 + hash01(900 + i) * (R.x1 - R.x0 - 3);
      const dy = (hash01(950 + i) - 0.5) * 0.6;
      const x2 = x + 1.2 + hash01(990 + i) * 1.5;
      marks.moveTo(isoX(x, R.y + dy), isoY(x, R.y + dy));
      marks.lineTo(isoX(x2, R.y + dy * 0.8), isoY(x2, R.y + dy * 0.8));
    }
    g.s.setColor(Skia.Color('#9c7448'));
    g.s.setStrokeWidth(1.6);
    c.drawPath(marks.build(), g.s);
    // white edge markers (painted tires)
    const tireO = Skia.PathBuilder.Make();
    const tireW = Skia.PathBuilder.Make();
    for (let x = R.x0; x <= R.x1 + 0.01; x += 1.5) {
      for (const side of [-1, 1]) {
        const sx = isoX(x, R.y + side * (hw + 0.1));
        const sy = isoY(x, R.y + side * (hw + 0.1));
        tireO.addOval(Skia.XYWHRect(sx - 4.5, sy - 3, 9, 6));
        tireW.addOval(Skia.XYWHRect(sx - 3.2, sy - 2.6, 6.4, 4));
      }
    }
    g.f.setColor(Skia.Color('#2b2b30'));
    c.drawPath(tireO.build(), g.f);
    g.f.setColor(Skia.Color('#ffffff'));
    c.drawPath(tireW.build(), g.f);
    // threshold bars
    for (let k = -2; k <= 2; k++) {
      const yy = R.y + k * 0.22;
      g.line(R.x0 + 0.3, yy, R.x0 + 0.9, yy, '#f4f1e8', 3);
    }
    // stand marker: a painted circle with a T
    g.ellipse(st.pos[0], st.pos[1], 0.75, 0.75, '#f4f1e8');
    g.ellipse(st.pos[0], st.pos[1], 0.62, 0.62, GRAVEL);
    g.line(st.pos[0] + 0.55, st.pos[1] + 0.8, st.pos[0] - 0.35, st.pos[1] - 0.55, '#ffd23f', 3);

    // fence around the airfield, with a gate for the road
    const posts: [number, number, number, number][] = [
      [F.x0, F.y0, F.x1, F.y0],
      [F.x1, F.y0, F.x1, F.y1],
      [F.x1, F.y1, F.x0, F.y1],
      [F.x0, F.y1, F.x0, F.y0],
    ];
    const rails = Skia.PathBuilder.Make();
    const postsPath = Skia.PathBuilder.Make();
    for (const [ax, ay, bx, by] of posts) {
      const len = Math.hypot(bx - ax, by - ay);
      const n = Math.round(len);
      for (let i = 0; i < n; i++) {
        const t0 = i / n;
        const t1 = (i + 1) / n;
        const x0 = ax + (bx - ax) * t0;
        const y0 = ay + (by - ay) * t0;
        const x1 = ax + (bx - ax) * t1;
        const y1 = ay + (by - ay) * t1;
        const gate = Math.abs(y0 - F.y0) < 0.01 && Math.abs(y1 - F.y0) < 0.01 && Math.min(x0, x1) < 22.6 && Math.max(x0, x1) > 21.6;
        if (gate) continue;
        for (const z of [0.22, 0.12]) {
          rails.moveTo(isoX(x0, y0), isoY(x0, y0, z));
          rails.lineTo(isoX(x1, y1), isoY(x1, y1, z));
        }
        postsPath.moveTo(isoX(x0, y0), isoY(x0, y0));
        postsPath.lineTo(isoX(x0, y0), isoY(x0, y0, 0.3));
      }
    }
    g.s.setColor(Skia.Color('#8a6a4a'));
    g.s.setStrokeWidth(1.4);
    c.drawPath(rails.build(), g.s);
    g.s.setColor(Skia.Color('#6e5238'));
    g.s.setStrokeWidth(2.6);
    c.drawPath(postsPath.build(), g.s);
  });

  // static sprites with depth: buildings and trees
  statics.push({ sprite: sprites.hut, x: isoX(L.hut[0], L.hut[1]), y: isoY(L.hut[0], L.hut[1]), depth: L.hut[0] + 1 + L.hut[1] + 0.7, r: 120 });
  statics.push({ sprite: sprites.pump, x: isoX(L.pump[0], L.pump[1]), y: isoY(L.pump[0], L.pump[1]), depth: L.pump[0] + L.pump[1] + 0.9, r: 60 });

  const treeAt = (x: number, y: number, seed: number) => {
    const kind = Math.floor(hash01(seed * 5 + 1) * TREE_KINDS.length);
    const size = Math.floor(hash01(seed * 5 + 2) * TREE_SIZES.length);
    statics.push({ sprite: sprites.tree(kind, size), x: isoX(x, y), y: isoY(x, y), depth: x + y, r: 110 });
  };
  // tree lines outside the fence, with gaps
  let seed = 1;
  for (let x = 2; x < W - 2; x += 1.3) {
    for (const y of [F.y0 - 1.6, F.y1 + 1.8]) {
      const jitter = (hash01(seed * 7) - 0.5) * 0.8;
      if (hash01(seed * 11) < 0.62 && !(y < F.y0 && x > 20.5 && x < 24)) treeAt(x + jitter, y + jitter * 0.6, seed);
      seed++;
    }
  }
  for (let y = 4; y < H - 3; y += 1.4) {
    for (const x of [F.x0 - 1.8, F.x1 + 1.8]) {
      const jitter = (hash01(seed * 7) - 0.5) * 0.8;
      if (hash01(seed * 11) < 0.55) treeAt(x + jitter * 0.6, y + jitter, seed);
      seed++;
    }
  }
  // a little grove near the hut
  treeAt(19.6, 18.4, 501);
  treeAt(19.9, 19.6, 502);
  treeAt(27.8, 18.3, 503);
  // scattered trees in the countryside
  for (let i = 0; i < 70; i++) {
    const x = hash01(2000 + i) * W;
    const y = hash01(3000 + i) * H;
    if (x > F.x0 - 3 && x < F.x1 + 3 && y > F.y0 - 3 && y < F.y1 + 3) continue;
    if (Math.abs(x - 22) < 1.5 && y < F.y0) continue; // keep the road clear
    treeAt(x, y, 4000 + i);
  }

  // only tiles that touch the world diamond (|sx|/a + |sy-c|/b <= 1)
  const a = (W + H) * HALF_W * 0.5 + 64;
  const cy = isoY(W / 2, H / 2);
  const b = (W + H) * HALF_H * 0.5 + 64;
  const tiles = rasterizeGround(picture, minX, minY, maxX - minX, maxY - minY, 512, 1, (tx, ty, size) => {
    const dx = tx > 0 ? tx : tx + size < 0 ? -(tx + size) : 0;
    const dy = ty > cy ? ty - cy : ty + size < cy ? cy - (ty + size) : 0;
    return dx / a + dy / b <= 1;
  });
  return {
    picture,
    tiles,
    statics,
    bounds: { x0: isoX(0, H) * 0.7, y0: isoY(0, 0) + 200, x1: isoX(W, 0) * 0.7, y1: isoY(W, H) - 300 },
    windsock: { x: L.windsock[0], y: L.windsock[1] },
  };
}
