import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useDir } from '../../i18n';
import type { IconName } from '../../render/art/icons';
import { Icon } from '../Icon';
import { C, SHADOW_SM } from '../theme';

export interface Toast {
  id: number;
  icon: IconName;
  text: string;
  /** performance.now() when shown. */
  at: number;
  tone: 'info' | 'warn' | 'good';
}

export const TOAST_MS = 2800;

const TONE = { info: C.primary, warn: C.red, good: C.green } as const;

export const Toasts = memo(function Toasts({ items, now }: { items: Toast[]; now: number }) {
  const dir = useDir();
  return (
    <View style={styles.wrap} pointerEvents="none">
      {items.map((it) => {
        const age = now - it.at;
        const opacity = age > TOAST_MS - 500 ? Math.max(0, (TOAST_MS - age) / 500) : 1;
        return (
          <View key={it.id} style={[styles.toast, { opacity, flexDirection: dir.row }]}>
            <View style={[styles.dot, { backgroundColor: TONE[it.tone] }]} />
            <Icon name={it.icon} size={20} />
            <Text style={[styles.text, { textAlign: dir.textAlign, writingDirection: dir.writingDirection }]} numberOfLines={2}>
              {it.text}
            </Text>
          </View>
        );
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 6, paddingHorizontal: 14 },
  toast: {
    alignItems: 'center',
    gap: 8,
    maxWidth: 360,
    backgroundColor: C.glassStrong,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: C.glassEdge,
    ...SHADOW_SM,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  text: { color: C.text, fontSize: 13, fontWeight: '600', flexShrink: 1 },
});
