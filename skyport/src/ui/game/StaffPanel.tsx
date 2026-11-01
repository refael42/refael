import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FIRST_NAMES, LAST_NAMES, RARITIES, STAFF_ROLES, TALENT_MAX, TALENTS, TRAITS } from '../../data/staff';
import { useDir, useLang, useT, type Lang, type TKey } from '../../i18n';
import { formatBig, formatDuration, MAX_PER_ROLE, xpForLevel, type Applicant, type Command, type StaffMember } from '../../sim';
import { Icon } from '../Icon';
import { C } from '../theme';
import { Sheet } from './Sheet';

export function personName(p: { first: number; last: number }, lang: Lang): string {
  const f = FIRST_NAMES[p.first] ?? FIRST_NAMES[0];
  const l = LAST_NAMES[p.last] ?? LAST_NAMES[0];
  return `${f[lang]} ${l[lang]}`;
}

export const ROLE_COLOR: Record<string, string> = { atc: '#6366f1', fueler: '#f59e0b', porter: '#8b5cf6', agent: '#3b82f6' };

export interface StaffView {
  money: number;
  staff: StaffMember[];
  applicants: Applicant[];
  wages: number;
  time: number;
  tier: number;
}

function Stars({ speed }: { speed: number }) {
  const n = Math.max(1, Math.min(5, Math.round(((speed - 0.8) / 0.9) * 4) + 1));
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {Array.from({ length: 5 }, (_, i) => (
        <View key={i} style={[styles.dot, { backgroundColor: i < n ? C.gold : C.track }]} />
      ))}
    </View>
  );
}

function Meter({ label, value, color }: { label: string; value: number; color: string }) {
  const dir = useDir();
  return (
    <View style={[styles.meterRow, { flexDirection: dir.row }]}>
      <Text style={[styles.meterLabel, { textAlign: dir.textAlign }]} numberOfLines={1}>
        {label}
      </Text>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${Math.max(3, Math.min(100, value * 100))}%`, backgroundColor: color, [dir.rtl ? 'right' : 'left']: 0 }]} />
      </View>
    </View>
  );
}

function Traits({ traits }: { traits: number[] }) {
  const t = useT();
  const dir = useDir();
  return (
    <View style={[styles.wrapRow, { flexDirection: dir.row }]}>
      {traits.map((k) => {
        const tr = TRAITS[k];
        if (!tr) return null;
        return (
          <View key={k} style={[styles.trait, { backgroundColor: tr.good ? C.greenSoft : C.redSoft }]}>
            <Text style={[styles.traitText, { color: tr.good ? '#047857' : '#b91c1c' }]}>{t(`trait.${tr.id}` as TKey)}</Text>
          </View>
        );
      })}
    </View>
  );
}

function RarityChip({ rarity }: { rarity: number }) {
  const t = useT();
  const R = RARITIES[rarity] ?? RARITIES[0];
  return (
    <View style={[styles.rarity, { backgroundColor: R.color }]}>
      <Text style={styles.rarityText}>{t(`rarity.${R.id}` as TKey)}</Text>
    </View>
  );
}

export function StaffPanel({ view, send, onClose }: { view: StaffView; send: (c: Command) => void; onClose: () => void }) {
  const t = useT();
  const dir = useDir();
  const lang = useLang();
  const [tab, setTab] = useState<'team' | 'applicants'>(view.staff.length > 0 ? 'team' : 'applicants');
  const [open, setOpen] = useState<number>(0);
  const ta = { textAlign: dir.textAlign, writingDirection: dir.writingDirection } as const;
  const roleName = (r: number) => t(`role.${STAFF_ROLES[r]?.id ?? 'atc'}` as TKey);
  const count = (r: number) => view.staff.filter((m) => m.role === r).length;
  const pending = view.staff.filter((m) => m.raise > 0 || m.trialUntil === 1);

  const member = (m: StaffMember) => {
    const color = ROLE_COLOR[STAFF_ROLES[m.role]?.id ?? 'atc'];
    const R = RARITIES[m.rarity] ?? RARITIES[0];
    const expanded = open === m.id;
    const onBreak = m.energy < 0.6 && m.busyUntil <= view.time && m.breakUntil > view.time;
    return (
      <Pressable key={m.id} onPress={() => setOpen(expanded ? 0 : m.id)} style={[styles.card, { borderColor: R.color + '66' }]}>
        <View style={[styles.row, { flexDirection: dir.row }]}>
          <View style={[styles.avatar, { backgroundColor: color, borderColor: R.color }]}>
            <Text style={styles.avatarText}>{m.level}</Text>
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <View style={[styles.row, { flexDirection: dir.row, gap: 6 }]}>
              <Text style={[styles.name, ta]} numberOfLines={1}>
                {personName(m, lang)}
              </Text>
              <RarityChip rarity={m.rarity} />
            </View>
            <Text style={[styles.small, ta]} numberOfLines={1}>
              {roleName(m.role)} · {t('staff.wage', { amount: formatBig(m.wage) })}
              {m.trialUntil > 1 ? ` · ${t('staff.trial', { t: formatDuration(m.trialUntil - view.time) })}` : ''}
              {onBreak ? ` · ${t('staff.onBreak')}` : ''}
            </Text>
          </View>
          {m.points > 0 ? <View style={styles.pointsBadge}><Text style={styles.pointsText}>+{m.points}</Text></View> : null}
        </View>
        <Traits traits={m.traits} />
        <Meter label={t('staff.mood')} value={m.mood} color={m.mood > 0.6 ? C.green : m.mood > 0.35 ? C.amber : C.red} />
        <Meter label={t('staff.energy')} value={m.energy} color={C.blue} />
        <Meter label={t('staff.xp')} value={m.xp / xpForLevel(m.level)} color={C.primary} />
        {expanded ? (
          <View style={{ gap: 10, marginTop: 4 }}>
            <Text style={[styles.section, ta]}>
              {t('staff.talents')}
              {m.points > 0 ? ` · ${t('staff.points', { n: m.points })}` : ''}
            </Text>
            <View style={[styles.wrapRow, { flexDirection: dir.row }]}>
              {TALENTS.map((tal, i) => (
                <Pressable
                  key={tal}
                  disabled={m.points <= 0 || m.talents[i] >= TALENT_MAX}
                  onPress={() => send({ type: 'talent', staffId: m.id, talent: i })}
                  style={[styles.talent, m.points > 0 && m.talents[i] < TALENT_MAX && styles.talentOn]}
                >
                  <Text style={styles.talentName}>{t(`talent.${tal}` as TKey)}</Text>
                  <View style={{ flexDirection: 'row', gap: 2 }}>
                    {Array.from({ length: TALENT_MAX }, (_, k) => (
                      <View key={k} style={[styles.pip, { backgroundColor: k < m.talents[i] ? C.primary : C.track }]} />
                    ))}
                  </View>
                </Pressable>
              ))}
            </View>
            <View style={[styles.wrapRow, { flexDirection: dir.row, alignItems: 'center' }]}>
              <Text style={styles.small}>{t('staff.transfer')}</Text>
              {STAFF_ROLES.map((r, i) =>
                i === m.role || r.unlockTier > view.tier ? null : (
                  <Pressable key={r.id} disabled={count(i) >= MAX_PER_ROLE} onPress={() => send({ type: 'transfer', staffId: m.id, role: i })} style={[styles.chip, count(i) >= MAX_PER_ROLE && { opacity: 0.4 }]}>
                    <Text style={styles.chipText}>{roleName(i)}</Text>
                  </Pressable>
                ),
              )}
            </View>
            <Pressable onPress={() => send({ type: 'fire', staffId: m.id })} style={styles.fire}>
              <Text style={styles.fireText}>{t('staff.fire')}</Text>
            </Pressable>
          </View>
        ) : null}
      </Pressable>
    );
  };

  const applicant = (a: Applicant) => {
    const R = RARITIES[a.rarity] ?? RARITIES[0];
    const full = count(a.role) >= MAX_PER_ROLE;
    const afford = view.money >= a.cost;
    const trialBusy = view.staff.some((m) => m.trialUntil > 0);
    return (
      <View key={a.id} style={[styles.card, { borderColor: R.color, borderTopWidth: 4 }]}>
        <View style={[styles.row, { flexDirection: dir.row }]}>
          <View style={[styles.avatar, { backgroundColor: ROLE_COLOR[STAFF_ROLES[a.role]?.id ?? 'atc'], borderColor: R.color }]}>
            <Text style={styles.avatarText}>{a.level}</Text>
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <View style={[styles.row, { flexDirection: dir.row, gap: 6 }]}>
              <Text style={[styles.name, ta]} numberOfLines={1}>
                {personName(a, lang)}
              </Text>
              <RarityChip rarity={a.rarity} />
            </View>
            <Text style={[styles.small, ta]}>
              {roleName(a.role)} · {t('staff.lv', { n: a.level })} · {t('staff.expires', { t: formatDuration(Math.max(0, a.expiresAt - view.time)) })}
            </Text>
          </View>
        </View>
        <Text style={[styles.cv, ta]}>“{t(`cv.${a.cv}` as TKey)}”</Text>
        <Traits traits={a.traits} />
        {a.traits.map((k) => (
          <Text key={k} style={[styles.small, ta]}>
            · {t(`trait.${TRAITS[k].id}` as TKey)}: {t(`traitDesc.${TRAITS[k].id}` as TKey)}
          </Text>
        ))}
        <View style={[styles.row, { flexDirection: dir.row, gap: 10 }]}>
          <Stars speed={a.speed} />
          <Text style={styles.small}>{t('staff.wage', { amount: formatBig(a.wage) })}</Text>
        </View>
        {full ? (
          <Text style={[styles.small, ta]}>{t('staff.max')}</Text>
        ) : (
          <View style={[styles.wrapRow, { flexDirection: dir.row }]}>
            <Pressable
              disabled={!afford}
              onPress={() => send({ type: 'hire', applicantId: a.id })}
              style={[styles.btn, { backgroundColor: afford ? C.green : C.track, flexDirection: dir.row }]}
              accessibilityRole="button"
              accessibilityLabel={`${t('staff.hire')} ${roleName(a.role)}`}
            >
              <Text style={[styles.btnText, !afford && { color: C.textDim }]}>{t('staff.hire')}</Text>
              <View style={[styles.price, { flexDirection: dir.row }]}>
                <Icon name="coin" size={14} />
                <Text style={styles.priceText}>{formatBig(a.cost)}</Text>
              </View>
            </Pressable>
            {!a.negotiated ? (
              <Pressable onPress={() => send({ type: 'negotiate', applicantId: a.id })} style={[styles.btn, styles.btnGhost]}>
                <Text style={styles.btnGhostText}>{t('staff.negotiate')}</Text>
              </Pressable>
            ) : null}
            <Pressable disabled={trialBusy} onPress={() => send({ type: 'trial', applicantId: a.id })} style={[styles.btn, styles.btnGhost, trialBusy && { opacity: 0.4 }]}>
              <Text style={styles.btnGhostText}>{t('staff.tryTrial')}</Text>
            </Pressable>
          </View>
        )}
      </View>
    );
  };

  return (
    <Sheet title={t('staff.title')} subtitle={`${t('staff.subtitle')} · ${t('staff.wagesDay', { amount: formatBig(view.wages) })}`} onClose={onClose}>
      <View style={[styles.tabs, { flexDirection: dir.row }]}>
        {(['team', 'applicants'] as const).map((k) => (
          <Pressable key={k} onPress={() => setTab(k)} style={[styles.tab, tab === k && styles.tabOn]}>
            <Text style={[styles.tabText, tab === k && styles.tabTextOn]}>
              {k === 'team' ? `${t('staff.tabTeam')} (${view.staff.length})` : `${t('staff.tabApplicants')} (${view.applicants.length})`}
            </Text>
          </Pressable>
        ))}
      </View>
      {pending.map((m) => (
        <View key={'p' + m.id} style={styles.banner}>
          <Text style={[styles.bannerText, ta]}>
            {personName(m, lang)}: {m.raise > 0 ? t('staff.raise', { amount: formatBig(m.raise) }) : t('staff.trialOver', { amount: formatBig(m.trialCost) })}
          </Text>
          <View style={[styles.wrapRow, { flexDirection: dir.row }]}>
            {m.raise > 0 ? (
              <>
                <Pressable onPress={() => send({ type: 'answerRaise', staffId: m.id, answer: 1 })} style={[styles.btn, { backgroundColor: C.green }]}>
                  <Text style={styles.btnText}>{t('staff.raiseYes')}</Text>
                </Pressable>
                <Pressable onPress={() => send({ type: 'answerRaise', staffId: m.id, answer: 2 })} style={[styles.btn, styles.btnGhost]}>
                  <Text style={styles.btnGhostText}>{t('staff.raiseCounter')}</Text>
                </Pressable>
                <Pressable onPress={() => send({ type: 'answerRaise', staffId: m.id, answer: 0 })} style={[styles.btn, styles.btnGhost]}>
                  <Text style={styles.btnGhostText}>{t('staff.raiseNo')}</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Pressable onPress={() => send({ type: 'confirmTrial', staffId: m.id, keep: true })} style={[styles.btn, { backgroundColor: C.green }]}>
                  <Text style={styles.btnText}>{t('staff.keep')}</Text>
                </Pressable>
                <Pressable onPress={() => send({ type: 'confirmTrial', staffId: m.id, keep: false })} style={[styles.btn, styles.btnGhost]}>
                  <Text style={styles.btnGhostText}>{t('staff.letGo')}</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
      ))}
      {tab === 'team' ? (
        view.staff.length === 0 ? <Text style={[styles.empty, ta]}>{t('staff.noTeam')}</Text> : view.staff.map(member)
      ) : view.applicants.length === 0 ? (
        <Text style={[styles.empty, ta]}>{t('staff.noApplicants')}</Text>
      ) : (
        view.applicants.map(applicant)
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  tabs: { backgroundColor: C.chip, borderRadius: 14, padding: 4, gap: 4 },
  tab: { flex: 1, borderRadius: 11, paddingVertical: 9, alignItems: 'center' },
  tabOn: { backgroundColor: '#ffffff', boxShadow: '0px 2px 6px rgba(15,23,42,0.12)' },
  tabText: { color: C.textDim, fontWeight: '800', fontSize: 14 },
  tabTextOn: { color: C.text },
  card: { backgroundColor: '#ffffff', borderRadius: 20, padding: 14, gap: 8, borderWidth: 1, boxShadow: '0px 2px 8px rgba(15,23,42,0.06)' },
  row: { alignItems: 'center', gap: 12 },
  wrapRow: { flexWrap: 'wrap', gap: 6 },
  avatar: { width: 44, height: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center', borderWidth: 3 },
  avatarText: { color: '#fff', fontWeight: '900', fontSize: 16 },
  name: { color: C.text, fontSize: 16, fontWeight: '800', flexShrink: 1 },
  small: { color: C.textDim, fontSize: 12, fontWeight: '600' },
  cv: { color: C.text, fontSize: 13, fontStyle: 'italic' },
  rarity: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  rarityText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  trait: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  traitText: { fontSize: 12, fontWeight: '700' },
  dot: { width: 7, height: 7, borderRadius: 4 },
  meterRow: { alignItems: 'center', gap: 8 },
  meterLabel: { color: C.textDim, fontSize: 11, fontWeight: '700', width: 64 },
  track: { flex: 1, height: 6, borderRadius: 3, backgroundColor: C.track, overflow: 'hidden' },
  fill: { position: 'absolute', top: 0, bottom: 0, borderRadius: 3 },
  pointsBadge: { backgroundColor: C.primary, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  pointsText: { color: '#fff', fontWeight: '900', fontSize: 12 },
  section: { color: C.text, fontWeight: '800', fontSize: 14 },
  talent: { width: '31%', minWidth: 96, backgroundColor: C.chip, borderRadius: 12, padding: 8, gap: 5 },
  talentOn: { borderWidth: 2, borderColor: C.primary },
  talentName: { color: C.text, fontSize: 12, fontWeight: '700' },
  pip: { flex: 1, height: 5, borderRadius: 3 },
  chip: { backgroundColor: C.chip, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  chipText: { color: C.text, fontSize: 12, fontWeight: '700' },
  fire: { alignSelf: 'flex-start', backgroundColor: C.redSoft, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8 },
  fireText: { color: C.red, fontWeight: '800' },
  btn: { borderRadius: 14, paddingHorizontal: 12, paddingVertical: 9, alignItems: 'center', justifyContent: 'center', gap: 8 },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  btnGhost: { backgroundColor: C.primarySoft },
  btnGhostText: { color: C.primary, fontWeight: '800', fontSize: 14 },
  price: { alignItems: 'center', gap: 3, backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2 },
  priceText: { color: C.text, fontWeight: '800', fontSize: 13 },
  banner: { backgroundColor: '#fffbeb', borderRadius: 16, padding: 12, gap: 8, borderWidth: 1, borderColor: '#fde68a' },
  bannerText: { color: '#92400e', fontWeight: '700', fontSize: 14 },
  empty: { color: C.textDim, fontSize: 14, padding: 12 },
});
