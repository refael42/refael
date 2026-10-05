import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { NAME_MAX, RESTAURANT_NAMES } from '../data/tutorial';
import { isRTL, useT } from '../i18n';
import { useSettings, type Profile } from '../store/settings';
import { cardStyles, HowToPlayCards } from './HowToPlay';
import { gold } from './theme';

// The first run: a welcome with the language choice, the manager's and the restaurant's
// names (kept on this phone only, no account), then how to play. The game waits behind it.

export type WelcomePage = 'hello' | 'names' | 'howto';

const randomName = (lang: 'he' | 'en', not?: string) => {
  const names = RESTAURANT_NAMES[lang].filter((n) => n !== not);
  return names[Math.floor(Math.random() * names.length)]!;
};

interface Props {
  pages: readonly WelcomePage[];
  initial?: Profile | null;
  onDone: (profile: Profile) => void;
}

export function Welcome({ pages, initial, onDone }: Props) {
  const t = useT();
  const { lang, setLang } = useSettings();
  const rtl = isRTL(lang);
  const [page, setPage] = useState(0);
  const [manager, setManager] = useState(initial?.manager ?? '');
  const [restaurant, setRestaurant] = useState(initial?.restaurant ?? '');
  // Each page pops in.
  const pop = useSharedValue(0.7);
  useEffect(() => {
    pop.value = withSequence(withTiming(0.7, { duration: 0 }), withSpring(1, { damping: 10, stiffness: 170 }));
  }, [page, pop]);
  const popStyle = useAnimatedStyle(() => ({ opacity: Math.min(1, (pop.value - 0.7) * 4), transform: [{ scale: pop.value }] }));

  const profile = (): Profile => ({
    manager: manager.trim() || t('welcome.defaultManager'),
    restaurant: restaurant.trim() || randomName(lang),
  });
  const next = () => (page + 1 < pages.length ? setPage(page + 1) : onDone(profile()));
  const lastLabel = pages.length === 1 ? t('welcome.save') : t('welcome.start');
  const current = pages[page]!;
  const input = [styles.input, { textAlign: rtl ? 'right' : 'left' } as const];

  return (
    <View style={styles.backdrop}>
      <Animated.View style={[styles.card, popStyle]}>
        {current === 'hello' && (
          <>
            <Text style={styles.title}>{t('welcome.title')}</Text>
            <Text style={styles.body}>{t('welcome.body')}</Text>
            <View style={styles.chips}>
              {(['he', 'en'] as const).map((l) => (
                <Pressable key={l} onPress={() => setLang(l)} style={[styles.chip, lang === l && styles.chipOn]}>
                  <Text style={[styles.chipText, lang === l && styles.chipTextOn]}>{l === 'he' ? 'עברית' : 'English'}</Text>
                </Pressable>
              ))}
            </View>
            <Pressable accessibilityRole="button" onPress={next} style={[styles.button, styles.next, styles.big]}>
              <Text style={styles.nextText}>{t('welcome.go')}</Text>
            </Pressable>
          </>
        )}
        {current === 'names' && (
          <>
            <Text style={styles.title}>{t('welcome.namesTitle')}</Text>
            <Text style={styles.label}>{t('welcome.manager')}</Text>
            <TextInput value={manager} onChangeText={setManager} maxLength={NAME_MAX} placeholder={t('welcome.defaultManager')} placeholderTextColor="#8A6A9A" style={input} returnKeyType="next" />
            <Text style={styles.label}>{t('welcome.restaurant')}</Text>
            <View style={styles.inputRow}>
              <TextInput value={restaurant} onChangeText={setRestaurant} maxLength={NAME_MAX} placeholder={RESTAURANT_NAMES[lang][0]} placeholderTextColor="#8A6A9A" style={[input, styles.grow]} returnKeyType="done" onSubmitEditing={next} />
              <Pressable accessibilityRole="button" accessibilityLabel="random name" onPress={() => setRestaurant(randomName(lang, restaurant))} style={styles.dice}>
                <Text style={styles.diceText}>🎲</Text>
              </Pressable>
            </View>
            <View style={styles.buttons}>
              {page > 0 && (
                <Pressable accessibilityRole="button" onPress={() => setPage(page - 1)} style={[styles.button, styles.back]}>
                  <Text style={styles.backText}>{t('welcome.back')}</Text>
                </Pressable>
              )}
              <Pressable accessibilityRole="button" onPress={next} style={[styles.button, styles.next]}>
                <Text style={styles.nextText}>{page + 1 < pages.length ? t('welcome.next') : lastLabel}</Text>
              </Pressable>
            </View>
          </>
        )}
        {current === 'howto' && <HowToPlayCards doneLabel={lastLabel} onDone={next} />}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  ...cardStyles,
  // The names page sits high so the phone's keyboard does not cover it.
  backdrop: { ...cardStyles.backdrop, justifyContent: 'flex-start', paddingTop: 18 },
  title: { color: '#FFE9A8', fontSize: 26, fontWeight: '900', textAlign: 'center', marginBottom: 4 },
  body: { color: '#F3E6FA', fontSize: 15, fontWeight: '600', textAlign: 'center', lineHeight: 21, marginBottom: 10 },
  chips: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  chip: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 16, borderWidth: 2, borderColor: '#5A3A6A', backgroundColor: '#3A1D40' },
  chipOn: { borderColor: gold, backgroundColor: '#5A2A66' },
  chipText: { color: '#C9B3D6', fontWeight: '800', fontSize: 15 },
  chipTextOn: { color: '#FFFFFF' },
  big: { minWidth: 180, height: 50, borderRadius: 25 },
  label: { alignSelf: 'stretch', color: '#C9B3D6', fontWeight: '800', fontSize: 13, marginTop: 4 },
  input: {
    alignSelf: 'stretch',
    height: 42,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#6A4A7A',
    backgroundColor: '#1E0E24',
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
    paddingHorizontal: 12,
    marginTop: 3,
  },
  inputRow: { alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', gap: 8 },
  grow: { flex: 1, alignSelf: 'auto' },
  dice: { width: 44, height: 42, marginTop: 3, borderRadius: 12, borderWidth: 2, borderColor: gold, backgroundColor: '#3A1D40', alignItems: 'center', justifyContent: 'center' },
  diceText: { fontSize: 22 },
  buttons: { flexDirection: 'row', gap: 10, marginTop: 12 },
});
