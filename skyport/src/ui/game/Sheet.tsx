import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useDir } from '../../i18n';
import { Icon } from '../Icon';
import { C, SHADOW } from '../theme';

/** Modern bottom sheet used by the game panels. */
export function Sheet({ title, subtitle, onClose, children, footer }: { title: string; subtitle?: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  const dir = useDir();
  const ta = { textAlign: dir.textAlign, writingDirection: dir.writingDirection } as const;
  return (
    <View style={styles.backdrop}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <View style={[styles.head, { flexDirection: dir.row }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, ta]} numberOfLines={1}>
              {title}
            </Text>
            {subtitle ? (
              <Text style={[styles.sub, ta]} numberOfLines={2}>
                {subtitle}
              </Text>
            ) : null}
          </View>
          <Pressable onPress={onClose} hitSlop={10} style={styles.close}>
            <Icon name="close" size={16} />
          </Pressable>
        </View>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
          {children}
        </ScrollView>
        {footer}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.3)', justifyContent: 'flex-end', alignItems: 'center' },
  sheet: {
    width: '100%',
    maxWidth: 560,
    maxHeight: '86%',
    backgroundColor: '#f8fafc',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 8,
    ...SHADOW,
  },
  handle: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: '#cbd5e1', marginBottom: 6 },
  head: { alignItems: 'center', gap: 10, paddingHorizontal: 18, paddingBottom: 10 },
  title: { color: C.text, fontSize: 22, fontWeight: '800', letterSpacing: -0.4 },
  sub: { color: C.textDim, fontSize: 13, marginTop: 2 },
  close: { width: 34, height: 34, borderRadius: 17, backgroundColor: C.chip, alignItems: 'center', justifyContent: 'center' },
  scroll: { flexGrow: 0 },
  content: { paddingHorizontal: 14, paddingBottom: 24, gap: 12 },
});
