import { isRunningInExpoGo } from 'expo';
import { Platform } from 'react-native';
import { noNotifier, type Notifier } from './types';

// The phone's own local notifications (expo-notifications): planned on the phone, nothing is
// sent to or through any server. On Android, Expo Go throws as soon as the library loads (Expo
// removed push from it in SDK 53), so there it is not loaded at all; a real build has it.

type Lib = typeof import('expo-notifications');

const CHANNEL = 'reminders';

function load(): Lib | null {
  if (Platform.OS === 'android' && isRunningInExpoGo()) return null;
  try {
    return require('expo-notifications') as Lib;
  } catch {
    return null;
  }
}

export function nativeNotifier(): Notifier {
  const lib = load();
  if (!lib) return noNotifier;
  // While the game is open nothing is planned; if one still comes, show it quietly.
  lib.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
  });
  let channel: Promise<unknown> | null = null;
  const ensureChannel = () =>
    (channel ??= Platform.OS === 'android' ? lib.setNotificationChannelAsync(CHANNEL, { name: 'Reminders', importance: lib.AndroidImportance.DEFAULT }) : Promise.resolve());
  return {
    available: true,
    async ask() {
      const now = await lib.getPermissionsAsync();
      if (now.granted) return true;
      if (!now.canAskAgain) return false;
      return (await lib.requestPermissionsAsync()).granted;
    },
    async plan(notes) {
      await ensureChannel();
      await lib.cancelAllScheduledNotificationsAsync();
      if (!(await lib.getPermissionsAsync()).granted) return;
      for (const n of notes) {
        await lib.scheduleNotificationAsync({
          content: { title: n.title, body: n.body, sound: false },
          trigger: { type: lib.SchedulableTriggerInputTypes.DATE, date: n.at, channelId: CHANNEL },
        });
      }
    },
    async clear() {
      await lib.cancelAllScheduledNotificationsAsync();
      await lib.dismissAllNotificationsAsync();
    },
  };
}
