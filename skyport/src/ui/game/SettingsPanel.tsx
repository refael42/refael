import { Pressable, StyleSheet, Text, View } from 'react-native';

import { LANGS, useDir, useLang, useT, type TKey } from '../../i18n';
import { useSettings } from '../../settings/store';
import { Icon } from '../Icon';
import { C, SHADOW } from '../theme';

function Switch({ on }: { on: boolean }) {
  return (
    <View style={[styles.switch, on && styles.switchOn]}>
      <View style={[styles.knob, on ? { right: 3 } : { left: 3 }]} />
    </View>
  );
}

export function SettingsPanel({ onClose, onGallery }: { onClose: () => void; onGallery: () => void }) {
  const t = useT();
  const dir = useDir();
  const lang = useLang();
  const setLang = useSettings((s) => s.setLang);
  const showFps = useSettings((s) => s.showFps);
  const setShowFps = useSettings((s) => s.setShowFps);
  const ta = { textAlign: dir.textAlign, writingDirection: dir.writingDirection } as const;
  return (
    <View style={styles.backdrop}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <View style={styles.panel}>
        <View style={[styles.head, { flexDirection: dir.row }]}>
          <Text style={[styles.title, ta, { flex: 1 }]}>{t('settings.title')}</Text>
          <Pressable onPress={onClose} hitSlop={10} style={styles.close}>
            <Icon name="close" size={16} />
          </Pressable>
        </View>
        <View style={styles.group}>
          <Text style={[styles.label, ta]}>{t('settings.language')}</Text>
          <View style={[styles.segment, { flexDirection: dir.row }]}>
            {LANGS.map((l) => (
              <Pressable key={l} onPress={() => setLang(l)} style={[styles.segItem, lang === l && styles.segOn]}>
                <Text style={[styles.segText, lang === l && styles.segTextOn]}>{t(`lang.${l}` as TKey)}</Text>
              </Pressable>
            ))}
          </View>
        </View>
        <Pressable onPress={() => setShowFps(!showFps)} style={[styles.rowItem, { flexDirection: dir.row }]}>
          <Text style={[styles.rowText, ta, { flex: 1 }]}>{t('settings.fps')}</Text>
          <Switch on={showFps} />
        </Pressable>
        <Pressable onPress={onGallery} style={({ pressed }) => [styles.secondary, pressed && { opacity: 0.8 }]}>
          <Text style={styles.secondaryText}>{t('settings.gallery')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.35)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  panel: { width: '100%', maxWidth: 400, backgroundColor: C.glassStrong, borderRadius: 26, padding: 18, gap: 16, borderWidth: 1, borderColor: C.glassEdge, ...SHADOW },
  head: { alignItems: 'center', gap: 10 },
  title: { color: C.text, fontSize: 22, fontWeight: '800', letterSpacing: -0.4 },
  close: { width: 32, height: 32, borderRadius: 16, backgroundColor: C.chip, alignItems: 'center', justifyContent: 'center' },
  group: { gap: 8 },
  label: { color: C.textDim, fontSize: 13, fontWeight: '700' },
  segment: { backgroundColor: C.chip, borderRadius: 14, padding: 4, gap: 4 },
  segItem: { flex: 1, borderRadius: 11, paddingVertical: 9, alignItems: 'center' },
  segOn: { backgroundColor: '#ffffff', boxShadow: '0px 2px 6px rgba(15,23,42,0.12)' },
  segText: { color: C.textDim, fontSize: 15, fontWeight: '700' },
  segTextOn: { color: C.text },
  rowItem: { alignItems: 'center', gap: 12, backgroundColor: C.chip, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12 },
  rowText: { color: C.text, fontSize: 15, fontWeight: '600' },
  switch: { width: 46, height: 28, borderRadius: 14, backgroundColor: '#cbd5e1' },
  switchOn: { backgroundColor: C.green },
  knob: { position: 'absolute', top: 3, width: 22, height: 22, borderRadius: 11, backgroundColor: '#ffffff', boxShadow: '0px 1px 3px rgba(15,23,42,0.3)' },
  secondary: { backgroundColor: C.primarySoft, borderRadius: 14, paddingVertical: 12, alignItems: 'center' },
  secondaryText: { color: C.primary, fontWeight: '800', fontSize: 15 },
});
