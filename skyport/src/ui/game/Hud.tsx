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
  /** Where the wind blows toward, as a screen rotation in degrees (0 = up). */
  windDeg: number;
  windKt: number;
  /** 0 clear, 1 haze, 2 fog the airport cannot land in. */
  fog: number;
  /** Crosswind strong enough to keep light planes waiting. */
  cross: boolean;
  /** How thick the fog on the map looks, 0..1 (steps of 0.05). */
  haze: number;
  /** A thunderstorm over the field. */
  storm: boolean;
  /** Incidents under way or announced (the events button's count). */
  incidents: number;
  weekend: boolean;
}

/** HUD fields compared twice a second (a new object only when something shows differently). */
export function sameHud(a: HudData, b: HudData): boolean {
  return (
    a.money === b.money &&
    a.diamonds === b.diamonds &&
    a.rating === b.rating &&
    a.day === b.day &&
    a.time === b.time &&
    Math.abs(a.windDeg - b.windDeg) < 4 &&
    a.windKt === b.windKt &&
    a.fog === b.fog &&
    a.cross === b.cross &&
    a.haze === b.haze &&
    a.storm === b.storm &&
    a.incidents === b.incidents &&
    a.weekend === b.weekend
  );
}

export const Hud = memo(function Hud({
  data,
  onSettings,
  onHelp,
  onEvents,
  onCoinPos,
  bump,
}: {
  data: HudData;
  onSettings: () => void;
  onHelp: () => void;
  onEvents: () => void;
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
          <View
            style={[styles.item, { flexDirection: dir.row }]}
            accessibilityLabel={t('hud.wind', { n: data.windKt })}
            testID="hud-weather"
          >
            <View style={[styles.windDial, data.cross && styles.windCross]}>
              <View style={{ transform: [{ rotate: `${Math.round(data.windDeg)}deg` }] }}>
                <Icon name="arrow" size={14} />
              </View>
            </View>
            <View>
              <Text style={[styles.time, data.cross && { color: C.red }]} numberOfLines={1}>
                {data.windKt}
              </Text>
              <Text style={styles.day} numberOfLines={1}>
                {t('hud.kt')}
              </Text>
            </View>
            {data.fog > 0 && (
              <View style={[styles.fogBadge, data.fog > 1 && styles.fogBad]}>
                <Icon name="fog" size={18} />
              </View>
            )}
          </View>
          <View style={styles.divider} />
          <View style={[styles.item, { flexDirection: dir.row }]}>
            <Icon name="sun" size={20} />
            <View>
              <Text style={styles.time} numberOfLines={1}>
                {data.time}
              </Text>
              <Text style={[styles.day, data.weekend && { color: C.primary }]} numberOfLines={1}>
                {data.weekend ? t('hud.weekend', { n: data.day }) : t('hud.day', { n: data.day })}
              </Text>
            </View>
          </View>
        </View>
        <Pressable
          onPress={onEvents}
          style={({ pressed }) => [styles.round, pressed && styles.pressed]}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t('inc.panel')}
          testID="events-button"
        >
          <Icon name="bell" size={24} />
          {data.incidents > 0 ? (
            <View style={styles.count}>
              <Text style={styles.countText}>{data.incidents}</Text>
            </View>
          ) : null}
        </Pressable>
        <Pressable
          onPress={onHelp}
          style={({ pressed }) => [styles.round, pressed && styles.pressed]}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t('help.title')}
          testID="help-button"
        >
          <Text style={styles.helpMark}>?</Text>
        </Pressable>
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
  windDial: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(56,189,248,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  windCross: { backgroundColor: 'rgba(239,68,68,0.2)' },
  fogBadge: { borderRadius: 8, padding: 1 },
  fogBad: { backgroundColor: 'rgba(239,68,68,0.22)' },
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
  count: { position: 'absolute', top: -2, right: -2, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: C.red, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, borderWidth: 2, borderColor: '#fff' },
  countText: { color: '#fff', fontSize: 10, fontWeight: '900' },
  helpMark: { color: C.primary, fontSize: 22, fontWeight: '900', lineHeight: 26 },
});
