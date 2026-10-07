import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { RUSH } from '../data/staff';
import { useT } from '../i18n';
import type { Command, GameState } from '../sim/game/types';
import { gold, textShadow } from './theme';

// Rush hour: hold the flame and the whole team speeds up while the meter lasts (it costs them
// morale). The meter is the fill inside the button; the screen edges glow while it runs.

const SIZE = 58;
const POLL_MS = 100;

interface Props {
  gameRef: { current: GameState | null };
  onCommand: (cmd: Command) => void;
  /** Where the button sits (it moves out of the way of menus by not being shown). */
  style: object;
}

export function RushButton({ gameRef, onCommand, style }: Props) {
  const t = useT();
  const [rush, setRush] = useState({ on: false, charge: 1 });
  useEffect(() => {
    const timer = setInterval(() => {
      const r = gameRef.current?.rush;
      if (r) setRush((old) => (old.on === r.on && Math.abs(old.charge - r.charge) < 0.01 ? old : { on: r.on, charge: r.charge }));
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [gameRef]);
  // Let go when the button goes away mid-press (a menu opened): the rush must not stay on.
  useEffect(() => () => onCommand({ type: 'rush', on: false }), [onCommand]);

  const pulse = useSharedValue(0);
  const active = useSharedValue(0);
  useEffect(() => {
    active.value = withTiming(rush.on ? 1 : 0, { duration: 150 });
    if (rush.on) pulse.value = withRepeat(withSequence(withTiming(1, { duration: 220 }), withTiming(0, { duration: 220 })), -1);
    else {
      cancelAnimation(pulse);
      pulse.value = withTiming(0, { duration: 150 });
    }
  }, [rush.on, pulse, active]);
  const buttonStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 + pulse.value * 0.08 }] }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: active.value * (0.55 + pulse.value * 0.35) }));
  const ready = rush.on || rush.charge >= RUSH.minCharge;

  return (
    <>
      <Animated.View style={[styles.glow, glowStyle]} pointerEvents="none" />
      <View style={[styles.wrap, style]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="rush"
          onPressIn={() => onCommand({ type: 'rush', on: true })}
          onPressOut={() => onCommand({ type: 'rush', on: false })}
          hitSlop={8}
        >
          <Animated.View style={[styles.button, !ready && styles.empty, rush.on && styles.on, buttonStyle]}>
            <View style={[styles.fill, { height: `${Math.round(rush.charge * 100)}%` }]} />
            <Text style={styles.flame}>🔥</Text>
            <Text style={styles.label}>{rush.on ? t('ui.rush') : t('ui.rushHold')}</Text>
          </Animated.View>
        </Pressable>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  glow: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, borderWidth: 10, borderColor: 'rgba(255,122,26,0.9)', borderRadius: 4 },
  wrap: { position: 'absolute', alignItems: 'center' },
  button: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    backgroundColor: '#3A1D40',
    borderWidth: 3,
    borderColor: gold,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0px 3px 0px #120818',
  },
  empty: { borderColor: '#6A5A72' },
  on: { borderColor: '#FFF4E3' },
  fill: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: '#FF7A1A' },
  flame: { fontSize: 22, marginTop: 4 },
  label: { color: '#FFF4E3', fontSize: 9, fontWeight: '900', marginTop: -2, ...textShadow('#120818', 1, 0) },
});
