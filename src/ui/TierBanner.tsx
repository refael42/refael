import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { TIERS } from '../data/buildings';
import { useT } from '../i18n';
import { gold, panel } from './theme';

/**
 * The bigger restaurant opens: a white flash (it also hides the moment the new building is
 * drawn for the first time), then a big card with the new name that pops and fades away.
 */
export function TierBanner({ tier, onDone }: { tier: number; onDone: () => void }) {
  const t = useT();
  const flash = useSharedValue(1);
  const pop = useSharedValue(0);
  useEffect(() => {
    flash.value = withTiming(0, { duration: 900, easing: Easing.out(Easing.quad) });
    pop.value = withSequence(withDelay(250, withSpring(1, { damping: 8, stiffness: 160 })), withDelay(2400, withTiming(0, { duration: 300 })));
    const done = setTimeout(onDone, 3300);
    return () => clearTimeout(done);
  }, [flash, pop, onDone]);
  const flashStyle = useAnimatedStyle(() => ({ opacity: flash.value }));
  const cardStyle = useAnimatedStyle(() => ({ opacity: Math.min(1, pop.value * 1.5), transform: [{ scale: 0.6 + pop.value * 0.4 }] }));
  const def = TIERS[tier];
  return (
    <View style={styles.fill} pointerEvents="none">
      <Animated.View style={[styles.fill, styles.flash, flashStyle]} />
      <Animated.View style={[styles.card, cardStyle]}>
        <Text style={styles.title}>{t('ui.grew')}</Text>
        {def && <Text style={styles.name}>{t(`tier.${def.id}`)}</Text>}
      </Animated.View>
    </View>
  );
}

/** A small sign while the scaffolding is up. */
export function ConstructionNote() {
  const t = useT();
  return (
    <View style={styles.note} pointerEvents="none">
      <Text style={styles.noteText}>{t('ui.underConstruction')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  flash: { backgroundColor: '#FFF8E8' },
  card: {
    backgroundColor: panel.bg,
    borderColor: gold,
    borderWidth: 3,
    borderRadius: 22,
    paddingHorizontal: 34,
    paddingVertical: 14,
    alignItems: 'center',
    boxShadow: '0px 6px 0px #120818',
  },
  title: { color: '#FFE9A8', fontSize: 18, fontWeight: '900' },
  name: { color: '#FFFFFF', fontSize: 34, fontWeight: '900', marginTop: 2 },
  note: {
    position: 'absolute',
    top: 56,
    alignSelf: 'center',
    backgroundColor: '#E9A23B',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 2,
    borderColor: '#5A3A1A',
  },
  noteText: { color: '#2A1530', fontWeight: '900', fontSize: 13 },
});
