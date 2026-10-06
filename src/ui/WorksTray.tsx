import { Image, PixelRatio, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useT } from '../i18n';
import { spriteIcon } from '../render/icons';
import { upgradeIcon } from '../render/upgradeIcons';
import { usePoll } from '../render/useSimulation';
import { tierOf } from '../sim/economy/upgrades';
import { crewCount, gemsToFinish } from '../sim/economy/works';
import { formatDuration } from '../sim/format';
import type { Command, GameState } from '../sim/game/types';
import { gold } from './theme';
import { tapFeedback } from '../audio/sound';

// What the crews are building right now (owner request: big upgrades take time, and you can
// pay to finish): one line per job with its time left, and a gem button that finishes it.

const ICON_PX = 26;

const readWorks = (s: GameState) => ({
  gems: s.gems,
  crews: crewCount(s.perks),
  works: s.works.map((w) => ({ id: w.id, item: w.item, level: w.level, left: w.left, share: w.total > 0 ? 1 - w.left / w.total : 1 })),
});

export function WorksTray({ gameRef, onCommand, style }: { gameRef: { current: GameState | null }; onCommand: (cmd: Command) => void; style?: StyleProp<ViewStyle> }) {
  const t = useT();
  const data = usePoll(gameRef, readWorks, 4);
  if (!data || data.works.length === 0) return null;
  return (
    <View style={[styles.tray, style]}>
      <Text style={styles.title}>{`🔨 ${t('ui.works')} ${data.works.length}/${data.crews}`}</Text>
      {data.works.map((w) => {
        const gems = gemsToFinish(w.left);
        const can = data.gems >= gems;
        return (
          <View key={w.id} style={styles.row}>
            <Image source={{ uri: spriteIcon(upgradeIcon(w.item, tierOf(w.level)), Math.round(ICON_PX * PixelRatio.get())) }} style={styles.icon} />
            <View style={styles.body}>
              <Text style={styles.time}>{formatDuration(w.left)}</Text>
              <View style={styles.bar}>
                <View style={[styles.fill, { width: `${Math.min(100, w.share * 100)}%` }]} />
              </View>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: !can }}
              disabled={!can}
              hitSlop={6}
              onPress={() => {
                tapFeedback();
                onCommand({ type: 'finish', work: w.id });
              }}
              style={[styles.finish, !can && styles.finishOff]}
            >
              <Text style={styles.finishText}>{`💎${gems}`}</Text>
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  tray: {
    position: 'absolute',
    width: 150,
    padding: 6,
    gap: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(42,21,48,0.88)',
    borderWidth: 1.5,
    borderColor: gold,
  },
  title: { color: '#FFE9A8', fontSize: 11, fontWeight: '900' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  icon: { width: ICON_PX, height: ICON_PX },
  body: { flex: 1, gap: 2 },
  time: { color: '#FFD23F', fontSize: 12, fontWeight: '900' },
  bar: { height: 5, borderRadius: 3, backgroundColor: '#1C0E22', overflow: 'hidden' },
  fill: { height: 5, backgroundColor: '#F4C542' },
  finish: { height: 24, minWidth: 40, paddingHorizontal: 5, borderRadius: 8, backgroundColor: '#3E6FE0', borderWidth: 1.2, borderColor: '#BFD4FF', alignItems: 'center', justifyContent: 'center' },
  finishOff: { backgroundColor: '#4A4258', borderColor: '#6A6278' },
  finishText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900' },
});
