// Phone reminders (owner M35): the game never talks to the phone's notifications directly, only
// through this, so the browser and Expo Go on Android (where the library cannot load) simply
// have none, and the game runs the same.

export interface PlannedNote {
  /** When (phone clock, ms). */
  at: number;
  title: string;
  body: string;
}

export interface Notifier {
  /** False where there are no phone notifications (the browser, Expo Go on Android). */
  readonly available: boolean;
  /** Asks the player once (the phone remembers the answer). Resolves to whether they may be sent. */
  ask(): Promise<boolean>;
  /** Replaces every planned reminder with these. */
  plan(notes: readonly PlannedNote[]): Promise<void>;
  /** Cancels them all (the player is back). */
  clear(): Promise<void>;
}

export const noNotifier: Notifier = {
  available: false,
  ask: async () => false,
  plan: async () => {},
  clear: async () => {},
};
