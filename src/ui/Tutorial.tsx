import { useEffect, useRef, useState, type RefObject } from 'react';
import { PixelRatio, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TUTORIAL_STEPS } from '../data/tutorial';
import { useT } from '../i18n';
import type { Camera } from '../render/draw/fx';
import { HUD, hudAnchors, type HudLayout } from '../render/draw/hud';
import { hudIcon } from '../render/icons';
import { isoX, isoY } from '../render/iso';
import type { GameState } from '../sim/game/types';
import { nextStep, readTutorial, tutorialTarget, type TutorialView } from '../sim/tutorial';
import { useSettings } from '../store/settings';
import { gold, panel, textShadow } from './theme';

// The first-run walkthrough: a message at the top and a white glove tapping at what to do next.
// The steps and when each one is done live in sim/tutorial.ts; this only shows them.

const HAND = 64;
/** The fingertip sits this far into the hand image (from the top). */
const TIP = HAND * 0.07;
const POLL_MS = 125;
/** Steps the player is counted through ("2/5"); the closing message is not one of them. */
const COUNTED = TUTORIAL_STEPS.length - 1;

/** A screen point to tap, and whether the glove comes from above (for the bottom buttons). */
type Point = { x: number; y: number; down: boolean };

interface Props {
  gameRef: { current: GameState | null };
  camera: { current: Camera };
  buttons: { upgrades: RefObject<View | null>; staff: RefObject<View | null> };
  layout: HudLayout;
  /** A menu covers the buttons: the glove waits. */
  menuOpen: boolean;
}

export function Tutorial({ gameRef, camera, buttons, layout, menuOpen }: Props) {
  const t = useT();
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const index = useSettings((s) => s.tutorial);
  const setTutorial = useSettings((s) => s.setTutorial);
  const step = TUTORIAL_STEPS[Math.min(index, TUTORIAL_STEPS.length - 1)]!;
  const [point, setPoint] = useState<Point | null>(null);
  const [cooking, setCooking] = useState(false);
  const start = useRef<TutorialView | null>(null);
  const menu = useRef(menuOpen);
  menu.current = menuOpen;

  // Each step counts from when it showed up (declared first: runs before the poll below).
  useEffect(() => {
    start.current = null;
  }, [index]);
  useEffect(() => {
    const tick = () => {
      const game = gameRef.current;
      if (!game) return;
      const now = readTutorial(game);
      start.current ??= now;
      const next = nextStep(index, now, start.current);
      if (next !== index) return setTutorial(next);
      const target = tutorialTarget(step, game);
      setCooking(step === 'serve' && !target);
      if (!target) return setPoint(null);
      if ('world' in target) {
        const cam = camera.current;
        const { x, y, height } = target.world;
        return setPoint({ x: cam.x + isoX(x, y) * cam.zoom, y: cam.y + isoY(x, y, height) * cam.zoom + 8, down: false });
      }
      if (target.ui === 'coins') {
        const a = hudAnchors(layout);
        return setPoint({ x: a.coinX, y: a.coinY + HUD.icon / 2, down: false });
      }
      const button = buttons[target.ui].current;
      if (!button || menu.current) return setPoint(null);
      button.measureInWindow((x, y, w) => setPoint({ x: x + w / 2, y: y + 2, down: true }));
    };
    tick();
    const timer = setInterval(tick, POLL_MS);
    return () => clearInterval(timer);
  }, [index, step, gameRef, camera, buttons, layout, setTutorial]);

  // The glove glides to its target and keeps tapping.
  const hx = useSharedValue(0);
  const hy = useSharedValue(0);
  const flip = useSharedValue(0);
  const shown = useSharedValue(0);
  const tap = useSharedValue(0);
  useEffect(() => {
    tap.value = withRepeat(withSequence(withTiming(1, { duration: 380, easing: Easing.inOut(Easing.quad) }), withTiming(0, { duration: 380, easing: Easing.inOut(Easing.quad) })), -1);
  }, [tap]);
  useEffect(() => {
    if (!point) {
      shown.value = withTiming(0, { duration: 150 });
      return;
    }
    const first = shown.value < 0.05;
    const glide = (v: number) => (first ? v : withTiming(v, { duration: 180 }));
    hx.value = glide(point.x);
    hy.value = glide(point.y);
    flip.value = point.down ? 1 : 0;
    shown.value = withTiming(1, { duration: 150 });
  }, [point, hx, hy, flip, shown]);
  const handStyle = useAnimatedStyle(() => {
    const down = flip.value > 0.5;
    const bob = tap.value * 10;
    return {
      opacity: shown.value,
      left: hx.value - HAND / 2,
      top: down ? hy.value - HAND + TIP - bob : hy.value - TIP + bob,
      transform: [{ rotate: down ? '180deg' : '0deg' }, { scale: 1 - tap.value * 0.08 }],
    };
  });

  const message = step === 'serve' && cooking ? 'tut.cooking' : `tut.${step}`;
  const done = step === 'done';
  // The message never covers what the glove points at: up top, unless that is up top too.
  // With a menu open (it fills the far side) the message moves to the free corner beside it.
  const below = point !== null && !point.down && point.y < height / 2;
  const place = menuOpen
    ? { bottom: insets.bottom + 10, start: insets.left + 66, maxWidth: '44%' as const, alignItems: 'flex-start' as const }
    : below
      ? [styles.across, { bottom: insets.bottom + 74 }]
      : [styles.across, { top: layout.top + HUD.height + 10 }];
  return (
    <View style={styles.root} pointerEvents="box-none">
      <Animated.Image source={{ uri: hudIcon('hudHand', Math.round(HAND * PixelRatio.get())) }} style={[styles.hand, handStyle]} />
      <View style={[styles.bar, place]} pointerEvents="box-none">
        {/* Taps go through the message to the game; only Skip catches them. */}
        <View style={[styles.bubble, done && styles.doneBubble]} pointerEvents="box-none">
          {!done && (
            <View style={styles.count}>
              <Text style={styles.countText}>{`${index + 1}/${COUNTED}`}</Text>
            </View>
          )}
          <Text style={[styles.text, done && styles.doneText]}>{t(message)}</Text>
          {!done && (
            <Pressable accessibilityRole="button" onPress={() => setTutorial(TUTORIAL_STEPS.length)} hitSlop={8} style={styles.skip}>
              <Text style={styles.skipText}>{t('tut.skip')}</Text>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  hand: { position: 'absolute', width: HAND, height: HAND, pointerEvents: 'none' },
  bar: { position: 'absolute', alignItems: 'center' },
  across: { left: 0, right: 0 },
  bubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    maxWidth: 560,
    marginHorizontal: 16,
    paddingStart: 8,
    paddingEnd: 12,
    paddingVertical: 7,
    borderRadius: 18,
    backgroundColor: panel.bg,
    borderWidth: 2.5,
    borderColor: gold,
    boxShadow: '0px 4px 0px #120818',
  },
  doneBubble: { paddingHorizontal: 22, paddingVertical: 12, backgroundColor: '#35B957', borderColor: '#FFE08A' },
  count: { minWidth: 34, height: 26, borderRadius: 13, backgroundColor: gold, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  countText: { color: '#2A1530', fontWeight: '900', fontSize: 13 },
  text: { flexShrink: 1, color: '#FFFFFF', fontWeight: '900', fontSize: 15, ...textShadow('#120818', 1, 0) },
  doneText: { fontSize: 19 },
  skip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.08)' },
  skipText: { color: '#C9B3D6', fontWeight: '800', fontSize: 12 },
});
