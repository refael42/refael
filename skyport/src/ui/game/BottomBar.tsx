import { memo } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { useDir, useT, type TKey } from '../../i18n';
import type { IconName } from '../../render/art/icons';
import { Icon } from '../Icon';
import { C, SHADOW_SM } from '../theme';

export interface BarItem {
  id: string;
  icon: IconName;
  label: TKey;
  badge?: boolean;
}

export const BottomBar = memo(function BottomBar({
  items,
  onPress,
  onItemLayout,
  onLayout,
  compact: dense = false,
  maxWidth,
}: {
  items: BarItem[];
  onPress: (id: string) => void;
  onItemLayout?: (id: string, cx: number, cy: number) => void;
  onLayout?: (x: number, y: number) => void;
  /** Landscape: smaller buttons, the map needs the height. */
  compact?: boolean;
  /** Width left for the bar (defaults to the window). */
  maxWidth?: number;
}) {
  const t = useT();
  const dir = useDir();
  const { width } = useWindowDimensions();
  // one row when every button gets at least MIN_W, otherwise two even rows (never overlapping)
  const avail = Math.min(maxWidth ?? width - 20, 640) - PAD * 2 - BORDER * 2;
  const n = items.length;
  const fit = (cols: number) => Math.floor((avail - GAP * (cols - 1)) / cols);
  const cols = fit(n) >= MIN_W ? n : Math.ceil(n / 2);
  const w = Math.min(dense ? 70 : MAX_W, fit(cols));
  const compact = dense || w < 66;
  return (
    <View
      style={[styles.bar, { flexDirection: dir.row, width: cols * w + GAP * (cols - 1) + PAD * 2 + BORDER * 2 }]}
      onLayout={(e) => onLayout?.(e.nativeEvent.layout.x, e.nativeEvent.layout.y)}
    >
      {items.map((it) => (
        <Pressable
          key={it.id}
          onPress={() => onPress(it.id)}
          onLayout={(e) => {
            const l = e.nativeEvent.layout;
            onItemLayout?.(it.id, l.x + l.width / 2, l.y + l.height / 2);
          }}
          style={({ pressed }) => [styles.btn, { width: w }, dense && styles.btnDense, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={t(it.label)}
        >
          <View>
            <Icon name={it.icon} size={compact ? 24 : 26} />
            {it.badge ? <View style={styles.badge} /> : null}
          </View>
          <Text style={[styles.label, compact && styles.labelSmall]} numberOfLines={1}>
            {t(it.label)}
          </Text>
        </Pressable>
      ))}
    </View>
  );
});

const GAP = 4;
const PAD = 6;
const BORDER = 1;
const MIN_W = 56;
const MAX_W = 84;

const styles = StyleSheet.create({
  bar: {
    alignSelf: 'center',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: GAP,
    backgroundColor: C.glass,
    borderRadius: 24,
    padding: PAD,
    borderWidth: BORDER,
    borderColor: C.glassEdge,
    ...SHADOW_SM,
  },
  btn: { paddingHorizontal: 2, paddingVertical: 6, borderRadius: 18, alignItems: 'center', gap: 2 },
  btnDense: { paddingVertical: 3 },
  pressed: { backgroundColor: C.chip, transform: [{ scale: 0.96 }] },
  label: { color: C.text, fontSize: 12, fontWeight: '700' },
  labelSmall: { fontSize: 11 },
  badge: { position: 'absolute', top: -2, right: -4, width: 10, height: 10, borderRadius: 5, backgroundColor: C.red, borderWidth: 2, borderColor: '#fff' },
});
