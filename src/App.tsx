import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { deviceLang } from './i18n';
import { useSettings } from './store/settings';
import { StyleTestScreen } from './ui/StyleTestScreen';

export default function App() {
  useEffect(() => {
    useSettings.getState().setLang(deviceLang());
  }, []);
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <StyleTestScreen />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
