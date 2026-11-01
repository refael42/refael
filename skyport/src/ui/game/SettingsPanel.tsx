import { Pressable, StyleSheet, Text, View } from 'react-native';

import { LANGS, useDir, useLang, useT, type TKey } from '../../i18n';
import { useSettings } from '../../settings/store';
import { Icon } from '../Icon';
import { C } from '../theme';

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
          <Icon name="gear" size={26} />
          <Text style={[styles.title, ta, { flex: 1 }]}>{t('settings.title')}</Text>
          <Pressable onPress={onClose} hitSlop={10} style={styles.close}>
            <Icon name="close" size={18} />
          </Pressable>
        </View>
        <Text style={[styles.label, ta]}>{t('settings.language')}</Text>
        <View style={[styles.row, { flexDirection: dir.row }]}>
          {LANGS.map((l) => (
            <Pressable key={l} onPress={() => setLang(l)} style={[styles.choice, lang === l && styles.choiceOn]}>
              <Text style={styles.choiceText}>{t(`lang.${l}` as TKey)}</Text>
            </Pressable>
          ))}
        </View>
        <Pressable onPress={() => setShowFps(!showFps)} style={[styles.toggle, { flexDirection: dir.row }]}>
          <Text style={[styles.label, ta, { flex: 1 }]}>{t('settings.fps')}</Text>
          <View style={[styles.switch, showFps && styles.switchOn]}>
            <Text style={styles.switchText}>{showFps ? t('settings.on') : t('settings.off')}</Text>
          </View>
        </Pressable>
        <Pressable onPress={onGallery} style={styles.link}>
          <Text style={styles.linkText}>{t('settings.gallery')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(10,14,24,0.55)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  panel: { width: '100%', maxWidth: 420, backgroundColor: C.panel, borderRadius: 20, borderWidth: 2, borderColor: C.ink, padding: 16, gap: 12 },
  head: { alignItems: 'center', gap: 10 },
  title: { color: C.text, fontSize: 20, fontWeight: '900' },
  close: { width: 32, height: 32, borderRadius: 16, backgroundColor: C.panelHi, alignItems: 'center', justifyContent: 'center' },
  label: { color: C.textDim, fontSize: 14, fontWeight: '700' },
  row: { gap: 8 },
  choice: { flex: 1, backgroundColor: C.panelHi, borderRadius: 12, paddingVertical: 10, alignItems: 'center', borderWidth: 2, borderColor: 'transparent' },
  choiceOn: { borderColor: C.gold, backgroundColor: '#3a4a74' },
  choiceText: { color: C.text, fontSize: 16, fontWeight: '800' },
  toggle: { alignItems: 'center', gap: 10 },
  switch: { minWidth: 64, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, backgroundColor: C.panelHi, alignItems: 'center' },
  switchOn: { backgroundColor: C.green },
  switchText: { color: '#fff', fontWeight: '800' },
  link: { backgroundColor: C.blue, borderRadius: 12, paddingVertical: 10, alignItems: 'center', borderWidth: 2, borderColor: C.ink },
  linkText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
