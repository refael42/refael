import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';
import { useT } from '../i18n';
import { formatNumber } from '../sim/format';
import { Ev } from '../sim/game/events';
import type { GameState } from '../sim/game/types';
import { gold } from './theme';

// A short note at the top for the special moments: a VIP walks in, a VIP's bonus, a present on
// the sidewalk and what was inside. The sim's events are read a few times a second.

const SHOW_MS = 3500;
const TYPES: readonly number[] = [Ev.VipArrives, Ev.Vip, Ev.GiftAppears, Ev.Gift];

interface Toast {
  id: number;
  type: number;
  coins: number;
  gems: number;
}

export function EventToast({ gameRef, style }: { gameRef: { current: GameState | null }; style?: StyleProp<ViewStyle> }) {
  const t = useT();
  const [toast, setToast] = useState<Toast | null>(null);
  const last = useRef(Math.max(0, ...(gameRef.current?.events.map((e) => e.id) ?? [0])));
  useEffect(() => {
    const timer = setInterval(() => {
      const s = gameRef.current;
      if (!s) return;
      for (const e of s.events) {
        if (e.id <= last.current) continue;
        last.current = e.id;
        if (TYPES.includes(e.type)) setToast({ id: e.id, type: e.type, coins: e.a, gems: e.b });
      }
    }, 200);
    return () => clearInterval(timer);
  }, [gameRef]);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast((x) => (x?.id === toast.id ? null : x)), SHOW_MS);
    return () => clearTimeout(id);
  }, [toast]);
  if (!toast) return null;
  const reward = [toast.coins > 0 ? `+${formatNumber(toast.coins)} 🪙` : '', toast.gems > 0 ? `+${toast.gems} 💎` : ''].filter(Boolean).join('  ');
  const text =
    toast.type === Ev.VipArrives ? t('toast.vip') : toast.type === Ev.Vip ? `${t('toast.vipPaid')} ${reward}` : toast.type === Ev.GiftAppears ? t('toast.gift') : `${t('toast.giftOpened')} ${reward}`;
  return (
    <View style={[styles.wrap, style]} pointerEvents="none">
      <Animated.View key={toast.id} entering={FadeInDown.duration(220)} exiting={FadeOut.duration(200)} style={[styles.toast, toast.type === Ev.VipArrives && styles.vip]}>
        <Text style={styles.text}>{text}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  toast: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, backgroundColor: 'rgba(42,21,48,0.92)', borderWidth: 2, borderColor: gold },
  vip: { borderColor: '#FFE27A', backgroundColor: 'rgba(90,60,10,0.92)' },
  text: { color: '#FFF4E3', fontSize: 14, fontWeight: '900' },
});
