import { ALBUM, ALBUM_PAGES, STICKERS, type StickerId } from '../data/album';
import { KID_RANK } from '../data/customers';
import { computeMods } from './economy/upgrades';
import { emit, Ev } from './game/events';
import type { Customer, GameState } from './game/types';

// The customer album (src/data/album.ts): sticker counts, stars, rewards, the page perks. The
// album is the player's: it goes along to a new branch and is kept in the save.

export interface AlbumState {
  /** Guests of each kind served, all time. */
  counts: Partial<Record<StickerId, number>>;
  /** Rewards taken per sticker: 0 none, 1 the sticker, 2-4 its stars. */
  taken: Partial<Record<StickerId, number>>;
  /** Per page: 1 = the full page's reward taken, 2 = the gold page's. */
  pages: number[];
}

export const newAlbum = (): AlbumState => ({ counts: {}, taken: {}, pages: ALBUM_PAGES.map(() => 0) });

export const copyAlbum = (a: AlbumState): AlbumState => ({ counts: { ...a.counts }, taken: { ...a.taken }, pages: [...a.pages] });

/** How far a sticker is: 0 not met yet, 1 stuck in, 2-4 its stars. */
export function stickerLevel(a: AlbumState, id: StickerId): number {
  const n = a.counts[id] ?? 0;
  if (n < 1) return 0;
  return 1 + ALBUM.stars.filter((at) => n >= at).length;
}

/** Rewards waiting on a sticker. */
export const stickerReady = (a: AlbumState, id: StickerId): number => Math.max(0, stickerLevel(a, id) - (a.taken[id] ?? 0));

const pageFull = (a: AlbumState, page: number, level: number): boolean => ALBUM_PAGES[page]!.stickers.every((st) => stickerLevel(a, st.id) >= level);

/** A page's rewards waiting: the full page, the gold page. */
export function pageReady(a: AlbumState, page: number): { full: boolean; gold: boolean } {
  const bits = a.pages[page] ?? 0;
  return { full: (bits & 1) === 0 && pageFull(a, page, 1), gold: (bits & 2) === 0 && pageFull(a, page, 4) };
}

/** Everything waiting in the album (for the button's badge). */
export function albumReady(a: AlbumState): number {
  let n = 0;
  for (const st of STICKERS) n += stickerReady(a, st.id);
  ALBUM_PAGES.forEach((_, i) => {
    const r = pageReady(a, i);
    n += (r.full ? 1 : 0) + (r.gold ? 1 : 0);
  });
  return n;
}

function count(s: GameState, id: StickerId): void {
  const a = s.album;
  const before = a.counts[id] ?? 0;
  a.counts[id] = before + 1;
  if (before === 0) emit(s, Ev.AlbumNew, 0, 0, STICKERS.findIndex((st) => st.id === id));
}

/** A guest paid: their kind's sticker counts one more (and the special ones they also are). */
export function albumServed(s: GameState, c: Customer): void {
  count(s, c.type);
  if (c.vip) count(s, 'vip');
  if (c.rank === KID_RANK) count(s, 'kid');
  if (c.inspector) count(s, 'inspector');
  if (c.party === c.id && c.partySize >= ALBUM.banquetSize) count(s, 'banquet');
}

/** Takes a sticker's next reward (the sticker, then its stars in order). */
export function claimSticker(s: GameState, id: StickerId): boolean {
  const a = s.album;
  const taken = a.taken[id] ?? 0;
  if (taken >= stickerLevel(a, id)) return false;
  const gems = taken === 0 ? ALBUM.stickerGems : ALBUM.starGems[taken - 1]!;
  a.taken[id] = taken + 1;
  s.gems += gems;
  emit(s, Ev.AlbumClaim, 0, 0, gems);
  return true;
}

/** Takes a page's reward: the full page (its perk, for good) first, then the gold page. */
export function claimPage(s: GameState, page: number): boolean {
  const def = ALBUM_PAGES[page];
  if (!def) return false;
  const r = pageReady(s.album, page);
  let gems = 0;
  if (r.full) {
    s.album.pages[page] = (s.album.pages[page] ?? 0) | 1;
    s.perks = { ...s.perks, [ALBUM.perkPrefix + def.id]: 1 };
    s.mods = computeMods(s.levels, s.perks, s.trophies);
    gems = ALBUM.pageGems;
  } else if (r.gold) {
    s.album.pages[page] = (s.album.pages[page] ?? 0) | 2;
    gems = ALBUM.goldGems;
  } else return false;
  s.gems += gems;
  emit(s, Ev.AlbumClaim, 0, 0, gems);
  return true;
}

const nat = (n: unknown): number => (typeof n === 'number' && Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0);

/** The album as saved (unknown stickers dropped, odd numbers cleaned). */
export function cleanAlbum(raw: unknown): AlbumState {
  const out = newAlbum();
  if (!raw || typeof raw !== 'object') return out;
  const o = raw as Record<string, unknown>;
  const known = new Set<string>(STICKERS.map((st) => st.id));
  for (const key of ['counts', 'taken'] as const) {
    const v = o[key];
    if (!v || typeof v !== 'object') continue;
    for (const [id, n] of Object.entries(v)) if (known.has(id)) out[key][id as StickerId] = key === 'taken' ? Math.min(4, nat(n)) : nat(n);
  }
  if (Array.isArray(o.pages)) out.pages = ALBUM_PAGES.map((_, i) => nat((o.pages as unknown[])[i]) & 3);
  return out;
}
