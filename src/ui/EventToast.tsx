import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';
import { useT } from '../i18n';
import { formatNumber } from '../sim/format';
import { Ev } from '../sim/game/events';
import type { GameState } from '../sim/game/types';
import { gold } from './theme';
import { IconText } from './GameIcon';
import type { HudIcon } from '../render/art/hudArt';
import { FESTIVAL_THEMES } from '../data/events';
import { INGREDIENTS } from '../data/supply';

// A short note at the top for the special moments: a VIP walks in, a VIP's bonus, a present on
// the sidewalk and what was inside, a festival starting or a festival prize ready, the tourist
// bus, talent points from a source with no card of its own. The sim's events are read a few times a second.

const SHOW_MS = 4200;
const TYPES: readonly number[] = [Ev.VipArrives, Ev.Vip, Ev.GiftAppears, Ev.Gift, Ev.FestivalStart, Ev.FestivalStep, Ev.Bus, Ev.Weekend, Ev.DeliveryOrder, Ev.DeliveryCancel, Ev.RareApplicant, Ev.TalentPoints, Ev.SeasonStart, Ev.SeasonTier, Ev.SeasonGold, Ev.StockOut];

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
        // Only the first delivery order gets a note (they come all the time after that).
        if (e.type === Ev.DeliveryOrder && e.c !== 1) continue;
        // Talent points a card already shows (the wheel, a chef level, the daily gift...) need no note.
        if (e.type === Ev.TalentPoints && e.b === 1) continue;
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
  const festive = toast.type === Ev.FestivalStart || toast.type === Ev.FestivalStep || toast.type === Ev.Bus || toast.type === Ev.Weekend || toast.type === Ev.DeliveryOrder || toast.type === Ev.DeliveryCancel || toast.type === Ev.RareApplicant || toast.type === Ev.SeasonStart || toast.type === Ev.SeasonTier || toast.type === Ev.SeasonGold || toast.type === Ev.StockOut;
  // The reward after the words, with the coin and gem icons (owner M41: no emojis).
  const rewards: { icon: HudIcon; text: string }[] = festive ? [] : toast.type === Ev.TalentPoints ? [{ icon: 'iconTalent', text: `+${toast.coins}` }] : [
    ...(toast.coins > 0 ? [{ icon: 'hudCoin' as const, text: `+${formatNumber(toast.coins)}` }] : []),
    ...(toast.gems > 0 ? [{ icon: 'hudGem' as const, text: `+${toast.gems}` }] : []),
  ];
  const text = textOf(toast, '', t).trim();
  return (
    <View style={[styles.wrap, style]} pointerEvents="none">
      <Animated.View key={toast.id} entering={FadeInDown.duration(220)} exiting={FadeOut.duration(200)} style={[styles.toast, toast.type === Ev.VipArrives && styles.vip, festive && styles.festive]}>
        <View style={styles.line}>
          <Text style={styles.text}>{text}</Text>
          {rewards.map((r) => (
            <IconText key={r.icon} icon={r.icon} size={16} textStyle={styles.text}>
              {r.text}
            </IconText>
          ))}
        </View>
      </Animated.View>
    </View>
  );
}

function textOf(toast: Toast, reward: string, t: (k: string) => string): string {
  switch (toast.type) {
    case Ev.VipArrives:
      return t('toast.vip');
    case Ev.Vip:
      return `${t('toast.vipPaid')} ${reward}`;
    case Ev.GiftAppears:
      return t('toast.gift');
    case Ev.FestivalStart: {
      // a = the theme, b = prizes of the last festival paid now.
      const dish = t(`fest.name.${FESTIVAL_THEMES[toast.coins]?.id ?? 'fries'}`);
      return `${t('toast.festival').replace('{dish}', dish)}${toast.gems > 0 ? ` ${t('toast.festivalPaid')}` : ''}`;
    }
    case Ev.FestivalStep:
      return t('toast.festivalStep');
    case Ev.Bus:
      return t('toast.bus');
    case Ev.DeliveryOrder:
      return t('toast.firstDelivery');
    case Ev.DeliveryCancel:
      return t('toast.deliveryCancel');
    case Ev.RareApplicant:
      return t(toast.coins === 3 ? 'toast.legendary' : 'toast.epic');
    case Ev.Weekend:
      return t('toast.weekend').replace('{n}', String(toast.coins));
    case Ev.TalentPoints:
      return t('toast.talentPoints');
    // The season pass (a = tiers reached; a new season: b = prizes of the last one paid now).
    case Ev.SeasonTier:
      return t('toast.seasonTier').replace('{n}', String(toast.coins));
    case Ev.SeasonStart:
      return `${t('toast.season')}${toast.gems > 0 ? ` ${t('toast.seasonPaid')}` : ''}`;
    case Ev.SeasonGold:
      return t('toast.seasonGold');
    // The storeroom ran out of an ingredient (a = which, src/data/supply.ts).
    case Ev.StockOut:
      return t('toast.stockOut').replace('{i}', t(`supply.ingr.${INGREDIENTS[toast.coins] ?? 'veg'}`));
    default:
      return `${t('toast.giftOpened')} ${reward}`;
  }
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  toast: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, backgroundColor: 'rgba(42,21,48,0.92)', borderWidth: 2, borderColor: gold },
  vip: { borderColor: '#FFE27A', backgroundColor: 'rgba(90,60,10,0.92)' },
  festive: { borderColor: '#FF9A5A', backgroundColor: 'rgba(110,30,40,0.94)' },
  line: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, justifyContent: 'center' },
  text: { color: '#FFF4E3', fontSize: 14, fontWeight: '900' },
});
