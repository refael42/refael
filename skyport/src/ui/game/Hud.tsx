import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useDir, useT } from '../../i18n';
import { Icon } from '../Icon';
import { C } from '../theme';

export interface HudData {
  money: string;
  diamonds: string;
  rating: number;
  day: number;
  time: string;
}

function Pill({ children, onLayout }: { children: React.ReactNode; onLayout?: (x: number, y: number) => void }) {
  return (
    <View
      style={styles.pill}
      onLayout={
        onLayout
          ? (e) => {
              const { x, y, height } = e.nativeEvent.layout;
              onLayout(x + height / 2, y + height / 2);
            }
          : undefined
      }
    >
      {children}
    </View>
  );
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
  const full = Math.round(data.rating * 2) / 2;
  return (
    <View style={[styles.row, { flexDirection: dir.row }]} pointerEvents="box-none">
      <View style={[styles.group, { flexDirection: dir.row }]} pointerEvents="box-none">
        <Pill onLayout={onCoinPos}>
          <View style={{ transform: [{ scale: 1 + bump * 0.18 }] }}>
            <Icon name="coin" size={24} />
          </View>
          <Text style={styles.num} numberOfLines={1} accessibilityLabel={t('hud.coins')}>
            {data.money}
          </Text>
        </Pill>
        <Pill>
          <Icon name="diamond" size={22} />
          <Text style={styles.num} numberOfLines={1} accessibilityLabel={t('hud.diamonds')}>
            {data.diamonds}
          </Text>
        </Pill>
      </View>
      <View style={[styles.group, { flexDirection: dir.row }]} pointerEvents="box-none">
        <Pill>
          <Icon name={full >= 1 ? 'star' : 'starEmpty'} size={20} />
          <Text style={styles.num} numberOfLines={1} accessibilityLabel={t('hud.rating')}>
            {data.rating.toFixed(1)}
          </Text>
        </Pill>
        <Pill>
          <Icon name="sun" size={20} />
          <Text style={styles.small} numberOfLines={1}>
            {t('hud.day', { n: data.day })} · {data.time}
          </Text>
        </Pill>
        <Pressable onPress={onSettings} style={({ pressed }) => [styles.gear, pressed && { opacity: 0.7 }]} hitSlop={8}>
          <Icon name="gear" size={24} />
        </Pressable>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  row: { justifyContent: 'space-between', flexWrap: 'wrap', gap: 6, paddingHorizontal: 8 },
  group: { gap: 6, alignItems: 'center', flexWrap: 'wrap' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(32,40,61,0.9)',
    borderRadius: 18,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderWidth: 2,
    borderColor: C.ink,
    minHeight: 34,
  },
  num: { color: C.text, fontSize: 16, fontWeight: '900', fontVariant: ['tabular-nums'], minWidth: 18 },
  small: { color: C.text, fontSize: 13, fontWeight: '800', fontVariant: ['tabular-nums'] },
  gear: { backgroundColor: 'rgba(32,40,61,0.9)', borderRadius: 18, width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: C.ink },
});
