import { useState } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { FRANCHISE, cityOf } from '../data/franchise';
import { TIERS } from '../data/buildings';
import { useT } from '../i18n';
import { usePoll } from '../render/useSimulation';
import { type Big } from '../sim/big';
import { formatBig } from '../sim/format';
import { canOpenBranch, nextTrophyAt, trophiesFor } from '../sim/franchise';
import type { Command, GameState } from '../sim/game/types';
import { tapFeedback } from '../audio/sound';
import { Overlay } from './Overlay';
import { gold, panel } from './theme';

// Opening a branch in a new city (prestige): the card in the upgrades screen, the "are you sure"
// card, and the chip under the rating that shows the city and the trophies won so far.

export interface BranchView {
  can: boolean;
  gain: number;
  trophies: number;
  city: number;
  earned: Big;
  nextAt: Big;
}

export const readBranch = (s: GameState): BranchView => ({
  can: canOpenBranch(s),
  gain: trophiesFor(s.stats.earned),
  trophies: s.trophies,
  city: s.city,
  earned: s.stats.earned,
  nextAt: nextTrophyAt(s.stats.earned),
});

const pct = (trophies: number) => `+${Math.round(trophies * FRANCHISE.pricePerTrophy * 100)}%`;

/** The card at the top of the building tab: what the next city brings, and the button. */
export function BranchCard({ view, onOpen }: { view: BranchView; onOpen: () => void }) {
  const t = useT();
  const next = cityOf(view.city + 1);
  return (
    <View style={styles.card}>
      <View style={styles.line}>
        <Text style={styles.icon}>{'🏙️'}</Text>
        <Text style={styles.title}>{t('branch.title')}</Text>
      </View>
      <View style={styles.line}>
        <Text style={styles.label}>{t('branch.next')}</Text>
        <Text style={styles.value}>{t(`city.${next.id}`)}</Text>
      </View>
      <View style={styles.line}>
        <Text style={styles.label}>{t('branch.gain')}</Text>
        <Text style={styles.value}>{`🏆 +${view.gain}`}</Text>
        <Text style={styles.label}>{t('branch.bonus')}</Text>
        <Text style={styles.good}>{pct(view.trophies + view.gain)}</Text>
      </View>
      {/* What one more trophy takes: the "just a bit more" pull. */}
      <View style={styles.line}>
        <Text style={styles.small}>{t('branch.nextTrophy')}</Text>
        <Text style={styles.smallStrong}>{formatBig(view.nextAt)}</Text>
        <Text style={styles.small}>{`(${formatBig(view.earned)})`}</Text>
      </View>
      {view.can ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            tapFeedback();
            onOpen();
          }}
          style={styles.button}
        >
          <Text style={styles.buttonText}>{t('branch.open')}</Text>
        </Pressable>
      ) : (
        <Text style={styles.needs}>{`${t('branch.needs')} ${t(`tier.${TIERS[FRANCHISE.minBuilding]!.id}`)}`}</Text>
      )}
    </View>
  );
}

/** "Are you sure?": what stays, what starts over. Two buttons, no accidents. */
export function BranchConfirm({ gameRef, onCommand, onClose }: { gameRef: { current: GameState | null }; onCommand: (cmd: Command) => void; onClose: () => void }) {
  const t = useT();
  const view = usePoll(gameRef, readBranch, 2);
  const [sure, setSure] = useState(false);
  if (!view) return null;
  const next = cityOf(view.city + 1);
  return (
    <Overlay onClose={onClose} card={styles.dialog}>
      <Text style={styles.dialogTitle}>{`🏙️ ${t(`city.${next.id}`)}`}</Text>
      <Text style={styles.dialogBig}>{`🏆 +${view.gain}  ·  ${t('branch.bonus')} ${pct(view.trophies + view.gain)}`}</Text>
      <Text style={styles.keep}>{`✓ ${t('branch.keep')}`}</Text>
      <Text style={styles.reset}>{`↺ ${t('branch.reset')}`}</Text>
      <View style={styles.row}>
        <Pressable accessibilityRole="button" onPress={onClose} style={[styles.button, styles.buttonOff]}>
          <Text style={styles.buttonText}>{t('branch.cancel')}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={!view.can}
          onPress={() => {
            tapFeedback();
            // Two taps: the first one asks again, in words.
            if (!sure) {
              setSure(true);
              return;
            }
            onCommand({ type: 'branch' });
            onClose();
          }}
          style={[styles.button, sure && styles.buttonSure]}
        >
          <Text style={styles.buttonText}>{sure ? t('branch.yes') : t('branch.open')}</Text>
        </Pressable>
      </View>
      {sure && <Text style={styles.warn}>{t('branch.confirm')}</Text>}
    </Overlay>
  );
}

const readChip = (s: GameState) => ({ city: s.city, trophies: s.trophies });

/** Under the rating: the city and the trophies (once there is a second branch or a trophy). */
export function CityChip({ gameRef, style }: { gameRef: { current: GameState | null }; style?: StyleProp<ViewStyle> }) {
  const t = useT();
  const v = usePoll(gameRef, readChip, 1);
  if (!v || (v.city === 0 && v.trophies === 0)) return null;
  return (
    <View style={[styles.chip, style]} pointerEvents="none">
      <Text style={styles.chipText}>{`🏆 ${v.trophies}`}</Text>
      <Text style={styles.chipCity}>{t(`city.${cityOf(v.city).id}`)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#3A1E46', borderRadius: 14, padding: 10, gap: 4, borderWidth: 2, borderColor: gold },
  line: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  row: { flexDirection: 'row', gap: 10, justifyContent: 'center', marginTop: 6 },
  icon: { fontSize: 20 },
  title: { color: '#FFE9A8', fontSize: 15, fontWeight: '900' },
  label: { color: '#C9B3D6', fontSize: 12, fontWeight: '700' },
  value: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  good: { color: '#7EE08F', fontSize: 13, fontWeight: '900' },
  small: { color: '#B9A3C6', fontSize: 11, fontWeight: '700' },
  smallStrong: { color: '#FFE27A', fontSize: 11, fontWeight: '900' },
  needs: { color: '#E8C76A', fontSize: 12, fontWeight: '800', marginTop: 4 },
  button: { alignSelf: 'flex-start', marginTop: 4, height: 38, paddingHorizontal: 18, borderRadius: 14, backgroundColor: '#2F7FE0', borderWidth: 2, borderColor: '#A8D4FF', justifyContent: 'center' },
  buttonOff: { backgroundColor: '#4A3A52', borderColor: '#6A5A72' },
  buttonSure: { backgroundColor: '#E5483B', borderColor: '#FFB0A8' },
  buttonText: { color: '#FFFFFF', fontWeight: '900', fontSize: 14 },
  dialog: { width: 420, maxWidth: '92%', backgroundColor: panel.bg, borderRadius: 18, borderWidth: 2.5, borderColor: gold, padding: 16, gap: 6, alignItems: 'center' },
  dialogTitle: { color: '#FFE9A8', fontSize: 22, fontWeight: '900' },
  dialogBig: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  keep: { color: '#7EE08F', fontSize: 13, fontWeight: '800', textAlign: 'center' },
  reset: { color: '#F2B6A8', fontSize: 13, fontWeight: '800', textAlign: 'center' },
  warn: { color: '#FFD23F', fontSize: 12, fontWeight: '800', textAlign: 'center' },
  chip: { position: 'absolute', flexDirection: 'row', alignItems: 'center', gap: 6, height: 24, paddingHorizontal: 10, borderRadius: 12, backgroundColor: 'rgba(42,21,48,0.88)', borderWidth: 1.5, borderColor: gold },
  chipText: { color: '#FFE27A', fontSize: 12, fontWeight: '900' },
  chipCity: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
});
