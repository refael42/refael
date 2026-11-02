import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { deviceLang, useT } from '../i18n';
import { buildSprites, buildUiIcons, type SpriteSet } from '../render/sprites';
import { useSettings } from '../settings/store';
import { Gallery } from './Gallery';
import { readDebugParams } from './game/debugParams';
import { GameScreen, tierCombos, type Boot } from './game/GameScreen';
import { loadGame } from './game/persistence';
import { setIconSheet } from './iconSheet';
import { LoadingScreen } from './LoadingScreen';
import { Onboarding } from './Onboarding';

function useHydratedSettings(): boolean {
  const [ok, setOk] = useState(useSettings.persist.hasHydrated());
  useEffect(() => {
    const done = () => {
      useSettings.getState().initLang(deviceLang());
      setOk(true);
    };
    if (useSettings.persist.hasHydrated()) done();
    return useSettings.persist.onFinishHydration(done);
  }, []);
  return ok;
}

export default function App() {
  const hydrated = useHydratedSettings();
  const t = useT();
  const [sprites, setSprites] = useState<SpriteSet | null>(null);
  const [boot, setBoot] = useState<Boot | null>(null);
  const onboarded = useSettings((s) => s.onboarded);

  useEffect(() => {
    const dbg = readDebugParams();
    if (dbg.isTest && !dbg.save) {
      setBoot({ saveBlocked: true, futureSave: false });
      return;
    }
    loadGame().then((r) => {
      if (r.ok) setBoot({ state: r.state, away: r.awaySeconds, saveBlocked: false, futureSave: false });
      else setBoot({ saveBlocked: r.reason === 'future', futureSave: r.reason === 'future' });
    });
  }, []);
  const [screen, setScreen] = useState<'game' | 'gallery'>(() => (readDebugParams().screen === 'gallery' ? 'gallery' : 'game'));

  useEffect(() => {
    // Let the loading screen paint before the (synchronous) atlas build.
    const id = setTimeout(() => {
      setIconSheet(buildUiIcons());
      setSprites(buildSprites({ combos: tierCombos(2) }));
    }, 30);
    return () => clearTimeout(id);
  }, []);

  return (
    <SafeAreaProvider>
      <View style={styles.root}>
        <StatusBar style="light" />
        {!hydrated || !sprites || !boot ? (
          <LoadingScreen progress={sprites ? 0.9 : 0.5} label={t('app.loading')} />
        ) : !onboarded && !boot.state && !boot.saveBlocked ? (
          <Onboarding
            onDone={(names) => {
              setBoot({ ...boot, profile: names });
              useSettings.getState().setTutorial(1);
              useSettings.getState().setOnboarded(true);
            }}
          />
        ) : screen === 'gallery' ? (
          <Gallery sprites={sprites} onBack={() => setScreen('game')} />
        ) : (
          <GameScreen sprites={sprites} boot={boot} onGallery={() => setScreen('gallery')} />
        )}
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#1b2a4a' },
});
