import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

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
}: {
  items: BarItem[];
  onPress: (id: string) => void;
  onItemLayout?: (id: string, cx: number, cy: number) => void;
  onLayout?: (x: number, y: number) => void;
}) {
  const t = useT();
  const dir = useDir();
  return (
    <View
      style={[styles.bar, { flexDirection: dir.row }]}
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
          style={({ pressed }) => [styles.btn, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={t(it.label)}
        >
          <View>
            <Icon name={it.icon} size={26} />
            {it.badge ? <View style={styles.badge} /> : null}
          </View>
          <Text style={styles.label} numberOfLines={1}>
            {t(it.label)}
          </Text>
        </Pressable>
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  bar: {
    alignSelf: 'center',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: C.glass,
    borderRadius: 24,
    padding: 6,
    borderWidth: 1,
    borderColor: C.glassEdge,
    ...SHADOW_SM,
  },
  btn: { minWidth: 74, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 18, alignItems: 'center', gap: 2 },
  pressed: { backgroundColor: C.chip, transform: [{ scale: 0.96 }] },
  label: { color: C.text, fontSize: 12, fontWeight: '700' },
  badge: { position: 'absolute', top: -2, right: -4, width: 10, height: 10, borderRadius: 5, backgroundColor: C.red, borderWidth: 2, borderColor: '#fff' },
});
