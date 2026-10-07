import { useEffect } from 'react';
import { Image, PixelRatio, Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { tapFeedback } from '../audio/sound';
import { FESTIVAL, FESTIVAL_THEMES, type FestivalReward } from '../data/events';
import { useT } from '../i18n';
import { hudIcon, spriteIcon } from '../render/icons';
import { DISH_ICONS, type SpriteName } from '../render/sprites';
import { usePoll } from '../render/useSimulation';
import { festivalEnds, rewardCoins, stepsReached, themeIndex } from '../sim/festival';
import { formatBig } from '../sim/format';
import type { Command, GameState } from '../sim/game/types';
import { Overlay, scrollFill } from './Overlay';
import { gold, panel, textShadow } from './theme';

// The food festival (owner request: events and FOMO). A chip under the rating counts down the
// days and glows when a prize waits; the panel shows the reward track up to the trophy that
// only this festival gives, and the trophies collected so far.

/** How often the phone's clock is told to the sim (which festival is on). Cheap: nothing happens unless it changed. */
const CLOCK_EVERY_MS = 5000;

/** Sends the phone's clock to the sim now and then, so it knows which festival is on. */
export function useFestivalClock(onCommand: (cmd: Command) => void, on: boolean): void {
  useEffect(() => {
    if (!on) return;
    const tell = () => onCommand({ type: 'festival', now: Date.now() });
    tell();
    const timer = setInterval(tell, CLOCK_EVERY_MS);
    return () => clearInterval(timer);
  }, [onCommand, on]);
}

const pad = (n: number) => String(n).padStart(2, '0');

/** "2d 5h" (units in the player's language), "5:04:09" under a day. */
export function countdown(seconds: number, t: (k: string) => string): string {
  const s = Math.max(0, Math.floor(seconds));
  const days = Math.floor(s / 86400);
  if (days > 0) return `${days}${t('time.d')} ${Math.floor((s % 86400) / 3600)}${t('time.h')}`;
  return `${Math.floor(s / 3600)}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

const readFestival = (s: GameState) => {
  const f = s.festival;
  if (f.id < 0) return null;
  const reached = stepsReached(f);
  return {
    id: f.id,
    theme: themeIndex(f.id),
    points: f.points,
    claimed: f.claimed,
    reached,
    secondsLeft: Math.max(0, Math.ceil((festivalEnds(f.id) - Date.now()) / 1000)),
    trophies: f.trophies.join(','),
    // Coin prizes in coins right now, joined (a string compares cheaply between polls).
    coins: FESTIVAL.track.map((step) => formatBig(rewardCoins(s, step.reward))).join('|'),
  };
};

const dishIcon = (theme: number, px: number) => spriteIcon(DISH_ICONS[FESTIVAL_THEMES[theme]!.dish]! as SpriteName, Math.round(px * PixelRatio.get()));
const trophyIcon = (theme: number, px: number) => spriteIcon(`trophy${theme}` as SpriteName, Math.round(px * PixelRatio.get()));
const gemUri = (px: number) => hudIcon('hudGem', Math.round(px * PixelRatio.get()));
const coinUri = (px: number) => hudIcon('hudCoin', Math.round(px * PixelRatio.get()));

/** The festival's name ("Fries festival"). */
const titleOf = (t: (k: string) => string, theme: number) => t('fest.title').replace('{dish}', t(`fest.name.${FESTIVAL_THEMES[theme]!.id}`));

/** Under the rating: the festival dish, how far along the next prize is, and the time left. */
export function FestivalChip({ gameRef, onPress, style }: { gameRef: { current: GameState | null }; onPress: () => void; style: StyleProp<ViewStyle> }) {
  const t = useT();
  const d = usePoll(gameRef, readFestival, 1);
  const pulse = useSharedValue(0);
  const ready = d !== null && d.reached > d.claimed;
  useEffect(() => {
    pulse.value = ready ? withRepeat(withSequence(withTiming(1, { duration: 450 }), withTiming(0, { duration: 450 })), -1) : 0;
  }, [pulse, ready]);
  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 + pulse.value * 0.07 }] }));
  if (!d) return null;
  const hurry = d.secondsLeft < FESTIVAL.hurryHours * 3600;
  const next = FESTIVAL.track[d.reached];
  const prev = d.reached > 0 ? FESTIVAL.track[d.reached - 1]!.points : 0;
  const share = next ? Math.min(1, (d.points - prev) / (next.points - prev)) : 1;
  return (
    <Animated.View style={[styles.chipWrap, style, pulseStyle]}>
      <Pressable accessibilityRole="button" accessibilityLabel="festival" onPress={onPress} hitSlop={6} style={[styles.chip, hurry && styles.chipHurry, ready && styles.chipReady]}>
        <Image source={{ uri: dishIcon(d.theme, 26) }} style={styles.chipIcon} />
        <View style={styles.chipBody}>
          <Text numberOfLines={1} style={styles.chipTitle}>{ready ? `🎁 ${t('fest.ready')}` : `🎪 ${t('fest.chip')}`}</Text>
          <View style={styles.chipTrack}>
            <View style={[styles.chipFill, { width: `${share * 100}%` }]} />
          </View>
          <Text numberOfLines={1} style={[styles.chipTime, hurry && styles.chipTimeHurry]}>{hurry ? `⏰ ${countdown(d.secondsLeft, t)}` : `⏱ ${countdown(d.secondsLeft, t)}`}</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

/** A prize's icon and short words. */
function Prize({ reward, coins, theme, big }: { reward: FestivalReward; coins: string; theme: number; big: boolean }) {
  const t = useT();
  const size = big ? 60 : 28;
  switch (reward.kind) {
    case 'coins':
      return (
        <>
          <Image source={{ uri: coinUri(size) }} style={{ width: size, height: size }} />
          <Text style={styles.prizeText}>{coins}</Text>
        </>
      );
    case 'gems':
      return (
        <>
          <Image source={{ uri: gemUri(size) }} style={{ width: size, height: size }} />
          <Text style={styles.prizeText}>{`+${reward.gems}`}</Text>
        </>
      );
    case 'spins':
      return (
        <>
          <Text style={[styles.prizeEmoji, { fontSize: size * 0.8 }]}>{'🎡'}</Text>
          <Text style={styles.prizeText}>{`x${reward.spins}`}</Text>
        </>
      );
    case 'boost':
      return (
        <>
          <Text style={[styles.prizeEmoji, { fontSize: size * 0.8 }]}>{'⚡'}</Text>
          <Text style={styles.prizeText}>{`x${reward.mult} ${reward.minutes}${t('fest.min')}`}</Text>
        </>
      );
    case 'trophy':
      return (
        <>
          <Image source={{ uri: trophyIcon(theme, size) }} style={{ width: size, height: size }} />
          <Text style={styles.prizeText}>{`+${reward.gems}💎`}</Text>
        </>
      );
  }
}

export function FestivalPanel({ gameRef, onCommand, onClose }: { gameRef: { current: GameState | null }; onCommand: (cmd: Command) => void; onClose: () => void }) {
  const t = useT();
  const d = usePoll(gameRef, readFestival, 2);
  if (!d) return null;
  const theme = FESTIVAL_THEMES[d.theme]!;
  const coins = d.coins.split('|');
  const won = d.trophies === '' ? [] : d.trophies.split(',').map(Number);
  const hurry = d.secondsLeft < FESTIVAL.hurryHours * 3600;
  const last = FESTIVAL.track.length - 1;
  const take = () => {
    tapFeedback();
    onCommand({ type: 'festivalClaim' });
  };
  const nextTheme = themeIndex(d.id + 1);
  return (
    <Overlay onClose={onClose} card={[styles.card, { borderColor: theme.color }]}>
      <View style={[styles.header, { backgroundColor: theme.color }]}>
        <Image source={{ uri: dishIcon(d.theme, 40) }} style={styles.headerIcon} />
        <View style={styles.headerText}>
          <Text style={styles.title}>{`🎪 ${titleOf(t, d.theme)}`}</Text>
          <Text style={[styles.ends, hurry && styles.endsHurry]}>{hurry ? `⏰ ${t('fest.lastHours')} ${countdown(d.secondsLeft, t)}` : `${t('fest.endsIn')} ${countdown(d.secondsLeft, t)}`}</Text>
        </View>
        <View style={styles.pointsBox}>
          <Text style={styles.pointsValue}>{d.points}</Text>
          <Text style={styles.pointsLabel}>{t('fest.points')}</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="close" onPress={onClose} hitSlop={10} style={styles.close}>
          <Text style={styles.closeText}>{'✕'}</Text>
        </Pressable>
      </View>
      <Text style={styles.howTo}>{t('fest.howTo').replace('{dish}', t(`fest.name.${theme.id}`))}</Text>
      <ScrollView horizontal style={scrollFill} contentContainerStyle={styles.track}>
        {FESTIVAL.track.map((step, i) => {
          const done = i < d.claimed;
          const ready = !done && i < d.reached;
          const big = i === last;
          return (
            <View key={i} style={[styles.step, big && styles.stepBig, ready && styles.stepReady, done && styles.stepDone, big && { borderColor: theme.accent }]}>
              {big && <Text numberOfLines={1} style={[styles.only, { backgroundColor: theme.accent }]}>{t('fest.only')}</Text>}
              <Prize reward={step.reward} coins={coins[i] ?? ''} theme={d.theme} big={big} />
              {ready ? (
                <Pressable accessibilityRole="button" disabled={i !== d.claimed} onPress={take} style={[styles.take, i !== d.claimed && styles.takeLater]}>
                  <Text style={styles.takeText}>{t('fest.take')}</Text>
                </Pressable>
              ) : (
                <Text style={[styles.need, done && styles.needDone]}>{done ? '✓' : `${step.points}`}</Text>
              )}
            </View>
          );
        })}
      </ScrollView>
      {d.claimed >= FESTIVAL.track.length && <Text style={styles.allDone}>{t('fest.done')}</Text>}
      <View style={styles.footer}>
        <Text style={styles.footerLabel}>{`🏆 ${t('fest.collection')} ${won.length}/${FESTIVAL_THEMES.length}`}</Text>
        <View style={styles.cups}>
          {FESTIVAL_THEMES.map((_, i) => (
            <Image key={i} source={{ uri: trophyIcon(i, 26) }} style={[styles.cup, !won.includes(i) && styles.cupMissing]} />
          ))}
        </View>
        <Text style={styles.footerBonus}>
          {won.length > 0 ? t('fest.bonus').replace('{n}', String(Math.round(won.length * FESTIVAL.trophyBonus * 100))) : t('fest.trophyDesc').replace('{n}', String(Math.round(FESTIVAL.trophyBonus * 100)))}
        </Text>
        <Text style={styles.footerNext}>{t('fest.next').replace('{dish}', t(`fest.name.${FESTIVAL_THEMES[nextTheme]!.id}`))}</Text>
      </View>
    </Overlay>
  );
}

const styles = StyleSheet.create({
  chipWrap: { position: 'absolute' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingStart: 4, paddingEnd: 8, height: 44, borderRadius: 14, backgroundColor: 'rgba(42,21,48,0.93)', borderWidth: 2, borderColor: gold, boxShadow: '0px 2px 0px rgba(18,8,24,0.85)' },
  chipHurry: { borderColor: '#FF5A4A', backgroundColor: 'rgba(80,16,22,0.94)' },
  chipReady: { borderColor: '#7EE08F', backgroundColor: 'rgba(22,70,36,0.95)' },
  chipIcon: { width: 32, height: 32 },
  chipBody: { width: 86, gap: 2 },
  chipTitle: { color: '#FFE9A8', fontSize: 11.5, fontWeight: '900' },
  chipTrack: { height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.18)', overflow: 'hidden' },
  chipFill: { height: '100%', borderRadius: 3, backgroundColor: '#FFB547' },
  chipTime: { color: '#FFFFFF', fontSize: 10.5, fontWeight: '800' },
  chipTimeHurry: { color: '#FFB0A6' },
  card: { width: 680, maxWidth: '96%', maxHeight: '94%', backgroundColor: panel.bg, borderRadius: 20, borderWidth: 2.5, overflow: 'hidden', paddingBottom: 10 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 8 },
  headerIcon: { width: 44, height: 44 },
  headerText: { flex: 1 },
  title: { color: '#FFFFFF', fontSize: 20, fontWeight: '900', ...textShadow('#2A1530', 2, 2) },
  ends: { color: '#FFF4E3', fontSize: 13, fontWeight: '800', ...textShadow('#2A1530', 1, 1) },
  endsHurry: { color: '#FFF0A0' },
  pointsBox: { alignItems: 'center', backgroundColor: 'rgba(42,21,48,0.55)', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 2 },
  pointsValue: { color: '#FFE27A', fontSize: 20, fontWeight: '900' },
  pointsLabel: { color: '#FFF4E3', fontSize: 10.5, fontWeight: '800' },
  close: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(42,21,48,0.6)', alignItems: 'center', justifyContent: 'center' },
  closeText: { color: '#FFE9A8', fontSize: 16, fontWeight: '900' },
  howTo: { color: '#C9B3D6', fontSize: 11.5, fontWeight: '700', textAlign: 'center', paddingHorizontal: 12, paddingTop: 6 },
  track: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, paddingHorizontal: 12, paddingTop: 16, paddingBottom: 4 },
  step: { width: 66, minHeight: 96, paddingVertical: 6, borderRadius: 12, backgroundColor: panel.row, alignItems: 'center', justifyContent: 'space-between', gap: 2, borderWidth: 2, borderColor: 'transparent' },
  stepBig: { width: 124, minHeight: 124, backgroundColor: '#4A2252' },
  stepReady: { borderColor: '#7EE08F', backgroundColor: '#24502F' },
  stepDone: { opacity: 0.5 },
  only: { position: 'absolute', top: -11, paddingHorizontal: 6, borderRadius: 8, overflow: 'hidden', color: '#2A1530', fontSize: 10, fontWeight: '900', maxWidth: 132 },
  prizeEmoji: { lineHeight: 30 },
  prizeText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900', textAlign: 'center' },
  need: { color: '#E8C76A', fontSize: 12, fontWeight: '900' },
  needDone: { color: '#7EE08F', fontSize: 15 },
  take: { height: 26, paddingHorizontal: 10, borderRadius: 13, backgroundColor: '#35B957', borderWidth: 1.5, borderColor: '#B9F5A8', justifyContent: 'center' },
  takeLater: { opacity: 0.5 },
  takeText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  allDone: { color: '#7EE08F', fontSize: 13, fontWeight: '900', textAlign: 'center', marginTop: 4 },
  footer: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 12, paddingTop: 8 },
  footerLabel: { color: '#FFE9A8', fontSize: 13, fontWeight: '900' },
  cups: { flexDirection: 'row', gap: 2 },
  cup: { width: 26, height: 26 },
  cupMissing: { opacity: 0.22 },
  footerBonus: { color: '#7EE08F', fontSize: 12, fontWeight: '800' },
  footerNext: { color: '#B9A3C6', fontSize: 11.5, fontWeight: '700' },
});
