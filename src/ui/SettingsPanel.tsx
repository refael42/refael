import { useEffect, useState } from 'react';
import { Image, PixelRatio, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useT } from '../i18n';
import { spriteIcon } from '../render/icons';
import { eraseSave } from '../store/persistence';
import { useSettings } from '../store/settings';
import { gold, panel } from './theme';

const GEAR_PX = 30;

/** The round gear in the corner: everything that is not the game lives behind it. */
export function GearButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="settings" onPress={onPress} hitSlop={8} style={styles.gearButton}>
      <Image source={{ uri: spriteIcon('gear', Math.round(GEAR_PX * PixelRatio.get())) }} style={styles.gear} />
    </Pressable>
  );
}

function Toggle({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="switch" accessibilityState={{ checked: on }} onPress={onPress} style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={[styles.switch, on && styles.switchOn]}>
        <View style={styles.knob} />
      </View>
    </Pressable>
  );
}

const RESET_CONFIRM_MS = 4000;

export function SettingsPanel({ onClose }: { onClose: () => void }) {
  const t = useT();
  const { lang, setLang, showPerf, togglePerf, stress, toggleStress, view, setView, restartGame } = useSettings();
  // Erasing progress takes two taps: the first one arms it for a few seconds.
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const id = setTimeout(() => setArmed(false), RESET_CONFIRM_MS);
    return () => clearTimeout(id);
  }, [armed]);
  const reset = () => {
    if (!armed) return setArmed(true);
    void eraseSave().then(() => {
      restartGame();
      onClose();
    });
  };

  const enter = useSharedValue(0);
  useEffect(() => {
    enter.value = withTiming(1, { duration: 200, easing: Easing.out(Easing.cubic) });
  }, [enter]);
  const enterStyle = useAnimatedStyle(() => ({ opacity: enter.value, transform: [{ scale: 0.9 + enter.value * 0.1 }] }));

  return (
    <Pressable style={styles.backdrop} onPress={onClose}>
      <Animated.View style={[styles.card, enterStyle]}>
        {/* Taps inside the card must not close it. */}
        <Pressable style={styles.inner} onPress={() => undefined}>
          <View style={styles.header}>
            <Text style={styles.title}>{t('ui.settings')}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="close" onPress={onClose} hitSlop={10} style={styles.close}>
              <Text style={styles.closeText}>{'✕'}</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.body}>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>{t('set.language')}</Text>
              <View style={styles.chips}>
                {(['he', 'en'] as const).map((l) => (
                  <Pressable key={l} onPress={() => setLang(l)} style={[styles.chip, lang === l && styles.chipOn]}>
                    <Text style={[styles.chipText, lang === l && styles.chipTextOn]}>{l === 'he' ? 'עברית' : 'English'}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>{t('set.sound')}</Text>
              <Text style={styles.soon}>{t('set.soon')}</Text>
            </View>
            <Toggle label={t('set.fps')} on={showPerf} onPress={togglePerf} />
            <Text style={styles.section}>{t('set.testing')}</Text>
            <Toggle label={t('set.cast')} on={view === 'cast'} onPress={() => setView(view === 'cast' ? 'game' : 'cast')} />
            <Toggle label={t('set.stress')} on={stress > 0} onPress={toggleStress} />
            <Pressable accessibilityRole="button" onPress={reset} style={[styles.reset, armed && styles.resetArmed]}>
              <Text style={styles.resetText}>{armed ? t('set.resetConfirm') : t('set.reset')}</Text>
            </Pressable>
          </ScrollView>
        </Pressable>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  gearButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#2A1530',
    borderWidth: 2,
    borderColor: gold,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0px 3px 0px #120818',
  },
  gear: { width: GEAR_PX, height: GEAR_PX },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(14,6,18,0.55)', alignItems: 'center', justifyContent: 'center' },
  card: {
    width: 400,
    maxWidth: '92%',
    maxHeight: '92%',
    backgroundColor: panel.bg,
    borderRadius: 20,
    borderWidth: 2.5,
    borderColor: gold,
    overflow: 'hidden',
    boxShadow: '0px 6px 0px #120818',
  },
  inner: { flexShrink: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  title: { flex: 1, color: '#FFE9A8', fontSize: 20, fontWeight: '900' },
  close: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#4A2550', alignItems: 'center', justifyContent: 'center' },
  closeText: { color: '#FFE9A8', fontSize: 16, fontWeight: '900' },
  body: { paddingHorizontal: 12, paddingBottom: 14, gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: panel.row, borderRadius: 14, paddingHorizontal: 12, minHeight: 48, gap: 10 },
  rowLabel: { color: '#FFF4E3', fontWeight: '800', fontSize: 14, flexShrink: 1 },
  chips: { flexDirection: 'row', gap: 6 },
  chip: { height: 34, paddingHorizontal: 14, borderRadius: 17, backgroundColor: '#24122A', justifyContent: 'center', borderWidth: 1.5, borderColor: '#5A3A64' },
  chipOn: { backgroundColor: gold, borderColor: gold },
  chipText: { color: '#E8D7F0', fontWeight: '800', fontSize: 13 },
  chipTextOn: { color: '#2A1530' },
  soon: { color: '#9C88A8', fontWeight: '700', fontSize: 12 },
  switch: { width: 50, height: 28, borderRadius: 14, backgroundColor: '#5A4E66', padding: 3, alignItems: 'flex-start' },
  switchOn: { backgroundColor: '#35B957', alignItems: 'flex-end' },
  knob: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#FFFFFF' },
  section: { color: '#C9B3D6', fontWeight: '800', fontSize: 12, marginTop: 4, marginHorizontal: 4 },
  reset: { minHeight: 46, borderRadius: 14, borderWidth: 2, borderColor: '#E5483B', alignItems: 'center', justifyContent: 'center', marginTop: 6, paddingHorizontal: 10 },
  resetArmed: { backgroundColor: '#E5483B' },
  resetText: { color: '#FFFFFF', fontWeight: '900', fontSize: 14, textAlign: 'center' },
});
