import type { Reminder } from '../sim/reminders';
import type { PlannedNote } from './types';

/** A reminder in words: its title and text in the player's language, with the restaurant's name. */
export function noteFor(r: Reminder, t: (key: string) => string, restaurant: string): PlannedNote {
  const fill = (text: string) => {
    const out = text
      .replace('{name}', restaurant)
      .replace('{hero}', r.hero ? t(`hero.${r.hero}`) : '')
      .replace('{n}', String(r.count ?? 0));
    // "your restaurant is waiting..." starts a sentence.
    return out.charAt(0).toUpperCase() + out.slice(1);
  };
  return { at: r.at, title: fill(t(`notify.${r.kind}.title`)), body: fill(t(`notify.${r.kind}.body`)) };
}
