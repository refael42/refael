import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useDir, useT } from '../../i18n';
import { Icon } from '../Icon';
import { C, SHADOW_SM } from '../theme';

export interface HudData {
  money: string;
  diamonds: string;
  rating: number;
  day: number;
  time: string;
}

export const Hud = memo(function Hud({
  data,
  onSettings,
  onCoinPos,
  bump,
}: {
  data: HudData;
  onSettings: () => void;
  onCoinPos: (x: number, y: number) => void;
  bump: number;
}) {
  const t = useT();
  const dir = useDir();
  return (
    <View style={[styles.row, { flexDirection: dir.row }]} pointerEvents="box-none">
      <View
        style={[styles.capsule, { flexDirection: dir.row }]}
        onLayout={(e) => {
          const { x, y, width, height } = e.nativeEvent.layout;
          onCoinPos(dir.rtl ? x + width - 22 : x + 22, y + height / 2);
        }}
      >
        <View style={[styles.item, { flexDirection: dir.row }]}>
          <View style={{ transform: [{ scale: 1 + bump * 0.2 }] }}>
            <Icon name="coin" size={24} />
          </View>
          <Text style={styles.num} numberOfLines={1} accessibilityLabel={t('hud.coins')}>
            {data.money}
          </Text>
        </View>
        <View style={styles.divider} />
        <View style={[styles.item, { flexDirection: dir.row }]}>
          <Icon name="diamond" size={20} />
          <Text style={styles.num} numberOfLines={1} accessibilityLabel={t('hud.diamonds')}>
            {data.diamonds}
          </Text>
        </View>
      </View>
      <View style={[styles.right, { flexDirection: dir.row }]} pointerEvents="box-none">
        <View style={[styles.capsule, { flexDirection: dir.row }]}>
          <View style={[styles.item, { flexDirection: dir.row }]}>
            <Icon name="star" size={20} />
            <Text style={styles.num} numberOfLines={1} accessibilityLabel={t('hud.rating')}>
              {data.rating.toFixed(1)}
            </Text>
          </View>
          <View style={styles.divider} />
          <View style={[styles.item, { flexDirection: dir.row }]}>
            <Icon name="sun" size={20} />
            <View>
              <Text style={styles.time} numberOfLines={1}>
                {data.time}
              </Text>
              <Text style={styles.day} numberOfLines={1}>
                {t('hud.day', { n: data.day })}
              </Text>
            </View>
          </View>
        </View>
        <Pressable
          onPress={onSettings}
          style={({ pressed }) => [styles.round, pressed && styles.pressed]}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t('settings.title')}
        >
          <Icon name="gear" size={22} />
        </Pressable>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  row: { justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, paddingHorizontal: 10 },
  right: { gap: 8, alignItems: 'center' },
  capsule: {
    alignItems: 'center',
    backgroundColor: C.glass,
    borderRadius: 999,
    paddingHorizontal: 12,
    height: 44,
    borderWidth: 1,
    borderColor: C.glassEdge,
    ...SHADOW_SM,
  },
  item: { alignItems: 'center', gap: 6 },
  divider: { width: 1, height: 22, backgroundColor: C.line, marginHorizontal: 10 },
  num: { color: C.text, fontSize: 16, fontWeight: '800', fontVariant: ['tabular-nums'], minWidth: 14, letterSpacing: -0.2 },
  time: { color: C.text, fontSize: 14, fontWeight: '800', fontVariant: ['tabular-nums'], lineHeight: 16 },
  day: { color: C.textDim, fontSize: 10, fontWeight: '700', lineHeight: 12 },
  round: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: C.glass,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: C.glassEdge,
    ...SHADOW_SM,
  },
  pressed: { transform: [{ scale: 0.94 }], opacity: 0.9 },
});
