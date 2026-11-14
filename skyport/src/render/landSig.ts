/**
 * The land's shape for the ground painting (pure, no Skia): which plots are being cleared or are the
 * airport's, and what stands on them, as "id:state:facility;..." (the ground is repainted when it changes).
 */
import type { GameState } from '../sim/game/types';

export function landSignature(s: GameState): string {
  return Object.keys(s.land.plots)
    .map(Number)
    .sort((a, b) => a - b)
    .map((id) => `${id}:${s.land.plots[id].state}:${s.land.plots[id].f}`)
    .join(';');
}

/** The signature back into its parts; an empty one (no land bought) is none (it once read as plot 0 owned). */
export function parseLandSig(land: string): [number, number, number][] {
  const out: [number, number, number][] = [];
  for (const part of land.split(';')) {
    if (!part) continue;
    const [id, state, f] = part.split(':').map(Number);
    if (Number.isFinite(id) && (state === 1 || state === 2)) out.push([id, state, Number.isFinite(f) ? f : -1]);
  }
  return out;
}
