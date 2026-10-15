import { Skia } from '@shopify/react-native-skia';
import { hudIcons, type HudIcon } from './art/hudArt';
import { splashIcons, type SplashIcon } from './art/splashArt';
import { wheelIcons, type WheelIcon } from './art/wheelArt';
import type { SpriteDef } from './sprite';
import { spriteDef, type SpriteName } from './sprites';
import { HERO_BY_ID } from '../data/offers';
import { packCharacter } from '../sim/snapshot';
import { Emote, Expression, Facing, Held, Pose } from '../sim/types';
import { portraitAssets } from './assets';
import { drawCharacter } from './draw/drawCharacter';

// Menu icons are the game's own sprites, rendered once to small PNGs for <Image>: the menus
// match the world exactly, with no extra Skia canvases (web caps WebGL contexts at ~16).

const cache = new Map<string, string>();

/** A sprite rendered into a square `px` icon (device pixels), as a data URI. */
export function spriteIcon(name: SpriteName, px: number): string {
  return defIcon(String(name), spriteDef(name), px);
}

/** The HUD's big icons (not in the world atlas), the same way. */
export const hudIcon = (name: HudIcon, px: number): string => defIcon(name, hudIcons[name], px);

/** The lucky wheel's pieces (all the same size, so they stack). */
export const wheelIcon = (name: WheelIcon, px: number): string => defIcon(name, wheelIcons[name], px);

/** The opening screen's food and sunburst. */
export const splashIcon = (name: SplashIcon, px: number): string => defIcon(name, splashIcons[name], px);

function defIcon(name: string, def: SpriteDef, px: number): string {
  const key = `${name}@${px}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const [l, t, r, b] = def.bounds;
  const scale = (px * 0.92) / Math.max(r - l, b - t);
  const surface = Skia.Surface.Make(px, px);
  if (!surface) return '';
  const c = surface.getCanvas();
  c.translate(px / 2 - ((l + r) / 2) * scale, px / 2 - ((t + b) / 2) * scale);
  c.scale(scale, scale);
  def.draw(c);
  surface.flush();
  const image = surface.makeImageSnapshot();
  const uri = `data:image/png;base64,${image.encodeToBase64()}`;
  image.dispose();
  surface.dispose();
  cache.set(key, uri);
  return uri;
}

/** What each hero holds in their portrait (their job's tool). */
const HERO_HELD: Record<string, number> = { cook: Held.Spatula, waiter: Held.TrayFull, host: Held.Menu, manager: Held.Clipboard, bartender: Held.Shaker };

/**
 * A hero from the paid offers (src/data/offers.ts) as a portrait: drawn by the world's own
 * character code (mythic ring and all), facing the viewer, `px` device pixels square.
 */
export function heroIcon(id: string, px: number): string {
  const key = `hero:${id}@${px}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const hero = HERO_BY_ID[id];
  if (!hero) return '';
  const data = packCharacter({
    id: 7,
    look: hero.look,
    x: 0,
    y: 0,
    prevX: 0,
    prevY: 0,
    facing: Facing.FrontRight,
    pose: Pose.Idle,
    poseTime: 0,
    held: (HERO_HELD[hero.role] ?? Held.None) as Held,
    expression: Expression.Happy,
    emote: Emote.None,
    emoteTime: 0,
    patience: -1,
    bubble: 0,
    rank: 2 + 10 * 4,
  });
  const surface = Skia.Surface.Make(px, px);
  if (!surface) return '';
  const c = surface.getCanvas();
  // A standing character spans about 56 iso px from the feet to the top of the head (a hat
  // more): fill most of the square, feet near the bottom.
  const scale = (px * 0.76) / 60;
  c.translate(px / 2, px * 0.82);
  c.scale(scale, scale);
  drawCharacter(c, portraitAssets(), data, 0, 1, 0.3, -1, true);
  surface.flush();
  const image = surface.makeImageSnapshot();
  const uri = `data:image/png;base64,${image.encodeToBase64()}`;
  image.dispose();
  surface.dispose();
  cache.set(key, uri);
  return uri;
}
