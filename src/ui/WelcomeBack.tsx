import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { OFFLINE } from '../data/economy';
import { useT } from '../i18n';
import type { Big } from '../sim/big';
import { formatBig } from '../sim/format';
import type { OfflineEarnings } from '../sim/offline';
import { gold, panel } from './theme';

interface Props {
  earnings: OfflineEarnings;
  manager?: string;
  /** Called with the multiplier the player ended up with (1, or the ad bonus). */
  onCollect: (multiplier: number) => void;
}

const ROLL_MS = 1100;
/** The count starts once the card has popped in (it used to run during the pop, and jerk). */
const ROLL_DELAY_MS = 380;
/** At most this many number updates a second: the text re-renders only when it changes. */
const ROLL_FPS = 24;
const FAKE_AD_SECONDS = 3;

/**
 * Counts up from 0 with an ease-out, after a short wait. A modal shown once per session; the
 * updates are capped and skipped when the shown text does not change.
 */
function useRollingNumber(target: Big): string {
  const [text, setText] = useState(formatBig(0));
  // The amount is a new object on every render: the count follows its value, not the object
  // (following the object restarted it from 0 on every frame: the owner's "it jerks").
  const key = target.toString();
  const latest = useRef(target);
  latest.current = target;
  useEffect(() => {
    const target = latest.current;
    let start = 0;
    let shown = '';
    let raf = 0;
    let last = 0;
    const tick = (now: number) => {
      if (!start) start = now;
      const p = Math.min(1, (now - start) / ROLL_MS);
      if (p >= 1 || now - last >= 1000 / ROLL_FPS) {
        last = now;
        const e = 1 - (1 - p) ** 3;
        const next = formatBig(p >= 1 ? target : target.mul(e).floor());
        if (next !== shown) {
          shown = next;
          setText(next);
        }
      }
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    const wait = setTimeout(() => (raf = requestAnimationFrame(tick)), ROLL_DELAY_MS);
    return () => {
      clearTimeout(wait);
      cancelAnimationFrame(raf);
    };
  }, [key]);
  return text;
}

function Duration({ seconds }: { seconds: number }) {
  const t = useT();
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  // Numbers and Hebrew units in separate Texts: mixing them in one string breaks bidi order.
  return (
    <View style={styles.duration}>
      {h > 0 && <Text style={styles.durationNum}>{h}</Text>}
      {h > 0 && <Text style={styles.durationUnit}>{t('ui.hours')}</Text>}
      <Text style={styles.durationNum}>{m}</Text>
      <Text style={styles.durationUnit}>{t('ui.minutes')}</Text>
    </View>
  );
}

export function WelcomeBack({ earnings, manager, onCollect }: Props) {
  const t = useT();
  const [multiplier, setMultiplier] = useState(1);
  const [adLeft, setAdLeft] = useState(0);
  const amount = useRollingNumber(earnings.coins.mul(multiplier));
  const pop = useSharedValue(0.6);
  useEffect(() => {
    pop.value = withSpring(1, { damping: 9, stiffness: 160 });
  }, [pop]);
  const popStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));

  useEffect(() => {
    if (adLeft <= 0) return;
    const id = setTimeout(() => {
      if (adLeft === 1) {
        setMultiplier(OFFLINE.adMultiplier);
        pop.value = withSequence(withTiming(1.12, { duration: 120 }), withSpring(1, { damping: 7 }));
      }
      setAdLeft(adLeft - 1);
    }, 1000);
    return () => clearTimeout(id);
  }, [adLeft, pop]);

  const capped = earnings.paidSeconds < earnings.awaySeconds;
  return (
    <View style={styles.backdrop}>
      <Animated.View style={[styles.card, popStyle]}>
        <Text style={styles.title}>{t('ui.welcome')}</Text>
        {/* The name on a line of its own: no mixing of Hebrew and Latin in one string. */}
        {manager && <Text style={styles.manager}>{manager}</Text>}
        <View style={styles.awayRow}>
          <Text style={styles.label}>{t('ui.away')}</Text>
          <Duration seconds={earnings.awaySeconds} />
        </View>
        {capped && <Text style={styles.note}>{t('ui.awayCapped')}</Text>}
        <Text style={styles.label}>{t('ui.staffEarned')}</Text>
        <View style={styles.amountRow}>
          <View style={styles.coin} />
          <Text style={styles.amount}>{amount}</Text>
        </View>
        {adLeft > 0 ? (
          <View style={styles.ad}>
            <Text style={styles.adText}>{t('ui.adPlaying')}</Text>
            <Text style={styles.adCount}>{adLeft}</Text>
          </View>
        ) : (
          <View style={styles.buttons}>
            {multiplier === 1 && (
              <Pressable accessibilityRole="button" onPress={() => setAdLeft(FAKE_AD_SECONDS)} style={[styles.button, styles.adButton]}>
                <Text style={styles.buttonText}>{t('ui.adDouble')}</Text>
              </Pressable>
            )}
            <Pressable accessibilityRole="button" onPress={() => onCollect(multiplier)} style={[styles.button, styles.collect]}>
              <Text style={styles.buttonText}>{t('ui.collect')}</Text>
            </Pressable>
          </View>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(14,6,18,0.62)', alignItems: 'center', justifyContent: 'center' },
  card: {
    width: 380,
    maxWidth: '90%',
    backgroundColor: panel.bg,
    borderRadius: 22,
    borderWidth: 3,
    borderColor: gold,
    paddingHorizontal: 20,
    paddingVertical: 16,
    alignItems: 'center',
    gap: 6,
    boxShadow: '0px 6px 0px #120818',
  },
  title: { color: '#FFE9A8', fontSize: 24, fontWeight: '900' },
  manager: { color: '#FFFFFF', fontSize: 18, fontWeight: '900', marginTop: -4 },
  awayRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { color: '#E8D7F0', fontSize: 14, fontWeight: '700', textAlign: 'center' },
  note: { color: '#C9B3D6', fontSize: 12, fontWeight: '600' },
  duration: { flexDirection: 'row', alignItems: 'baseline', gap: 2 },
  durationNum: { color: gold, fontSize: 16, fontWeight: '900' },
  durationUnit: { color: gold, fontSize: 13, fontWeight: '800', marginEnd: 4 },
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 4 },
  coin: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#FFC21A', borderWidth: 3, borderColor: '#9A6A00' },
  // Same-width digits and a fixed box: the coin and the card stay still while it counts.
  amount: { color: '#FFFFFF', fontSize: 38, fontWeight: '900', minWidth: 150, textAlign: 'center', fontVariant: ['tabular-nums'] },
  buttons: { flexDirection: 'row', gap: 10, marginTop: 6 },
  button: { height: 48, paddingHorizontal: 18, borderRadius: 16, justifyContent: 'center', borderWidth: 2 },
  adButton: { backgroundColor: '#6A2C8F', borderColor: '#C9A0FF', boxShadow: '0px 3px 0px #2E1240' },
  collect: { backgroundColor: '#35B957', borderColor: '#B9F5A8', boxShadow: '0px 3px 0px #17602A' },
  buttonText: { color: '#FFFFFF', fontWeight: '900', fontSize: 16 },
  ad: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 48, marginTop: 6 },
  adText: { color: '#C9B3D6', fontSize: 13, fontWeight: '700' },
  adCount: { color: '#FFE9A8', fontSize: 22, fontWeight: '900' },
});
