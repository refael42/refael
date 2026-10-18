import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { useT } from '../i18n';
import { usePoll } from '../render/useSimulation';
import { CustomerState, type Command, type GameState } from '../sim/game/types';
import { tapFeedback } from '../audio/sound';
import { gold } from './theme';

// The sign on the door (owner M38: "close the restaurant to guests after service, so upgrading
// is comfortable"). Tap: closed to new guests, the ones inside finish; tap again to open. While
// closed a note above it says how many are still inside, then that the place is empty.
// It looks like the sign that hangs on a shop's door (owner: "like the sign on a grocery store
// that just says OPEN or CLOSED"): a board on a string from a nail; tapped, it swings and flips.

const SIZE = 58;
const BOARD = { width: 78, height: 34 } as const;
/** The whole sign's width (the board and a little room for the swing). */
export const SIGN_WIDTH = BOARD.width + 6;

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
  const closed = sign?.closed ?? false;
  // The side showing: it turns over halfway through the flip.
  const [shown, setShown] = useState(closed);
  const swing = useSharedValue(0);
  const flip = useSharedValue(1);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      setShown(closed);
      return;
    }
    flip.value = withSequence(withTiming(0, { duration: 130 }), withTiming(1, { duration: 170 }));
    swing.value = withSequence(withTiming(closed ? 14 : -14, { duration: 140 }), withSpring(0, { damping: 3, stiffness: 90 }));
    const id = setTimeout(() => setShown(closed), 130);
    return () => clearTimeout(id);
  }, [closed, flip, swing]);
  const hang = useAnimatedStyle(() => ({ transform: [{ rotate: `${swing.value}deg` }] }));
  const board = useAnimatedStyle(() => ({ transform: [{ scaleX: Math.max(0.02, flip.value) }] }));
  if (!sign) return null;
  const { inside } = sign;
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
        style={styles.button}
      >
        <Animated.View style={[styles.hang, hang]}>
          {/* The string from the nail to the board's two top corners, and the nail. */}
          <View style={[styles.string, styles.stringLeft]} />
          <View style={[styles.string, styles.stringRight]} />
          <View style={styles.nail} />
          <Animated.View style={[styles.board, shown ? styles.boardClosed : styles.boardOpen, board]}>
            <View style={[styles.inner, shown ? styles.innerClosed : styles.innerOpen]}>
              <Text style={[styles.word, shown ? styles.wordClosed : styles.wordOpen]} numberOfLines={1}>
                {shown ? 'CLOSED' : 'OPEN'}
              </Text>
            </View>
          </Animated.View>
        </Animated.View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', alignItems: 'flex-start' },
  button: { width: BOARD.width + 6, height: SIZE, alignItems: 'center' },
  // Swings about the nail at the top.
  hang: { width: BOARD.width + 6, height: SIZE, alignItems: 'center', transformOrigin: 'top center' },
  nail: { position: 'absolute', top: 1, width: 9, height: 9, borderRadius: 4.5, backgroundColor: gold, borderWidth: 2, borderColor: '#5A3A08' },
  // From the nail (top middle) to 30 px either side, 16 px down: 34 px long, 62° off upright.
  string: { position: 'absolute', top: -1, width: 3, height: 34, backgroundColor: '#E2C98E', borderRadius: 1.5, borderWidth: 0.5, borderColor: '#5A3A08' },
  stringLeft: { start: (BOARD.width + 6) / 2 - 15 - 1.25, transform: [{ rotate: '62deg' }] },
  stringRight: { end: (BOARD.width + 6) / 2 - 15 - 1.25, transform: [{ rotate: '-62deg' }] },
  board: {
    position: 'absolute',
    top: SIZE - BOARD.height - 2,
    width: BOARD.width,
    height: BOARD.height,
    borderRadius: 7,
    padding: 3,
    borderWidth: 2,
    borderColor: '#2A1530',
    boxShadow: '0px 3px 0px rgba(18,8,24,0.75)',
  },
  boardOpen: { backgroundColor: '#FFFFFF' },
  boardClosed: { backgroundColor: '#D7192E' },
  inner: { flex: 1, borderRadius: 4, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  innerOpen: { borderColor: '#1F8F45' },
  innerClosed: { borderColor: '#FFFFFF' },
  word: { fontSize: 15, fontWeight: '900', letterSpacing: 1.5, includeFontPadding: false },
  wordOpen: { color: '#1F8F45' },
  wordClosed: { color: '#FFFFFF', fontSize: 13.5, letterSpacing: 0.8 },
  // Under the sign (it hangs in the top bar).
  note: {
    position: 'absolute',
    top: SIZE + 4,
    left: (SIGN_WIDTH - 190) / 2,
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
