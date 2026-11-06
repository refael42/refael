import { Pressable, StyleSheet, Text, View } from 'react-native';

import { GUIDE_NOTES } from '../../data/guideNotes';
import { PAX_TYPES, paxTypeFrom } from '../../data/paxTypes';
import { FIRST_NAMES } from '../../data/staff';
import { useDir, useLang, useT, type TKey } from '../../i18n';
import { editionAt, formatDuration, GUIDE_PARTS, guideParts, guideScore, hash01, PST, RIGHT_PICK, STAR_AT, STAR_TIER, starsFor, weakParts, type Command, type GameState, type Person } from '../../sim';
import { Icon } from '../Icon';
import { C } from '../theme';

/** Where a suspect is on the way out (a few words). */
function whereKey(p: Person | undefined): TKey {
  if (!p) return 'guide.gone';
  switch (p.state) {
    case PST.toEntrance:
      return 'guide.where.entrance';
    case PST.inCheckin:
    case PST.atCounter:
      return 'guide.where.checkin';
    case PST.inSecurity:
    case PST.atScanner:
      return 'guide.where.security';
    case PST.inPassport:
    case PST.atBooth:
      return 'guide.where.passport';
    case PST.toShop:
    case PST.shopping:
      return 'guide.where.shops';
    default:
      return 'guide.where.gate';
  }
}

/** Little colors for a passenger's avatar, by type. */
export const PAX_COLOR: Record<string, string> = { tourist: '#ff7a59', business: '#38465e', businessW: '#6c4f8f', family: '#59c27a', kid: '#ffcd3c', student: '#27a4d8', vip: '#1d1d22', elder: '#9fc5e8' };

/** Three stars, filled from the start of the line (the right in Hebrew). */
function BigStars({ n }: { n: number }) {
  const dir = useDir();
  return (
    <View style={{ flexDirection: dir.row, gap: 4 }}>
      {[1, 2, 3].map((k) => (
        <View key={k} style={{ opacity: n >= k ? 1 : 0.2 }}>
          <Icon name="star" size={34} />
        </View>
      ))}
    </View>
  );
}

/**
 * The Aviation Guide (a tab of the rating panel): the stars of the latest
 * edition and when the next one is out, the inspector's visit (the suspects,
 * with the VIP care for one), how this week is going toward the next star and
 * what is missing, and the inspector's notebook.
 */
export function GuideTab({ state, send, onShow }: { state: GameState; send: (c: Command) => void; onShow?: (personId: number) => void }) {
  const t = useT();
  const lang = useLang();
  const dir = useDir();
  const ta = { textAlign: dir.textAlign, writingDirection: dir.writingDirection } as const;
  const g = state.guide;
  const parts = guideParts(state);
  const score = guideScore(parts, g.bonus);
  const now = starsFor(score, state.tier);
  const next = Math.min(3, now + 1);
  // (the higher stars are only for bigger airports)
  const capped = now < 3 && state.tier < STAR_TIER[next];
  const toNext = now >= 3 ? 1 : (score - STAR_AT[now]) / (STAR_AT[next] - STAR_AT[now]);
  const weak = weakParts(parts);
  const v = g.visit && !g.visit.done ? g.visit : null;
  return (
    <View testID="guide-tab">
      <View style={[styles.head, { flexDirection: dir.row }]}>
        <View style={styles.badge}>
          <Icon name="guide" size={34} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.edition, ta]}>{g.edition > 0 ? t('guide.edition', { n: g.edition }) : t('guide.noEdition')}</Text>
          <Text style={[styles.dim, ta]}>{t('guide.next', { t: formatDuration(Math.max(0, editionAt(g.edition + 1) - state.time)) })}</Text>
        </View>
        <View testID="guide-stars">
          <BigStars n={g.stars} />
        </View>
      </View>

      {v ? (
        <View style={styles.rumor} testID="guide-rumor">
          <View style={[styles.row, { flexDirection: dir.row }]}>
            <Icon name="search" size={22} />
            <Text style={[styles.rumorTitle, ta, { flex: 1 }]}>{t('guide.rumor.title')}</Text>
          </View>
          <Text style={[styles.body, ta]}>{t('guide.rumor.body')}</Text>
          {v.suspects.map((id) => {
            const p = state.people.find((q) => q.id === id);
            const type = PAX_TYPES[p?.outfit ?? paxTypeFrom(hash01(id * 7 + 3))];
            const who = FIRST_NAMES[Math.floor(hash01(id * 89 + 2) * FIRST_NAMES.length)] ?? FIRST_NAMES[0];
            const name = lang === 'he' ? who.he : who.en;
            const picked = v.picked === id;
            return (
              <View key={id} style={[styles.suspect, { flexDirection: dir.row }, picked && styles.suspectOn, !p && { opacity: 0.5 }]} testID="guide-suspect">
                <View style={[styles.avatar, { backgroundColor: PAX_COLOR[type.id] ?? '#94a3b8' }]}>
                  <Text style={styles.avatarText}>{name.slice(0, 1)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.name, ta]} numberOfLines={1}>
                    {name} · {t(`pax.${type.id}` as TKey)}
                  </Text>
                  <Text style={[styles.clue, ta]} numberOfLines={2}>
                    {t(`guide.clue.${Math.floor(hash01(id * 101 + 9) * 8)}` as TKey)} · {t(whereKey(p))}
                  </Text>
                </View>
                {p && onShow ? (
                  <Pressable onPress={() => onShow(id)} style={({ pressed }) => [styles.small, pressed && { opacity: 0.7 }]} accessibilityRole="button" testID="guide-show">
                    <Text style={styles.smallText}>{t('guide.show')}</Text>
                  </Pressable>
                ) : null}
                {picked ? (
                  <View style={[styles.vip, styles.vipOn]}>
                    <Text style={styles.vipText}>{t('guide.picked')}</Text>
                  </View>
                ) : v.picked === 0 && p ? (
                  <Pressable onPress={() => send({ type: 'pickSuspect', person: id })} style={({ pressed }) => [styles.vip, pressed && { opacity: 0.8 }]} accessibilityRole="button" testID="guide-vip">
                    <Text style={styles.vipText}>{t('guide.vip')}</Text>
                  </Pressable>
                ) : null}
              </View>
            );
          })}
        </View>
      ) : null}

      <Text style={[styles.section, ta]}>{t('guide.week')}</Text>
      <View style={styles.progress} testID="guide-progress">
        <View style={[styles.row, { flexDirection: dir.row }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.label, ta]}>{now >= 3 ? t('guide.top') : t('guide.toStar', { p: Math.floor(Math.max(0, Math.min(0.99, toNext)) * 100), n: next })}</Text>
          </View>
          <BigStarsSmall n={now} />
        </View>
        <View style={[styles.bar, { flexDirection: dir.row }]}>
          <View style={[styles.fill, { width: `${Math.round(Math.max(0.02, Math.min(1, toNext)) * 100)}%`, backgroundColor: '#f5b301' }]} />
        </View>
        {capped ? <Text style={[styles.cap, ta]} testID="guide-cap">{t('guide.cap', { n: next, t: STAR_TIER[next] })}</Text> : null}
      </View>
      {GUIDE_PARTS.map((k) => {
        const val = parts[k];
        const color = val >= 0.8 ? C.green : val >= 0.55 ? '#f59e0b' : C.red;
        return (
          <View key={k} style={styles.part} testID={`guide-${k}`}>
            <View style={[styles.row, { flexDirection: dir.row }]}>
              <Text style={[styles.label, ta, { flex: 1 }]}>{t(`guide.part.${k}` as TKey)}</Text>
              <Text style={[styles.pct, { color }]}>{Math.round(val * 100)}%</Text>
            </View>
            <View style={[styles.bar, { flexDirection: dir.row }]}>
              <View style={[styles.fill, { width: `${Math.round(val * 100)}%`, backgroundColor: color }]} />
            </View>
          </View>
        );
      })}
      {weak.length > 0 ? (
        <View style={styles.tip} testID="guide-missing">
          <Text style={[styles.tipTitle, ta]}>{t('guide.missing')}</Text>
          {weak.map((k) => (
            <Text key={k} style={[styles.tipText, ta]}>
              {t(`guide.part.${k}` as TKey)}: {t(`guide.tip.${k}` as TKey)}
            </Text>
          ))}
        </View>
      ) : null}

      <Text style={[styles.section, ta]}>{t('guide.notebook')}</Text>
      <View style={styles.notebook} testID="guide-notebook">
        {g.notes.length === 0 ? (
          <Text style={[styles.note, ta]}>{t('guide.noNotes')}</Text>
        ) : (
          <>
            <Text style={[styles.result, ta, { color: g.noteResult === 1 ? C.green : C.text }]}>{t(`guide.result.${g.noteResult}` as TKey, { n: Math.round(RIGHT_PICK * 100) })}</Text>
            {g.notes.map((i, k) => (
              <Text key={k} style={[styles.note, ta]}>
                “{lang === 'he' ? GUIDE_NOTES[i].he : GUIDE_NOTES[i].en}”
              </Text>
            ))}
          </>
        )}
      </View>
    </View>
  );
}

function BigStarsSmall({ n }: { n: number }) {
  const dir = useDir();
  return (
    <View style={{ flexDirection: dir.row }}>
      {[1, 2, 3].map((k) => (
        <View key={k} style={{ opacity: n >= k ? 1 : 0.2 }}>
          <Icon name="star" size={16} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  head: { alignItems: 'center', gap: 12, padding: 12, borderRadius: 18, backgroundColor: 'rgba(245,179,1,0.12)', marginBottom: 12 },
  badge: { width: 48, height: 48, borderRadius: 14, backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center' },
  edition: { fontSize: 18, fontWeight: '800', color: C.text },
  dim: { fontSize: 13, color: C.textDim, marginTop: 2 },
  rumor: { padding: 12, borderRadius: 18, backgroundColor: 'rgba(99,102,241,0.10)', borderWidth: 2, borderColor: 'rgba(99,102,241,0.35)', marginBottom: 12, gap: 8 },
  rumorTitle: { fontSize: 16, fontWeight: '800', color: C.text },
  body: { fontSize: 14, color: C.text, lineHeight: 20 },
  suspect: { alignItems: 'center', gap: 8, padding: 8, borderRadius: 14, backgroundColor: '#ffffff' },
  suspectOn: { borderWidth: 2, borderColor: '#f5b301' },
  avatar: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#ffffff', fontWeight: '800', fontSize: 14 },
  name: { fontSize: 14, fontWeight: '700', color: C.text },
  clue: { fontSize: 12, color: C.textDim, marginTop: 1 },
  small: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 12, backgroundColor: 'rgba(15,23,42,0.06)' },
  smallText: { fontSize: 13, fontWeight: '700', color: C.text },
  vip: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 12, backgroundColor: C.primary },
  vipOn: { backgroundColor: '#f5b301' },
  vipText: { fontSize: 13, fontWeight: '800', color: '#ffffff' },
  section: { fontSize: 15, fontWeight: '800', color: C.text, marginTop: 4, marginBottom: 8 },
  progress: { marginBottom: 12 },
  cap: { fontSize: 12, color: C.textDim, marginTop: 6, fontWeight: '600' },
  row: { alignItems: 'center', marginBottom: 6, gap: 8 },
  label: { fontSize: 14, fontWeight: '700', color: C.text },
  pct: { fontSize: 14, fontWeight: '800', marginHorizontal: 6 },
  bar: { height: 10, borderRadius: 5, backgroundColor: 'rgba(15,23,42,0.08)', overflow: 'hidden' },
  fill: { height: 10, borderRadius: 5 },
  part: { marginBottom: 10 },
  tip: { marginTop: 4, marginBottom: 12, padding: 12, borderRadius: 16, backgroundColor: 'rgba(99,102,241,0.08)', gap: 4 },
  tipTitle: { fontSize: 14, fontWeight: '800', color: C.text },
  tipText: { fontSize: 13, color: C.text, lineHeight: 19 },
  notebook: { padding: 14, borderRadius: 16, backgroundColor: '#fffbea', borderWidth: 1, borderColor: 'rgba(180,140,40,0.35)', gap: 6, marginBottom: 6 },
  result: { fontSize: 14, fontWeight: '800' },
  note: { fontSize: 14, color: '#4a3b12', lineHeight: 20, fontStyle: 'italic' },
});
