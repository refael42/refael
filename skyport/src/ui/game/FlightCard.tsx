import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useDir, useT, type TKey } from '../../i18n';
import { Icon } from '../Icon';
import { C } from '../theme';
import { cityKey, WANT_ACTION, type FlightView } from './flightInfo';

function Bar({ label, value, color }: { label: string; value: number; color: string }) {
  const dir = useDir();
  return (
    <View style={[styles.barRow, { flexDirection: dir.row }]}>
      <Text style={[styles.barLabel, { textAlign: dir.textAlign }]} numberOfLines={1}>
        {label}
      </Text>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${Math.max(3, Math.min(100, value * 100))}%`, backgroundColor: color, [dir.rtl ? 'right' : 'left']: 0 }]} />
      </View>
    </View>
  );
}

export const FlightCard = memo(function FlightCard({ v, onClose, onAction }: { v: FlightView; onClose: () => void; onAction: () => void }) {
  const t = useT();
  const dir = useDir();
  const act = WANT_ACTION[v.want];
  const moodColor = v.mood > 0.66 ? C.green : v.mood > 0.4 ? C.gold : C.red;
  const ta = { textAlign: dir.textAlign, writingDirection: dir.writingDirection } as const;
  return (
    <View style={styles.card}>
      <View style={[styles.head, { flexDirection: dir.row }]}>
        <View style={[styles.tail, { backgroundColor: v.tail }]} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.code, ta]} numberOfLines={1}>
            {t('card.flight', { code: v.code })}
          </Text>
          <Text style={[styles.sub, ta]} numberOfLines={1}>
            {v.airline} · {v.model}
          </Text>
        </View>
        <Pressable onPress={onClose} hitSlop={10} style={styles.close} accessibilityLabel={t('card.close')}>
          <Icon name="close" size={18} />
        </Pressable>
      </View>
      <Text style={[styles.route, ta]} numberOfLines={1}>
        {t('card.from', { city: t(cityKey(v.origin)) })}  {dir.rtl ? '←' : '→'}  {t('card.to', { city: t(cityKey(v.dest)) })}
      </Text>
      <View style={[styles.chips, { flexDirection: dir.row }]}>
        <View style={styles.chip}>
          <Text style={styles.chipText}>{t(`phase.${v.phase}` as TKey)}</Text>
        </View>
        <View style={[styles.chip, { flexDirection: dir.row, gap: 4 }]}>
          <Icon name="pax" size={14} />
          <Text style={styles.chipText}>{t('card.pax', { n: v.pax })}</Text>
        </View>
        {v.slot ? (
          <View style={[styles.chip, { flexDirection: dir.row, gap: 4 }]}>
            <Icon name="clock" size={14} />
            <Text style={styles.chipText}>{t('card.slot', { time: v.slot })}</Text>
          </View>
        ) : null}
        {v.onTime !== 0 ? (
          <View style={[styles.chip, { backgroundColor: v.onTime > 0 ? '#1f5c3a' : '#6b2a2a' }]}>
            <Text style={styles.chipText}>{v.onTime > 0 ? t('card.onTime') : t('card.late')}</Text>
          </View>
        ) : null}
      </View>
      <Bar label={t('card.mood')} value={v.mood} color={moodColor} />
      {v.airborne ? <Bar label={t('card.patience')} value={v.patience} color={v.patience < 0.35 ? C.red : C.gold} /> : null}
      {v.phase === 'deboarding' ? <Bar label={t('card.deboarding')} value={v.deboard} color={C.blue} /> : null}
      {v.fuelActive ? <Bar label={t('card.fuel')} value={v.fuel} color={C.orange} /> : null}
      {v.phase === 'boarding' ? <Bar label={t('card.boarding')} value={v.board} color={C.green} /> : null}
      {act ? (
        <Pressable onPress={onAction} style={({ pressed }) => [styles.action, { flexDirection: dir.row }, pressed && { transform: [{ scale: 0.97 }] }]}>
          <Icon name={act.icon} size={24} />
          <Text style={styles.actionText} numberOfLines={1}>
            {t(act.key)}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(32,40,61,0.97)',
    borderRadius: 18,
    borderWidth: 2,
    borderColor: C.ink,
    padding: 12,
    gap: 7,
    width: '100%',
    maxWidth: 460,
  },
  head: { alignItems: 'center', gap: 10 },
  tail: { width: 10, height: 36, borderRadius: 4, borderWidth: 2, borderColor: C.ink },
  code: { color: C.text, fontSize: 19, fontWeight: '900' },
  sub: { color: C.textDim, fontSize: 13 },
  close: { width: 32, height: 32, borderRadius: 16, backgroundColor: C.panelHi, alignItems: 'center', justifyContent: 'center' },
  route: { color: C.text, fontSize: 14, fontWeight: '700' },
  chips: { flexWrap: 'wrap', gap: 6 },
  chip: { backgroundColor: C.panelHi, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, alignItems: 'center' },
  chipText: { color: C.text, fontSize: 12, fontWeight: '700' },
  barRow: { alignItems: 'center', gap: 8 },
  barLabel: { color: C.textDim, fontSize: 12, width: 78, fontWeight: '700' },
  barTrack: { flex: 1, height: 10, borderRadius: 5, backgroundColor: '#141a28', overflow: 'hidden' },
  barFill: { position: 'absolute', top: 0, bottom: 0, borderRadius: 5 },
  action: { marginTop: 4, backgroundColor: C.green, borderRadius: 14, paddingVertical: 10, alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 2, borderColor: C.ink },
  actionText: { color: '#fff', fontSize: 17, fontWeight: '900' },
});
