import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { theme } from './theme';

interface Props {
  label: string;
  onPress: () => void;
  active?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Every tap squashes and springs back: the smallest unit of "juice". */
export function JuicyButton({ label, onPress, active = false, style }: Props) {
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPressIn={() => {
        scale.value = withTiming(0.88, { duration: 70 });
      }}
      onPressOut={() => {
        scale.value = withSequence(withSpring(1.08, { damping: 6, stiffness: 400 }), withSpring(1, { damping: 10, stiffness: 300 }));
      }}
      onPress={onPress}
      hitSlop={6}
    >
      <Animated.View style={[styles.button, active && styles.active, style, animated]}>
        <Text style={[styles.label, active && styles.activeLabel]} numberOfLines={1}>
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: 14,
    borderRadius: 22,
    backgroundColor: theme.cream,
    borderWidth: 2,
    borderColor: theme.ink,
    alignItems: 'center',
    justifyContent: 'center',
    // Chunky "sticker" drop: matches the outlined art.
    boxShadow: `0px 3px 0px ${theme.ink}`,
  },
  active: { backgroundColor: theme.tomato },
  label: { color: theme.ink, fontWeight: '800', fontSize: 15 },
  activeLabel: { color: '#FFFFFF' },
});
