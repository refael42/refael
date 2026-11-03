import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useDir, useT, type TKey } from '../../i18n';
import { Icon } from '../Icon';
import { C, SHADOW } from '../theme';
import { formatDuration } from '../../sim';
import { cityKey, WANT_ACTION, type FlightView } from './flightInfo';

function Meter({ label, value, color }: { label: string; value: number; color: string }) {
  const dir = useDir();
  return (
    <View style={[styles.meter, { flexDirection: dir.row }]}>
      <Text style={[styles.meterLabel, { textAlign: dir.textAlign }]} numberOfLines={1}>
        {label}
      </Text>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${Math.max(4, Math.min(100, value * 100))}%`, backgroundColor: color, [dir.rtl ? 'right' : 'left']: 0 }]} />
      </View>
      <Text style={styles.meterValue}>{Math.round(value * 100)}%</Text>
    </View>
  );
}

function Chip({ children, tone }: { children: React.ReactNode; tone?: 'good' | 'bad' | 'accent' }) {
  const bg = tone === 'good' ? C.greenSoft : tone === 'bad' ? C.redSoft : tone === 'accent' ? C.primarySoft : C.chip;
  return <View style={[styles.chip, { backgroundColor: bg }]}>{children}</View>;
}

export const FlightCard = memo(function FlightCard({ v, onClose, onAction }: { v: FlightView; onClose: () => void; onAction: (want: number) => void }) {
  const t = useT();
  const dir = useDir();
  const acts = v.actions ? v.actions.split(',').map(Number) : [];
  const moodColor = v.mood > 0.66 ? C.green : v.mood > 0.4 ? C.amber : C.red;
  const ta = { textAlign: dir.textAlign, writingDirection: dir.writingDirection } as const;
  return (
    <View style={styles.card}>
      <View style={[styles.head, { flexDirection: dir.row }]}>
        <View style={[styles.badge, { backgroundColor: v.tail }]}>
          <Text style={styles.badgeText}>{v.code.slice(0, 3)}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.code, ta]} numberOfLines={1}>
            {t('card.flight', { code: v.code })}
          </Text>
          <Text style={[styles.sub, ta]} numberOfLines={1}>
            {v.airline} · {v.model}
          </Text>
          {v.rep >= 0 ? (
            <Text style={[styles.sub, ta]} numberOfLines={1}>
              {t('card.airline', { kind: t(`air.kind.${v.kind}` as TKey), n: v.rep })}
            </Text>
          ) : null}
        </View>
        <Pressable onPress={onClose} hitSlop={10} style={styles.close} accessibilityLabel={t('card.close')}>
          <Icon name="close" size={16} />
        </Pressable>
      </View>
      <View style={[styles.route, { flexDirection: dir.row }]}>
        <Text style={styles.city} numberOfLines={1}>
          {t(cityKey(v.origin))}
        </Text>
        <View style={styles.routeLine}>
          <View style={styles.routeDash} />
          <View style={{ transform: [{ rotate: dir.rtl ? '-90deg' : '90deg' }] }}>
            <Icon name="plane" size={16} />
          </View>
          <View style={styles.routeDash} />
        </View>
        <Text style={styles.city} numberOfLines={1}>
          {t(cityKey(v.dest))}
        </Text>
      </View>
      <View style={[styles.chips, { flexDirection: dir.row }]}>
        <Chip tone="accent">
          <Text style={[styles.chipText, { color: C.primary }]}>{t(`phase.${v.phase}` as TKey)}</Text>
        </Chip>
        <Chip>
          <View style={[styles.chipRow, { flexDirection: dir.row }]}>
            <Icon name="pax" size={13} />
            <Text style={styles.chipText}>{t('card.pax', { n: v.pax })}</Text>
          </View>
        </Chip>
        {v.slot ? (
          <Chip>
            <View style={[styles.chipRow, { flexDirection: dir.row }]}>
              <Icon name="clock" size={13} />
              <Text style={styles.chipText}>{t('card.slot', { time: v.slot })}</Text>
            </View>
          </Chip>
        ) : null}
        {v.hold ? (
          <Chip tone="bad">
            <View style={[styles.chipRow, { flexDirection: dir.row }]}>
              <Icon name={v.hold === 'fog' ? 'fog' : v.hold === 'crosswind' || v.hold === 'turn' || v.hold === 'storm' ? 'wind' : 'hourglass'} size={13} />
              <Text style={[styles.chipText, { color: C.red }]}>{t(`hold.${v.hold}` as TKey)}</Text>
            </View>
          </Chip>
        ) : null}
        {v.emergency ? (
          <Chip tone="bad">
            <Text style={[styles.chipText, { color: C.red }]}>{t('card.emergency')}</Text>
          </Chip>
        ) : null}
        {v.vip ? (
          <Chip tone="accent">
            <View style={[styles.chipRow, { flexDirection: dir.row }]}>
              <Icon name="star" size={13} />
              <Text style={[styles.chipText, { color: C.primary }]}>{t('card.vip')}</Text>
            </View>
          </Chip>
        ) : null}
        {v.medical ? (
          <Chip tone="bad">
            <View style={[styles.chipRow, { flexDirection: dir.row }]}>
              <Icon name="medic" size={13} />
              <Text style={[styles.chipText, { color: C.red }]}>{t('card.medical')}</Text>
            </View>
          </Chip>
        ) : null}
        {v.celeb ? (
          <Chip tone="accent">
            <View style={[styles.chipRow, { flexDirection: dir.row }]}>
              <Icon name="camera" size={13} />
              <Text style={[styles.chipText, { color: C.primary }]}>{t('card.celeb')}</Text>
            </View>
          </Chip>
        ) : null}
        {v.historic >= 0 ? (
          <Chip tone="accent">
            <View style={[styles.chipRow, { flexDirection: dir.row }]}>
              <Icon name="ticket" size={13} />
              <Text style={[styles.chipText, { color: C.primary }]}>{v.historic > 0 ? t('card.onShow', { t: formatDuration(v.historic) }) : t('card.historic')}</Text>
            </View>
          </Chip>
        ) : null}
        {v.aog === 1 && !v.check ? (
          <Chip tone="bad">
            <View style={[styles.chipRow, { flexDirection: dir.row }]}>
              <Icon name="wrench" size={13} />
              <Text style={[styles.chipText, { color: C.red }]}>{t(v.partWait ? 'card.waitPart' : 'card.fault')}</Text>
            </View>
          </Chip>
        ) : null}
        {v.check ? (
          <Chip tone="accent">
            <View style={[styles.chipRow, { flexDirection: dir.row }]}>
              <Icon name="build" size={13} />
              <Text style={[styles.chipText, { color: C.primary }]}>{t(v.check === 2 ? 'card.checkB' : 'card.checkA')}</Text>
            </View>
          </Chip>
        ) : null}
        {v.guest ? (
          <Chip tone="good">
            <Text style={[styles.chipText, { color: C.green }]}>{t('card.guest')}</Text>
          </Chip>
        ) : null}
        {v.onTime !== 0 ? (
          <Chip tone={v.onTime > 0 ? 'good' : 'bad'}>
            <Text style={[styles.chipText, { color: v.onTime > 0 ? C.green : C.red }]}>{v.onTime > 0 ? t('card.onTime') : t('card.late')}</Text>
          </Chip>
        ) : null}
      </View>
      <View style={styles.meters}>
        <Meter label={t('card.mood')} value={v.mood} color={moodColor} />
        {v.checked >= 0 && v.checked < 1 ? <Meter label={t('card.checkedIn')} value={v.checked} color="#14b8a6" /> : null}
        {v.airborne ? <Meter label={t('card.patience')} value={v.patience} color={v.patience < 0.35 ? C.red : C.amber} /> : null}
        {v.phase === 'deboarding' ? <Meter label={t('card.deboarding')} value={v.deboard} color={C.blue} /> : null}
        {v.repair >= 0 ? <Meter label={t('card.repair')} value={v.repair} color={C.red} /> : null}
        {v.fuelActive ? <Meter label={t('card.fuel')} value={v.fuel} color={C.amber} /> : null}
        {v.bagsActive ? <Meter label={t('card.bags')} value={v.bags} color="#8b5cf6" /> : null}
        {v.phase === 'boarding' ? <Meter label={t('card.boarding')} value={v.board} color={C.green} /> : null}
      </View>
      {v.waiting ? (
        <View style={[styles.waiting, { flexDirection: dir.row }]}>
          <Icon name="hourglass" size={16} />
          <Text style={styles.waitingText}>{t('card.waitTaxi')}</Text>
        </View>
      ) : null}
      {acts.length > 0 ? (
        <View style={[styles.actions, { flexDirection: dir.row }]}>
          {acts.map((w) => {
            const act = WANT_ACTION[w];
            if (!act) return null;
            return (
              <Pressable
                key={w}
                onPress={() => onAction(w)}
                style={({ pressed }) => [styles.action, { backgroundColor: act.color, flexDirection: dir.row }, pressed && styles.pressed]}
              >
                <View style={styles.actionIcon}>
                  <Icon name={act.icon} size={20} />
                </View>
                <Text style={styles.actionText} numberOfLines={1}>
                  {t(act.key)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: C.glassStrong,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: C.glassEdge,
    padding: 14,
    gap: 10,
    width: '100%',
    maxWidth: 460,
    ...SHADOW,
  },
  head: { alignItems: 'center', gap: 10 },
  badge: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '900', letterSpacing: 0.5, textShadowColor: 'rgba(0,0,0,0.25)', textShadowRadius: 2 },
  code: { color: C.text, fontSize: 19, fontWeight: '800', letterSpacing: -0.3 },
  sub: { color: C.textDim, fontSize: 13, fontWeight: '500' },
  close: { width: 32, height: 32, borderRadius: 16, backgroundColor: C.chip, alignItems: 'center', justifyContent: 'center' },
  route: { alignItems: 'center', gap: 8 },
  city: { color: C.text, fontSize: 15, fontWeight: '700', flexShrink: 1 },
  routeLine: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4, minWidth: 40 },
  routeDash: { flex: 1, height: 2, borderRadius: 1, backgroundColor: C.track },
  chips: { flexWrap: 'wrap', gap: 6 },
  chip: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, alignItems: 'center' },
  chipRow: { alignItems: 'center', gap: 4 },
  chipText: { color: C.text, fontSize: 12, fontWeight: '700' },
  meters: { gap: 7 },
  meter: { alignItems: 'center', gap: 8 },
  meterLabel: { color: C.textDim, fontSize: 12, width: 74, fontWeight: '600' },
  meterValue: { color: C.textFaint, fontSize: 11, fontWeight: '700', width: 34, textAlign: 'center', fontVariant: ['tabular-nums'] },
  track: { flex: 1, height: 8, borderRadius: 4, backgroundColor: C.track, overflow: 'hidden' },
  fill: { position: 'absolute', top: 0, bottom: 0, borderRadius: 4 },
  actions: { flexWrap: 'wrap', gap: 8, marginTop: 2 },
  action: { flexGrow: 1, flexBasis: 150, borderRadius: 16, height: 50, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', gap: 8, ...SHADOW },
  actionIcon: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center' },
  actionText: { color: '#fff', fontSize: 15, fontWeight: '800', letterSpacing: -0.2, flexShrink: 1 },
  waiting: { alignItems: 'center', gap: 6, backgroundColor: '#fffbeb', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6 },
  waitingText: { color: '#92400e', fontSize: 13, fontWeight: '700' },
  pressed: { transform: [{ scale: 0.98 }], opacity: 0.92 },
});
