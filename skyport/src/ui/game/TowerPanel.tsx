import { Pressable, StyleSheet, Text, View } from 'react-native';

import { tierDef } from '../../data/tiers';
import { levelCap, upgradeDef, type UpgradeDef } from '../../data/upgrades';
import { versionOf } from '../../data/versions';
import { useDir, useT, type TKey } from '../../i18n';
import { formatBig, formatDuration, type Command, type GameState } from '../../sim';
import { roleIndex } from '../../data/staff';
import { boughtLevel, unitCost } from '../../sim/game/upgrades';
import { AUTO_CLEAR_SECONDS, forecast, goAroundCutAt, meteoLevel, spacingAt, TOWER_ABILITIES, towerLevel } from '../../sim/game/tower';
import { WANT } from '../../sim/game/types';
import type { IconName } from '../../render/art/icons';
import { Icon } from '../Icon';
import { C } from '../theme';
import { Sheet } from './Sheet';
import { effectText } from './UpgradesPanel';

const ATC = roleIndex('atc');
const AIR = new Set(['inbound', 'holding', 'final', 'goAround']);
const ABILITY_ICON: Record<string, IconName> = { ground: 'arrow', approach: 'hold', auto: 'check', surface: 'search', ops: 'gear' };

/** The buy button of a line: its price, or why it cannot be bought now. */
function BuyButton({ state, def, send, label, testID }: { state: GameState; def: UpgradeDef; send: (c: Command) => void; label: string; testID: string }) {
  const t = useT();
  const dir = useDir();
  const lvl = boughtLevel(state, def.id);
  const cap = levelCap(def, state.tier);
  const building = state.builds.find((b) => b.id === def.id);
  if (building) {
    const p = Math.round((1 - building.remaining / Math.max(0.001, building.total)) * 100);
    return (
      <View style={[styles.btn, styles.btnBuild]} testID={testID}>
        <Icon name="build" size={18} />
        <Text style={styles.btnText}>{t('tw.building', { p })}</Text>
      </View>
    );
  }
  if (lvl >= def.maxLevel) return null;
  if (lvl >= cap) {
    const need = def.levelTier?.[lvl] ?? state.tier + 1;
    return (
      <View style={[styles.btn, styles.btnOff, { flexDirection: dir.row }]} testID={testID}>
        <Icon name="lock" size={16} />
        <Text style={[styles.btnText, { color: C.textDim }]} numberOfLines={1}>
          {t('tw.locked', { tier: t(`tier.${tierDef(need).key}` as TKey) })}
        </Text>
      </View>
    );
  }
  const busy = !!def.buildSeconds && state.builds.length > 0;
  const cost = unitCost(state, def, lvl);
  const can = !busy && state.money.gte(cost);
  return (
    <Pressable
      disabled={!can}
      onPress={() => send({ type: 'buyUpgrade', id: def.id, count: 1 })}
      style={({ pressed }) => [styles.btn, { flexDirection: dir.row }, !can && styles.btnOff, pressed && { transform: [{ scale: 0.97 }] }]}
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
    >
      <Text style={[styles.btnText, !can && { color: C.textDim }]} numberOfLines={1}>
        {busy ? t('tw.busy') : label}
      </Text>
      {busy ? null : (
        <View style={[styles.row, { flexDirection: dir.row, gap: 3 }]}>
          <Icon name="coin" size={15} />
          <Text style={[styles.btnText, !can && { color: C.textDim }]}>{formatBig(cost)}</Text>
          {def.buildSeconds ? (
            <>
              <Icon name="clock" size={14} />
              <Text style={[styles.btnSmall, !can && { color: C.textDim }]}>{formatDuration(def.buildSeconds[Math.min(lvl, def.buildSeconds.length - 1)])}</Text>
            </>
          ) : null}
        </View>
      )}
    </Pressable>
  );
}

function TowerCard({ state, send }: { state: GameState; send: (c: Command) => void }) {
  const t = useT();
  const dir = useDir();
  const ta = { textAlign: dir.textAlign, writingDirection: dir.writingDirection } as const;
  const def = upgradeDef('tower')!;
  const lvl = towerLevel(state);
  const bought = boughtLevel(state, 'tower');
  const v = versionOf('tower', lvl);
  return (
    <View style={styles.card} testID="tower-card">
      <View style={[styles.row, { flexDirection: dir.row }]}>
        <View style={styles.badge}>
          <Icon name="tower" size={34} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[styles.cardTitle, ta]}>{t('ver.tower.' + Math.max(1, v) as TKey)}</Text>
          <Text style={[styles.note, ta]} testID="tower-level">
            {t('tw.level', { n: lvl, max: def.maxLevel })}
          </Text>
        </View>
      </View>
      {/* the ten levels: done, being built, still to come */}
      <View style={[styles.pips, { flexDirection: dir.row }]}>
        {Array.from({ length: def.maxLevel }, (_, i) => (
          <View key={i} style={[styles.pip, i < lvl ? styles.pipOn : i < bought ? styles.pipBuild : null, TOWER_ABILITIES.some((a) => a.level === i + 1) && styles.pipStar]} />
        ))}
      </View>
      <View style={[styles.stats, { flexDirection: dir.row }]}>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>{t('tw.spacing')}</Text>
          <Text style={styles.statValue}>{t('tw.less', { n: Math.round(spacingAt(lvl) * 100) })}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>{t('tw.goAround')}</Text>
          <Text style={styles.statValue}>{t('tw.less', { n: Math.round(goAroundCutAt(lvl) * 100) })}</Text>
        </View>
      </View>
      {bought < def.maxLevel ? <Text style={[styles.hint, ta]}>{effectText(t, def, lvl, bought + 1)}</Text> : <Text style={[styles.hint, ta]}>{t('tw.max')}</Text>}
      <BuyButton state={state} def={def} send={send} label={t('tw.upgrade', { n: bought + 1 })} testID="tower-buy" />
    </View>
  );
}

function AbilitiesCard({ state }: { state: GameState }) {
  const t = useT();
  const dir = useDir();
  const ta = { textAlign: dir.textAlign, writingDirection: dir.writingDirection } as const;
  const lvl = towerLevel(state);
  return (
    <View style={styles.card} testID="tower-abilities">
      <Text style={[styles.cardTitle, ta]}>{t('tw.abilities')}</Text>
      {TOWER_ABILITIES.map((a) => {
        const on = lvl >= a.level;
        return (
          <View key={a.id} style={[styles.ability, { flexDirection: dir.row }, on && styles.abilityOn]} testID={`ability-${a.id}`}>
            <View style={[styles.abIcon, on && { backgroundColor: '#dcfce7' }]}>
              <Icon name={on ? ABILITY_ICON[a.id] : 'lock'} size={22} />
            </View>
            <View style={{ flex: 1, gap: 1 }}>
              <Text style={[styles.line, ta, !on && { color: C.textDim }]}>{t(`ab.${a.id}` as TKey)}</Text>
              <Text style={[styles.note, ta]}>{t(`ab.${a.id}.d` as TKey, { n: AUTO_CLEAR_SECONDS })}</Text>
            </View>
            <View style={[styles.tag, on ? { backgroundColor: C.green } : null]}>
              <Text style={[styles.tagText, on && { color: '#fff' }]}>{on ? t('tw.on') : t('tw.atLevel', { n: a.level })}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

function TrafficCard({ state, onStaff }: { state: GameState; onStaff: () => void }) {
  const t = useT();
  const dir = useDir();
  const ta = { textAlign: dir.textAlign, writingDirection: dir.writingDirection } as const;
  const air = state.flights.filter((f) => AIR.has(f.phase)).length;
  const waiting = state.flights.filter((f) => f.want === WANT.clearLanding || f.want === WANT.clearTakeoff).length;
  const ground = state.flights.filter((f) => !AIR.has(f.phase) && f.phase !== 'diverted' && f.phase !== 'takeoff').length;
  const atc = state.staff.filter((m) => m.role === ATC).length;
  const cell = (label: string, n: number, icon: IconName, id: string) => (
    <View style={styles.stat} testID={`traffic-${id}`}>
      <Icon name={icon} size={20} />
      <Text style={styles.statValue}>{n}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
  return (
    <View style={styles.card} testID="tower-traffic">
      <Text style={[styles.cardTitle, ta]}>{t('tw.traffic')}</Text>
      <View style={[styles.stats, { flexDirection: dir.row }]}>
        {cell(t('tw.inAir'), air, 'land', 'air')}
        {cell(t('tw.waiting'), waiting, 'hand', 'waiting')}
        {cell(t('tw.ground'), ground, 'plane', 'ground')}
      </View>
      <Text style={[styles.note, ta]}>{t('tw.today', { g: state.stats.goArounds, d: state.stats.diverted })}</Text>
      <View style={[styles.row, { flexDirection: dir.row }]}>
        <Icon name="team" size={20} />
        <Text style={[styles.line, ta, { flex: 1 }]}>{t('tw.controllers', { n: atc })}</Text>
        <Pressable onPress={onStaff} style={({ pressed }) => [styles.small, pressed && { opacity: 0.7 }]} accessibilityRole="button" testID="tower-staff">
          <Text style={styles.smallText}>{t('tw.hire')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function EquipmentCard({ state, send }: { state: GameState; send: (c: Command) => void }) {
  const t = useT();
  const dir = useDir();
  const ta = { textAlign: dir.textAlign, writingDirection: dir.writingDirection } as const;
  const fc = forecast(state);
  const storm = state.incidents.find((i) => i.kind === 'storm' && i.state === 'announced');
  return (
    <View style={styles.card} testID="tower-equipment">
      <Text style={[styles.cardTitle, ta]}>{t('tw.equipment')}</Text>
      {(['meteo', 'radar', 'ils'] as const).map((id) => {
        const def = upgradeDef(id)!;
        const lvl = boughtLevel(state, id);
        return (
          <View key={id} style={styles.equip} testID={`equip-${id}`}>
            <View style={[styles.row, { flexDirection: dir.row }]}>
              <Icon name={def.icon as IconName} size={24} />
              <Text style={[styles.line, ta, { flex: 1 }]}>{t(`upg.${id}` as TKey)}</Text>
              <Text style={styles.statValue}>{lvl >= def.maxLevel ? t('upgrades.max') : `${lvl}/${def.maxLevel}`}</Text>
            </View>
            <Text style={[styles.note, ta]}>{effectText(t, def, lvl, lvl >= def.maxLevel ? lvl : lvl + 1)}</Text>
            <BuyButton state={state} def={def} send={send} label={lvl === 0 ? t('tw.build') : t('tw.buy')} testID={`equip-buy-${id}`} />
          </View>
        );
      })}
      {/* the forecast from the weather station */}
      <View style={[styles.forecast, { flexDirection: dir.row }]} testID="tower-forecast">
        <Icon name={fc ? (fc.vis < 0.5 ? 'fog' : fc.speed > 18 ? 'wind' : 'sun') : 'cloud'} size={26} />
        <View style={{ flex: 1, gap: 1 }}>
          {fc ? (
            <>
              <Text style={[styles.line, ta]}>{t('tw.forecast', { h: meteoLevel(state) >= 3 ? 2 : 1 })}</Text>
              <Text style={[styles.note, ta]}>{`${t('tw.wind', { n: Math.round(fc.speed) })} · ${t('tw.vis', { n: Math.round(fc.vis * 100) })}`}</Text>
            </>
          ) : (
            <Text style={[styles.note, ta]}>{t('tw.noForecast')}</Text>
          )}
          {storm ? <Text style={[styles.line, ta, { color: C.red }]}>{t('tw.stormIn', { t: formatDuration(Math.max(0, storm.at - state.time)) })}</Text> : null}
        </View>
      </View>
    </View>
  );
}

/** The control tower's own panel (owner request: the tower is part of the game, not only the look). */
export function TowerPanel({ state, send, onClose, onStaff }: { state: GameState; rev: number; send: (c: Command) => void; onClose: () => void; onStaff: () => void }) {
  const t = useT();
  return (
    <Sheet title={t('tw.title')} subtitle={t('tw.sub')} onClose={onClose}>
      <TowerCard state={state} send={send} />
      <AbilitiesCard state={state} />
      <TrafficCard state={state} onStaff={onStaff} />
      <EquipmentCard state={state} send={send} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#ffffff', borderRadius: 20, padding: 14, gap: 9, boxShadow: '0px 2px 8px rgba(15,23,42,0.06)' },
  row: { alignItems: 'center', gap: 8 },
  badge: { width: 52, height: 52, borderRadius: 16, backgroundColor: '#e0f2fe', alignItems: 'center', justifyContent: 'center' },
  cardTitle: { color: C.text, fontWeight: '800', fontSize: 17 },
  note: { color: C.textDim, fontSize: 12.5, fontWeight: '600' },
  line: { color: C.text, fontSize: 14, fontWeight: '800' },
  hint: { color: C.primary, fontSize: 13, fontWeight: '700' },
  pips: { gap: 4 },
  pip: { flex: 1, height: 10, borderRadius: 5, backgroundColor: C.track },
  pipOn: { backgroundColor: '#0ea5e9' },
  pipBuild: { backgroundColor: '#fbbf24' },
  pipStar: { borderWidth: 2, borderColor: '#facc15' },
  stats: { gap: 8 },
  stat: { flex: 1, backgroundColor: '#f1f5f9', borderRadius: 14, paddingVertical: 8, paddingHorizontal: 6, alignItems: 'center', gap: 2 },
  statLabel: { color: C.textDim, fontSize: 12, fontWeight: '700', textAlign: 'center' },
  statValue: { color: C.text, fontSize: 15, fontWeight: '800', fontVariant: ['tabular-nums'] },
  ability: { alignItems: 'center', gap: 10, padding: 8, borderRadius: 14, backgroundColor: '#f8fafc' },
  abilityOn: { backgroundColor: '#f0fdf4' },
  abIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center' },
  tag: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: C.track },
  tagText: { color: C.textDim, fontSize: 11.5, fontWeight: '800' },
  equip: { gap: 5, paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  forecast: { alignItems: 'center', gap: 10, padding: 10, borderRadius: 14, backgroundColor: '#eff6ff' },
  btn: { backgroundColor: C.primary, borderRadius: 14, minHeight: 42, alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 12 },
  btnOff: { backgroundColor: C.track },
  btnBuild: { backgroundColor: '#f59e0b', flexDirection: 'row' },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  btnSmall: { color: '#fff', fontWeight: '700', fontSize: 12 },
  small: { backgroundColor: '#eef2ff', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 },
  smallText: { color: C.primary, fontWeight: '800', fontSize: 13 },
});
