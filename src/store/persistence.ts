import AsyncStorage from '@react-native-async-storage/async-storage';
import { parseSave, type LoadResult, type SaveData } from '../sim/save';

// Where the save lives: AsyncStorage (localStorage on web). Two slots: the latest save and the
// one before it, so a write cut off halfway (app killed) never loses everything.

const MAIN = 'restaurant.save';
const BACKUP = 'restaurant.save.backup';
/** A save we could not read is parked here instead of being overwritten. */
const BROKEN = 'restaurant.save.broken';

let lastWritten: string | null = null;
let queue: Promise<void> = Promise.resolve();
/** Off when the stored save came from a newer app version: never overwrite it. */
let writable = true;

export async function loadSave(): Promise<LoadResult> {
  // A save still being written (e.g. when switching screens) must land before we read.
  await queue;
  writable = true;
  const mainText = await AsyncStorage.getItem(MAIN);
  const main = parseSave(mainText);
  if (main.ok) {
    lastWritten = mainText;
    return main;
  }
  if (main.reason === 'future') {
    writable = false;
    return main;
  }
  if (main.reason === 'corrupt' && mainText) await AsyncStorage.setItem(BROKEN, mainText);
  const backupText = await AsyncStorage.getItem(BACKUP);
  const backup = parseSave(backupText);
  if (backup.ok) lastWritten = backupText;
  return backup.ok ? backup : main;
}

/**
 * Erases all progress (settings screen, after a double confirmation). Saving stays off until
 * the next load, so the game being torn down cannot write its old state back.
 */
export async function eraseSave(): Promise<void> {
  writable = false;
  await queue;
  await AsyncStorage.multiRemove([MAIN, BACKUP]);
  lastWritten = null;
}

/** Writes are queued so two saves never interleave. */
export function writeSave(save: SaveData): Promise<void> {
  if (!writable) return queue;
  const text = JSON.stringify(save);
  queue = queue
    .then(async () => {
      if (lastWritten && lastWritten !== text) await AsyncStorage.setItem(BACKUP, lastWritten);
      await AsyncStorage.setItem(MAIN, text);
      lastWritten = text;
    })
    .catch((e: unknown) => console.warn('Save failed', e));
  return queue;
}
