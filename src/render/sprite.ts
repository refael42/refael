import type { SkCanvas } from '@shopify/react-native-skia';

/**
 * A procedurally drawn sprite. `bounds` = [left, top, right, bottom] around the sprite's anchor
 * (0,0) in world units; `draw` paints it in those coordinates. The atlas bakes it once at startup.
 */
export interface SpriteDef {
  bounds: readonly [number, number, number, number];
  draw: (c: SkCanvas) => void;
}

export const sprite = (bounds: SpriteDef['bounds'], draw: SpriteDef['draw']): SpriteDef => ({ bounds, draw });
