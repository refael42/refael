import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useDir, useT, type TKey } from '../../i18n';
import type { IconName } from '../../render/art/icons';
import { Icon } from '../Icon';
import { C, SHADOW_SM } from '../theme';

export interface FestView {
  kind: string;
  icon: string;
  points: number;
  goals: readonly [number, number, number];
  prizes: number;
  /** Game seconds left. */
  left: string;
}

export interface DealView {
  id: string;
  price: string;
  left: number;
  off: number;
  canBuy: boolean;
}

/**
 * The festival under way (a small card: its name, a bar to the next prize, three
 * prize marks) and the flash deal when there is one (a chip with its price and
 * the minutes left). Kept small: it sits on the map.
 */
export const FestivalCard = memo(function FestivalCard({ fest, deal, onBuy }: { fest: FestView | null; deal: DealView | null; onBuy: () => void }) {
  const t = useT();
  const dir = useDir();
  const ta = { textAlign: dir.textAlign, writingDirection: dir.writingDirection } as const;
  return (
    <View style={{ gap: 6 }} pointerEvents="box-none">
      {fest ? (
        <View style={[styles.card, { flexDirection: dir.row }]} testID="festival-card" accessibilityLabel={t(`fest.${fest.kind}.how` as TKey)}>
          <View style={styles.icon}>
            <Icon name={fest.icon as IconName} size={18} />
          </View>
          <View style={{ flex: 1, gap: 3 }}>
            <View style={[styles.row, { flexDirection: dir.row }]}>
              <Text style={[styles.name, ta, { flex: 1 }]} numberOfLines={1}>
                {t(`fest.${fest.kind}.name` as TKey)}
              </Text>
              <Text style={styles.left}>{fest.left}</Text>
            </View>
            <View style={[styles.bar, { flexDirection: dir.row }]}>
              {fest.goals.map((g, i) => {
                const from = i === 0 ? 0 : fest.goals[i - 1];
                const frac = Math.max(0, Math.min(1, (fest.points - from) / (g - from)));
                return (
                  <View key={i} style={styles.seg}>
                    <View style={[styles.fill, { width: `${Math.round(frac * 100)}%` }, i < fest.prizes && styles.fillDone]} />
                  </View>
                );
              })}
            </View>
            <Text style={[styles.how, ta]} numberOfLines={1}>
              {t('fest.points', { n: fest.points })} · {t(`fest.${fest.kind}.how` as TKey)}
            </Text>
          </View>
        </View>
      ) : null}
      {deal ? (
        <Pressable
          onPress={onBuy}
          disabled={!deal.canBuy}
          style={({ pressed }) => [styles.deal, { flexDirection: dir.row }, !deal.canBuy && { opacity: 0.6 }, pressed && { transform: [{ scale: 0.97 }] }]}
          accessibilityRole="button"
          testID="deal-chip"
        >
          <View style={styles.off}>
            <Text style={styles.offText}>{t('deal.off', { n: deal.off })}</Text>
          </View>
          <Text style={[styles.dealText, ta]} numberOfLines={1}>
            {t('deal.title', { name: t(`upg.${deal.id}` as TKey) })}
          </Text>
          <View style={[styles.price, { flexDirection: dir.row }]}>
            <Icon name="coin" size={13} />
            <Text style={styles.priceText}>{deal.price}</Text>
          </View>
          <Text style={styles.dealLeft}>{t('deal.left', { n: deal.left })}</Text>
        </Pressable>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  card: { width: 232, alignItems: 'center', gap: 8, backgroundColor: C.glassStrong, borderRadius: 16, paddingHorizontal: 10, paddingVertical: 7, borderWidth: 1, borderColor: '#f0abfc', ...SHADOW_SM },
  icon: { width: 30, height: 30, borderRadius: 10, backgroundColor: '#fae8ff', alignItems: 'center', justifyContent: 'center' },
  row: { alignItems: 'center', gap: 6 },
  name: { color: C.text, fontWeight: '800', fontSize: 13 },
  left: { color: C.textDim, fontWeight: '700', fontSize: 11, fontVariant: ['tabular-nums'] },
  bar: { gap: 3 },
  seg: { flex: 1, height: 6, borderRadius: 3, backgroundColor: 'rgba(15,23,42,0.1)', overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3, backgroundColor: '#d946ef' },
  fillDone: { backgroundColor: '#f5b301' },
  how: { color: C.textDim, fontSize: 10, fontWeight: '600' },
  deal: { maxWidth: 300, alignItems: 'center', gap: 6, backgroundColor: C.glassStrong, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 5, borderWidth: 1, borderColor: '#fca5a5', ...SHADOW_SM },
  off: { backgroundColor: C.red, borderRadius: 999, paddingHorizontal: 6, paddingVertical: 2 },
  offText: { color: '#ffffff', fontWeight: '900', fontSize: 11 },
  dealText: { color: C.text, fontWeight: '700', fontSize: 12, flexShrink: 1 },
  price: { alignItems: 'center', gap: 3, backgroundColor: C.green, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2 },
  priceText: { color: '#ffffff', fontWeight: '800', fontSize: 12 },
  dealLeft: { color: C.red, fontWeight: '800', fontSize: 11, fontVariant: ['tabular-nums'] },
});
