import { EXPAND, UPGRADE_BY_ID } from '../data/upgrades';
import { LOOKS } from './art/stationArt';
import type { SpriteName } from './sprites';

/** Which sprite stands for each upgrade in menus; looked items show their current look. */
const ICON: Record<string, { base: string; looks: boolean }> = {
  fries: { base: 'plateFries', looks: true },
  burger: { base: 'plateBurger', looks: true },
  rank: { base: 'star', looks: false },
  falafel: { base: 'plateFalafel', looks: true },
  shawarma: { base: 'plateShawarma', looks: true },
  hummus: { base: 'plateHummus', looks: true },
  schnitzel: { base: 'plateSchnitzel', looks: true },
  shakshuka: { base: 'plateShakshuka', looks: true },
  iceCream: { base: 'plateIceCream', looks: true },
  pizza: { base: 'platePizza', looks: true },
  sushi: { base: 'plateSushi', looks: true },
  steak: { base: 'plateSteak', looks: true },
  cake: { base: 'plateCake', looks: true },
  lobster: { base: 'plateLobster', looks: true },
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
  building: { base: 'saleSign', looks: false },
  seats: { base: 'chair0', looks: false },
  family: { base: 'tableSquare0', looks: false },
  fleet: { base: 'scooter1', looks: false },
  scooters: { base: 'scooterRide0', looks: false },
  deliveryApp: { base: 'bag', looks: false },
  packStation: { base: 'packTable', looks: true },
  place_flowers: { base: 'flowers0', looks: false },
  flowers: { base: 'flowers', looks: true },
  place_lamp: { base: 'floorLamp0', looks: false },
  lamp: { base: 'floorLamp', looks: true },
  place_aquarium: { base: 'aquarium0', looks: false },
  aquarium: { base: 'aquarium', looks: true },
  place_statue: { base: 'statue0', looks: false },
  statue: { base: 'statue', looks: true },
  place_fountain: { base: 'fountain0', looks: false },
  fountain: { base: 'fountain', looks: true },
  place_piano: { base: 'piano0', looks: false },
  piano: { base: 'piano', looks: true },
};

export function upgradeIcon(id: string, tier: number): SpriteName {
  const icon = ICON[id] ?? { base: 'table0', looks: false };
  const big = tier >= EXPAND.tier && UPGRADE_BY_ID[id]?.expands;
  return (icon.looks ? `${icon.base}${big ? LOOKS : Math.min(LOOKS - 1, tier)}` : icon.base) as SpriteName;
}
