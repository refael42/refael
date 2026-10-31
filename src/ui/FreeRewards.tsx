import { useState } from 'react';
import { Image, PixelRatio, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { getAds, watchAd } from '../ads';
import { tapFeedback } from '../audio/sound';
import { ADS, type AdReward } from '../data/ads';
import { useT } from '../i18n';
import { spriteIcon } from '../render/icons';
import { usePoll } from '../render/useSimulation';
import { adBoostLeft, adOpen, adsLeft } from '../sim/ads';
import { localDay } from '../sim/season';
import type { Command, GameState } from '../sim/game/types';
import { IconText } from './GameIcon';
import { Overlay } from './Overlay';
import { SIDE, SideButton } from './SideButton';
import { panel, textShadow } from './theme';

// Rewarded ads (owner: idea 12): a round "free" button in the events row, and a card with what
// an ad gives: x2 income for a while, a few gems, a spin of the wheel (the welcome-back card
// doubles what the staff earned while away). The player chooses to watch; each has a daily limit.

const tv = (px: number) => spriteIcon('tvIcon', Math.round(px * PixelRatio.get()));
const today = () => localDay(Date.now(), new Date().getTimezoneOffset());
const mmss = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;

const SHOWN: readonly AdReward[] = ['boost', 'gems', 'spin'];

const readChip = (s: GameState) => {
  const day = today();
  return { open: SHOWN.filter((r) => adOpen(s, r, day)).length, boost: Math.ceil(adBoostLeft(s)) };
};

/** The round button (only when there are ads to show). */
export function FreeChip({ gameRef, onPress, style }: { gameRef: { current: GameState | null }; onPress: () => void; style: StyleProp<ViewStyle> }) {
  const t = useT();
  const d = usePoll(gameRef, readChip, 1);
  if (!d || !getAds()) return null;
  return <SideButton label="free" icon={tv(SIDE.icon)} caption={d.boost > 0 ? `x${ADS.boostMult} ${mmss(d.boost)}` : t('ads.free')} ready={d.open > 0} badge={d.open > 0 ? d.open : undefined} onPress={onPress} style={style} />;
}

/** Free rewards waiting (for the events button's badge). */
export const freeWaiting = (s: GameState): number => (getAds() ? SHOWN.filter((r) => adOpen(s, r, today())).length : 0);

const readPanel = (s: GameState) => {
  const day = today();
  return {
    rows: SHOWN.map((r) => `${adOpen(s, r, day) ? 1 : 0}:${adsLeft(s, r, day)}`).join('|'),
    boost: Math.ceil(adBoostLeft(s)),
    otherBoost: s.time < s.boost.until && s.boost.mult > ADS.boostMult,
  };
};

export function FreePanel({ gameRef, onCommand, onClose }: { gameRef: { current: GameState | null }; onCommand: (cmd: Command) => void; onClose: () => void }) {
  const t = useT();
  const d = usePoll(gameRef, readPanel, 2);
  const [busy, setBusy] = useState(false);
  if (!d) return null;
  const rows = d.rows.split('|').map((r) => r.split(':').map(Number) as [number, number]);
  const watch = async (reward: AdReward) => {
    if (busy) return;
    tapFeedback();
    setBusy(true);
    const ok = await watchAd();
    setBusy(false);
    if (ok) onCommand({ type: 'adReward', reward, day: today() });
  };
  return (
    <Overlay onClose={onClose} card={styles.card}>
      <View style={styles.header}>
        <Image source={{ uri: tv(44) }} style={styles.headerIcon} />
        <View style={styles.headerText}>
          <Text style={styles.title}>{t('ads.title')}</Text>
          <Text style={styles.sub}>{t('ads.sub')}</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="close" onPress={onClose} hitSlop={10} style={styles.close}>
          <Text style={styles.closeText}>{'✕'}</Text>
        </Pressable>
      </View>
      <View style={styles.rows}>
        {SHOWN.map((reward, i) => {
          const [open, left] = rows[i]!;
          const note =
            reward === 'boost' && d.otherBoost ? t('ads.boostOther') : reward === 'boost' && d.boost > 0 ? t('ads.boostOn').replace('{t}', mmss(d.boost)) : t('ads.left').replace('{n}', String(left));
          return (
            <View key={reward} style={styles.row}>
              <IconText icon={reward === 'boost' ? 'iconBolt' : reward === 'gems' ? 'hudGem' : 'iconDice'} size={22} textStyle={styles.rowTitle}>
                {t(`ads.reward.${reward}`).replace('{n}', String(reward === 'gems' ? ADS.gems : ADS.boostMinutes))}
              </IconText>
              <Text style={styles.note}>{note}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel={`watch-${reward}`} disabled={!open || busy} onPress={() => void watch(reward)} style={[styles.watch, (!open || busy) && styles.off]}>
                <Text style={styles.watchText}>{t('ads.watch')}</Text>
              </Pressable>
            </View>
          );
        })}
      </View>
    </Overlay>
  );
}

const styles = StyleSheet.create({
  card: { width: 460, maxWidth: '94%', maxHeight: '94%', backgroundColor: panel.bg, borderRadius: 20, borderWidth: 2.5, borderColor: '#9A6AC8', overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#6A2C8F' },
  headerIcon: { width: 44, height: 44 },
  headerText: { flex: 1 },
  title: { color: '#FFFFFF', fontSize: 20, fontWeight: '900', ...textShadow('#2A1530', 2, 2) },
  sub: { color: '#F2E4FF', fontSize: 12.5, fontWeight: '800' },
  close: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(42,21,48,0.55)', alignItems: 'center', justifyContent: 'center' },
  closeText: { color: '#FFE9A8', fontSize: 16, fontWeight: '900' },
  rows: { padding: 12, gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: panel.row, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8 },
  rowTitle: { color: '#FFF4E3', fontSize: 15, fontWeight: '900' },
  note: { flex: 1, color: '#C9B3D6', fontSize: 12, fontWeight: '700', textAlign: 'right' },
  watch: { height: 36, paddingHorizontal: 14, borderRadius: 18, backgroundColor: '#35B957', borderWidth: 1.5, borderColor: '#B9F5A8', justifyContent: 'center' },
  off: { backgroundColor: '#5A4A62', borderColor: '#7A6A82' },
  watchText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
});
