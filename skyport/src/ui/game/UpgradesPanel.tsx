import { nextVersionAt, VERSIONS, versionOf } from '../../data/versions';
import { storeCap } from '../../data/supplies';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { CATEGORIES, levelCap, UPGRADES, type UpgradeCategory, type UpgradeDef } from '../../data/upgrades';
import { useDir, useT, type TKey } from '../../i18n';
import {
  affordableCount,
  bestOffer,
  boughtLevel,
  bulkCost,
  formatBig,
  formatDuration,
  milestonesReached,
  nextMilestone,
  unitCost,
  Big,
  type GameState,
} from '../../sim';
import { Icon } from '../Icon';
import { C } from '../theme';
import { Sheet } from './Sheet';

const AMOUNTS = [1, 10, 100, -1] as const;
const CAT_COLOR: Record<UpgradeCategory, string> = {
  runway: '#6366f1',
  apron: '#64748b',
  terminal: '#3b82f6',
  vehicles: '#f59e0b',
  marketing: '#ec4899',
  comfort: '#14b8a6',
};

function lineValue(def: UpgradeDef, lvl: number): number {
  return def.per * lvl * Math.pow(2, milestonesReached(def, lvl));
}

function trim(n: number): string {
  return String(Math.round(n * 100) / 100);
}

export function effectText(t: (k: TKey, p?: Record<string, string | number>) => string, def: UpgradeDef, from: number, to: number): string {
  const a = lineValue(def, from);
  const b = lineValue(def, to);
  switch (def.effect) {
    case 'paxFee':
    case 'landingFee':
      return t('eff.mult', { a: trim(1 + a), b: trim(1 + b) });
    case 'kiosk':
      return t('eff.kiosk', { a: trim(a), b: trim(b) });
    case 'traffic':
      return t('eff.traffic', { a: Math.round(a * 100), b: Math.round(b * 100) });
    case 'stands':
      return t('eff.stands', { a: 1 + from, b: 1 + to });
    case 'truck':
    case 'cart':
      return t('eff.vehicle', { a: 1 + from, b: 1 + to });
    case 'comfort':
      return t('eff.mood', { a: Math.round(Math.min(0.5, a) * 100), b: Math.round(Math.min(0.5, b) * 100) });
    case 'offlineCap':
      return t('eff.offline', { a: 2 + a, b: 2 + b });
    case 'counters':
      return t('eff.counters', { a: 1 + from, b: 1 + to });
    case 'opens':
      return t('eff.opens', { a: from, b: to });
    case 'tower':
      return t('eff.tower', { a: Math.round(a * 100), b: Math.round(b * 100) });
    case 'radar':
      return t('eff.radar', { a: Math.round(a * 100), b: Math.round(b * 100) });
    case 'ils':
      return t('eff.ils', { a: from, b: to });
    case 'lanes':
      return t('eff.lanes', { a: 1 + from, b: 1 + to });
    case 'birds':
      return t('eff.birds', { a: Math.round(Math.min(80, 30 * from)), b: Math.round(Math.min(80, 30 * to)) });
    case 'storage': {
      // capacity of the fuel farm (liters) or the parts store (pieces)
      const fuel = def.id === 'fuelFarm';
      const cap = (l: number) => formatBig(Big.fromNumber(storeCap(fuel ? 'fuel' : 'parts', l)));
      return t('eff.storage', { a: cap(from), b: cap(to), unit: t(fuel ? 'sup.liters' : 'sup.pieces') });
    }
    default:
      return t('eff.speed', { a: Math.round(a * 100), b: Math.round(b * 100) });
  }
}

interface Row {
  def: UpgradeDef;
  lvl: number;
  n: number;
  cost: Big;
  can: boolean;
}

export function UpgradesPanel({
  state,
  onBuy,
  onClose,
  initialCat = 'all',
}: {
  state: GameState;
  rev: number;
  onBuy: (id: string, count: number) => void;
  onClose: () => void;
  initialCat?: UpgradeCategory | 'all';
}) {
  const t = useT();
  const dir = useDir();
  const [amount, setAmount] = useState<number>(1);
  const [cat, setCat] = useState<UpgradeCategory | 'all'>(initialCat);
  const [onlyAfford, setOnlyAfford] = useState(false);
  const [query, setQuery] = useState('');
  const ta = { textAlign: dir.textAlign, writingDirection: dir.writingDirection } as const;
  const busy = state.builds.length > 0;

  const rows: Row[] = UPGRADES.filter((d) => d.unlockTier <= state.tier).map((def) => {
    const lvl = boughtLevel(state, def.id);
    const room = levelCap(def, state.tier) - lvl;
    let n = amount < 0 ? Math.max(1, affordableCount(state, def)) : Math.min(amount, room);
    if (def.buildSeconds) n = 1;
    n = Math.max(0, Math.min(n, room));
    const cost = n > 0 ? bulkCost(state, def, lvl, n) : unitCost(state, def, lvl);
    const can = n > 0 && state.money.gte(cost) && !(def.buildSeconds && busy);
    return { def, lvl, n, cost, can };
  });
  const best = bestOffer(state, false);
  const q = query.trim().toLowerCase();
  const shown = rows.filter(
    (r) => (cat === 'all' || r.def.category === cat) && (!onlyAfford || r.can) && (!q || t(`upg.${r.def.id}` as TKey).toLowerCase().includes(q) || r.def.id.includes(q)),
  );
  const amountLabel = (a: number) => (a < 0 ? 'MAX' : `x${a}`);
  const bestRow = useMemo(() => (best ? rows.find((r) => r.def.id === best.id) : undefined), [best, rows]);

  const renderRow = (r: Row, highlight = false) => {
    const max = r.lvl >= levelCap(r.def, state.tier);
    const nextM = nextMilestone(r.def, r.lvl);
    const prevM = [0, ...(r.def.milestones ?? [])].filter((m) => m <= r.lvl).pop() ?? 0;
    const prog = nextM ? (r.lvl - prevM) / (nextM - prevM) : 1;
    const color = CAT_COLOR[r.def.category];
    return (
      <View key={r.def.id + (highlight ? '-best' : '')} style={[styles.row, highlight && styles.bestRow]}>
        <View style={[styles.line, { flexDirection: dir.row }]}>
          <View style={[styles.tile, { backgroundColor: color + '22' }]}>
            <Icon name={r.def.icon} size={26} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <View style={[styles.line, { flexDirection: dir.row, gap: 6 }]}>
              <Text style={[styles.name, ta]} numberOfLines={1}>
                {t(`upg.${r.def.id}` as TKey)}
              </Text>
              <View style={[styles.lv, { backgroundColor: color }]}>
                <Text style={styles.lvText}>{max ? t('upgrades.max') : t('upgrades.level', { n: r.lvl })}</Text>
              </View>
            </View>
            <Text style={[styles.eff, ta]} numberOfLines={1}>
              {max ? effectText(t, r.def, r.lvl, r.lvl) : effectText(t, r.def, r.lvl, r.lvl + Math.max(1, r.n))}
            </Text>
            {VERSIONS[r.def.id] ? (
              <Text style={[styles.ver, ta]} numberOfLines={2} testID={`ver-${r.def.id}`}>
                {versionOf(r.def.id, r.lvl) > 0 ? t('ver.now', { n: versionOf(r.def.id, r.lvl), of: VERSIONS[r.def.id].length, name: t(`ver.${r.def.id}.${versionOf(r.def.id, r.lvl)}` as TKey) }) : ''}
                {nextVersionAt(r.def.id, r.lvl) !== null
                  ? `${versionOf(r.def.id, r.lvl) > 0 ? ' · ' : ''}${t('ver.next', { n: nextVersionAt(r.def.id, r.lvl)!, name: t(`ver.${r.def.id}.${versionOf(r.def.id, r.lvl) + 1}` as TKey) })}`
                  : ''}
              </Text>
            ) : null}
            {nextM ? (
              <View style={[styles.line, { flexDirection: dir.row, gap: 6 }]}>
                <View style={styles.track}>
                  <View style={[styles.fill, { width: `${Math.max(4, prog * 100)}%`, backgroundColor: color, [dir.rtl ? 'right' : 'left']: 0 }]} />
                </View>
                <Text style={styles.next}>{t('upgrades.next', { n: nextM })}</Text>
              </View>
            ) : r.def.buildSeconds && !max ? (
              <Text style={[styles.next, ta]}>{busy ? t('upgrades.busy') : t('upgrades.build', { t: formatDuration(r.def.buildSeconds[Math.min(r.lvl, r.def.buildSeconds.length - 1)]) })}</Text>
            ) : null}
          </View>
          {!max ? (
            <Pressable
              onPress={() => onBuy(r.def.id, amount < 0 ? -1 : r.n)}
              disabled={!r.can}
              style={({ pressed }) => [styles.buy, !r.can && styles.buyOff, pressed && { transform: [{ scale: 0.96 }] }]}
              accessibilityRole="button"
              accessibilityLabel={`${t('upgrades.buy')} ${t(`upg.${r.def.id}` as TKey)}`}
            >
              <Text style={[styles.buyN, !r.can && { color: C.textDim }]}>+{r.n}</Text>
              <View style={[styles.line, { flexDirection: dir.row, gap: 3 }]}>
                <Icon name="coin" size={14} />
                <Text style={[styles.buyCost, !r.can && { color: C.textDim }]}>{formatBig(r.cost)}</Text>
              </View>
            </Pressable>
          ) : null}
        </View>
      </View>
    );
  };

  return (
    <Sheet title={t('upgrades.title')} subtitle={t('upgrades.subtitle')} onClose={onClose}>
      <View style={[styles.controls, { flexDirection: dir.row }]}>
        <View style={[styles.segment, { flexDirection: dir.row }]}>
          {AMOUNTS.map((a) => (
            <Pressable key={a} onPress={() => setAmount(a)} style={[styles.seg, amount === a && styles.segOn]}>
              <Text style={[styles.segText, amount === a && styles.segTextOn]}>{amountLabel(a)}</Text>
            </Pressable>
          ))}
        </View>
        <Pressable onPress={() => setOnlyAfford(!onlyAfford)} style={[styles.chip, onlyAfford && styles.chipOn]}>
          <Text style={[styles.chipText, onlyAfford && styles.chipTextOn]}>{t('upgrades.affordable')}</Text>
        </Pressable>
      </View>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder={t('upgrades.search')}
        placeholderTextColor={C.textFaint}
        style={[styles.search, ta]}
        autoCorrect={false}
      />
      <View style={[styles.cats, { flexDirection: dir.row }]}>
        {(['all', ...CATEGORIES] as const).map((c) => (
          <Pressable key={c} onPress={() => setCat(c)} style={[styles.chip, cat === c && styles.chipOn]}>
            <Text style={[styles.chipText, cat === c && styles.chipTextOn]}>{c === 'all' ? t('upgrades.all') : t(`cat.${c}` as TKey)}</Text>
          </Pressable>
        ))}
      </View>
      {bestRow && cat === 'all' && !q ? (
        <View style={{ gap: 6 }}>
          <View style={[styles.line, { flexDirection: dir.row, gap: 6 }]}>
            <Icon name="star" size={16} />
            <Text style={[styles.bestLabel, ta]}>{t('upgrades.best')}</Text>
          </View>
          {renderRow(bestRow, true)}
        </View>
      ) : null}
      {shown.length === 0 ? <Text style={[styles.empty, ta]}>{t('upgrades.none')}</Text> : shown.map((r) => renderRow(r))}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  controls: { alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  segment: { backgroundColor: C.chip, borderRadius: 14, padding: 3, gap: 3 },
  seg: { borderRadius: 11, paddingHorizontal: 12, paddingVertical: 7 },
  segOn: { backgroundColor: '#ffffff', boxShadow: '0px 2px 6px rgba(15,23,42,0.12)' },
  segText: { color: C.textDim, fontWeight: '800', fontSize: 13 },
  segTextOn: { color: C.text },
  search: { backgroundColor: '#ffffff', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, color: C.text, borderWidth: 1, borderColor: C.track },
  cats: { flexWrap: 'wrap', gap: 6 },
  chip: { backgroundColor: '#ffffff', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: C.track },
  chipOn: { backgroundColor: C.text, borderColor: C.text },
  chipText: { color: C.textDim, fontSize: 13, fontWeight: '700' },
  chipTextOn: { color: '#ffffff' },
  bestLabel: { color: C.text, fontWeight: '800', fontSize: 14 },
  row: { backgroundColor: '#ffffff', borderRadius: 18, padding: 12, boxShadow: '0px 2px 8px rgba(15,23,42,0.06)' },
  bestRow: { borderWidth: 2, borderColor: C.gold },
  line: { alignItems: 'center', gap: 10 },
  tile: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  name: { color: C.text, fontSize: 15, fontWeight: '800', flexShrink: 1 },
  lv: { borderRadius: 999, paddingHorizontal: 7, paddingVertical: 1 },
  lvText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  ver: { fontSize: 11, fontWeight: '700', color: '#7c3aed' },
  eff: { color: C.textDim, fontSize: 12, fontWeight: '600' },
  track: { flex: 1, height: 5, borderRadius: 3, backgroundColor: C.track, overflow: 'hidden' },
  fill: { position: 'absolute', top: 0, bottom: 0, borderRadius: 3 },
  next: { color: C.textFaint, fontSize: 11, fontWeight: '700' },
  buy: { minWidth: 76, backgroundColor: C.green, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 7, alignItems: 'center', gap: 2 },
  buyOff: { backgroundColor: C.track },
  buyN: { color: '#fff', fontSize: 12, fontWeight: '800' },
  buyCost: { color: '#fff', fontSize: 13, fontWeight: '800' },
  empty: { color: C.textDim, fontSize: 14, padding: 12 },
});
