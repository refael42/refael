import type { MapDef } from '../data/maps';
import type { GameBoot } from '../render/useSimulation';
import { offlineEarnings } from '../sim/offline';
import { loadSave } from './persistence';

/** Loads the save and works out what the staff earned while the app was closed. */
export async function bootGame(map: MapDef): Promise<GameBoot> {
  const result = await loadSave();
  if (!result.ok) {
    if (result.reason !== 'empty') console.warn(`Save not loaded (${result.reason}): starting fresh`);
    return { save: null, offline: null };
  }
  return { save: result.save, offline: offlineEarnings(map, result.save, Date.now()) };
}
