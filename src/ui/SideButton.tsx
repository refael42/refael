import { useEffect, type ReactNode } from 'react';
import { Image, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { tapFeedback } from '../audio/sound';
import { textShadow } from './theme';

// The side of the screen (owner M33: "make the main screen easier on the eye, too many things
// are shown... and nicer, so it does not look cheap"): the festival, the deal, the reviews, the
// guide, the trophies are small round buttons with one short word under them, instead of a
// stack of wide cards. The number that matters sits in a red badge; something ready to take
// glows gold. Tapping opens the full page, where everything else is.

export const SIDE = { size: 46, icon: 32, gap: 6 } as const;

interface Props {
  /** A PNG data URI (the HUD's icons), or a node drawn in its place. */
  icon?: string;
  children?: ReactNode;
  caption?: string;
  /** The caption in a warning color (a clock running out). */
  hurry?: boolean;
  badge?: number | string;
  /** Something to take: a slow gold pulse round it. */
  ready?: boolean;
  label: string;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

export function SideButton({ icon, children, caption, hurry, badge, ready, label, onPress, style }: Props) {
  const glow = useSharedValue(0);
  const press = useSharedValue(1);
  useEffect(() => {
    glow.value = ready ? withRepeat(withSequence(withTiming(1, { duration: 700 }), withTiming(0, { duration: 700 })), -1) : withTiming(0, { duration: 200 });
  }, [glow, ready]);
  const ring = useAnimatedStyle(() => ({ opacity: glow.value * 0.85, transform: [{ scale: 1 + glow.value * 0.16 }] }));
  const body = useAnimatedStyle(() => ({ transform: [{ scale: press.value }] }));
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={!onPress}
      hitSlop={4}
      onPressIn={() => (press.value = withTiming(0.9, { duration: 70 }))}
      onPressOut={() => (press.value = withSpring(1, { damping: 9, stiffness: 320 }))}
      onPress={() => {
        tapFeedback();
        onPress?.();
      }}
      style={[styles.wrap, style]}
    >
      <Animated.View style={[styles.circle, body]}>
        <Animated.View pointerEvents="none" style={[styles.ring, ring]} />
        <View pointerEvents="none" style={styles.shine} />
        {icon ? <Image source={{ uri: icon }} style={styles.icon} /> : children}
      </Animated.View>
      {caption ? (
        <View style={styles.caption}>
          <Text numberOfLines={1} style={[styles.captionText, hurry && styles.hurry]}>
            {caption}
          </Text>
        </View>
      ) : null}
      {badge !== undefined && badge !== 0 && badge !== '' ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { width: SIDE.size + 14, alignItems: 'center' },
  circle: {
    width: SIDE.size,
    height: SIDE.size,
    borderRadius: SIDE.size / 2,
    backgroundColor: 'rgba(28,14,36,0.84)',
    borderWidth: 1.5,
    borderColor: 'rgba(242,198,96,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0px 3px 8px rgba(8,2,12,0.45)',
  },
  ring: {
    position: 'absolute',
    left: -4,
    top: -4,
    right: -4,
    bottom: -4,
    borderRadius: SIDE.size / 2 + 4,
    borderWidth: 2.5,
    borderColor: '#FFD86A',
  },
  shine: { position: 'absolute', left: 7, right: 7, top: 3, height: SIDE.size / 2 - 5, borderRadius: SIDE.size / 3, backgroundColor: 'rgba(255,255,255,0.09)' },
  icon: { width: SIDE.icon, height: SIDE.icon },
  caption: {
    marginTop: -7,
    minWidth: 34,
    height: 17,
    paddingHorizontal: 6,
    borderRadius: 9,
    backgroundColor: 'rgba(22,10,30,0.94)',
    borderWidth: 1,
    borderColor: 'rgba(242,198,96,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  captionText: { color: '#FFF1CC', fontSize: 10.5, fontWeight: '800', fontVariant: ['tabular-nums'], ...textShadow('rgba(0,0,0,0.6)', 1, 0) },
  hurry: { color: '#FF9A7A' },
  badge: {
    position: 'absolute',
    top: -3,
    right: 2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: '#E5483B',
    borderWidth: 1.5,
    borderColor: '#FFF4E3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#FFFFFF', fontSize: 10.5, fontWeight: '900' },
});
