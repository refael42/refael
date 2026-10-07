import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { TIERS } from '../data/buildings';
import { unlocksAt } from '../data/unlocks';
import { useT } from '../i18n';
import { gold, panel } from './theme';

/**
 * The bigger restaurant opens: a white flash (it also hides the moment the new building is
 * drawn for the first time), then a big card with the new name that pops and fades away.
 */
export function TierBanner({ tier, restaurant, onDone }: { tier: number; restaurant?: string; onDone: () => void }) {
  const t = useT();
  const flash = useSharedValue(1);
  const pop = useSharedValue(0);
  useEffect(() => {
    flash.value = withTiming(0, { duration: 900, easing: Easing.out(Easing.quad) });
    // Longer when it lists what opened, so there is time to read it.
    const hold = unlocksAt(tier).length > 0 ? 4200 : 2400;
    pop.value = withSequence(withDelay(250, withSpring(1, { damping: 8, stiffness: 160 })), withDelay(hold, withTiming(0, { duration: 300 })));
    const done = setTimeout(onDone, hold + 900);
    return () => clearTimeout(done);
  }, [flash, pop, onDone, tier]);
  const flashStyle = useAnimatedStyle(() => ({ opacity: flash.value }));
  const cardStyle = useAnimatedStyle(() => ({ opacity: Math.min(1, pop.value * 1.5), transform: [{ scale: 0.6 + pop.value * 0.4 }] }));
  const def = TIERS[tier];
  const opened = unlocksAt(tier);
  return (
    <View style={styles.fill} pointerEvents="none">
      <Animated.View style={[styles.fill, styles.flash, flashStyle]} />
      <Animated.View style={[styles.card, cardStyle]}>
        {restaurant && <Text style={styles.restaurant}>{restaurant}</Text>}
        <Text style={styles.title}>{t('ui.grew')}</Text>
        {def && <Text style={styles.name}>{t(`tier.${def.id}`)}</Text>}
        {/* What this building opens (src/data/unlocks.ts). */}
        {opened.length > 0 && (
          <View style={styles.opened}>
            <Text style={styles.openedTitle}>{t('unlock.opened')}</Text>
            <View style={styles.openedList}>
              {opened.map((u) => (
                <View key={u.id} style={styles.chip}>
                  <Text style={styles.chipIcon}>{u.icon}</Text>
                  <Text style={styles.chipText}>{t(u.name)}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
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
  restaurant: { color: gold, fontSize: 15, fontWeight: '900', marginBottom: 2 },
  title: { color: '#FFE9A8', fontSize: 18, fontWeight: '900' },
  name: { color: '#FFFFFF', fontSize: 34, fontWeight: '900', marginTop: 2 },
  opened: { marginTop: 10, alignItems: 'center', maxWidth: 300 },
  openedTitle: { color: '#FFE9A8', fontSize: 14, fontWeight: '900', marginBottom: 6 },
  openedList: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 12, backgroundColor: '#3A1D40', borderWidth: 1.5, borderColor: gold },
  chipIcon: { fontSize: 15 },
  chipText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
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
