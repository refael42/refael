import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { aircraftIndex } from '../data/aircraft';
import { airlineIndex } from '../data/airlines';
import { deviceLang, useT } from '../i18n';
import { buildSprites, buildUiIcons, type SpriteSet } from '../render/sprites';
import { useSettings } from '../settings/store';
import { Gallery } from './Gallery';
import { setIconSheet } from './iconSheet';
import { LoadingScreen } from './LoadingScreen';

const GALLERY_COMBOS: (readonly [number, number])[] = [
  [airlineIndex('meadowlark'), aircraftIndex('sparrow')],
  [airlineIndex('meadowlark'), aircraftIndex('finch')],
  [airlineIndex('bluefin'), aircraftIndex('falcon')],
  [airlineIndex('puddle'), aircraftIndex('sparrow')],
  [airlineIndex('aurelia'), aircraftIndex('albatross')],
];

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

  useEffect(() => {
    // Let the loading screen paint before the (synchronous) atlas build.
    const id = setTimeout(() => {
      setIconSheet(buildUiIcons());
      setSprites(buildSprites({ combos: GALLERY_COMBOS }));
    }, 30);
    return () => clearTimeout(id);
  }, []);

  return (
    <SafeAreaProvider>
      <View style={styles.root}>
        <StatusBar style="light" />
        {!hydrated || !sprites ? <LoadingScreen progress={sprites ? 0.9 : 0.5} label={t('app.loading')} /> : <Gallery sprites={sprites} />}
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#1b2a4a' },
});
