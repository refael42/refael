import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useT } from '../i18n';
import { usePoll } from '../render/useSimulation';
import { CustomerState, type Command, type GameState } from '../sim/game/types';
import { tapFeedback } from '../audio/sound';
import { gold, textShadow } from './theme';

// The sign on the door (owner M38: "close the restaurant to guests after service, so upgrading
// is comfortable"). Tap: closed to new guests, the ones inside finish; tap again to open. While
// closed a note above it says how many are still inside, then that the place is empty.

const SIZE = 58;

/** Closed or not, and the guests still inside (everyone not already on the way out). */
const readSign = (s: GameState) => ({
  closed: s.closed,
  inside: s.closed ? s.customers.filter((c) => c.state !== CustomerState.Leaving).length : 0,
});

interface Props {
  gameRef: { current: GameState | null };
  onCommand: (cmd: Command) => void;
  style: object;
}

export function ClosedSign({ gameRef, onCommand, style }: Props) {
  const t = useT();
  const sign = usePoll(gameRef, readSign, 4);
  if (!sign) return null;
  const { closed, inside } = sign;
  return (
    <View style={[styles.wrap, style]} pointerEvents="box-none">
      {closed && (
        <View style={styles.note} pointerEvents="none">
          <Text style={styles.noteText}>{inside > 0 ? t('closed.inside').replace('{n}', String(inside)) : t('closed.empty')}</Text>
        </View>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={closed ? 'door sign: shut' : 'door sign: open'}
        onPress={() => {
          tapFeedback();
          onCommand({ type: 'close', closed: !closed });
        }}
        hitSlop={8}
        style={[styles.button, closed && styles.closed]}
      >
        <Text style={styles.icon}>{closed ? '🔒' : '🚪'}</Text>
        <Text style={styles.label}>{closed ? t('closed.closed') : t('closed.open')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', alignItems: 'flex-start' },
  button: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    backgroundColor: '#1F6B3A',
    borderWidth: 3,
    borderColor: gold,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0px 3px 0px #120818',
  },
  closed: { backgroundColor: '#9A2430', borderColor: '#FFF4E3' },
  icon: { fontSize: 20, marginTop: 2 },
  label: { color: '#FFF4E3', fontSize: 10, fontWeight: '900', marginTop: -1, ...textShadow('#120818', 1, 0) },
  note: {
    position: 'absolute',
    bottom: SIZE + 6,
    start: 0,
    width: 190,
    backgroundColor: 'rgba(32,12,38,0.92)',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E85A68',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  noteText: { color: '#FFF4E3', fontSize: 12, fontWeight: '800', lineHeight: 16 },
});
