/**
 * Upgrade versions (owner request): the upgrades you see on the map change
 * look as they level up. Each line lists the level each version starts at
 * (version 1 at the first entry). Names in i18n: ver.<id>.<n>.
 */
export const VERSIONS: Readonly<Record<string, readonly number[]>> = {
  kiosk: [1, 10, 25, 50],
  billboard: [1, 6, 14, 24],
  benches: [1, 10, 20],
  tower: [0, 2, 4],
  radar: [1, 2, 3],
  scanner: [1, 8, 15],
  fence: [0, 1, 2, 3],
};

/** The version this level shows (0 = not there yet). */
export function versionOf(id: string, level: number): number {
  const at = VERSIONS[id];
  if (!at) return 0;
  let v = 0;
  for (let i = 0; i < at.length; i++) if (level >= at[i]) v = i + 1;
  return v;
}

/** The level the next version comes at (null at the last one). */
export function nextVersionAt(id: string, level: number): number | null {
  const at = VERSIONS[id];
  if (!at) return null;
  for (const l of at) if (l > level) return l;
  return null;
}
