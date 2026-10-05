import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { deviceLang } from './i18n';
import { loadSettings } from './store/settings';
import { trace } from './trace';
import { GameScreen } from './ui/GameScreen';

export default function App() {
  useEffect(() => {
    trace('app start');
    void loadSettings(deviceLang());
  }, []);
  return (
    <SafeAreaProvider>
      <StatusBar hidden />
      <GameScreen />
    </SafeAreaProvider>
  );
}
