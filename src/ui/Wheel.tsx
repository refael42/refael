import { useEffect, useRef, useState } from 'react';
import { Image, PixelRatio, Pressable, StyleSheet, Text, useWindowDimensions, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming, type SharedValue } from 'react-native-reanimated';
import { buzz, playSound, tapFeedback } from '../audio/sound';
import { WHEEL, WHEEL_SEGMENTS, type WheelPrize } from '../data/wheel';
import { useT } from '../i18n';
import { POINTER_BOUNDS, WHEEL_ART, WHEEL_BOUNDS } from '../render/art/wheelArt';
import { hudIcon, splashIcon, wheelIcon } from '../render/icons';
import { usePoll } from '../render/useSimulation';
import { formatBig } from '../sim/format';
import type { Command, GameState } from '../sim/game/types';
import { freeIn, prizeCoins, spinCost } from '../sim/wheel';
import { isOpen } from '../sim/unlocks';
import { TIERS } from '../data/buildings';
import { UNLOCK_TIER } from '../data/unlocks';
import { Overlay } from './Overlay';
import { gold, panel, textShadow } from './theme';

// The lucky wheel (owner request: "a cool wheel of fortune"). The sim decides where it stops
// the moment it is spun; this screen only makes the stop exciting: a long ease-out spin with a
// click (and a pointer flick) at every peg, chasing bulbs, and the prize card when it settles.

const SEG = 360 / WHEEL_SEGMENTS.length;
const ART = WHEEL_BOUNDS[2] - WHEEL_BOUNDS[0];
const POINTER = POINTER_BOUNDS[2] - POINTER_BOUNDS[0];
const POINTER_MID = (POINTER_BOUNDS[1] + POINTER_BOUNDS[3]) / 2;
/** The pointer swings on its jewel, this far above its middle (art units). */
const POINTER_PIVOT = -7;
/** Haptic ticks at most this often (a phone buzzing 25 times a second feels broken). */
const BUZZ_GAP_MS = 90;

type Phase = 'idle' | 'starting' | 'spinning' | 'won';

const pad = (n: number) => String(n).padStart(2, '0');
const clock = (seconds: number) => `${Math.floor(seconds / 3600)}:${pad(Math.floor((seconds % 3600) / 60))}:${pad(seconds % 60)}`;

/** The face's turn that puts segment `seg` under the pointer (0..360). */
const restAngle = (seg: number) => (360 - seg * SEG) % 360;

const readWheel = (s: GameState) => {
  const now = Date.now();
  return {
    cost: spinCost(s, now),
    secondsLeft: Math.ceil(freeIn(s.wheel, now) / 1000),
    tokens: s.wheel.tokens,
    prize: s.wheel.prize,
    spins: s.wheel.spins,
    gems: s.gems,
    // Coin prizes in coins right now, joined (a string compares cheaply between polls).
    coins: WHEEL_SEGMENTS.map((seg) => formatBig(prizeCoins(s, seg.prize))).join('|'),
  };
};

/** Is there a spin to take (free, saved, or a prize waiting)? For the button's glow. */
const readButton = (s: GameState) => {
  const r = readWheel(s);
  return { ready: r.cost === 'free' || r.cost === 'token' || r.prize >= 0, secondsLeft: r.secondsLeft, locked: !isOpen(s, 'wheel') };
};

/** How long the "opens with..." note stays up after tapping the locked wheel. */
const LOCKED_NOTE_MS = 2600;

/** The short label on a segment. */
function shortLabel(prize: WheelPrize, coins: string, t: (k: string) => string): string {
  if (prize.kind === 'coins') return coins;
  if (prize.kind === 'gems') return `+${prize.gems}`;
  if (prize.kind === 'boost') return `x${prize.mult}`;
  return t('wheel.jackpot');
}

/** The prize in words, for the card. */
function longLabel(prize: WheelPrize, coins: string, t: (k: string) => string): string {
  if (prize.kind === 'coins') return `🪙 ${coins}`;
  if (prize.kind === 'gems') return `💎 +${prize.gems}`;
  if (prize.kind === 'boost') return `x${prize.mult} · ${t('wheel.boost').replace('{m}', String(prize.minutes))}`;
  return `🪙 ${coins}  +  💎 ${prize.gems}`;
}

/** The button by the stage button: a small turning wheel while a spin waits, else the time left. */
export function WheelButton({ gameRef, onPress, style }: { gameRef: { current: GameState | null }; onPress: () => void; style: StyleProp<ViewStyle> }) {
  const t = useT();
  const d = usePoll(gameRef, readButton, 1);
  const turn = useSharedValue(0);
  const ready = d?.ready ?? false;
  useEffect(() => {
    turn.value = ready ? withRepeat(withTiming(360, { duration: 5000, easing: Easing.linear }), -1, false) : 0;
  }, [turn, ready]);
  const turnStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value}deg` }] }));
  const [note, setNote] = useState(false);
  useEffect(() => {
    if (!note) return;
    const id = setTimeout(() => setNote(false), LOCKED_NOTE_MS);
    return () => clearTimeout(id);
  }, [note]);
  if (!d) return null;
  const px = Math.round(BUTTON_FACE * PixelRatio.get());
  // Not open yet (src/data/unlocks.ts): grey, a padlock, and a tap says which building opens it.
  const opensWith = t(`tier.${TIERS[UNLOCK_TIER.wheel]!.id}`);
  return (
    <View style={[styles.buttonWrap, style]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="lucky wheel"
        onPress={() => {
          if (!d.locked) return onPress();
          tapFeedback();
          setNote(true);
        }}
        hitSlop={6}
        style={[styles.button, d.locked && styles.buttonLocked]}
      >
        <Animated.Image source={{ uri: wheelIcon('wheelFace', px) }} style={[styles.buttonFace, turnStyle]} />
        <Image source={{ uri: wheelIcon('wheelHub', px) }} style={styles.buttonFace} />
      </Pressable>
      {ready && !d.locked ? <View style={styles.dot} /> : null}
      {d.locked ? <Text style={styles.padlock}>🔒</Text> : null}
      <View pointerEvents="none" style={[styles.buttonTag, ready && !d.locked && styles.buttonTagFree]}>
        <Text style={styles.buttonTagText}>{d.locked ? opensWith : ready ? t('wheel.free') : clock(d.secondsLeft)}</Text>
      </View>
      {note ? (
        <View pointerEvents="none" style={styles.lockedNote}>
          <Text style={styles.lockedNoteText}>{t('unlock.opensWith').replace('{tier}', opensWith)}</Text>
        </View>
      ) : null}
    </View>
  );
}

const BUTTON_FACE = 50;

/** Bulbs light in this many groups (every 4th bulb together): one animation per group, not per bulb. */
const BULB_GROUPS = 4;

/**
 * Every 4th bulb on the frame: blinking in turns when idle, running round while the wheel
 * spins, all flashing together on a win.
 */
function BulbGroup({ group, size, bulb, u, chase, mode }: { group: number; size: number; bulb: number; u: number; chase: SharedValue<number>; mode: SharedValue<number> }) {
  const lit = useAnimatedStyle(() => {
    const step = Math.floor(chase.value * BULB_GROUPS);
    const on = mode.value === 1 ? (group - step + BULB_GROUPS) % BULB_GROUPS < 2 : mode.value === 2 ? step % 2 === 0 : (group + step) % 2 === 0;
    return { opacity: on ? 1 : 0.18 };
  });
  const bulbs: number[] = [];
  for (let i = group; i < WHEEL_ART.bulbCount; i += BULB_GROUPS) bulbs.push(i);
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, lit]}>
      {bulbs.map((i) => {
        const a = (i / WHEEL_ART.bulbCount) * Math.PI * 2;
        const x = size / 2 + Math.cos(a) * WHEEL_ART.bulbs * u;
        const y = size / 2 + Math.sin(a) * WHEEL_ART.bulbs * u;
        return <View key={i} style={[styles.bulb, { left: x - bulb / 2, top: y - bulb / 2, width: bulb, height: bulb, borderRadius: bulb / 2 }]} />;
      })}
    </Animated.View>
  );
}

/** A burst of paper for the jackpot. */
function Confetti({ size }: { size: number }) {
  const go = useSharedValue(0);
  useEffect(() => {
    go.value = withTiming(1, { duration: 1800, easing: Easing.out(Easing.quad) });
  }, [go]);
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
      {Array.from({ length: 28 }, (_, i) => (
        <ConfettiBit key={i} index={i} size={size} go={go} />
      ))}
    </View>
  );
}

const CONFETTI_COLORS = ['#FFD23F', '#E5483B', '#35B957', '#3E6FE0', '#9B4FD8', '#FFFFFF'];

function ConfettiBit({ index, size, go }: { index: number; size: number; go: SharedValue<number> }) {
  const angle = (index / 28) * Math.PI * 2 + Math.sin(index * 7.3) * 0.3;
  const speed = size * (0.55 + ((index * 37) % 10) / 22);
  const style = useAnimatedStyle(() => {
    const p = go.value;
    return {
      opacity: p < 0.85 ? 1 : (1 - p) / 0.15,
      transform: [{ translateX: Math.cos(angle) * speed * p }, { translateY: Math.sin(angle) * speed * p + size * 0.6 * p * p }, { rotate: `${p * 720 + index * 40}deg` }],
    };
  });
  return <Animated.View style={[styles.confetti, { backgroundColor: CONFETTI_COLORS[index % CONFETTI_COLORS.length] }, style]} />;
}

export function WheelPanel({ gameRef, onCommand, onClose }: { gameRef: { current: GameState | null }; onCommand: (cmd: Command) => void; onClose: () => void }) {
  const t = useT();
  const d = usePoll(gameRef, readWheel, 4);
  const { width, height } = useWindowDimensions();
  const size = Math.round(Math.min(290, height - 56, width * 0.48));
  /** Screen points per art unit (icons fill 92% of their image). */
  const u = (size * 0.92) / ART;
  const px = Math.round(size * PixelRatio.get());
  const waiting = gameRef.current?.wheel.prize ?? -1;
  // A prize left from before (the screen was closed mid-spin): show it where it stopped.
  const [phase, setPhase] = useState<Phase>(waiting >= 0 ? 'won' : 'idle');
  const rotation = useSharedValue(waiting >= 0 ? restAngle(waiting) : 0);
  const kick = useSharedValue(0);
  const chase = useSharedValue(0);
  const mode = useSharedValue(waiting >= 0 ? 2 : 0);
  const rays = useSharedValue(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const spinsBefore = useRef(0);

  useEffect(() => {
    rays.value = withRepeat(withTiming(360, { duration: 24000, easing: Easing.linear }), -1, false);
    return () => timers.current.forEach(clearTimeout);
  }, [rays]);
  useEffect(() => {
    const speed = phase === 'spinning' || phase === 'starting' ? 700 : phase === 'won' ? 900 : 2400;
    mode.value = phase === 'won' ? 2 : phase === 'idle' ? 0 : 1;
    chase.value = 0;
    chase.value = withRepeat(withTiming(1, { duration: speed, easing: Easing.linear }), -1, false);
  }, [phase, chase, mode]);

  // A spin was asked for: wait for the sim to pick the segment (the next step), then turn.
  useEffect(() => {
    if (phase !== 'starting') return;
    const asked = Date.now();
    const timer = setInterval(() => {
      const w = gameRef.current?.wheel;
      if (w && w.spins > spinsBefore.current && w.prize >= 0) {
        clearInterval(timer);
        run(w.prize);
      } else if (Date.now() - asked > 1500) {
        // Refused (nothing to pay with after all): back to the start.
        clearInterval(timer);
        setPhase('idle');
      }
    }, 30);
    return () => clearInterval(timer);
    // `run` only reads refs and shared values, so it is left out of the list.
  }, [phase, gameRef]);

  const run = (seg: number) => {
    const from = rotation.value;
    // Not dead center every time: somewhere inside the wedge, like a real wheel.
    const jitter = (Math.random() - 0.5) * (SEG - 12);
    let to = from - (from % 360) + WHEEL.turns * 360 + restAngle(seg) + jitter;
    if (to - from < WHEEL.turns * 360) to += 360;
    rotation.value = withTiming(to, { duration: WHEEL.spinMs, easing: Easing.out(Easing.cubic) });
    // A click each time a peg passes the pointer: pegs sit between wedges (half a wedge off).
    // The spin eases out as 1 - (1 - t)^3, so the time a given angle is reached is known.
    let lastBuzz = 0;
    for (let a = Math.ceil((from - SEG / 2) / SEG) * SEG + SEG / 2; a < to; a += SEG) {
      if (a <= from) continue;
      const at = (1 - Math.cbrt(1 - (a - from) / (to - from))) * WHEEL.spinMs;
      timers.current.push(
        setTimeout(() => {
          playSound('tick');
          kick.value = withSequence(withTiming(1, { duration: 35 }), withTiming(0, { duration: 160 }));
          if (at - lastBuzz >= BUZZ_GAP_MS) {
            lastBuzz = at;
            buzz('tap');
          }
        }, at),
      );
    }
    timers.current.push(
      setTimeout(() => {
        setPhase('won');
        playSound(WHEEL_SEGMENTS[seg]!.prize.kind === 'jackpot' ? 'jackpot' : 'levelup');
        buzz('success');
      }, WHEEL.spinMs + 120),
    );
    setPhase('spinning');
  };

  const spin = (paid: boolean) => {
    if (phase !== 'idle') return;
    tapFeedback();
    spinsBefore.current = gameRef.current?.wheel.spins ?? 0;
    onCommand({ type: 'spin', now: Date.now(), paid });
    setPhase('starting');
  };
  const take = () => {
    tapFeedback();
    onCommand({ type: 'wheel' });
    setPhase('idle');
  };

  const faceStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotation.value}deg` }] }));
  const raysStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${rays.value}deg` }] }));
  const pointerStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: POINTER_PIVOT * u }, { rotate: `${kick.value * -16}deg` }, { translateY: -POINTER_PIVOT * u }],
  }));

  if (!d) return null;
  const coins = d.coins.split('|');
  const canFree = d.cost === 'free' || d.cost === 'token';
  const prizeSeg = phase === 'won' && d.prize >= 0 ? d.prize : -1;
  const prize = prizeSeg >= 0 ? WHEEL_SEGMENTS[prizeSeg]!.prize : null;
  const pointerSize = POINTER * (size / ART);
  const bulbSize = Math.max(6, 9 * u);

  return (
    <Overlay onClose={phase === 'spinning' || phase === 'starting' ? () => undefined : onClose} card={[styles.card, { width: Math.min(660, width * 0.96) }]}>
      <View style={{ width: size, height: size }}>
        <Animated.Image source={{ uri: splashIcon('splashRays', px) }} style={[styles.rays, { width: size * 1.5, height: size * 1.5, left: -size * 0.25, top: -size * 0.25 }, raysStyle]} />
        <Image source={{ uri: wheelIcon('wheelGlow', px) }} style={[StyleSheet.absoluteFill, { transform: [{ scale: 1.12 }] }]} />
        <Image source={{ uri: wheelIcon('wheelFrame', px) }} style={StyleSheet.absoluteFill} />
        <Animated.View style={[StyleSheet.absoluteFill, faceStyle]}>
          <Image source={{ uri: wheelIcon('wheelFace', px) }} style={StyleSheet.absoluteFill} />
          {WHEEL_SEGMENTS.map((seg, i) => (
            <View key={i} pointerEvents="none" style={[StyleSheet.absoluteFill, { transform: [{ rotate: `${i * SEG}deg` }] }]}>
              <Text numberOfLines={1} style={[styles.label, seg.prize.kind === 'jackpot' && styles.labelJackpot, { top: size / 2 - (seg.prize.kind === 'jackpot' ? WHEEL_ART.jackpotLabel : WHEEL_ART.label) * u - 9, left: size / 2 - 32 }]}>
                {shortLabel(seg.prize, coins[i] ?? '', t)}
              </Text>
            </View>
          ))}
        </Animated.View>
        {Array.from({ length: BULB_GROUPS }, (_, g) => (
          <BulbGroup key={g} group={g} size={size} bulb={bulbSize} u={u} chase={chase} mode={mode} />
        ))}
        <Image source={{ uri: wheelIcon('wheelHub', px) }} style={StyleSheet.absoluteFill} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="spin"
          disabled={phase !== 'idle' || d.cost === 'none'}
          onPress={() => spin(d.cost === 'gems')}
          style={[styles.hub, { width: 54 * u, height: 54 * u, borderRadius: 27 * u, left: size / 2 - 27 * u, top: size / 2 - 27 * u }]}
        >
          <Text style={[styles.hubText, { fontSize: Math.max(10, 12 * u) }]}>{t('wheel.spin')}</Text>
        </Pressable>
        <Animated.Image
          source={{ uri: wheelIcon('wheelPointer', Math.round(pointerSize * PixelRatio.get())) }}
          style={[styles.pointer, { width: pointerSize, height: pointerSize, left: size / 2 - pointerSize / 2, top: size / 2 + POINTER_MID * u - pointerSize / 2 }, pointerStyle]}
        />
        {prize?.kind === 'jackpot' ? <Confetti size={size} /> : null}
      </View>

      <View style={styles.side}>
        <Text style={styles.title}>{`🎡 ${t('wheel.title')}`}</Text>
        {prize ? (
          <View style={styles.won}>
            <Text style={styles.wonTitle}>{prize.kind === 'jackpot' ? `🎉 ${t('wheel.jackpot')}! 🎉` : t('wheel.won')}</Text>
            <View style={styles.wonIcons}>
              {(prize.kind === 'coins' || prize.kind === 'jackpot') && <Image source={{ uri: hudIcon('hudCoin', Math.round(44 * PixelRatio.get())) }} style={styles.wonIcon} />}
              {(prize.kind === 'gems' || prize.kind === 'jackpot') && <Image source={{ uri: hudIcon('hudGem', Math.round(44 * PixelRatio.get())) }} style={styles.wonIcon} />}
              {prize.kind === 'boost' && <Text style={styles.wonBolt}>{'⚡'}</Text>}
            </View>
            <Text style={styles.wonValue}>{longLabel(prize, coins[prizeSeg] ?? '', t)}</Text>
            <Pressable accessibilityRole="button" onPress={take} style={styles.take}>
              <Text style={styles.takeText}>{t('wheel.take')}</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <Text style={styles.sub}>{t('wheel.sub')}</Text>
            {phase !== 'idle' ? (
              <Text style={styles.luck}>{t('wheel.spinning')}</Text>
            ) : canFree ? (
              <Pressable accessibilityRole="button" onPress={() => spin(false)} style={styles.spinFree}>
                <Text style={styles.spinText}>{d.cost === 'token' ? t('wheel.spinToken').replace('{n}', String(d.tokens)) : t('wheel.spinFree')}</Text>
              </Pressable>
            ) : (
              <>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ disabled: d.cost === 'none' }}
                  disabled={d.cost === 'none'}
                  onPress={() => spin(true)}
                  style={[styles.spinGems, d.cost === 'none' && styles.spinOff]}
                >
                  <Text style={styles.spinText}>{`${t('wheel.spinGems')}💎${WHEEL.gemCost}`}</Text>
                </Pressable>
                <Text style={styles.timer}>{`${t('wheel.freeIn')} ${clock(d.secondsLeft)}`}</Text>
              </>
            )}
            {d.cost !== 'token' && d.tokens > 0 ? <Text style={styles.tokens}>{t('wheel.spinToken').replace('{n}', String(d.tokens))}</Text> : null}
          </>
        )}
      </View>
    </Overlay>
  );
}

const styles = StyleSheet.create({
  buttonWrap: { position: 'absolute' },
  button: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#3A1D40', borderWidth: 2.5, borderColor: gold, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', boxShadow: '0px 3px 0px #120818' },
  buttonFace: { position: 'absolute', width: BUTTON_FACE, height: BUTTON_FACE },
  dot: { position: 'absolute', top: -2, end: -2, width: 14, height: 14, borderRadius: 7, backgroundColor: '#E5483B', borderWidth: 2, borderColor: '#FFF4E3' },
  buttonTag: { position: 'absolute', bottom: -7, alignSelf: 'center', paddingHorizontal: 5, borderRadius: 7, backgroundColor: '#2A1530', borderWidth: 1.2, borderColor: gold },
  buttonTagFree: { backgroundColor: '#35B957', borderColor: '#B9F5A8' },
  buttonTagText: { color: '#FFFFFF', fontSize: 9.5, fontWeight: '900' },
  buttonLocked: { opacity: 0.45 },
  padlock: { position: 'absolute', top: 12, alignSelf: 'center', fontSize: 20 },
  lockedNote: {
    position: 'absolute',
    bottom: 62,
    start: -30,
    width: 160,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: 'rgba(42,21,48,0.95)',
    borderWidth: 1.5,
    borderColor: gold,
  },
  lockedNoteText: { color: '#FFF4E3', fontSize: 12, fontWeight: '800', textAlign: 'center' },
  card: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 12, borderRadius: 20, borderWidth: 2.5, borderColor: gold, backgroundColor: panel.bg, overflow: 'hidden' },
  rays: { position: 'absolute' },
  label: { position: 'absolute', width: 64, textAlign: 'center', color: '#FFFFFF', fontSize: 13, fontWeight: '900', ...textShadow('#120818', 1.5, 2) },
  labelJackpot: { color: '#FFD23F', fontSize: 9, letterSpacing: -0.2 },
  hub: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  hubText: { color: '#FFFFFF', fontWeight: '900', ...textShadow('#6A140E', 1.5, 1) },
  pointer: { position: 'absolute' },
  bulb: { position: 'absolute', backgroundColor: '#FFF6C8', borderWidth: 1, borderColor: '#FFD23F', boxShadow: '0px 0px 6px #FFD23F' },
  confetti: { position: 'absolute', width: 8, height: 12, borderRadius: 2 },
  side: { flex: 1, alignItems: 'center', gap: 10 },
  title: { color: '#FFE9A8', fontSize: 22, fontWeight: '900', ...textShadow('#120818', 2, 2) },
  sub: { color: '#C9B3D6', fontSize: 12.5, fontWeight: '700', textAlign: 'center' },
  luck: { color: '#FFE27A', fontSize: 16, fontWeight: '900', paddingVertical: 10 },
  spinFree: { minHeight: 46, paddingHorizontal: 22, borderRadius: 16, backgroundColor: '#35B957', borderWidth: 2, borderColor: '#B9F5A8', justifyContent: 'center', boxShadow: '0px 3px 0px #17602A' },
  spinGems: { minHeight: 46, paddingHorizontal: 22, borderRadius: 16, backgroundColor: '#3E6FE0', borderWidth: 2, borderColor: '#BFD4FF', justifyContent: 'center', boxShadow: '0px 3px 0px #22409A' },
  spinOff: { backgroundColor: '#4A4258', borderColor: '#6A6278', boxShadow: '0px 3px 0px #2A2438' },
  spinText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900', textAlign: 'center' },
  timer: { color: '#E8C76A', fontSize: 13, fontWeight: '800' },
  tokens: { color: '#7EE08F', fontSize: 12, fontWeight: '800' },
  won: { alignItems: 'center', gap: 6, padding: 10, borderRadius: 16, backgroundColor: '#3A1D40', borderWidth: 2, borderColor: '#FFE27A', alignSelf: 'stretch' },
  wonTitle: { color: '#FFE27A', fontSize: 20, fontWeight: '900', ...textShadow('#120818', 2, 2) },
  wonIcons: { flexDirection: 'row', gap: 6, alignItems: 'center', minHeight: 44 },
  wonIcon: { width: 44, height: 44 },
  wonBolt: { fontSize: 36 },
  wonValue: { color: '#FFFFFF', fontSize: 17, fontWeight: '900', textAlign: 'center' },
  take: { height: 44, paddingHorizontal: 30, borderRadius: 16, backgroundColor: '#35B957', borderWidth: 2, borderColor: '#B9F5A8', justifyContent: 'center', boxShadow: '0px 3px 0px #17602A' },
  takeText: { color: '#FFFFFF', fontSize: 17, fontWeight: '900' },
});
