import { useEffect, useRef, useState } from 'react';
import { Image, PixelRatio, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useT } from '../i18n';
import type { SplashIcon } from '../render/art/splashArt';
import { hudIcon, splashIcon } from '../render/icons';
import { finishSplash, mountGame, useLaunch } from '../store/launch';
import { textShadow } from './theme';

// The opening animation: a sunburst, the title popping in with a chef hat landing on it, and
// a loading bar with a coin rolling along its edge. The game mounts underneath
// once the intro has played (its loading would stutter the intro on web), and the splash fades
// away as soon as the restaurant is ready. Every launch; a tap skips the wait once it is ready.

export const SPLASH_BG = '#2A1230';
/** The title and its hat land first, then loading starts. */
const INTRO_MS = 1100;
const PHRASES = ['splash.loading1', 'splash.loading2', 'splash.loading3', 'splash.loading4'];
const PHRASE_MS = 700;
const BAR_W = 300;
const BAR_H = 24;
const COIN = 30;

const icon = (name: SplashIcon, px: number) => splashIcon(name, Math.round(px * PixelRatio.get()));

export function Splash() {
  const t = useT();
  const { width, height } = useWindowDimensions();
  const ready = useLaunch((s) => s.ready);
  const k = Math.max(0.8, Math.min(1.4, height / 390));
  const rayPx = Math.ceil(Math.hypot(width, height) * 1.15);

  const rays = useSharedValue(0);
  const title = useSharedValue(0);
  const hat = useSharedValue(0);
  const progress = useSharedValue(0);
  const leave = useSharedValue(0);
  const [phrase, setPhrase] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const started = useRef(Date.now());

  useEffect(() => {
    rays.value = withRepeat(withTiming(360, { duration: 24000, easing: Easing.linear }), -1);
    title.value = withDelay(120, withSpring(1, { damping: 8, stiffness: 150 }));
    hat.value = withDelay(650, withTiming(1, { duration: 650, easing: Easing.bounce }));
    // Most of the bar fills during the intro; the last stretch creeps while the game loads.
    progress.value = withSequence(withTiming(0.6, { duration: INTRO_MS, easing: Easing.out(Easing.quad) }), withTiming(0.92, { duration: 4000, easing: Easing.out(Easing.cubic) }));
    const intro = setTimeout(mountGame, INTRO_MS);
    const words = setInterval(() => setPhrase((p) => (p + 1) % PHRASES.length), PHRASE_MS);
    return () => {
      clearTimeout(intro);
      clearInterval(words);
    };
  }, [rays, title, hat, progress]);

  // Fill the bar, say we're open, fade out. Runs once: when ready, or on a tap after that.
  const gone = useRef(false);
  const go = () => {
    if (gone.current) return;
    gone.current = true;
    progress.value = withTiming(1, { duration: 280 });
    setLeaving(true);
    setTimeout(() => {
      leave.value = withTiming(1, { duration: 380, easing: Easing.in(Easing.quad) });
    }, 650);
    setTimeout(finishSplash, 1050);
  };
  const goRef = useRef(go);
  goRef.current = go;
  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => goRef.current(), Math.max(0, INTRO_MS + 400 - (Date.now() - started.current)));
    return () => clearTimeout(timer);
  }, [ready]);

  const rootStyle = useAnimatedStyle(() => ({ opacity: 1 - leave.value, transform: [{ scale: 1 + leave.value * 0.08 }] }));
  const raysStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${rays.value}deg` }] }));
  const titleStyle = useAnimatedStyle(() => ({ opacity: Math.min(1, title.value * 2), transform: [{ scale: 0.3 + title.value * 0.7 }] }));
  const hatStyle = useAnimatedStyle(() => ({ opacity: hat.value > 0.02 ? 1 : 0, transform: [{ translateY: (1 - hat.value) * -140 }, { rotate: `${-18 + (1 - hat.value) * -50}deg` }] }));
  const fillStyle = useAnimatedStyle(() => ({ width: Math.max(BAR_H - 6, progress.value * (BAR_W - 6)) }));
  const coinStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * (BAR_W - 6) - COIN / 2 }, { rotate: `${progress.value * 720}deg` }],
  }));

  return (
    <Animated.View style={[styles.root, rootStyle]}>
      <Pressable style={styles.fill} onPress={() => ready && go()} accessibilityRole="button">
        <Animated.Image
          source={{ uri: icon('splashRays', 512) }}
          style={[styles.rays, { width: rayPx, height: rayPx, left: (width - rayPx) / 2, top: (height - rayPx) / 2 }, raysStyle]}
        />
        <View style={styles.column}>
          <View>
            <Animated.Text style={[styles.title, { fontSize: Math.round(54 * k) }, titleStyle]} numberOfLines={1}>
              {t('app.title')}
            </Animated.Text>
            <Animated.Image source={{ uri: icon('splashHat', 60) }} style={[styles.hat, hatStyle]} />
          </View>
          <Text style={[styles.tagline, { fontSize: Math.round(16 * k) }]}>{t('splash.tagline')}</Text>
          <View style={styles.bar}>
            <Animated.View style={[styles.barFill, fillStyle]}>
              <View style={styles.barShine} />
            </Animated.View>
            <Animated.View style={[styles.coin, coinStyle]}>
              <Image source={{ uri: hudIcon('hudCoin', Math.round(COIN * PixelRatio.get())) }} style={styles.coinImage} />
            </Animated.View>
          </View>
          <Text style={styles.phrase}>{t(leaving ? 'splash.ready' : PHRASES[phrase]!)}</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: SPLASH_BG, overflow: 'hidden' },
  fill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  rays: { position: 'absolute' },
  column: { alignItems: 'center', gap: 6 },
  title: { color: '#FFD85A', fontWeight: '900', letterSpacing: 0.5, ...textShadow('#120818', 4, 0) },
  // Perched on the title's first letter.
  hat: { position: 'absolute', width: 60, height: 60, left: -22, top: -24 },
  tagline: { color: '#F3D9FF', fontWeight: '800', marginBottom: 12, ...textShadow('#120818', 2, 0) },
  bar: {
    width: BAR_W,
    height: BAR_H,
    borderRadius: BAR_H / 2,
    backgroundColor: 'rgba(18,8,24,0.75)',
    borderWidth: 2.5,
    borderColor: '#F2C14E',
    justifyContent: 'center',
    paddingHorizontal: 1,
    direction: 'ltr',
  },
  barFill: { height: BAR_H - 7, borderRadius: (BAR_H - 7) / 2, backgroundColor: '#FF9A2E', overflow: 'hidden' },
  barShine: { position: 'absolute', left: 6, right: 6, top: 2, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.45)' },
  coin: { position: 'absolute', left: 3, top: (BAR_H - 5 - COIN) / 2, width: COIN, height: COIN },
  coinImage: { width: COIN, height: COIN },
  phrase: { color: '#FFF4E3', fontWeight: '800', fontSize: 14, marginTop: 4, ...textShadow('#120818', 2, 0) },
});
