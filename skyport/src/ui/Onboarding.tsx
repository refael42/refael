/** First launch: language, names (with a dice), and how to play in three cards. */
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { FIRST_NAMES, LAST_NAMES } from '../data/staff';
import { LANGS, useDir, useLang, useT, type TKey } from '../i18n';
import { useSettings } from '../settings/store';
import { Icon } from './Icon';
import { C, SHADOW } from './theme';

const PLACES = 10;

export function randomNames(lang: 'en' | 'he', t: (k: TKey, p?: Record<string, string | number>) => string) {
  const f = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
  const l = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
  const place = t(`ap.p${Math.floor(Math.random() * PLACES)}` as TKey);
  return { manager: `${f[lang]} ${l[lang]}`, airport: t('ap.name', { place }) };
}

export function Onboarding({ onDone }: { onDone: (names: { manager: string; airport: string }) => void }) {
  const t = useT();
  const dir = useDir();
  const lang = useLang();
  const setLang = useSettings((s) => s.setLang);
  const [step, setStep] = useState(0);
  const [names, setNames] = useState(() => randomNames(lang, t));
  const ta = { textAlign: dir.textAlign, writingDirection: dir.writingDirection } as const;
  const how = [
    { icon: 'actLand' as const, title: t('ob.how1t'), body: t('ob.how1') },
    { icon: 'coin' as const, title: t('ob.how2t'), body: t('ob.how2') },
    { icon: 'team' as const, title: t('ob.how3t'), body: t('ob.how3') },
  ];
  const next = () => (step < 4 ? setStep(step + 1) : onDone(names));
  return (
    <View style={styles.root}>
      <View style={[styles.glow, { top: '10%', left: '-20%', backgroundColor: 'rgba(99,102,241,0.25)' }]} />
      <View style={styles.card}>
        <View style={[styles.dots, { flexDirection: dir.row }]}>
          {Array.from({ length: 5 }, (_, i) => (
            <View key={i} style={[styles.dot, i === step && styles.dotOn]} />
          ))}
        </View>
        {step === 0 ? (
          <>
            <Icon name="plane" size={56} />
            <Text style={styles.title}>{t('ob.welcome')}</Text>
            <Text style={styles.sub}>{t('ob.pickLang')}</Text>
            <View style={[styles.row, { flexDirection: dir.row }]}>
              {LANGS.map((l) => (
                <Pressable key={l} onPress={() => setLang(l)} style={[styles.choice, lang === l && styles.choiceOn]}>
                  <Text style={[styles.choiceText, lang === l && { color: C.primary }]}>{t(`lang.${l}` as TKey)}</Text>
                </Pressable>
              ))}
            </View>
          </>
        ) : step === 1 ? (
          <>
            <Text style={styles.title}>{t('ob.names')}</Text>
            <Text style={[styles.label, ta]}>{t('ob.manager')}</Text>
            <TextInput value={names.manager} onChangeText={(v) => setNames({ ...names, manager: v.slice(0, 24) })} style={[styles.input, ta]} />
            <Text style={[styles.label, ta]}>{t('ob.airport')}</Text>
            <TextInput value={names.airport} onChangeText={(v) => setNames({ ...names, airport: v.slice(0, 24) })} style={[styles.input, ta]} />
            <Pressable onPress={() => setNames(randomNames(lang, t))} style={[styles.dice, { flexDirection: dir.row }]} accessibilityRole="button" accessibilityLabel={t('ob.random')}>
              <View style={styles.die}>
                {[0, 1, 2].map((k) => (
                  <View key={k} style={[styles.pip, { top: 5 + k * 7, left: 5 + k * 7 }]} />
                ))}
              </View>
              <Text style={styles.diceText}>{t('ob.random')}</Text>
            </Pressable>
          </>
        ) : (
          <>
            <View style={styles.bigIcon}>
              <Icon name={how[step - 2].icon} size={64} />
            </View>
            <Text style={styles.title}>{how[step - 2].title}</Text>
            <Text style={styles.body}>{how[step - 2].body}</Text>
          </>
        )}
        <Pressable onPress={next} style={({ pressed }) => [styles.btn, pressed && { transform: [{ scale: 0.98 }] }]} accessibilityRole="button" accessibilityLabel={step < 4 ? t('ob.next') : t('ob.start')}>
          <Text style={styles.btnText}>{step < 4 ? t('ob.next') : t('ob.start')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.night, alignItems: 'center', justifyContent: 'center', padding: 20, overflow: 'hidden' },
  glow: { position: 'absolute', width: 460, height: 460, borderRadius: 230 },
  card: { width: '100%', maxWidth: 400, backgroundColor: '#ffffff', borderRadius: 28, padding: 22, gap: 12, alignItems: 'center', ...SHADOW },
  dots: { gap: 6, marginBottom: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.track },
  dotOn: { width: 22, backgroundColor: C.primary },
  title: { color: C.text, fontSize: 22, fontWeight: '900', textAlign: 'center', letterSpacing: -0.3 },
  sub: { color: C.textDim, fontSize: 14, fontWeight: '600' },
  body: { color: C.textDim, fontSize: 15, textAlign: 'center', lineHeight: 21 },
  row: { gap: 10, alignSelf: 'stretch' },
  choice: { flex: 1, backgroundColor: C.chip, borderRadius: 14, paddingVertical: 14, alignItems: 'center', borderWidth: 2, borderColor: 'transparent' },
  choiceOn: { borderColor: C.primary, backgroundColor: C.primarySoft },
  choiceText: { color: C.text, fontSize: 17, fontWeight: '800' },
  label: { alignSelf: 'stretch', color: C.textDim, fontSize: 13, fontWeight: '700' },
  input: { alignSelf: 'stretch', backgroundColor: C.chip, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: C.text, fontWeight: '700' },
  dice: { alignItems: 'center', gap: 8, backgroundColor: C.primarySoft, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  die: { width: 26, height: 26, borderRadius: 7, backgroundColor: C.primary },
  pip: { position: 'absolute', width: 5, height: 5, borderRadius: 3, backgroundColor: '#fff' },
  diceText: { color: C.primary, fontWeight: '800' },
  bigIcon: { width: 110, height: 110, borderRadius: 55, backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'center' },
  btn: { alignSelf: 'stretch', backgroundColor: C.primary, borderRadius: 16, paddingVertical: 14, alignItems: 'center', marginTop: 6 },
  btnText: { color: '#fff', fontSize: 17, fontWeight: '800' },
});
