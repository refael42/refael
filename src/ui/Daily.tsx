import { SIDE, SideButton } from './SideButton';
import { hudIcon } from '../render/icons';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle, PixelRatio } from 'react-native';
import { DAILY } from '../data/retention';
import { useT } from '../i18n';
import { usePoll } from '../render/useSimulation';
import type { Command, GameState } from '../sim/game/types';
import { dailyToday } from '../sim/retention';
import { tapFeedback } from '../audio/sound';
import { Overlay } from './Overlay';
import { gold, panel } from './theme';
import { GameIcon, IconText } from './GameIcon';

// The daily gift (owner request: "addictive"): seven days in a row, each better than the last;
// miss a day and it starts over. The dates are the phone's own (the sim has no clock).

const pad = (n: number) => String(n).padStart(2, '0');
const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Today's and yesterday's local dates, "YYYY-MM-DD". */
export function dateKeys(now = new Date()): { today: string; yesterday: string } {
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  return { today: dayKey(now), yesterday: dayKey(y) };
}

const readDaily = (s: GameState) => {
  const { today, yesterday } = dateKeys();
  return { ...dailyToday(s.daily, today, yesterday), streak: s.daily.streak };
};

/** Is today's gift waiting? (For opening the calendar by itself once a day.) */
export const dailyReady = (s: GameState): boolean => readDaily(s).ready;

/** The gift button next to the stage button, bouncing while today's gift waits. */
export function DailyButton({ gameRef, onPress, style }: { gameRef: { current: GameState | null }; onPress: () => void; style: StyleProp<ViewStyle> }) {
  const d = usePoll(gameRef, readDaily, 1);
  if (!d?.ready) return null;
  return <SideButton label="daily gift" icon={hudIcon('hudGift', Math.round(SIDE.icon * PixelRatio.get()))} ready onPress={onPress} style={[styles.buttonWrap, style]} />;
}

export function DailyPanel({ gameRef, onCommand, onClose }: { gameRef: { current: GameState | null }; onCommand: (cmd: Command) => void; onClose: () => void }) {
  const t = useT();
  const d = usePoll(gameRef, readDaily, 2);
  if (!d) return null;
  return (
    <Overlay onClose={onClose} card={styles.card}>
      <IconText icon="iconGift" size={22} textStyle={styles.title}>{`${t('daily.title')}`}</IconText>
      <Text style={styles.sub}>{t('daily.sub')}</Text>
      <View style={styles.days}>
        {DAILY.rewards.map((r, i) => {
          const day = i + 1;
          const done = d.ready ? day < d.day : day <= d.day;
          const now = d.ready && day === d.day;
          return (
            <View key={day} style={[styles.day, done && styles.dayDone, now && styles.dayNow, day === DAILY.rewards.length && styles.dayBig]}>
              <Text style={styles.dayLabel}>{`${t('daily.day')} ${day}`}</Text>
              <GameIcon name={r.gems > 0 ? 'hudGem' : 'hudCoin'} size={28} />
              {r.minutes > 0 && <Text style={styles.dayValue}>{`${r.minutes} ${t('daily.min')}`}</Text>}
              {r.gems > 0 && <Text style={styles.dayValue}>{`+${r.gems}`}</Text>}
              {r.boostMult && <IconText icon="iconBolt" size={14} textStyle={styles.dayValue}>{`x${r.boostMult}`}</IconText>}
              {done && <Text style={styles.check}>{'✓'}</Text>}
            </View>
          );
        })}
      </View>
      {d.ready ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            tapFeedback();
            onCommand({ type: 'daily', ...dateKeys() });
            onClose();
          }}
          style={styles.take}
        >
          <Text style={styles.takeText}>{t('daily.take')}</Text>
        </Pressable>
      ) : (
        <Text style={styles.tomorrow}>{t('daily.tomorrow')}</Text>
      )}
    </Overlay>
  );
}

const styles = StyleSheet.create({
  buttonWrap: { position: 'absolute' },
  card: { width: 600, maxWidth: '96%', backgroundColor: panel.bg, borderRadius: 20, borderWidth: 2.5, borderColor: gold, padding: 14, gap: 8, alignItems: 'center' },
  title: { color: '#FFE9A8', fontSize: 21, fontWeight: '900' },
  sub: { color: '#C9B3D6', fontSize: 12, fontWeight: '700', textAlign: 'center' },
  days: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' },
  day: { width: 74, paddingVertical: 6, borderRadius: 12, backgroundColor: panel.row, alignItems: 'center', gap: 1, borderWidth: 2, borderColor: 'transparent' },
  dayDone: { opacity: 0.55 },
  dayNow: { borderColor: '#FFE27A', backgroundColor: '#5A3A1A' },
  dayBig: { width: 92 },
  dayLabel: { color: '#C9B3D6', fontSize: 11, fontWeight: '800' },
  dayValue: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  check: { position: 'absolute', top: 2, end: 6, color: '#7EE08F', fontSize: 14, fontWeight: '900' },
  take: { height: 42, paddingHorizontal: 26, borderRadius: 16, backgroundColor: '#35B957', borderWidth: 2, borderColor: '#B9F5A8', justifyContent: 'center', boxShadow: '0px 3px 0px #17602A' },
  takeText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  tomorrow: { color: '#E8C76A', fontSize: 13, fontWeight: '800' },
});
