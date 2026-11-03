import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AIRCRAFT } from '../../data/aircraft';
import { AIRLINE_KINDS, AIRLINES } from '../../data/airlines';
import { TIERS } from '../../data/tiers';
import { useDir, useT, type TKey } from '../../i18n';
import {
  addedPerDay,
  airlineBlocker,
  airportCapacity,
  askChance,
  canExpand,
  contractRate,
  contractSlots,
  EXPAND_COOLDOWN,
  fleetHere,
  flightsPerDay,
  formatDuration,
  REP_EXPAND,
  REP_FOR_SIZE,
  repOf,
  type AirlineOffer,
  type Command,
  type Contract,
  type GameState,
} from '../../sim';
import { Icon } from '../Icon';
import { C } from '../theme';
import { Sheet } from './Sheet';

/** Reputation 0..100 -> mood word index 0..4. */
export function repMood(rep: number): number {
  return rep < 20 ? 0 : rep < 40 ? 1 : rep < 60 ? 2 : rep < 80 ? 3 : 4;
}

const MOOD_COLOR = ['#ef4444', '#f97316', '#94a3b8', '#10b981', '#6366f1'];

/** Small square logo in the airline's colors with its code. */
export function AirlineLogo({ al, size = 44 }: { al: number; size?: number }) {
  const a = AIRLINES[al] ?? AIRLINES[0];
  return (
    <View style={[styles.logo, { width: size, height: size, borderRadius: size * 0.32, backgroundColor: a.livery.tail }]}>
      <View style={[styles.logoStripe, { backgroundColor: a.livery.stripe, height: size * 0.16 }]} />
      <Text style={[styles.logoText, { fontSize: size * 0.3, color: a.livery.body }]}>{a.code}</Text>
    </View>
  );
}

function RepBar({ rep }: { rep: number }) {
  const t = useT();
  const dir = useDir();
  const m = repMood(rep);
  return (
    <View style={[styles.repRow, { flexDirection: dir.row }]}>
      <Text style={styles.repLabel} numberOfLines={1}>
        {t('air.rep')}
      </Text>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${Math.max(3, Math.min(100, rep))}%`, backgroundColor: MOOD_COLOR[m], [dir.rtl ? 'right' : 'left']: 0 }]} />
      </View>
      <Text style={[styles.repValue, { color: MOOD_COLOR[m] }]} numberOfLines={1}>
        {Math.round(rep)} · {t(`air.mood${m}` as TKey)}
      </Text>
    </View>
  );
}

function KindChip({ al }: { al: number }) {
  const t = useT();
  return (
    <View style={styles.kind}>
      <Text style={styles.kindText}>{t(`air.kind.${AIRLINES[al].kind}` as TKey)}</Text>
    </View>
  );
}

function Head({ al }: { al: number }) {
  const dir = useDir();
  const ta = { textAlign: dir.textAlign, writingDirection: dir.writingDirection } as const;
  const t = useT();
  return (
    <View style={[styles.row, { flexDirection: dir.row }]}>
      <AirlineLogo al={al} />
      <View style={{ flex: 1, gap: 3 }}>
        <View style={[styles.row, { flexDirection: dir.row, gap: 8 }]}>
          <Text style={[styles.name, ta]} numberOfLines={1}>
            {AIRLINES[al].name}
          </Text>
          <KindChip al={al} />
        </View>
        <Text style={[styles.small, ta]} numberOfLines={2}>
          {t(`air.hint.${AIRLINES[al].kind}` as TKey)}
        </Text>
      </View>
    </View>
  );
}

function Stat({ icon, text }: { icon: 'plane' | 'coin' | 'clock' | 'hourglass'; text: string }) {
  const dir = useDir();
  return (
    <View style={[styles.stat, { flexDirection: dir.row }]}>
      <Icon name={icon} size={14} />
      <Text style={styles.statText} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
}

function fleetText(state: GameState, al: number): string {
  const list = fleetHere(state, al).map((k) => AIRCRAFT[k].model);
  return list.join(', ');
}

function ContractCard({ state, c, send }: { state: GameState; c: Contract; send: (c: Command) => void }) {
  const t = useT();
  const dir = useDir();
  const ta = { textAlign: dir.textAlign, writingDirection: dir.writingDirection } as const;
  const [confirm, setConfirm] = useState(false);
  const rep = repOf(state, c.al);
  const k = AIRLINE_KINDS[AIRLINES[c.al].kind];
  const rate = contractRate(c);
  const fleet = fleetHere(state, c.al);
  const nextSize = REP_FOR_SIZE.find((r, i) => i < fleet.length && r > rep);
  const expandable = canExpand(state, c);
  const wait = Math.max(0, c.expandedAt + EXPAND_COOLDOWN - state.time);
  return (
    <View style={[styles.card, { borderColor: c.warned ? '#fecaca' : C.line }]} testID={`contract-${AIRLINES[c.al].id}`}>
      <Head al={c.al} />
      <RepBar rep={rep} />
      <View style={[styles.stats, { flexDirection: dir.row }]}>
        <Stat icon="plane" text={t('air.perDay', { n: c.perDay })} />
        <Stat icon="coin" text={t('air.pay', { n: c.pay.toFixed(2) })} />
        <Stat icon="clock" text={c.last.length ? t('air.onTime', { p: Math.round(rate * 100), g: Math.round(c.goal * 100) }) : t('air.goal', { g: Math.round(c.goal * 100) })} />
        {c.endsAt > 0 ? <Stat icon="hourglass" text={t('air.endsIn', { t: formatDuration(Math.max(0, c.endsAt - state.time)) })} /> : null}
      </View>
      {fleet.length > 0 ? (
        <Text style={[styles.small, ta]} numberOfLines={2}>
          {t('air.fleet', { list: fleetText(state, c.al) })}
          {nextSize !== undefined ? ` · ${t('air.bigger', { n: nextSize })}` : ''}
        </Text>
      ) : null}
      {c.warned ? (
        <View style={[styles.warn, { flexDirection: dir.row }]}>
          <Icon name="warn" size={16} />
          <Text style={[styles.warnText, ta]}>{t('air.warned')}</Text>
        </View>
      ) : null}
      {confirm ? (
        <View style={styles.confirm}>
          <Text style={[styles.warnText, ta]}>{t('air.endConfirm')}</Text>
          <View style={[styles.btnRow, { flexDirection: dir.row }]}>
            <Pressable
              style={[styles.btn, { backgroundColor: C.red }]}
              onPress={() => {
                setConfirm(false);
                send({ type: 'endContract', airline: c.al });
              }}
              accessibilityRole="button"
            >
              <Text style={styles.btnText}>{t('air.endYes')}</Text>
            </Pressable>
            <Pressable style={[styles.btn, styles.ghost]} onPress={() => setConfirm(false)} accessibilityRole="button">
              <Text style={styles.ghostText}>{t('air.endNo')}</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={[styles.btnRow, { flexDirection: dir.row }]}>
          {c.endsAt === 0 && c.perDay < k.maxPerDay ? (
            <Pressable
              style={[styles.btn, styles.grow, expandable ? { backgroundColor: C.green } : styles.disabled]}
              disabled={!expandable}
              onPress={() => send({ type: 'expandContract', airline: c.al })}
              accessibilityRole="button"
              testID={`expand-${AIRLINES[c.al].id}`}
            >
              <Icon name="up" size={16} />
              <Text style={[styles.btnText, !expandable && { color: C.textDim }]} numberOfLines={1}>
                {expandable
                  ? t('air.expand', { n: k.step })
                  : rep < REP_EXPAND
                    ? t('air.expandHint', { n: REP_EXPAND })
                    : t('air.expandWait', { t: formatDuration(wait) })}
              </Text>
            </Pressable>
          ) : null}
          {state.contracts.length > 1 ? (
            <Pressable style={[styles.btn, styles.ghostRed]} onPress={() => setConfirm(true)} accessibilityRole="button">
              <Text style={styles.ghostRedText}>{t('air.end')}</Text>
            </Pressable>
          ) : null}
        </View>
      )}
    </View>
  );
}

function OfferCard({ state, o, send, full }: { state: GameState; o: AirlineOffer; send: (c: Command) => void; full: boolean }) {
  const t = useT();
  const dir = useDir();
  const ta = { textAlign: dir.textAlign, writingDirection: dir.writingDirection } as const;
  const rep = repOf(state, o.al);
  return (
    <View style={styles.card} testID={`offer-${AIRLINES[o.al].id}`}>
      <Head al={o.al} />
      <RepBar rep={rep} />
      <View style={[styles.stats, { flexDirection: dir.row }]}>
        <Stat icon="plane" text={t('air.perDay', { n: o.perDay })} />
        <Stat icon="coin" text={t('air.pay', { n: o.pay.toFixed(2) })} />
        <Stat icon="clock" text={t('air.goal', { g: Math.round(o.goal * 100) })} />
        <Stat icon="hourglass" text={t('air.expires', { t: formatDuration(Math.max(0, o.expiresAt - state.time)) })} />
      </View>
      <Text style={[styles.small, ta]} numberOfLines={2}>
        {t('air.fleet', { list: fleetText(state, o.al) })}
        {o.days > 0 ? ` · ${t('air.season', { d: o.days })}` : ''}
      </Text>
      {flightsPerDay(state) + addedPerDay(state, o.perDay) > airportCapacity(state) ? (
        <View style={[styles.warn, { flexDirection: dir.row }]}>
          <Icon name="warn" size={16} />
          <Text style={[styles.warnText, ta]}>
            {t('air.tooMuch', { n: Math.round(flightsPerDay(state) + addedPerDay(state, o.perDay)), max: airportCapacity(state) })}
          </Text>
        </View>
      ) : null}
      <Pressable
        style={[styles.btn, full ? styles.disabled : { backgroundColor: C.primary }]}
        disabled={full}
        onPress={() => send({ type: 'signOffer', offerId: o.id })}
        accessibilityRole="button"
        testID={`sign-${AIRLINES[o.al].id}`}
      >
        <Icon name="handshake" size={18} />
        <Text style={[styles.btnText, full && { color: C.textDim }]}>{t('air.sign')}</Text>
      </Pressable>
      {!o.negotiated ? (
        <View style={[styles.btnRow, { flexDirection: dir.row }]}>
          <Pressable style={[styles.btn, styles.ghost, { flex: 1 }]} onPress={() => send({ type: 'negotiateOffer', offerId: o.id, mode: 0 })} accessibilityRole="button" testID={`ask-${AIRLINES[o.al].id}`}>
            <Text style={styles.ghostText} numberOfLines={2}>
              {t('air.askMore', { p: Math.round(askChance(state, o) * 100) })}
            </Text>
          </Pressable>
          <Pressable style={[styles.btn, styles.ghost, { flex: 1 }]} onPress={() => send({ type: 'negotiateOffer', offerId: o.id, mode: 1 })} accessibilityRole="button">
            <Text style={styles.ghostText} numberOfLines={2}>
              {t('air.discount')}
            </Text>
          </Pressable>
        </View>
      ) : null}
      <Pressable style={styles.link} onPress={() => send({ type: 'declineOffer', offerId: o.id })} accessibilityRole="button">
        <Text style={styles.linkText}>{t('air.decline')}</Text>
      </Pressable>
    </View>
  );
}

/** Airlines that can't come yet, and what they are waiting for. */
function Later({ state }: { state: GameState }) {
  const t = useT();
  const dir = useDir();
  const ta = { textAlign: dir.textAlign, writingDirection: dir.writingDirection } as const;
  const rows = AIRLINES.map((a, i) => ({ a, i, b: airlineBlocker(state, i) })).filter((r) => r.b);
  if (rows.length === 0) return null;
  return (
    <View style={{ gap: 8 }}>
      <Text style={[styles.section, ta]}>{t('air.later')}</Text>
      {rows.map(({ a, i, b }) => {
        const why =
          b && 'tier' in b ? t('air.needsTier', { tier: t(`tier.${TIERS.find((x) => x.id === b.tier)?.key ?? 'regional'}` as TKey) }) : t(`air.need.${b && 'need' in b ? b.need : 'fbo'}` as TKey);
        return (
          <View key={a.id} style={[styles.later, { flexDirection: dir.row }]}>
            <AirlineLogo al={i} size={32} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.laterName, ta]} numberOfLines={1}>
                {a.name} · {t(`air.kind.${a.kind}` as TKey)}
              </Text>
              <Text style={[styles.small, ta]} numberOfLines={1}>
                {why}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

export function AirlinesPanel({ state, send, onClose, initialTab = 0 }: { state: GameState; rev: number; send: (c: Command) => void; onClose: () => void; initialTab?: number }) {
  const t = useT();
  const dir = useDir();
  const ta = { textAlign: dir.textAlign, writingDirection: dir.writingDirection } as const;
  const [tab, setTab] = useState(initialTab);
  const slots = contractSlots(state);
  const full = state.contracts.length >= slots;
  const load = flightsPerDay(state);
  const cap = airportCapacity(state);
  const over = load > cap;
  return (
    <Sheet title={t('air.title')} subtitle={t('air.subtitle')} onClose={onClose}>
      <View style={[styles.loadBox, over && styles.loadOver]}>
        <Text style={[styles.loadText, ta]} numberOfLines={1}>
          {t('air.load', { n: Math.round(load), max: cap })}
        </Text>
        <View style={styles.loadTrack}>
          <View style={[styles.fill, { width: `${Math.min(100, (load / Math.max(1, cap)) * 100)}%`, backgroundColor: over ? C.red : load > cap * 0.85 ? C.amber : C.green, [dir.rtl ? 'right' : 'left']: 0 }]} />
        </View>
        {over ? <Text style={[styles.warnText, ta]}>{t('air.loadHigh')}</Text> : null}
      </View>
      <View style={[styles.tabs, { flexDirection: dir.row }]}>
        {[t('air.tabContracts', { n: state.contracts.length, max: slots }), t('air.tabOffers')].map((label, i) => (
          <Pressable key={i} style={[styles.tab, tab === i && styles.tabOn]} onPress={() => setTab(i)} accessibilityRole="tab" testID={`air-tab-${i}`}>
            <Text style={[styles.tabText, tab === i && styles.tabTextOn]} numberOfLines={1}>
              {label}
            </Text>
            {i === 1 && state.offers.length > 0 ? (
              <View style={styles.count}>
                <Text style={styles.countText}>{state.offers.length}</Text>
              </View>
            ) : null}
          </Pressable>
        ))}
      </View>
      {tab === 0 ? (
        state.contracts.map((c) => <ContractCard key={c.al} state={state} c={c} send={send} />)
      ) : (
        <>
          {full ? (
            <View style={[styles.warn, { flexDirection: dir.row }]}>
              <Icon name="warn" size={16} />
              <Text style={[styles.warnText, ta]}>{t('air.slotsFull')}</Text>
            </View>
          ) : null}
          {state.offers.length === 0 ? <Text style={[styles.empty, ta]}>{t('air.noOffers')}</Text> : null}
          {state.offers.map((o) => (
            <OfferCard key={o.id} state={state} o={o} send={send} full={full} />
          ))}
          <Later state={state} />
        </>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  logo: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  logoStripe: { position: 'absolute', left: 0, right: 0, bottom: '22%' },
  logoText: { fontWeight: '900', letterSpacing: 0.5 },
  row: { alignItems: 'center', gap: 12 },
  name: { color: C.text, fontSize: 16, fontWeight: '800', flexShrink: 1 },
  small: { color: C.textDim, fontSize: 12, fontWeight: '600' },
  kind: { backgroundColor: C.primarySoft, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  kindText: { color: C.primary, fontSize: 11, fontWeight: '800' },
  card: { backgroundColor: '#ffffff', borderRadius: 20, padding: 14, gap: 10, borderWidth: 1, borderColor: C.line, boxShadow: '0px 2px 8px rgba(15,23,42,0.06)' },
  repRow: { alignItems: 'center', gap: 8 },
  repLabel: { color: C.textDim, fontSize: 11, fontWeight: '700', width: 64 },
  repValue: { fontSize: 12, fontWeight: '800', minWidth: 86 },
  track: { flex: 1, height: 7, borderRadius: 4, backgroundColor: C.track, overflow: 'hidden' },
  fill: { position: 'absolute', top: 0, bottom: 0, borderRadius: 4 },
  stats: { flexWrap: 'wrap', gap: 6 },
  stat: { alignItems: 'center', gap: 5, backgroundColor: C.chip, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
  statText: { color: C.text, fontSize: 12, fontWeight: '700' },
  warn: { alignItems: 'center', gap: 8, backgroundColor: '#fffbeb', borderRadius: 12, padding: 10, borderWidth: 1, borderColor: '#fde68a' },
  warnText: { color: '#92400e', fontWeight: '700', fontSize: 13, flexShrink: 1 },
  confirm: { gap: 8, backgroundColor: C.redSoft, borderRadius: 12, padding: 10 },
  btnRow: { gap: 8 },
  grow: { flex: 1, minWidth: 0 },
  btn: { flexDirection: 'row', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, alignItems: 'center', justifyContent: 'center', gap: 8 },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 14, flexShrink: 1 },
  disabled: { backgroundColor: C.chip },
  ghost: { backgroundColor: C.primarySoft },
  ghostText: { color: C.primary, fontWeight: '800', fontSize: 13, textAlign: 'center' },
  ghostRed: { backgroundColor: C.redSoft },
  ghostRedText: { color: C.red, fontWeight: '800', fontSize: 13 },
  link: { alignSelf: 'center', paddingVertical: 2, paddingHorizontal: 10 },
  linkText: { color: C.textDim, fontWeight: '700', fontSize: 13 },
  tabs: { backgroundColor: C.chip, borderRadius: 14, padding: 4, gap: 4 },
  tab: { flex: 1, flexDirection: 'row', borderRadius: 11, paddingVertical: 9, alignItems: 'center', justifyContent: 'center', gap: 6 },
  tabOn: { backgroundColor: '#ffffff', boxShadow: '0px 2px 6px rgba(15,23,42,0.12)' },
  tabText: { color: C.textDim, fontWeight: '800', fontSize: 14 },
  tabTextOn: { color: C.text },
  count: { backgroundColor: C.red, borderRadius: 999, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  countText: { color: '#fff', fontWeight: '900', fontSize: 11 },
  loadBox: { backgroundColor: '#ffffff', borderRadius: 16, padding: 12, gap: 8, borderWidth: 1, borderColor: C.line },
  loadOver: { borderColor: '#fecaca' },
  loadText: { color: C.text, fontWeight: '800', fontSize: 14 },
  loadTrack: { height: 8, borderRadius: 4, backgroundColor: C.track, overflow: 'hidden' },
  section: { color: C.text, fontWeight: '800', fontSize: 14, marginTop: 4 },
  later: { alignItems: 'center', gap: 10, backgroundColor: C.chip, borderRadius: 14, padding: 10, opacity: 0.85 },
  laterName: { color: C.text, fontWeight: '800', fontSize: 13 },
  empty: { color: C.textDim, fontSize: 14, padding: 12 },
});
