import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ACHIEVEMENTS, MEDAL_GEMS, MEDALS } from '../../data/achievements';
import { tierDef } from '../../data/tiers';
import { useDir, useT, type TKey } from '../../i18n';
import type { IconName } from '../../render/art/icons';
import { Big, BOOST_SECONDS, CHEST_EVERY, CHEST_GEMS, formatBig, formatDuration, LEVEL_COINS, medalsOf, medalsToClaim, xpToNext, type Command, type GameState } from '../../sim';
import { Icon } from '../Icon';
import { C } from '../theme';
import { Sheet } from './Sheet';

/** Medal colors: bronze, silver, gold, diamond (and none yet). */
export const MEDAL_COLOR = ['#c77b3a', '#9aa7b8', '#f5b301', '#38bdf8'];
const NONE = 'rgba(15,23,42,0.12)';

/** A round medal with the achievement's icon (colored by the best medal reached). */
function Medal({ icon, reached }: { icon: string; reached: number }) {
  return (
    <View style={[styles.medal, { backgroundColor: reached > 0 ? MEDAL_COLOR[reached - 1] : NONE }]}>
      <Icon name={icon as IconName} size={22} />
    </View>
  );
}

/**
 * The manager: the level and its experience bar, what the next level brings,
 * chests to open and the double income they give; the achievements with their
 * four medals each and the diamonds to collect.
 */
export function CareerPanel({ state, onClose, send, initialTab = 0 }: { state: GameState; rev: number; onClose: () => void; send: (c: Command) => void; initialTab?: number }) {
  const t = useT();
  const dir = useDir();
  const ta = { textAlign: dir.textAlign, writingDirection: dir.writingDirection } as const;
  const [tab, setTab] = useState(initialTab);
  const c = state.career;
  const need = xpToNext(c.level);
  const nextCoins = Math.round(LEVEL_COINS * (c.level + 1) * tierDef(state.tier).pay);
  const chestNext = (c.level + 1) % CHEST_EVERY === 0;
  const boostLeft = Math.max(0, c.boostUntil - state.time);
  const toClaim = medalsToClaim(state);
  return (
    <Sheet title={t('career.title')} subtitle={t('career.sub', { n: c.level })} onClose={onClose}>
      <View style={[styles.tabs, { flexDirection: dir.row }]}>
        {[t('career.tab.level'), t('career.tab.ach', { n: toClaim })].map((label, i) => (
          <Pressable key={i} onPress={() => setTab(i)} style={[styles.tab, tab === i && styles.tabOn]} accessibilityRole="tab" testID={`career-tab-${i}`}>
            <Text style={[styles.tabText, tab === i && styles.tabTextOn]}>{label}</Text>
            {i === 1 && toClaim > 0 && tab !== 1 ? <View style={styles.dot} /> : null}
          </Pressable>
        ))}
      </View>
      {tab === 0 ? (
        <View testID="career-level">
          <View style={[styles.levelRow, { flexDirection: dir.row }]}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{c.level}</Text>
            </View>
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={[styles.label, ta]}>{t('career.xp', { a: Math.floor(c.xp), b: need, n: c.level + 1 })}</Text>
              <View style={[styles.bar, { flexDirection: dir.row }]}>
                <View style={[styles.fill, { width: `${Math.max(2, Math.round((c.xp / need) * 100))}%`, backgroundColor: C.primary }]} />
              </View>
              <Text style={[styles.dim, ta]}>{t(chestNext ? 'career.nextChest' : 'career.next', { n: formatBig(Big.fromNumber(nextCoins)) })}</Text>
            </View>
          </View>
          <View style={[styles.chest, { flexDirection: dir.row }]} testID="career-chest">
            <View style={styles.chestIcon}>
              <Icon name="chest" size={30} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.label, ta]}>{t('career.chests', { n: c.chests })}</Text>
              <Text style={[styles.dim, ta]}>{t('career.chestInfo', { g: CHEST_GEMS, t: formatDuration(BOOST_SECONDS) })}</Text>
              {boostLeft > 0 ? <Text style={[styles.boost, ta]}>{t('career.boost', { t: formatDuration(boostLeft) })}</Text> : null}
            </View>
            <Pressable
              disabled={c.chests <= 0}
              onPress={() => send({ type: 'openChest' })}
              style={({ pressed }) => [styles.btn, c.chests <= 0 && styles.btnOff, pressed && { opacity: 0.85 }]}
              accessibilityRole="button"
              testID="career-open"
            >
              <Text style={styles.btnText}>{t('career.open')}</Text>
            </Pressable>
          </View>
          <Text style={[styles.how, ta]}>{t('career.how')}</Text>
        </View>
      ) : (
        <View testID="career-ach">
          {ACHIEVEMENTS.map((a, i) => {
            const m = medalsOf(state, i);
            const gems = MEDAL_GEMS.slice(m.claimed, m.reached).reduce((x, y) => x + y, 0);
            const from = m.reached > 0 ? a.medals[m.reached - 1] : 0;
            const frac = m.reached >= 4 ? 1 : Math.max(0, Math.min(1, (m.value - from) / Math.max(1, m.next - from)));
            return (
              <View key={a.id} style={[styles.ach, { flexDirection: dir.row }]} testID="career-achievement">
                <Medal icon={a.icon} reached={m.reached} />
                <View style={{ flex: 1, gap: 3 }}>
                  <View style={[styles.row, { flexDirection: dir.row }]}>
                    <Text style={[styles.name, ta, { flex: 1 }]} numberOfLines={1}>
                      {t(`ach.${a.id}` as TKey)}
                    </Text>
                    <View style={[styles.pips, { flexDirection: dir.row }]}>
                      {MEDALS.map((_, k) => (
                        <View key={k} style={[styles.pip, { backgroundColor: k < m.reached ? MEDAL_COLOR[k] : NONE }]} />
                      ))}
                    </View>
                  </View>
                  <Text style={[styles.dim, ta]} numberOfLines={1}>
                    {t(`ach.${a.id}.how` as TKey, {
                      n: m.reached < 4 ? t('career.of', { a: formatBig(Big.fromNumber(Math.floor(m.value))), b: formatBig(Big.fromNumber(m.next)) }) : formatBig(Big.fromNumber(Math.floor(m.value))),
                    })}
                  </Text>
                  <View style={[styles.barThin, { flexDirection: dir.row }]}>
                    <View style={[styles.fill, { width: `${Math.round(frac * 100)}%`, backgroundColor: m.reached >= 4 ? MEDAL_COLOR[3] : MEDAL_COLOR[Math.min(3, m.reached)] }]} />
                  </View>
                </View>
                {gems > 0 ? (
                  <Pressable onPress={() => send({ type: 'claimMedals', index: i })} style={({ pressed }) => [styles.claim, { flexDirection: dir.row }, pressed && { opacity: 0.85 }]} accessibilityRole="button" testID="career-claim">
                    <Icon name="diamond" size={16} />
                    <Text style={styles.claimText}>+{gems}</Text>
                  </Pressable>
                ) : null}
              </View>
            );
          })}
        </View>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  tabs: { gap: 8, marginBottom: 14 },
  tab: { flex: 1, paddingVertical: 9, borderRadius: 14, backgroundColor: 'rgba(15,23,42,0.06)', alignItems: 'center' },
  tabOn: { backgroundColor: C.primary },
  tabText: { fontSize: 14, fontWeight: '700', color: C.text },
  tabTextOn: { color: '#ffffff' },
  dot: { position: 'absolute', top: 6, right: 10, width: 8, height: 8, borderRadius: 4, backgroundColor: C.red },
  levelRow: { alignItems: 'center', gap: 14, padding: 14, borderRadius: 18, backgroundColor: 'rgba(99,102,241,0.08)', marginBottom: 12 },
  badge: { width: 64, height: 64, borderRadius: 32, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 4, borderColor: '#c7d2fe' },
  badgeText: { color: '#ffffff', fontSize: 26, fontWeight: '900' },
  label: { fontSize: 14, fontWeight: '700', color: C.text },
  dim: { fontSize: 12, color: C.textDim },
  bar: { height: 10, borderRadius: 5, backgroundColor: 'rgba(15,23,42,0.08)', overflow: 'hidden' },
  barThin: { height: 6, borderRadius: 3, backgroundColor: 'rgba(15,23,42,0.08)', overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 5 },
  chest: { alignItems: 'center', gap: 12, padding: 12, borderRadius: 18, backgroundColor: '#fef3c7', marginBottom: 12 },
  chestIcon: { width: 46, height: 46, borderRadius: 12, backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center' },
  boost: { fontSize: 13, fontWeight: '800', color: C.green, marginTop: 2 },
  btn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 14, backgroundColor: C.green },
  btnOff: { backgroundColor: 'rgba(15,23,42,0.15)' },
  btnText: { color: '#ffffff', fontWeight: '800', fontSize: 14 },
  how: { fontSize: 13, color: C.textDim, lineHeight: 19 },
  ach: { alignItems: 'center', gap: 10, padding: 10, borderRadius: 16, backgroundColor: 'rgba(15,23,42,0.04)', marginBottom: 8 },
  medal: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#ffffff' },
  row: { alignItems: 'center', gap: 8 },
  name: { fontSize: 14, fontWeight: '800', color: C.text },
  pips: { gap: 3 },
  pip: { width: 9, height: 9, borderRadius: 5 },
  claim: { alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 12, backgroundColor: C.primary },
  claimText: { color: '#ffffff', fontWeight: '800', fontSize: 13 },
});
