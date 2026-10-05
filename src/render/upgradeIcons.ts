import { LOOKS } from './art/stationArt';
import type { SpriteName } from './sprites';

/** Which sprite stands for each upgrade in menus; looked items show their current look. */
const ICON: Record<string, { base: string; looks: boolean }> = {
  fries: { base: 'plateFries', looks: true },
  burger: { base: 'plateBurger', looks: true },
  stove: { base: 'stove', looks: true },
  stove2: { base: 'stove0', looks: false },
  fridge: { base: 'fridge', looks: true },
  sink: { base: 'sink', looks: true },
  plates: { base: 'plateStack', looks: false },
  tables: { base: 'table0', looks: false },
  cloth: { base: 'table', looks: true },
  chairs: { base: 'chair', looks: true },
  plants: { base: 'plantPalm', looks: true },
  neon: { base: 'neonIcon', looks: false },
  sign: { base: 'streetSign', looks: true },
};

export function upgradeIcon(id: string, tier: number): SpriteName {
  const icon = ICON[id] ?? { base: 'table0', looks: false };
  return (icon.looks ? `${icon.base}${Math.min(LOOKS - 1, tier)}` : icon.base) as SpriteName;
}
