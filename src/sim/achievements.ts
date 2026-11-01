import { ACHIEVEMENT, ACHIEVEMENTS, type AchievementId } from '../data/achievements';
import { STICKERS } from '../data/album';
import { stickerLevel } from './album';
import { emit, Ev } from './game/events';
import type { GameState } from './game/types';

// Achievements (src/data/achievements.ts). Checked once a second: a counted one adds what the
// game's own counter gained since the last look (a new branch starts that counter over; the
// achievement keeps going), a best one keeps the highest value seen. Medals are taken by the
// player (gems), like the quests.

export interface AchievementState {
  /** The achievement's value so far. */
  value: Partial<Record<AchievementId, number>>;
  /** For counted ones: the game's counter at the last look. */
  seen: Partial<Record<AchievementId, number>>;
  /** Medals taken (0-3). */
  taken: Partial<Record<AchievementId, number>>;
}

export const newAchievements = (): AchievementState => ({ value: {}, seen: {}, taken: {} });
export const copyAchievements = (a: AchievementState): AchievementState => ({ value: { ...a.value }, seen: { ...a.seen }, taken: { ...a.taken } });

/** What the game shows for each achievement right now. */
function current(s: GameState, id: AchievementId): number {
  switch (id) {
    case 'served':
      return s.stats.served;
    case 'fiveStars':
      return s.stats.fiveStars;
    case 'delivered':
      return s.stats.delivered;
    case 'hires':
      return s.stats.hires;
    case 'occasions':
      return s.occasion.hosted;
    case 'earned':
      return s.stats.earned.gt(0) ? Math.floor(s.stats.earned.log10()) : 0;
    case 'combo':
      return s.stats.bestCombo;
    case 'building':
      return s.mods.building;
    case 'chef':
      return s.chef.level;
    case 'album':
      return STICKERS.filter((st) => stickerLevel(s.album, st.id) > 0).length;
    case 'vip':
      return s.album.counts.vip ?? 0;
    case 'inspector':
      return s.album.counts.inspector ?? 0;
    case 'guide':
      return s.guide.stars;
    case 'trophies':
      return s.festival.trophies.length;
    case 'holidays':
      return s.holidays.gifted.length;
    case 'branches':
      return s.city;
  }
}

/** Medals reached (0-3). */
export function medals(s: GameState, id: AchievementId): number {
  const def = ACHIEVEMENTS.find((a) => a.id === id)!;
  const v = s.achievements.value[id] ?? 0;
  return def.goals.filter((g) => v >= g).length;
}

/** Medals reached but not taken yet, over all achievements. */
export const achievementsReady = (s: GameState): number => ACHIEVEMENTS.reduce((n, a) => n + Math.max(0, medals(s, a.id) - (s.achievements.taken[a.id] ?? 0)), 0);

/** Look at the game's numbers (once a second); a new medal is announced. */
export function updateAchievements(s: GameState): void {
  const a = s.achievements;
  for (const def of ACHIEVEMENTS) {
    const now = current(s, def.id);
    const before = medals(s, def.id);
    if (def.kind === 'count') {
      const seen = a.seen[def.id];
      // The first look, or the counter started over (a new branch, a fresh session): just note it.
      if (seen !== undefined && now >= seen) a.value[def.id] = (a.value[def.id] ?? 0) + (now - seen);
      else if (seen === undefined && a.value[def.id] === undefined) a.value[def.id] = now;
      a.seen[def.id] = now;
    } else a.value[def.id] = Math.max(a.value[def.id] ?? 0, now);
    const after = medals(s, def.id);
    if (after > before) emit(s, Ev.Achievement, 0, 0, ACHIEVEMENTS.indexOf(def), after);
  }
}

/** Takes an achievement's next medal: its gems. */
export function claimAchievement(s: GameState, id: AchievementId): boolean {
  const taken = s.achievements.taken[id] ?? 0;
  if (taken >= medals(s, id)) return false;
  const gems = ACHIEVEMENT.gems[taken]!;
  s.achievements.taken[id] = taken + 1;
  s.gems += gems;
  emit(s, Ev.AchievementClaim, 0, 0, gems);
  return true;
}

const nat = (n: unknown): number => (typeof n === 'number' && Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0);

/** As saved (unknown achievements dropped). */
export function cleanAchievements(raw: unknown): AchievementState {
  const out = newAchievements();
  if (!raw || typeof raw !== 'object') return out;
  const o = raw as Record<string, unknown>;
  for (const key of ['value', 'seen', 'taken'] as const) {
    const v = o[key];
    if (!v || typeof v !== 'object') continue;
    for (const def of ACHIEVEMENTS) {
      const n = (v as Record<string, unknown>)[def.id];
      if (n !== undefined) out[key][def.id] = key === 'taken' ? Math.min(3, nat(n)) : nat(n);
    }
  }
  return out;
}
