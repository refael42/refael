import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FIRST_NAMES, LAST_NAMES, STAFF_ROLES } from '../../data/staff';
import { useDir, useLang, useT, type Lang, type TKey } from '../../i18n';
import { formatBig, MAX_PER_ROLE, type Applicant, type StaffMember } from '../../sim';
import { Icon } from '../Icon';
import { C } from '../theme';
import { Sheet } from './Sheet';

export function personName(p: { first: number; last: number }, lang: Lang): string {
  const f = FIRST_NAMES[p.first] ?? FIRST_NAMES[0];
  const l = LAST_NAMES[p.last] ?? LAST_NAMES[0];
  return `${f[lang]} ${l[lang]}`;
}

const ROLE_COLOR: Record<string, string> = { atc: '#6366f1', fueler: '#f59e0b', porter: '#8b5cf6', agent: '#3b82f6' };

export interface StaffView {
  money: number;
  staff: StaffMember[];
  applicants: Applicant[];
  wages: number;
}

function Stars({ speed }: { speed: number }) {
  // 0.8..1.3 -> 1..5 dots
  const n = Math.max(1, Math.min(5, Math.round(((speed - 0.8) / 0.5) * 4) + 1));
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {Array.from({ length: 5 }, (_, i) => (
        <View key={i} style={[styles.dot, { backgroundColor: i < n ? C.gold : C.track }]} />
      ))}
    </View>
  );
}

export function StaffPanel({ view, onHire, onClose }: { view: StaffView; onHire: (applicantId: number) => void; onClose: () => void }) {
  const t = useT();
  const dir = useDir();
  const lang = useLang();
  const ta = { textAlign: dir.textAlign, writingDirection: dir.writingDirection } as const;
  return (
    <Sheet title={t('staff.title')} subtitle={`${t('staff.subtitle')} · ${t('staff.wagesDay', { amount: formatBig(view.wages) })}`} onClose={onClose}>
      {STAFF_ROLES.map((role, ri) => {
        const team = view.staff.filter((m) => m.role === ri);
        const a = view.applicants.find((x) => x.role === ri);
        const full = team.length >= MAX_PER_ROLE;
        const afford = a ? view.money >= a.cost : false;
        const color = ROLE_COLOR[role.id] ?? C.primary;
        return (
          <View key={role.id} style={styles.card}>
            <View style={[styles.row, { flexDirection: dir.row }]}>
              <View style={[styles.avatar, { backgroundColor: color }]}>
                <Text style={styles.avatarText}>{team.length}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.role, ta]}>{t(`role.${role.id}` as TKey)}</Text>
                <Text style={[styles.desc, ta]}>{t(`roleDesc.${role.id}` as TKey)}</Text>
              </View>
            </View>
            {team.length > 0 ? (
              <View style={[styles.team, { flexDirection: dir.row }]}>
                {team.map((m) => (
                  <View key={m.id} style={[styles.member, { flexDirection: dir.row }]}>
                    <View style={[styles.mini, { backgroundColor: color }]} />
                    <Text style={styles.memberName} numberOfLines={1}>
                      {personName(m, lang)}
                    </Text>
                    <Stars speed={m.speed} />
                  </View>
                ))}
              </View>
            ) : null}
            {a && !full ? (
              <View style={[styles.applicant, { flexDirection: dir.row }]}>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={[styles.small, ta]}>{t('staff.applicant')}</Text>
                  <Text style={[styles.name, ta]} numberOfLines={1}>
                    {personName(a, lang)}
                  </Text>
                  <View style={[styles.row, { flexDirection: dir.row, gap: 8 }]}>
                    <Stars speed={a.speed} />
                    <Text style={styles.small}>{t('staff.wage', { amount: formatBig(a.wage) })}</Text>
                  </View>
                </View>
                <Pressable
                  onPress={() => onHire(a.id)}
                  disabled={!afford}
                  style={({ pressed }) => [styles.hire, { flexDirection: dir.row }, !afford && styles.hireOff, pressed && { transform: [{ scale: 0.97 }] }]}
                  accessibilityRole="button"
                  accessibilityLabel={`${t('staff.hire')} ${t(`role.${role.id}` as TKey)}`}
                >
                  <Text style={[styles.hireText, !afford && { color: C.textDim }]}>{t('staff.hire')}</Text>
                  <View style={[styles.price, { flexDirection: dir.row }]}>
                    <Icon name="coin" size={16} />
                    <Text style={[styles.priceText, !afford && { color: C.textDim }]}>{formatBig(a.cost)}</Text>
                  </View>
                </Pressable>
              </View>
            ) : (
              <Text style={[styles.small, ta]}>{full ? t('staff.max') : ''}</Text>
            )}
          </View>
        );
      })}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#ffffff', borderRadius: 20, padding: 14, gap: 10, boxShadow: '0px 2px 8px rgba(15,23,42,0.06)' },
  row: { alignItems: 'center', gap: 12 },
  avatar: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontWeight: '900', fontSize: 16 },
  role: { color: C.text, fontSize: 16, fontWeight: '800' },
  desc: { color: C.textDim, fontSize: 13 },
  team: { flexWrap: 'wrap', gap: 6 },
  member: { alignItems: 'center', gap: 6, backgroundColor: C.chip, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  mini: { width: 8, height: 8, borderRadius: 4 },
  memberName: { color: C.text, fontSize: 12, fontWeight: '700', maxWidth: 120 },
  applicant: { alignItems: 'center', gap: 10, backgroundColor: C.primarySoft, borderRadius: 16, padding: 10 },
  small: { color: C.textDim, fontSize: 12, fontWeight: '600' },
  name: { color: C.text, fontSize: 15, fontWeight: '800' },
  dot: { width: 7, height: 7, borderRadius: 4 },
  hire: { backgroundColor: C.green, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 9, alignItems: 'center', gap: 8 },
  hireOff: { backgroundColor: C.track },
  hireText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  price: { alignItems: 'center', gap: 3, backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2 },
  priceText: { color: C.text, fontWeight: '800', fontSize: 13 },
});
