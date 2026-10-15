import { noNotifier, type Notifier } from './types';

// The browser: no phone reminders (and no notifications library to load).
export const nativeNotifier = (): Notifier => noNotifier;
