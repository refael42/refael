import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useDir } from '../../i18n';
import type { IconName } from '../../render/art/icons';
import { Icon } from '../Icon';
import { C } from '../theme';

export interface Toast {
  id: number;
  icon: IconName;
  text: string;
  /** performance.now() when shown. */
  at: number;
  tone: 'info' | 'warn' | 'good';
}

export const TOAST_MS = 2800;

export const Toasts = memo(function Toasts({ items, now }: { items: Toast[]; now: number }) {
  const dir = useDir();
  return (
    <View style={styles.wrap} pointerEvents="none">
      {items.map((it) => {
        const age = now - it.at;
        const opacity = age > TOAST_MS - 500 ? Math.max(0, (TOAST_MS - age) / 500) : 1;
        return (
          <View
            key={it.id}
            style={[styles.toast, { opacity, flexDirection: dir.row, borderColor: it.tone === 'warn' ? C.red : it.tone === 'good' ? C.green : C.ink }]}
          >
            <Icon name={it.icon} size={22} />
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
  wrap: { alignItems: 'center', gap: 6, paddingHorizontal: 12 },
  toast: {
    alignItems: 'center',
    gap: 8,
    maxWidth: 360,
    backgroundColor: 'rgba(32,40,61,0.94)',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 2,
  },
  text: { color: C.text, fontSize: 13, fontWeight: '700', flexShrink: 1 },
});
