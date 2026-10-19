import { useEffect, useRef } from 'react';
import { Image, PixelRatio, Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { buzz, tapFeedback } from '../audio/sound';
import { CHEF, levelReward, xpNeed } from '../data/chef';
import type { ChefUnlock } from '../data/chef';
import { useT } from '../i18n';
import { hudIcon, spriteIcon } from '../render/icons';
import type { HudIcon } from '../render/art/hudArt';
import type { SpriteName } from '../render/sprites';
import { usePoll } from '../render/useSimulation';
import { opensAt, upcoming } from '../sim/chef';
import type { GameState } from '../sim/game/types';
import { GameIcon } from './GameIcon';
import { Overlay, scrollFill } from './Overlay';
import { gold, panel, textShadow } from './theme';

// The chef's level on screen (owner: "more levels, more things that open, like Hay Day"): a
// gold star with the level in the top bar and the experience filling under it; its page (what
// the next levels bring); and the card of a new level, with its rewards and what it opens.

const BADGE = 46;

const readBadge = (s: GameState) => ({ level: s.chef.level, xp: Math.floor(s.chef.xp), need: xpNeed(s.chef.level) });

export function ChefBadge({ gameRef, onPress, style }: { gameRef: { current: GameState | null }; onPress: () => void; style: StyleProp<ViewStyle> }) {
  const d = usePoll(gameRef, readBadge, 2);
  const pulse = useSharedValue(1);
  const shown = useRef(0);
  useEffect(() => {
    if (!d) return;
    // A new level: the star jumps.
    if (shown.current && d.level > shown.current) pulse.value = withSequence(withTiming(1.35, { duration: 160 }), withSpring(1, { damping: 6, stiffness: 160 }));
    shown.current = d.level;
  }, [d, pulse]);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));
  if (!d) return null;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="chef level" onPress={() => { tapFeedback(); onPress(); }} hitSlop={6} style={[styles.badge, style]}>
      <Animated.View style={[styles.star, anim]}>
        <Image source={{ uri: hudIcon('hudStar', Math.round(BADGE * PixelRatio.get())) }} style={styles.starImage} />
        <Text style={styles.starNumber} numberOfLines={1}>{d.level}</Text>
      </Animated.View>
      <View style={styles.xpBack}>
        <View style={[styles.xpFill, { width: `${Math.min(100, (d.xp / d.need) * 100)}%` }]} />
      </View>
    </Pressable>
  );
}

/** An unlock's picture: a HUD icon, or a sprite (a dessert). */
function UnlockIcon({ u, size }: { u: ChefUnlock; size: number }) {
  if (u.kind === 'dessert') return <Image source={{ uri: spriteIcon(u.icon as SpriteName, Math.round(size * PixelRatio.get())) }} style={{ width: size, height: size }} />;
  return <GameIcon name={u.icon as HudIcon} size={size} />;
}

const readPage = (s: GameState) => ({ level: s.chef.level, xp: Math.floor(s.chef.xp), need: xpNeed(s.chef.level) });

const SOURCES = ['served', 'upgrade', 'hire', 'stage', 'inspector', 'star', 'building'] as const;
const SOURCE_ICON: Record<(typeof SOURCES)[number], HudIcon> = { served: 'iconSmile', upgrade: 'iconHammer', hire: 'iconChef', stage: 'hudScroll', inspector: 'iconMagnifier', star: 'iconRosette', building: 'iconCity' };

export function ChefPanel({ gameRef, onClose }: { gameRef: { current: GameState | null }; onClose: () => void }) {
  const t = useT();
  const d = usePoll(gameRef, readPage, 2);
  if (!d) return null;
  const next = levelReward(d.level + 1);
  const soon = upcoming(d.level, 6);
  return (
    <Overlay onClose={onClose} card={styles.card}>
      <View style={styles.header}>
        <View style={styles.bigStar}>
          <GameIcon name="hudStar" size={56} />
          <Text style={styles.bigNumber}>{d.level}</Text>
        </View>
        <View style={styles.grow}>
          <Text style={styles.title}>{t('chef.title').replace('{n}', String(d.level))}</Text>
          <View style={styles.bar}>
            <View style={[styles.barFill, { width: `${Math.min(100, (d.xp / d.need) * 100)}%` }]} />
            <Text style={styles.barText}>{`${d.xp} / ${d.need}`}</Text>
          </View>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="close" onPress={onClose} hitSlop={10} style={styles.close}>
          <Text style={styles.closeText}>{'✕'}</Text>
        </Pressable>
      </View>
      <ScrollView style={scrollFill} contentContainerStyle={styles.body}>
        <Text style={styles.section}>{t('chef.next').replace('{n}', String(d.level + 1))}</Text>
        <View style={styles.rewards}>
          <Reward icon="hudGem" text={`+${next.gems}`} />
          <Reward icon="iconTalent" text={`+${next.talent}`} />
          {next.minutes > 0 && <Reward icon="hudCoin" text={t('chef.minutes').replace('{n}', String(next.minutes))} />}
          {next.chest && <Reward icon="hudGift" text={t('chef.chest').replace('{n}', String(CHEF.chestBoost.minutes))} />}
          {opensAt(d.level + 1).map((u) => (
            <View key={u.id} style={styles.reward}>
              <UnlockIcon u={u} size={22} />
              <Text style={styles.rewardText}>{t(u.name)}</Text>
            </View>
          ))}
        </View>
        {soon.length > 0 && (
          <>
            <Text style={styles.section}>{t('chef.soon')}</Text>
            {soon.map((u) => (
              <View key={u.id} style={styles.row}>
                <UnlockIcon u={u} size={28} />
                <Text style={styles.rowText}>{t(u.name)}</Text>
                <View style={styles.levelTag}>
                  <Text style={styles.levelTagText}>{`${t('chef.level')} ${u.level}`}</Text>
                </View>
              </View>
            ))}
          </>
        )}
        <Text style={styles.section}>{t('chef.how')}</Text>
        {SOURCES.map((k) => (
          <View key={k} style={styles.row}>
            <GameIcon name={SOURCE_ICON[k]} size={22} />
            <Text style={styles.rowText}>{t(`chef.xp.${k}`)}</Text>
            <Text style={styles.xpTag}>{`+${CHEF.xp[k]}`}</Text>
          </View>
        ))}
      </ScrollView>
    </Overlay>
  );
}

function Reward({ icon, text }: { icon: HudIcon; text: string }) {
  return (
    <View style={styles.reward}>
      <GameIcon name={icon} size={22} />
      <Text style={styles.rewardText}>{text}</Text>
    </View>
  );
}

/** Rays turning behind the big star. */
function Rays() {
  const spin = useSharedValue(0);
  useEffect(() => {
    spin.value = withRepeat(withTiming(1, { duration: 8000, easing: Easing.linear }), -1);
  }, [spin]);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value * 360}deg` }] }));
  return (
    <Animated.View style={[styles.rays, style]} pointerEvents="none">
      {Array.from({ length: 10 }, (_, i) => (
        <View key={i} style={[styles.ray, { transform: [{ rotate: `${i * 18}deg` }] }]} />
      ))}
    </Animated.View>
  );
}

/** A new level: the star pops in, then its rewards and what it opens, one after another. */
export function LevelUpCard({ level, onClose }: { level: number; onClose: () => void }) {
  const t = useT();
  const pop = useSharedValue(0);
  const star = useSharedValue(0);
  const rest = useSharedValue(0);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    pop.value = withSpring(1, { damping: 10, stiffness: 150 });
    star.value = withDelay(200, withSpring(1, { damping: 7, stiffness: 170 }));
    rest.value = withDelay(650, withTiming(1, { duration: 450 }));
    const id = setTimeout(() => buzz('success'), 260);
    return () => clearTimeout(id);
  }, [pop, star, rest]);
  const card = useAnimatedStyle(() => ({ opacity: Math.min(1, pop.value * 1.5), transform: [{ scale: 0.7 + pop.value * 0.3 }] }));
  const starStyle = useAnimatedStyle(() => ({ transform: [{ scale: star.value }, { rotate: `${(1 - star.value) * -90}deg` }] }));
  const restStyle = useAnimatedStyle(() => ({ opacity: rest.value, transform: [{ translateY: (1 - rest.value) * 10 }] }));
  const r = levelReward(level);
  const opens = opensAt(level);
  return (
    <Pressable style={styles.levelWrap} onPress={() => close.current()} accessibilityRole="button" accessibilityLabel="level up">
      <Animated.View style={[styles.levelCard, card]}>
        <Text style={styles.levelKicker}>{t('chef.levelUp')}</Text>
        <View style={styles.levelStage}>
          <Rays />
          <Animated.View style={[styles.levelStar, starStyle]}>
            <GameIcon name="hudStar" size={96} />
            <Text style={styles.levelNumber}>{level}</Text>
          </Animated.View>
        </View>
        <Animated.View style={[styles.levelRest, restStyle]}>
          <View style={styles.rewards}>
            <Reward icon="hudGem" text={`+${r.gems}`} />
            <Reward icon="iconTalent" text={`+${r.talent}`} />
            {r.minutes > 0 && <Reward icon="hudCoin" text={t('chef.minutes').replace('{n}', String(r.minutes))} />}
            {r.chest && <Reward icon="hudGift" text={t('chef.chest').replace('{n}', String(CHEF.chestBoost.minutes))} />}
          </View>
          {opens.length > 0 && (
            <>
              <Text style={styles.opens}>{t('chef.opens')}</Text>
              <View style={styles.rewards}>
                {opens.map((u) => (
                  <View key={u.id} style={[styles.reward, styles.newThing]}>
                    <UnlockIcon u={u} size={30} />
                    <Text style={styles.newThingText}>{t(u.name)}</Text>
                  </View>
                ))}
              </View>
            </>
          )}
          <View style={styles.okButton}>
            <Text style={styles.okText}>{t('chef.ok')}</Text>
          </View>
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  badge: { position: 'absolute', width: BADGE + 6, alignItems: 'center' },
  star: { width: BADGE, height: BADGE, alignItems: 'center', justifyContent: 'center' },
  starImage: { position: 'absolute', width: BADGE, height: BADGE },
  starNumber: { color: '#FFFFFF', fontSize: 15, fontWeight: '900', marginTop: 3, ...textShadow('#5A3A08', 1.5, 0) },
  xpBack: { width: BADGE, height: 6, borderRadius: 3, backgroundColor: 'rgba(28,14,36,0.86)', borderWidth: 1, borderColor: 'rgba(242,198,96,0.9)', overflow: 'hidden', marginTop: -3 },
  xpFill: { height: '100%', backgroundColor: '#5BE07A' },
  card: { width: 560, maxWidth: '96%', maxHeight: '94%', backgroundColor: panel.bg, borderRadius: 20, borderWidth: 2.5, borderColor: gold, padding: 12, gap: 8 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bigStar: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center' },
  bigNumber: { position: 'absolute', color: '#FFFFFF', fontSize: 18, fontWeight: '900', marginTop: 4, ...textShadow('#5A3A08', 1.5, 0) },
  grow: { flex: 1, gap: 4 },
  title: { color: '#FFE9A8', fontSize: 18, fontWeight: '900', ...textShadow('#120818', 2, 2) },
  bar: { height: 18, borderRadius: 9, backgroundColor: '#1E0E24', borderWidth: 1.5, borderColor: gold, overflow: 'hidden', justifyContent: 'center' },
  barFill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: '#3DDC6A' },
  barText: { color: '#FFFFFF', fontSize: 11.5, fontWeight: '900', textAlign: 'center', ...textShadow('#120818', 1, 0) },
  close: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#4A2550', alignItems: 'center', justifyContent: 'center' },
  closeText: { color: '#FFE9A8', fontSize: 16, fontWeight: '900' },
  body: { gap: 8, paddingBottom: 4 },
  section: { color: '#FFE9A8', fontSize: 14, fontWeight: '900', marginTop: 4 },
  rewards: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' },
  reward: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: panel.row, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5 },
  rewardText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: panel.row, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  rowText: { flex: 1, color: '#F2E6F7', fontSize: 12.5, fontWeight: '800' },
  levelTag: { backgroundColor: '#5E2A86', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
  levelTagText: { color: '#FFE9A8', fontSize: 11.5, fontWeight: '900' },
  xpTag: { color: '#7CF0A0', fontSize: 13, fontWeight: '900' },
  levelWrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(14,6,18,0.55)' },
  levelCard: { width: 380, maxWidth: '92%', alignItems: 'center', gap: 4, backgroundColor: '#2A1233', borderRadius: 24, borderWidth: 3, borderColor: gold, paddingVertical: 14, paddingHorizontal: 16, overflow: 'hidden', boxShadow: '0px 6px 0px #120818' },
  levelKicker: { color: '#FFE9A8', fontSize: 20, fontWeight: '900', ...textShadow('#120818', 2, 2) },
  levelStage: { height: 110, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  rays: { position: 'absolute', width: 170, height: 170, alignItems: 'center', justifyContent: 'center' },
  ray: { position: 'absolute', width: 14, height: 170, borderRadius: 7, backgroundColor: 'rgba(255,214,90,0.22)' },
  levelStar: { width: 96, height: 96, alignItems: 'center', justifyContent: 'center' },
  levelNumber: { position: 'absolute', color: '#FFFFFF', fontSize: 30, fontWeight: '900', marginTop: 6, ...textShadow('#5A3A08', 2, 0) },
  levelRest: { alignItems: 'center', gap: 8, alignSelf: 'stretch' },
  opens: { color: '#7CF0A0', fontSize: 14, fontWeight: '900' },
  newThing: { borderWidth: 1.5, borderColor: '#7CF0A0' },
  newThingText: { color: '#FFFFFF', fontSize: 13.5, fontWeight: '900' },
  okButton: { marginTop: 4, backgroundColor: '#23934A', borderRadius: 14, paddingHorizontal: 28, paddingVertical: 8, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.45)' },
  okText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900', ...textShadow('#0E3A1C', 1, 0) },
});
