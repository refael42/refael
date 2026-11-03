import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

import { useT } from '../i18n';

/** Shown over the game when a phone browser is held upright: the game is landscape only. */
export function RotateHint() {
  const t = useT();
  const turn = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(500),
        Animated.timing(turn, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
        Animated.delay(900),
        Animated.timing(turn, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [turn]);
  const rotate = turn.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-90deg'] });
  return (
    <View style={styles.wrap} testID="rotate-hint">
      <Animated.View style={[styles.phone, { transform: [{ rotate }] }]}>
        <View style={styles.screen}>
          <View style={styles.runway} />
          <View style={styles.plane} />
        </View>
        <View style={styles.notch} />
      </Animated.View>
      <Text style={styles.title}>{t('rotate.title')}</Text>
      <Text style={styles.body}>{t('rotate.body')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: '#0b1222', alignItems: 'center', justifyContent: 'center', gap: 18, padding: 32 },
  phone: { width: 96, height: 176, borderRadius: 22, borderWidth: 5, borderColor: '#e2e8f0', padding: 6, marginBottom: 24 },
  screen: { flex: 1, borderRadius: 14, backgroundColor: '#86d07a', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  runway: { position: 'absolute', width: 18, top: 0, bottom: 0, backgroundColor: '#475569' },
  plane: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#f8fafc', borderWidth: 6, borderColor: '#6366f1' },
  notch: { position: 'absolute', top: 7, alignSelf: 'center', width: 26, height: 5, borderRadius: 3, backgroundColor: '#e2e8f0' },
  title: { color: '#f8fafc', fontSize: 24, fontWeight: '900', textAlign: 'center' },
  body: { color: '#94a3b8', fontSize: 16, fontWeight: '600', textAlign: 'center' },
});
