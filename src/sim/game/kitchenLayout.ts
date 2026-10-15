import { BACK_KINDS, PREP_KINDS } from '../../data/maps';
import { PropKind } from '../types';
import type { GameState, KitchenSpot } from './types';

// The kitchen laid out by the player (owner M30: "the kitchen much more open to design, placed
// however you want"): in build mode any station or prep piece can trade places with any other
// (a station keeps its cook behind it, facing the room: every kitchen tile is on a line with a
// cook's lane behind it), and a prep piece can take any of the prep and back-of-house looks.
// The tiles never change, only what stands on them, so every path stays as it was.

/** A piece of the kitchen: a station (its index in `s.stoves`) or a prep piece (its prop id). */
export type KitchenPiece = { kind: 'station'; index: number } | { kind: 'prep'; id: number };

/** How far behind its station a cook stands (src/data/maps.ts kitchenOf). */
const COOK_BEHIND = 1.05;

const prepProp = (s: GameState, id: number) => s.props.find((p) => p.id === id && p.kind === PropKind.Prep);

/** Where a piece stands (null: gone). */
export function pieceAt(s: GameState, piece: KitchenPiece): { x: number; y: number } | null {
  if (piece.kind === 'station') {
    const sv = s.stoves[piece.index];
    return sv ? { x: sv.x, y: sv.y } : null;
  }
  const p = prepProp(s, piece.id);
  return p ? { x: p.x, y: p.y } : null;
}

/** A station can move while nobody cooks at it. */
const stationFree = (sv: KitchenSpot): boolean => sv.user < 0;

function moveStation(s: GameState, sv: KitchenSpot, x: number, y: number): void {
  sv.x = x;
  sv.y = y;
  sv.cook = { x: x - COOK_BEHIND, y };
  const p = s.props.find((q) => q.id === sv.propId);
  if (p) {
    p.x = x;
    p.y = y;
  }
}

/** Can these two pieces trade places right now? */
export function canSwap(s: GameState, a: KitchenPiece, b: KitchenPiece): boolean {
  if (s.construction) return false;
  if (a.kind === b.kind && (a.kind === 'station' ? a.index === (b as typeof a).index : a.id === (b as { id: number }).id)) return false;
  for (const piece of [a, b]) {
    if (!pieceAt(s, piece)) return false;
    if (piece.kind === 'station' && !stationFree(s.stoves[piece.index]!)) return false;
  }
  return true;
}

/** Trades two pieces' places. False if one is in use (a cook at it) or gone. */
export function swapKitchen(s: GameState, a: KitchenPiece, b: KitchenPiece): boolean {
  if (!canSwap(s, a, b)) return false;
  const pa = pieceAt(s, a)!;
  const pb = pieceAt(s, b)!;
  const put = (piece: KitchenPiece, at: { x: number; y: number }) => {
    if (piece.kind === 'station') moveStation(s, s.stoves[piece.index]!, at.x, at.y);
    else {
      const p = prepProp(s, piece.id)!;
      p.x = at.x;
      p.y = at.y;
    }
  };
  put(a, pb);
  put(b, pa);
  // Idle cooks walk to wherever their station went.
  for (const st of s.staff) if (st.role === 'cook' && !st.job) st.path = [];
  return true;
}

/** Every look a prep piece can take: the prep tables, then the back of the house. */
export const PREP_LOOKS = PREP_KINDS + BACK_KINDS;

/** Gives a prep piece its next look (`to`: a given one). */
export function restylePrep(s: GameState, id: number, to?: number): boolean {
  const p = prepProp(s, id);
  if (!p || s.construction) return false;
  p.variant = to === undefined ? (p.variant + 1) % PREP_LOOKS : Math.max(0, Math.min(PREP_LOOKS - 1, Math.floor(to)));
  return true;
}

/** The kitchen as the save keeps it: where each station stands, and each prep piece's tile and look. */
export interface SavedKitchen {
  tier: number;
  stations: { x: number; y: number }[];
  preps: { x: number; y: number; variant: number }[];
}

export function kitchenSave(s: GameState): SavedKitchen {
  return {
    tier: s.map.tier,
    stations: s.stoves.map((sv) => ({ x: sv.x, y: sv.y })),
    preps: s.props.filter((p) => p.kind === PropKind.Prep).map((p) => ({ x: p.x, y: p.y, variant: p.variant })),
  };
}

const key = (x: number, y: number) => `${Math.round(x * 2)},${Math.round(y * 2)}`;

/**
 * A saved layout goes back if it is this building's and uses exactly its kitchen's tiles (a
 * bigger building has a new kitchen: it starts from the building's own layout).
 */
export function restoreKitchen(s: GameState, saved: SavedKitchen | undefined): void {
  if (!saved || saved.tier !== s.map.tier) return;
  const preps = s.props.filter((p) => p.kind === PropKind.Prep);
  if (saved.stations.length !== s.stoves.length || saved.preps.length !== preps.length) return;
  const tiles = new Set([...s.stoves.map((sv) => key(sv.x, sv.y)), ...preps.map((p) => key(p.x, p.y))]);
  const wanted = [...saved.stations, ...saved.preps].map((p) => key(p.x, p.y));
  if (new Set(wanted).size !== wanted.length || wanted.some((k) => !tiles.has(k))) return;
  saved.stations.forEach((p, i) => moveStation(s, s.stoves[i]!, p.x, p.y));
  saved.preps.forEach((p, i) => {
    const prop = preps[i]!;
    prop.x = p.x;
    prop.y = p.y;
    prop.variant = Math.max(0, Math.min(PREP_LOOKS - 1, Math.floor(p.variant)));
  });
}
