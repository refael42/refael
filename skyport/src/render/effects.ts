/**
 * Visual effects (render side only, never in the simulation): floating
 * numbers, coins flying to the HUD, dust puffs, sparkles. Fixed-size pool.
 */
import { Big } from '../sim/big';
import { formatBig } from '../sim/format';
import type { Camera } from './camera';
import type { SnapWriter } from './scene';
import type { SpriteSet } from './sprites';
import { overlayText } from './text';

const MAX = 160;

type Kind = 0 | 1 | 2 | 3 | 4 | 5; // 0 text, 1 coin to HUD, 2 dust puff, 3 sparkle, 4 bag on belt, 5 small text

interface Fx {
  live: boolean;
  kind: Kind;
  t: number;
  life: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  text: string;
  seed: number;
}

export class Effects {
  private pool: Fx[] = [];
  /** Belt polyline in world-screen px (for bags riding the conveyor). */
  belt: { x: number; y: number }[] = [];
  /** View-space target the coins fly to (the HUD coin counter). */
  coinTarget = { x: 40, y: 30 };
  onCoinArrive: (() => void) | null = null;

  constructor() {
    for (let i = 0; i < MAX; i++) this.pool.push({ live: false, kind: 0, t: 0, life: 1, x: 0, y: 0, vx: 0, vy: 0, text: '', seed: 0 });
  }

  private take(): Fx | null {
    for (const f of this.pool) if (!f.live) return f;
    return null;
  }

  private add(kind: Kind, x: number, y: number, life: number, vx = 0, vy = 0, text = ''): void {
    const f = this.take();
    if (!f) return;
    f.live = true;
    f.kind = kind;
    f.t = 0;
    f.life = life;
    f.x = x;
    f.y = y;
    f.vx = vx;
    f.vy = vy;
    f.text = text;
    f.seed = Math.random();
  }

  /** Money popup at a world-screen point. */
  money(x: number, y: number, m: number, e: number): void {
    this.add(0, x, y, 1.6, 0, -28, '+' + formatBig(new Big(m, e)));
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i - 2) * 0.45;
      this.add(1, x, y, 0.9 + i * 0.08, Math.cos(a) * 70, Math.sin(a) * 70);
    }
  }

  /** A shop sale: a small number pops up. */
  sale(x: number, y: number, m: number, e: number): void {
    this.add(5, x, y, 1.1, 0, -24, '+' + formatBig(new Big(m, e)));
  }

  /** A checked bag rides the conveyor into the building. */
  bag(): void {
    if (this.belt.length > 1) this.add(4, this.belt[0].x, this.belt[0].y, 3.2);
  }

  dust(x: number, y: number, n = 4): void {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      this.add(2, x + Math.cos(a) * 6, y + Math.sin(a) * 3, 0.9 + Math.random() * 0.5, Math.cos(a) * 14, Math.sin(a) * 6 - 6);
    }
  }

  sparkle(x: number, y: number): void {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      this.add(3, x, y, 0.7, Math.cos(a) * 40, Math.sin(a) * 26);
    }
  }

  update(dt: number, cam: Camera): void {
    for (const f of this.pool) {
      if (!f.live) continue;
      f.t += dt;
      if (f.t >= f.life) {
        if (f.kind === 1 && this.onCoinArrive) this.onCoinArrive();
        f.live = false;
        continue;
      }
      if (f.kind === 4 && this.belt.length > 1) {
        // position along the belt by time
        let total = 0;
        for (let i = 1; i < this.belt.length; i++) total += Math.hypot(this.belt[i].x - this.belt[i - 1].x, this.belt[i].y - this.belt[i - 1].y);
        let d = (f.t / f.life) * total;
        for (let i = 1; i < this.belt.length; i++) {
          const a = this.belt[i - 1];
          const b = this.belt[i];
          const seg = Math.hypot(b.x - a.x, b.y - a.y);
          if (d <= seg) {
            f.x = a.x + ((b.x - a.x) * d) / seg;
            f.y = a.y + ((b.y - a.y) * d) / seg;
            break;
          }
          d -= seg;
        }
        continue;
      }
      if (f.kind === 1) {
        // burst first, then home in on the HUD coin counter (in world-screen space)
        const tx = cam.x + (this.coinTarget.x - cam.viewW / 2) / cam.zoom;
        const ty = cam.y + (this.coinTarget.y - cam.viewH / 2) / cam.zoom;
        const k = f.t / f.life;
        if (k < 0.3) {
          f.x += f.vx * dt;
          f.y += f.vy * dt;
        } else {
          const pull = Math.min(1, dt * (4 + k * 14));
          f.x += (tx - f.x) * pull;
          f.y += (ty - f.y) * pull;
        }
      } else {
        f.x += f.vx * dt;
        f.y += f.vy * dt;
      }
    }
  }

  draw(w: SnapWriter, sp: SpriteSet, zoom: number, time: number): void {
    const inv = 1 / zoom;
    for (const f of this.pool) {
      if (!f.live) continue;
      const k = f.t / f.life;
      switch (f.kind) {
        case 0: {
          const pop = k < 0.15 ? 0.6 + (k / 0.15) * 0.5 : 1.1 - Math.min(0.1, (k - 0.15) * 0.3);
          if (k < 0.8 || Math.floor(time * 20) % 2 === 0) overlayText(w, sp, f.text, f.x, f.y, 1.15 * pop * Math.max(0.8, inv * 0.8), 0);
          break;
        }
        case 1:
          w.over(sp.coin(Math.floor((time + f.seed) * 14)), f.x, f.y, 0.85 * Math.max(0.9, inv * 0.8));
          break;
        case 2:
          w.fx(sp.puff, f.x, f.y, 0.5 + k * 1.1, (1 - k) * 0.8);
          break;
        case 3:
          w.fx(sp.sparkle, f.x, f.y, 0.9 * (1 - k * 0.5), 1 - k);
          break;
        case 4:
          w.over(sp.icon('bag'), f.x, f.y - 6, 0.32);
          break;
        case 5:
          if (k < 0.85) overlayText(w, sp, f.text, f.x, f.y - 18, 0.75 * Math.max(0.8, inv * 0.7), 0);
          break;
      }
    }
  }
}
