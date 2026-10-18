import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useT } from '../i18n';
import { usePoll } from '../render/useSimulation';
import { kitchenAdvice, type KitchenAdvice } from '../sim/game/jam';
import type { GameState } from '../sim/game/types';
import { tapFeedback } from '../audio/sound';
import { gold, textShadow } from './theme';

// The kitchen can't keep up (owner M40: "waiters stand around while there is lots of work"): a
// note above the big buttons says what helps and opens the right page. ✕ hides it for a while.

/** How long the ✕ keeps it away (phone clock, ms). */
const SNOOZE_MS = 10 * 60 * 1000;

const readAdvice = (s: GameState): KitchenAdvice | null => kitchenAdvice(s);

interface Props {
  gameRef: { current: GameState | null };
  onAct: (advice: KitchenAdvice) => void;
  style: object;
}

export function KitchenHint({ gameRef, onAct, style }: Props) {
  const t = useT();
  const advice = usePoll(gameRef, readAdvice, 1);
  const [snoozed, setSnoozed] = useState(0);
  if (!advice || Date.now() < snoozed) return null;
  return (
    <View style={[styles.wrap, style]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="kitchen hint"
        onPress={() => {
          tapFeedback();
          onAct(advice);
        }}
        style={styles.body}
      >
        <Text style={styles.title}>{`🍳 ${t('jam.title')}`}</Text>
        <Text style={styles.text}>{`${t(`jam.${advice}`)} ›`}</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="hide kitchen hint" onPress={() => setSnoozed(Date.now() + SNOOZE_MS)} hitSlop={8} style={styles.x}>
        <Text style={styles.xText}>✕</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: 330, backgroundColor: 'rgba(32,12,38,0.94)', borderRadius: 14, borderWidth: 2, borderColor: gold, paddingStart: 10, paddingEnd: 6, paddingVertical: 6 },
  body: { flexShrink: 1 },
  title: { color: '#FFE9A8', fontSize: 13, fontWeight: '900', ...textShadow('#120818', 1, 0) },
  text: { color: '#FFF4E3', fontSize: 12, fontWeight: '800' },
  x: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#4A2550', alignItems: 'center', justifyContent: 'center' },
  xText: { color: '#FFE9A8', fontSize: 11, fontWeight: '900' },
});
