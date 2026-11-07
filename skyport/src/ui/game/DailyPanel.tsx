import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { Canvas, Circle, Path } from '@shopify/react-native-skia';

import { tierDef } from '../../data/tiers';
import { useDir, useT } from '../../i18n';
import type { IconName } from '../../render/art/icons';
import { Big, DAILY_GIFTS, formatBig, giftReady, SPIN_GEMS, spinIn, WHEEL, WHEEL_TOTAL, type Command, type GameState, type Gift } from '../../sim';
import { Icon } from '../Icon';
import { C } from '../theme';
import { Sheet } from './Sheet';

const GIFT_ICON: Record<Gift['kind'], IconName> = { coins: 'coin', gems: 'diamond', boost: 'up', chest: 'chest' };
const SEG_COLORS = ['#fde68a', '#bfdbfe', '#c7d2fe', '#bbf7d0', '#fed7aa', '#a5f3fc', '#fbcfe8', '#fef08a'];

/** What a gift is, in a few words. */
function giftText(t: ReturnType<typeof useT>, g: Gift, pay: number): string {
  switch (g.kind) {
    case 'coins':
      return formatBig(Big.fromNumber(Math.round(g.n * pay)));
    case 'gems':
      return `${g.n}`;
    case 'boost':
      return t('daily.boostMin', { n: g.n });
    case 'chest':
      return t('daily.chest');
  }
}

/** Hours and minutes, short. */
function hm(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.floor(min % 60);
  return h > 0 ? `${h}:${m < 10 ? '0' : ''}${m}` : `0:${m < 10 ? '0' : ''}${m}`;
}

/** The wheel: eight slices sized by their odds (drawn with Skia), the prize in each (text on top, turning with it). */
function Wheel({ size, pay }: { size: number; pay: number }) {
  const r = size / 2;
  let a0 = -Math.PI / 2;
  const slices = WHEEL.map((w, i) => {
    const a1 = a0 + (w.weight / WHEEL_TOTAL) * Math.PI * 2;
    const large = a1 - a0 > Math.PI ? 1 : 0;
    const d = `M ${r} ${r} L ${r + r * Math.cos(a0)} ${r + r * Math.sin(a0)} A ${r} ${r} 0 ${large} 1 ${r + r * Math.cos(a1)} ${r + r * Math.sin(a1)} Z`;
    const mid = (a0 + a1) / 2;
    a0 = a1;
    const label = w.kind === 'coins' ? formatBig(Big.fromNumber(Math.round(w.n * pay))) : w.kind === 'gems' ? `${w.n}` : w.kind === 'boost' ? 'x2' : '';
    return { d, mid, label, color: SEG_COLORS[i % SEG_COLORS.length], icon: GIFT_ICON[w.kind], big: w.weight >= 4 };
  });
  return (
    <View style={{ width: size, height: size }}>
      <Canvas style={{ width: size, height: size }}>
        {slices.map((sl, i) => (
          <Path key={`f${i}`} path={sl.d} color={sl.color} />
        ))}
        {slices.map((sl, i) => (
          <Path key={`s${i}`} path={sl.d} color="#ffffff" style="stroke" strokeWidth={2} />
        ))}
        <Circle cx={r} cy={r} r={r * 0.16} color="#6366f1" />
      </Canvas>
      {slices.map((sl, i) =>
        sl.big ? (
          <View key={i} style={[styles.slice, { left: r + r * 0.66 * Math.cos(sl.mid) - 22, top: r + r * 0.66 * Math.sin(sl.mid) - 15 }]} pointerEvents="none">
            <Icon name={sl.icon} size={14} />
            {sl.label ? <Text style={styles.sliceText}>{sl.label}</Text> : null}
          </View>
        ) : null,
      )}
    </View>
  );
}

/**
 * The daily gift (seven days of a streak, today's to collect) and the lucky
 * wheel (a free spin every four hours, or one for diamonds), with its odds.
 */
export function DailyPanel({ state, send, onClose, last }: { state: GameState; rev: number; send: (c: Command) => void; onClose: () => void; last: { seg: number; at: number } | null }) {
  const t = useT();
  const dir = useDir();
  const ta = { textAlign: dir.textAlign, writingDirection: dir.writingDirection } as const;
  const pay = tierDef(state.tier).pay;
  const g = giftReady(state);
  const wait = spinIn(state);
  const known = state.daily.now >= 0;
  // the wheel turns to where the last spin landed
  const turn = useRef(new Animated.Value(0)).current;
  const [shown, setShown] = useState(-1);
  useEffect(() => {
    if (!last || last.seg === shown) return;
    let a = 0;
    for (let i = 0; i < last.seg; i++) a += WHEEL[i].weight;
    a += WHEEL[last.seg].weight / 2;
    // (the slice's middle under the pointer at the top, after four turns)
    const to = 4 + 1 - a / WHEEL_TOTAL;
    turn.setValue(0);
    Animated.timing(turn, { toValue: to, duration: 2200, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start(() => setShown(last.seg));
  }, [last, shown, turn]);
  const rotate = turn.interpolate({ inputRange: [0, 10], outputRange: ['0deg', '3600deg'] });
  const won = last && last.seg === shown ? WHEEL[last.seg] : null;
  return (
    <Sheet title={t('daily.title')} subtitle={t('daily.sub')} onClose={onClose}>
      <Text style={[styles.section, ta]}>{t('daily.gift')}</Text>
      <View style={[styles.days, { flexDirection: dir.row }]} testID="daily-days">
        {DAILY_GIFTS.map((gift, i) => {
          const day = i + 1;
          const done = g.ready ? day < g.day : day <= state.daily.streak;
          const today = g.ready && day === g.day;
          return (
            <View key={i} style={[styles.day, done && styles.dayDone, today && styles.dayToday]}>
              <Text style={styles.dayNum}>{t('daily.day', { n: day })}</Text>
              <Icon name={GIFT_ICON[gift.kind]} size={22} />
              <Text style={[styles.dayText, gift.kind === 'boost' && { fontSize: 10 }]} numberOfLines={2}>
                {giftText(t, gift, pay)}
              </Text>
            </View>
          );
        })}
      </View>
      <Pressable
        disabled={!g.ready}
        onPress={() => send({ type: 'claimGift' })}
        style={({ pressed }) => [styles.btn, !g.ready && styles.btnOff, pressed && { opacity: 0.85 }]}
        accessibilityRole="button"
        testID="daily-claim"
      >
        <Text style={styles.btnText}>{g.ready ? t('daily.claim', { n: g.day }) : known ? t('daily.tomorrow') : t('daily.noClock')}</Text>
      </Pressable>
      <Text style={[styles.dim, ta]}>{t('daily.streakInfo')}</Text>

      <Text style={[styles.section, ta]}>{t('daily.wheel')}</Text>
      <View style={[styles.wheelRow, { flexDirection: dir.row }]}>
        <View style={styles.wheelBox} testID="daily-wheel">
          <Animated.View style={{ transform: [{ rotate }] }}>
            <Wheel size={170} pay={pay} />
          </Animated.View>
          <View style={styles.pointer} />
        </View>
        <View style={{ flex: 1, gap: 8 }}>
          {won ? (
            <View style={[styles.won, { flexDirection: dir.row }]} testID="daily-won">
              <Icon name={GIFT_ICON[won.kind]} size={22} />
              <Text style={styles.wonText}>{t('daily.won', { what: giftText(t, won, pay) })}</Text>
            </View>
          ) : null}
          <Pressable
            disabled={!known || wait > 0}
            onPress={() => send({ type: 'spinWheel', paid: false })}
            style={({ pressed }) => [styles.btn, (!known || wait > 0) && styles.btnOff, pressed && { opacity: 0.85 }]}
            accessibilityRole="button"
            testID="daily-spin"
          >
            <Text style={styles.btnText}>{wait > 0 ? t('daily.next', { t: hm(wait) }) : t('daily.spin')}</Text>
          </Pressable>
          <Pressable
            disabled={!known || state.diamonds < SPIN_GEMS}
            onPress={() => send({ type: 'spinWheel', paid: true })}
            style={({ pressed }) => [styles.btnSoft, { flexDirection: dir.row }, (!known || state.diamonds < SPIN_GEMS) && { opacity: 0.45 }, pressed && { opacity: 0.8 }]}
            accessibilityRole="button"
            testID="daily-spin-paid"
          >
            <Icon name="diamond" size={16} />
            <Text style={styles.btnSoftText}>{t('daily.spinPaid', { n: SPIN_GEMS })}</Text>
          </Pressable>
        </View>
      </View>
      <Text style={[styles.section, ta]}>{t('daily.odds')}</Text>
      <View style={styles.odds} testID="daily-odds">
        {WHEEL.map((w, i) => (
          <View key={i} style={[styles.odd, { flexDirection: dir.row }]}>
            <View style={[styles.swatch, { backgroundColor: SEG_COLORS[i % SEG_COLORS.length] }]} />
            <Icon name={GIFT_ICON[w.kind]} size={16} />
            <Text style={[styles.oddText, ta, { flex: 1 }]}>{giftText(t, w, pay)}</Text>
            <Text style={styles.oddPct}>{Math.round((w.weight / WHEEL_TOTAL) * 100)}%</Text>
          </View>
        ))}
      </View>
    </Sheet>
  );
}


const styles = StyleSheet.create({
  section: { fontSize: 15, fontWeight: '800', color: C.text, marginTop: 6, marginBottom: 8 },
  days: { gap: 5, marginBottom: 10 },
  day: { flex: 1, alignItems: 'center', gap: 3, paddingVertical: 7, borderRadius: 12, backgroundColor: 'rgba(15,23,42,0.05)' },
  dayDone: { opacity: 0.45 },
  dayToday: { backgroundColor: '#fef3c7', borderWidth: 2, borderColor: '#f5b301' },
  dayNum: { fontSize: 10, fontWeight: '800', color: C.textDim },
  dayText: { fontSize: 11, fontWeight: '800', color: C.text, textAlign: 'center' },
  btn: { alignItems: 'center', paddingVertical: 11, borderRadius: 14, backgroundColor: C.green },
  btnOff: { backgroundColor: 'rgba(15,23,42,0.15)' },
  btnText: { color: '#ffffff', fontWeight: '800', fontSize: 15 },
  btnSoft: { alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 9, borderRadius: 14, backgroundColor: 'rgba(99,102,241,0.12)' },
  btnSoftText: { color: C.text, fontWeight: '800', fontSize: 14 },
  dim: { fontSize: 12, color: C.textDim, marginTop: 6, marginBottom: 6 },
  wheelRow: { alignItems: 'center', gap: 14 },
  wheelBox: { width: 170, height: 178, alignItems: 'center', justifyContent: 'flex-end' },
  pointer: { position: 'absolute', top: 0, width: 0, height: 0, borderLeftWidth: 9, borderRightWidth: 9, borderTopWidth: 16, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: C.red },
  won: { alignItems: 'center', gap: 8, padding: 10, borderRadius: 14, backgroundColor: '#dcfce7' },
  wonText: { fontSize: 15, fontWeight: '800', color: C.text, flexShrink: 1 },
  odds: { gap: 4, marginBottom: 8 },
  odd: { alignItems: 'center', gap: 8, paddingVertical: 4, paddingHorizontal: 8, borderRadius: 10, backgroundColor: 'rgba(15,23,42,0.03)' },
  swatch: { width: 12, height: 12, borderRadius: 3 },
  oddText: { fontSize: 13, color: C.text, fontWeight: '600' },
  slice: { position: 'absolute', width: 44, height: 30, alignItems: 'center', justifyContent: 'center' },
  sliceText: { fontSize: 10, fontWeight: '800', color: '#1e293b' },
  oddPct: { fontSize: 13, fontWeight: '800', color: C.text, fontVariant: ['tabular-nums'] },
});
