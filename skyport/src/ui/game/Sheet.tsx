import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useDir } from '../../i18n';
import { Icon } from '../Icon';
import { C, SHADOW } from '../theme';

/** Width of the side panel in landscape (the map stays visible next to it). */
export function sideWidth(w: number): number {
  return Math.round(Math.min(480, Math.max(340, w * 0.46)));
}

/**
 * Game panel: a full-height side drawer in landscape (at the end side: right,
 * or left in Hebrew), a bottom sheet on a tall window.
 */
export function Sheet({ title, subtitle, onClose, children, footer }: { title: string; subtitle?: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  const dir = useDir();
  const ta = { textAlign: dir.textAlign, writingDirection: dir.writingDirection } as const;
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const side = width > height;
  return (
    <View style={[styles.backdrop, side && { flexDirection: 'row', justifyContent: dir.rtl ? 'flex-start' : 'flex-end', alignItems: 'stretch' }]}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <View
        style={
          side
            ? [styles.side, { width: sideWidth(width), paddingTop: insets.top + 12 }, dir.rtl ? { borderTopRightRadius: 28, borderBottomRightRadius: 28, paddingLeft: insets.left } : { borderTopLeftRadius: 28, borderBottomLeftRadius: 28, paddingRight: insets.right }]
            : styles.sheet
        }
        testID="panel"
      >
        {side ? null : <View style={styles.handle} />}
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
        <ScrollView style={side ? styles.scrollSide : styles.scroll} contentContainerStyle={[styles.content, side && { paddingBottom: insets.bottom + 24 }]}>
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
  scrollSide: { flex: 1 },
  side: { height: '100%', backgroundColor: '#f8fafc', ...SHADOW },
  content: { paddingHorizontal: 14, paddingBottom: 24, gap: 12 },
});
