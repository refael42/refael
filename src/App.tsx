import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { deviceLang } from './i18n';
import { useLaunch } from './store/launch';
import { loadSettings } from './store/settings';
import { trace } from './trace';
import { GameScreen } from './ui/GameScreen';
import { Splash, SPLASH_BG } from './ui/Splash';

export default function App() {
  const mounted = useLaunch((s) => s.mounted);
  const done = useLaunch((s) => s.done);
  useEffect(() => {
    trace('app start');
    void loadSettings(deviceLang());
  }, []);
  return (
    <SafeAreaProvider>
      <StatusBar hidden />
      <View style={{ flex: 1, backgroundColor: SPLASH_BG }}>
        {mounted && <GameScreen />}
        {!done && <Splash />}
      </View>
    </SafeAreaProvider>
  );
}
