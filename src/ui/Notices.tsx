import { Pressable, StyleSheet, Text, View } from 'react-native';
import { NAMES } from '../data/names';
import { STAFF } from '../data/staff';
import { isRTL, useT } from '../i18n';
import { usePoll } from '../render/useSimulation';
import { formatBig } from '../sim/format';
import type { Command, GameState, Notice } from '../sim/game/types';
import { useSettings } from '../store/settings';
import { gold, panel } from './theme';

interface Item {
  notice: Notice;
  /** The worker it is about, if still here. */
  name: number;
  wage: string;
}

function read(s: GameState): Item[] {
  return s.notices
    .filter((n) => n.kind !== 'payday' || n.unpaid > 0)
    .map((n) => {
      const st = 'staff' in n ? s.staff.find((x) => x.id === n.staff) : undefined;
      return {
        notice: n,
        name: n.kind === 'quit' ? n.name : (st?.name ?? 0),
        wage: st ? formatBig(n.kind === 'trial' ? st.wage.mul(STAFF.signingDays).ceil() : st.wage) : '',
      };
    });
}

/** Decisions (raises, trial shifts) and news (someone quit, payday bounced), top middle. */
export function Notices({ gameRef, onCommand }: { gameRef: { current: GameState | null }; onCommand: (cmd: Command) => void }) {
  const t = useT();
  const lang = useSettings((s) => s.lang);
  const items = usePoll(gameRef, read, 4) ?? [];
  if (items.length === 0) return null;
  const answer = (id: number, yes: boolean) => onCommand({ type: 'answer', notice: id, yes });
  return (
    <View style={styles.stack}>
      {items.slice(-3).map(({ notice: n, name, wage }) => (
        <View key={n.id} style={[styles.card, (n.kind === 'quit' || n.kind === 'payday') && styles.bad]}>
          {(n.kind === 'raise' || n.kind === 'trial' || n.kind === 'quit') && <Text style={styles.name}>{NAMES[name]![lang]}</Text>}
          {n.kind === 'raise' && (
            <>
              <Text style={styles.text}>{t('ui.raiseAsk')}</Text>
              <Text style={styles.num}>{wage}</Text>
              <Text style={styles.arrow}>{isRTL(lang) ? '←' : '→'}</Text>
              <Text style={styles.numNew}>{formatBig(n.wage)}</Text>
              <Pressable onPress={() => answer(n.id, true)} style={[styles.button, styles.go]}>
                <Text style={styles.buttonText}>{t('ui.approve')}</Text>
              </Pressable>
              <Pressable onPress={() => answer(n.id, false)} style={styles.button}>
                <Text style={styles.buttonText}>{t('ui.refuse')}</Text>
              </Pressable>
            </>
          )}
          {n.kind === 'trial' && (
            <>
              <Text style={styles.text}>{t('ui.trialOver')}</Text>
              <Pressable onPress={() => answer(n.id, true)} style={[styles.button, styles.go]}>
                <Text style={styles.buttonText}>{t('ui.keep')}</Text>
              </Pressable>
              <Text style={styles.num}>{wage}</Text>
              <Pressable onPress={() => answer(n.id, false)} style={styles.button}>
                <Text style={styles.buttonText}>{t('ui.letGo')}</Text>
              </Pressable>
            </>
          )}
          {n.kind === 'quit' && (
            <>
              <Text style={styles.text}>{t('ui.quitNotice')}</Text>
              <Text style={styles.text}>{t(n.unpaid ? 'ui.unpaidReason' : 'ui.moraleReason')}</Text>
            </>
          )}
          {n.kind === 'inspector' && (
            <>
              <Text style={styles.name}>{`🕵️ ${t('guide.revealed')}`}</Text>
              <Text style={styles.text}>{`"${t(n.verdict)}"`}</Text>
            </>
          )}
          {n.kind === 'guide' && <Text style={styles.name}>{`📕 ${t('guide.newEdition')}`}</Text>}
          {n.kind === 'payday' && (
            <>
              <Text style={styles.text}>{t('ui.unpaidWarn')}</Text>
              <Text style={styles.num}>{n.unpaid}</Text>
            </>
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { position: 'absolute', top: 56, left: 0, right: 0, alignItems: 'center', gap: 6, pointerEvents: 'box-none' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: panel.bg,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: gold,
    paddingHorizontal: 12,
    paddingVertical: 6,
    boxShadow: '0px 4px 0px #120818',
  },
  bad: { borderColor: '#FF6A5E' },
  name: { color: '#FFE9A8', fontWeight: '900', fontSize: 14 },
  text: { color: '#E8D7F0', fontWeight: '700', fontSize: 13 },
  num: { color: '#FFF4E3', fontWeight: '900', fontSize: 13 },
  numNew: { color: '#7EE08F', fontWeight: '900', fontSize: 13 },
  arrow: { color: '#C9B3D6', fontWeight: '900', fontSize: 13 },
  button: { height: 34, paddingHorizontal: 12, borderRadius: 11, backgroundColor: '#4A2550', borderWidth: 1.5, borderColor: '#8A5BB8', justifyContent: 'center' },
  go: { backgroundColor: '#35B957', borderColor: '#B9F5A8' },
  buttonText: { color: '#FFFFFF', fontWeight: '900', fontSize: 13 },
});
