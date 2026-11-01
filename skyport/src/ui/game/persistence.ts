/** Save/load through AsyncStorage (localStorage on web). */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { parseSave, SAVE_KEY, serializeGame, type GameState, type LoadResult } from '../../sim';

export async function loadGame(): Promise<LoadResult> {
  try {
    const text = await AsyncStorage.getItem(SAVE_KEY);
    return parseSave(text, Date.now());
  } catch {
    return { ok: false, reason: 'corrupt' };
  }
}

export async function saveGame(s: GameState): Promise<void> {
  try {
    await AsyncStorage.setItem(SAVE_KEY, serializeGame(s, Date.now()));
  } catch {
    // saving is best effort; the next autosave tries again
  }
}
