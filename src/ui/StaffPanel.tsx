import { useEffect, useState } from 'react';
import { Image, PixelRatio, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { NAMES } from '../data/names';
import { RARITY, type Rarity } from '../data/rarity';
import { ROLE_LIST, STAFF, STAT_IDS, type Role } from '../data/staff';
import { TRAITS, type TraitId } from '../data/traits';
import { TALENT, TALENT_IDS, TALENTS, talentBlockOf, talentCost, talentCount, talentSlots, talentSpent, type TalentId, type TalentLevels } from '../data/talents';
import type { HudIcon } from '../render/art/hudArt';
import { useT } from '../i18n';
import { heroIcon, spriteIcon } from '../render/icons';
import type { SpriteName } from '../render/sprites';
import { usePoll } from '../render/useSimulation';
import type { Big } from '../sim/big';
import { formatBig } from '../sim/format';
import { recommended, signingFee } from '../sim/game/applicants';
import { xpToNext } from '../sim/game/people';
import type { Command, GameState, Person } from '../sim/game/types';
import { capacity, headcount, trainingCost, trainingPlan } from '../sim/game/workers';
import { BulkToggle } from './Bulk';
import { useSettings } from '../store/settings';
import { gold, panel } from './theme';
import { tapFeedback } from '../audio/sound';
import { GameIcon, IconText } from './GameIcon';

export type StaffView = { tab: 'team' | 'applicants' } | { person: number };

interface Props {
  gameRef: { current: GameState | null };
  view: StaffView;
  onView: (view: StaffView) => void;
  onCommand: (cmd: Command) => void;
  onClose: () => void;
}

const ROLE_ICON: Record<Role, SpriteName> = { cook: 'hatToqueF', waiter: 'trayFull', washer: 'plateStack', host: 'seat', cleaner: 'clean', manager: 'clipboard', promoter: 'flyers', courier: 'bag', checker: 'checkBadge', packer: 'packBox', bartender: 'shaker' };
const ICON_PX = 36;
const roleIcon = (role: Role) => spriteIcon(ROLE_ICON[role], Math.round(ICON_PX * PixelRatio.get()));
/** A hero (paid offer) shows their portrait and their own name; anyone else their job's icon and a name from the list. */
const personIcon = (p: { role: Role; hero?: string }) => (p.hero ? heroIcon(p.hero, Math.round(ICON_PX * 1.4 * PixelRatio.get())) : roleIcon(p.role));
const personName = (p: { name: number; hero?: string }, lang: 'he' | 'en', t: (k: string) => string) => (p.hero ? t(`hero.${p.hero}`) : NAMES[p.name]![lang]);

interface PersonRow extends Person {
  id: number;
  role: Role;
  applicant: boolean;
  /** Workers */
  xp: number;
  morale: number;
  energy: number;
  trial: boolean;
  leaving: boolean;
  trainCost: Big;
  /** Applicants */
  fee: Big;
  patience: number;
  negotiated: 'no' | 'accepted' | 'refused';
  room: boolean;
  /** The applicant the shortlist suggests. */
  pick: boolean;
  /** Talent levels (workers only). */
  talents?: TalentLevels;
}

/** A plain copy of what the menu shows, read a few times per second. */
function read(s: GameState) {
  const team: PersonRow[] = s.staff.map((st) => ({
    ...st,
    stats: { ...st.stats },
    talents: st.talents ? { ...st.talents } : undefined,
    applicant: false,
    fee: st.wage,
    patience: 1,
    negotiated: 'no',
    room: true,
    pick: false,
    trainCost: trainingCost(st),
  }));
  const pick = recommended(s);
  const applicants: PersonRow[] = s.applicants
    .filter((a) => a.state === 'waiting')
    .map((a) => ({
      ...a,
      stats: { ...a.stats },
      applicant: true,
      xp: 0,
      morale: STAFF.morale.start,
      energy: 1,
      trial: false,
      leaving: false,
      trainCost: a.wage,
      fee: signingFee(a),
      patience: a.patience,
      room: headcount(s, a.role) < capacity(s, a.role),
      pick: a.id === pick,
    }));
  const room = Object.fromEntries(ROLE_LIST.map((r) => [r, headcount(s, r) < capacity(s, r)])) as Record<Role, boolean>;
  return { coins: s.coins, gems: s.gems, talentPoints: s.talentPoints, team, applicants, room };
}

function Bar({ value, color, label }: { value: number; color: string; label: string }) {
  return (
    <View style={styles.barRow}>
      <Text style={styles.barLabel}>{label}</Text>
      <View style={styles.bar}>
        <View style={[styles.barFill, { width: `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

function Money({ value, suffix }: { value: Big; suffix?: string }) {
  // The number and the Hebrew word stay in separate Texts: mixing them breaks bidi order.
  return (
    <View style={styles.money}>
      <View style={styles.coin} />
      <Text style={styles.moneyText}>{formatBig(value)}</Text>
      {suffix ? <Text style={styles.moneySuffix}>{suffix}</Text> : null}
    </View>
  );
}

function Traits({ traits }: { traits: readonly TraitId[] }) {
  const t = useT();
  return (
    <View style={styles.traits}>
      {traits.map((id) => (
        <View key={id} style={[styles.trait, !TRAITS[id].good && styles.traitBad]}>
          <Text style={styles.traitName}>{t(`trait.${id}`)}</Text>
          <Text style={styles.traitTip}>{t(`traitTip.${id}`)}</Text>
        </View>
      ))}
    </View>
  );
}

function Button({ label, onPress, kind = 'plain', disabled = false }: { label: string; onPress: () => void; kind?: 'go' | 'plain' | 'danger'; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => {
        tapFeedback();
        onPress();
      }}
      style={[styles.button, kind === 'go' && styles.buttonGo, kind === 'danger' && styles.buttonDanger, disabled && styles.buttonOff]}
    >
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

/** Common, rare, epic or legendary: a colored chip (the card's frame takes the color too). */
function RarityTag({ rarity }: { rarity: Rarity }) {
  const t = useT();
  return (
    <View style={[styles.rarity, { backgroundColor: RARITY[rarity].color }]}>
      <Text style={styles.rarityText}>{`${RARITY_ICON[rarity]} ${t(`rarity.${rarity}`)}`}</Text>
    </View>
  );
}

const RARITY_ICON: Record<Rarity, string> = { common: '●', rare: '◆', epic: '✦', legendary: '★', mythic: '👑' };
/** A frame in the rarity's color (none for common). */
const frame = (rarity: Rarity) => (rarity === 'common' ? null : { borderWidth: 2, borderColor: RARITY[rarity].color });

function Row({ p, onPress }: { p: PersonRow; onPress: () => void }) {
  const t = useT();
  const lang = useSettings((s) => s.lang);
  return (
    <Pressable onPress={onPress} style={[styles.row, frame(p.rarity)]}>
      <Image source={{ uri: personIcon(p) }} style={styles.icon} />
      <View style={styles.rowBody}>
        <View style={styles.line}>
          <Text style={styles.name}>{personName(p, lang, t)}</Text>
          <Text style={styles.role}>{t(`role.${p.role}`)}</Text>
          <Text style={styles.lvLabel}>{t('ui.lv')}</Text>
          <Text style={styles.lv}>{p.level}</Text>
          <RarityTag rarity={p.rarity} />
          {talentCount(p.talents) > 0 && (
            <IconText icon="iconTalent" size={14} textStyle={styles.talentCount}>
              {talentCount(p.talents)}
            </IconText>
          )}
        </View>
        {p.applicant ? (
          <Bar value={p.patience} color="#F4C542" label={t('ui.patience')} />
        ) : (
          <View style={styles.line}>
            <Bar value={p.morale} color="#FF6FA8" label={t('ui.morale')} />
            <Bar value={p.energy} color="#5CD66E" label={t('ui.energy')} />
          </View>
        )}
        {p.trial && <Text style={styles.tag}>{t('ui.onTrial')}</Text>}
        {p.leaving && <Text style={styles.tagBad}>{t('ui.leaving')}</Text>}
        {p.pick && <IconText icon="iconCheck" size={16} textStyle={styles.tagPick}>{`${t('ui.recommended')}`}</IconText>}
      </View>
      <Money value={p.wage} suffix={t('ui.perDay')} />
    </Pressable>
  );
}

function Card({ p, coins, gems, points, room, onCommand, onBack }: { p: PersonRow; coins: Big; gems: number; points: number; room: Record<Role, boolean>; onCommand: (cmd: Command) => void; onBack: () => void }) {
  const t = useT();
  const lang = useSettings((s) => s.lang);
  const bulk = useSettings((s) => s.bulk);
  // Training in tens or hundreds (bulk buying): the whole batch is paid at once.
  const training = trainingPlan(p, coins, bulk);
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const id = setTimeout(() => setArmed(false), 3500);
    return () => clearTimeout(id);
  }, [armed]);
  return (
    <View style={[styles.card, frame(p.rarity)]}>
      <View style={styles.line}>
        <Image source={{ uri: personIcon(p) }} style={styles.iconBig} />
        <View style={styles.rowBody}>
          <Text style={styles.cardName}>{personName(p, lang, t)}</Text>
          <View style={styles.line}>
            <Text style={styles.role}>{t(`role.${p.role}`)}</Text>
            <Text style={styles.lvLabel}>{t('ui.lv')}</Text>
            <Text style={styles.lv}>{p.level}</Text>
            <RarityTag rarity={p.rarity} />
          </View>
          {p.rarity !== 'common' && <Text style={styles.rarityPerk}>{t('rarity.perk').replace('{n}', String(Math.round((RARITY[p.rarity].xp - 1) * 100)))}</Text>}
        </View>
        <Money value={p.wage} suffix={t('ui.perDay')} />
      </View>
      {STAT_IDS.map((k) => (
        <View key={k} style={styles.statRow}>
          <Text style={styles.statLabel}>{t(`skill.${k}`)}</Text>
          <View style={styles.statBar}>
            <View style={[styles.statFill, { width: `${(p.stats[k] / STAFF.stat.max) * 100}%` }]} />
          </View>
          <Text style={styles.statValue}>{p.stats[k]}</Text>
        </View>
      ))}
      <Traits traits={p.traits} />
      {p.applicant ? (
        <>
          {p.negotiated !== 'no' && <Text style={p.negotiated === 'accepted' ? styles.tag : styles.tagBad}>{t(p.negotiated === 'accepted' ? 'ui.accepted' : 'ui.refused')}</Text>}
          {!p.room && <Text style={styles.tagBad}>{t('ui.noRoom')}</Text>}
          <View style={styles.line}>
            <Text style={styles.statLabel}>{t('ui.fee')}</Text>
            <Money value={p.fee} />
          </View>
          <View style={styles.actions}>
            <Button label={t('ui.hire')} kind="go" disabled={!p.room || coins.lt(p.fee)} onPress={() => onCommand({ type: 'hire', applicant: p.id, trial: false })} />
            <Button label={t('ui.trial')} disabled={!p.room} onPress={() => onCommand({ type: 'hire', applicant: p.id, trial: true })} />
            {p.negotiated === 'no' && <Button label={t('ui.negotiate')} onPress={() => onCommand({ type: 'negotiate', applicant: p.id })} />}
            <Button label={t('ui.reject')} kind="danger" onPress={() => onCommand({ type: 'reject', applicant: p.id })} />
          </View>
        </>
      ) : (
        <>
          <Bar value={p.xp / xpToNext(p.level)} color={gold} label={t('ui.xp')} />
          <View style={styles.line}>
            <Bar value={p.morale} color="#FF6FA8" label={t('ui.morale')} />
            <Bar value={p.energy} color="#5CD66E" label={t('ui.energy')} />
          </View>
          <Talents p={p} points={points} gems={gems} onCommand={onCommand} />
          {p.hero ? (
            <IconText icon="iconCrown" size={16} textStyle={styles.tagPick}>{`${t('staff.heroFree')}`}</IconText>
          ) : p.leaving ? (
            <Text style={styles.tagBad}>{t('ui.leaving')}</Text>
          ) : (
            <>
              <View style={styles.actions}>
                <Button label={t('ui.bonus')} kind="go" disabled={coins.lt(p.wage)} onPress={() => onCommand({ type: 'bonus', staff: p.id })} />
                <Button label={training.count > 1 ? `${t('ui.train')} x${training.count}` : t('ui.train')} disabled={coins.lt(training.cost)} onPress={() => onCommand({ type: 'train', staff: p.id, count: bulk === 'max' ? training.count : bulk })} />
                <Button label={t('ui.scold')} onPress={() => onCommand({ type: 'scold', staff: p.id })} />
                <Button label={armed ? t('ui.fireConfirm') : t('ui.fire')} kind="danger" onPress={() => (armed ? onCommand({ type: 'fire', staff: p.id }) : setArmed(true))} />
              </View>
              <View style={styles.line}>
                <Money value={p.wage} />
                <Text style={styles.statLabel}>{t('ui.bonus')}</Text>
                <Money value={training.cost} />
                <Text style={styles.statLabel}>{t('ui.train')}</Text>
                <View style={styles.grow} />
                <BulkToggle />
              </View>
              <Text style={styles.section}>{t('ui.changeJob')}</Text>
              <View style={styles.actions}>
                {ROLE_LIST.filter((r) => r !== p.role).map((r) => (
                  <Button key={r} label={t(`role.${r}`)} disabled={!room[r]} onPress={() => onCommand({ type: 'reassign', staff: p.id, role: r })} />
                ))}
              </View>
            </>
          )}
        </>
      )}
      <Pressable onPress={onBack} style={styles.back}>
        <Text style={styles.backText}>{t('ui.back')}</Text>
      </Pressable>
    </View>
  );
}

/** The number in each talent's line: what one level does, in percent. */
const TIP_N: Record<TalentId, number> = { quick: TALENT.quick, mood: TALENT.moodShield, fit: TALENT.fitDrain, craft: TALENT.craft, charisma: TALENT.charisma, loyal: TALENT.loyalWage };

/**
 * The worker's talents (owner M46): a row each with its level in pips and the next level's price
 * in points, the levels held against what their level allows, and a reset for gems.
 */
function Talents({ p, points, gems, onCommand }: { p: PersonRow; points: number; gems: number; onCommand: (cmd: Command) => void }) {
  const t = useT();
  const used = talentCount(p.talents);
  const slots = talentSlots(p.level);
  const spent = talentSpent(p.talents);
  const blocks = TALENT_IDS.map((id) => talentBlockOf(p, id, points));
  // What stands in the way, said once under the rows: no room left (level up for more), or no points.
  const hint = p.leaving ? null : used >= slots ? 'talent.full' : blocks.some((b) => b === 'points') && !blocks.some((b) => b === null) ? 'talent.earn' : null;
  return (
    <View style={styles.talents}>
      <View style={styles.line}>
        <IconText icon="iconTalent" size={18} textStyle={styles.talentTitle}>
          {t('talent.title')}
        </IconText>
        <View style={styles.grow} />
        <Text style={styles.talentSlotsLabel}>{t('talent.slots')}</Text>
        <Text style={styles.talentSlots}>{`${used}/${slots}`}</Text>
      </View>
      {TALENT_IDS.map((id, i) => {
        const def = TALENTS[id];
        const lv = p.talents?.[id] ?? 0;
        const block = blocks[i];
        return (
          <View key={id} style={styles.talentRow}>
            <GameIcon name={def.icon as HudIcon} size={24} />
            <View style={styles.rowBody}>
              <Text style={styles.talentName}>{t(`talent.${id}`)}</Text>
              <Text style={styles.talentTip}>{t(`talentTip.${id}`).replace('{n}', String(Math.round(TIP_N[id] * 100))).replace('{max}', String(TALENT.max))}</Text>
            </View>
            <View style={styles.pips}>
              {Array.from({ length: TALENT.max }, (_, k) => (
                <View key={k} style={[styles.pip, k < lv && { backgroundColor: def.color, borderColor: def.color }]} />
              ))}
            </View>
            {lv >= TALENT.max ? (
              <Text style={styles.talentMax}>{t('talent.max')}</Text>
            ) : (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${t(`talent.${id}`)} +1`}
                accessibilityState={{ disabled: block !== null }}
                disabled={block !== null}
                onPress={() => {
                  tapFeedback();
                  onCommand({ type: 'talent', staff: p.id, talent: id });
                }}
                style={[styles.talentBuy, { borderColor: def.color }, block === null && { backgroundColor: def.color }, block !== null && styles.buttonOff]}
              >
                <Text style={[styles.talentPlus, block === null && styles.talentPlusOn]}>{'+'}</Text>
                <GameIcon name="iconTalent" size={14} />
                <Text style={[styles.talentCost, block === null && styles.talentPlusOn]}>{talentCost(lv)}</Text>
              </Pressable>
            )}
          </View>
        );
      })}
      {hint && <Text style={styles.talentHint}>{t(hint)}</Text>}
      {spent > 0 && !p.leaving && (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: gems < TALENT.resetGems }}
          disabled={gems < TALENT.resetGems}
          onPress={() => {
            tapFeedback();
            onCommand({ type: 'talentReset', staff: p.id });
          }}
          style={[styles.talentReset, gems < TALENT.resetGems && styles.buttonOff]}
        >
          <Text style={styles.talentResetText}>{t('talent.reset')}</Text>
          <GameIcon name="hudGem" size={14} />
          <Text style={styles.talentResetText}>{TALENT.resetGems}</Text>
        </Pressable>
      )}
    </View>
  );
}

/** Side sheet: the team, the people at the door, and each person's card. */
export function StaffPanel({ gameRef, view, onView, onCommand, onClose }: Props) {
  const t = useT();
  const data = usePoll(gameRef, read, 6);
  const slide = useSharedValue(1);
  useEffect(() => {
    slide.value = withTiming(0, { duration: 220, easing: Easing.out(Easing.cubic) });
  }, [slide]);
  const slideStyle = useAnimatedStyle(() => ({ transform: [{ translateX: slide.value * 420 }] }));
  if (!data) return null;
  const person = 'person' in view ? [...data.team, ...data.applicants].find((p) => p.id === view.person) : undefined;
  const tab = 'tab' in view ? view.tab : person?.applicant ? 'applicants' : 'team';
  const list = tab === 'team' ? data.team : data.applicants;
  return (
    <Animated.View style={[styles.panel, slideStyle]}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('ui.staff')}</Text>
        <View style={[styles.pointsChip, data.talentPoints > 0 && styles.pointsChipOn]}>
          <GameIcon name="iconTalent" size={18} />
          <Text style={styles.pointsText}>{data.talentPoints}</Text>
          <Text style={styles.pointsLabel}>{t('talent.points')}</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="close" onPress={onClose} hitSlop={10} style={styles.close}>
          <Text style={styles.closeText}>{'✕'}</Text>
        </Pressable>
      </View>
      <View style={styles.tabs}>
        {(['team', 'applicants'] as const).map((k) => (
          <Pressable key={k} onPress={() => onView({ tab: k })} style={[styles.tab, tab === k && !person && styles.tabOn]}>
            <Text style={[styles.tabText, tab === k && !person && styles.tabTextOn]}>{t(`ui.${k}`)}</Text>
            {k === 'applicants' && data.applicants.length > 0 && (
              <View style={styles.dot}>
                <Text style={styles.dotText}>{data.applicants.length}</Text>
              </View>
            )}
          </Pressable>
        ))}
      </View>
      <ScrollView style={styles.list} contentContainerStyle={styles.listInner}>
        {person ? (
          <Card p={person} coins={data.coins} gems={data.gems} points={data.talentPoints} room={data.room} onCommand={onCommand} onBack={() => onView({ tab })} />
        ) : list.length === 0 ? (
          <Text style={styles.empty}>{t('ui.noApplicants')}</Text>
        ) : (
          list.map((p) => <Row key={p.id} p={p} onPress={() => onView({ person: p.id })} />)
        )}
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1 },
  panel: {
    position: 'absolute',
    top: 8,
    bottom: 8,
    right: 8,
    width: 392,
    maxWidth: '62%',
    backgroundColor: panel.bg,
    borderRadius: 18,
    borderWidth: 2.5,
    borderColor: gold,
    boxShadow: '0px 6px 0px #120818',
    overflow: 'hidden',
  },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingTop: 10, paddingBottom: 6 },
  title: { flex: 1, color: '#FFE9A8', fontSize: 19, fontWeight: '900' },
  close: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#4A2550', alignItems: 'center', justifyContent: 'center' },
  closeText: { color: '#FFE9A8', fontSize: 16, fontWeight: '900' },
  tabs: { flexDirection: 'row', gap: 6, paddingHorizontal: 10, paddingBottom: 6 },
  tab: { paddingHorizontal: 14, height: 32, borderRadius: 16, backgroundColor: '#3A1D40', flexDirection: 'row', alignItems: 'center', gap: 6 },
  tabOn: { backgroundColor: gold },
  tabText: { color: '#E8D7F0', fontWeight: '800', fontSize: 13 },
  tabTextOn: { color: '#2A1530' },
  dot: { minWidth: 18, height: 18, borderRadius: 9, backgroundColor: '#E5483B', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  dotText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900' },
  list: { flex: 1 },
  listInner: { paddingHorizontal: 10, paddingBottom: 12, gap: 8 },
  empty: { color: '#C9B3D6', fontSize: 13, fontWeight: '700', textAlign: 'center', marginTop: 16, paddingHorizontal: 12 },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: panel.row, borderRadius: 14, padding: 8, gap: 8 },
  icon: { width: ICON_PX, height: ICON_PX },
  iconBig: { width: 48, height: 48 },
  rowBody: { flex: 1, gap: 3 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  name: { color: '#FFF4E3', fontWeight: '900', fontSize: 14 },
  cardName: { color: '#FFF4E3', fontWeight: '900', fontSize: 18 },
  role: { color: '#C9B3D6', fontWeight: '700', fontSize: 12 },
  lvLabel: { color: '#C9B3D6', fontWeight: '800', fontSize: 12 },
  lv: { color: gold, fontWeight: '900', fontSize: 13 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flexGrow: 1 },
  barLabel: { color: '#C9B3D6', fontSize: 10, fontWeight: '700', minWidth: 42 },
  bar: { flex: 1, minWidth: 44, height: 7, borderRadius: 4, backgroundColor: '#1C0E22', overflow: 'hidden' },
  barFill: { height: 7 },
  tag: { alignSelf: 'flex-start', color: '#7EE08F', fontSize: 11, fontWeight: '800' },
  tagBad: { alignSelf: 'flex-start', color: '#FF8A7A', fontSize: 11, fontWeight: '800' },
  tagPick: { alignSelf: 'flex-start', color: '#2A1530', backgroundColor: '#7EE08F', fontSize: 11, fontWeight: '900', paddingHorizontal: 6, borderRadius: 8, overflow: 'hidden', marginTop: 2 },
  money: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  coin: { width: 13, height: 13, borderRadius: 7, backgroundColor: '#FFC21A', borderWidth: 1.5, borderColor: '#9A6A00' },
  moneyText: { color: '#FFF4E3', fontWeight: '900', fontSize: 13 },
  moneySuffix: { color: '#C9B3D6', fontWeight: '700', fontSize: 11 },
  rarity: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 8 },
  rarityText: { color: '#1A0E22', fontSize: 10.5, fontWeight: '900' },
  rarityPerk: { color: '#C9B3D6', fontSize: 11, fontWeight: '700' },
  card: { backgroundColor: panel.row, borderRadius: 14, padding: 10, gap: 7 },
  statRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statLabel: { color: '#C9B3D6', fontSize: 12, fontWeight: '700', minWidth: 64 },
  statBar: { flex: 1, height: 8, borderRadius: 4, backgroundColor: '#1C0E22', overflow: 'hidden' },
  statFill: { height: 8, backgroundColor: '#5B8EDB' },
  statValue: { color: '#FFF4E3', fontSize: 12, fontWeight: '900', minWidth: 18, textAlign: 'center' },
  traits: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  trait: { backgroundColor: '#1E4A2E', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: '#3DDC6A' },
  traitBad: { backgroundColor: '#4A1E22', borderColor: '#FF6A5E' },
  traitName: { color: '#FFF4E3', fontSize: 12, fontWeight: '900' },
  traitTip: { color: '#D8CFE0', fontSize: 10, fontWeight: '600' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  button: { minHeight: 40, paddingHorizontal: 12, borderRadius: 12, backgroundColor: '#4A2550', borderWidth: 1.5, borderColor: '#8A5BB8', justifyContent: 'center' },
  buttonGo: { backgroundColor: '#35B957', borderColor: '#B9F5A8' },
  buttonDanger: { backgroundColor: '#7A1E2A', borderColor: '#FF6A5E' },
  buttonOff: { opacity: 0.45 },
  buttonText: { color: '#FFFFFF', fontWeight: '900', fontSize: 13 },
  section: { color: '#C9B3D6', fontWeight: '800', fontSize: 12, marginTop: 2 },
  pointsChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, height: 28, borderRadius: 14, backgroundColor: '#3A1D40', marginEnd: 8 },
  pointsChipOn: { backgroundColor: '#5A1F5E', borderWidth: 1.5, borderColor: '#FF6FD8' },
  pointsText: { color: '#FFF4E3', fontWeight: '900', fontSize: 14 },
  pointsLabel: { color: '#E8C8F0', fontWeight: '700', fontSize: 11 },
  talentCount: { color: '#FF9BE6', fontWeight: '900', fontSize: 12 },
  talents: { backgroundColor: '#24112A', borderRadius: 12, padding: 8, gap: 6, borderWidth: 1, borderColor: '#5A2E66' },
  talentTitle: { color: '#FFE9A8', fontWeight: '900', fontSize: 14 },
  talentSlotsLabel: { color: '#C9B3D6', fontSize: 11, fontWeight: '700' },
  talentSlots: { color: '#FFF4E3', fontSize: 13, fontWeight: '900' },
  talentRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  talentName: { color: '#FFF4E3', fontSize: 13, fontWeight: '900' },
  talentTip: { color: '#C9B3D6', fontSize: 10.5, fontWeight: '600' },
  pips: { flexDirection: 'row', gap: 3 },
  pip: { width: 9, height: 9, borderRadius: 5, borderWidth: 1.5, borderColor: '#6A4A78', backgroundColor: '#1C0E22' },
  talentBuy: { flexDirection: 'row', alignItems: 'center', gap: 3, minWidth: 58, height: 34, paddingHorizontal: 8, borderRadius: 11, borderWidth: 1.5, backgroundColor: '#3A1D40', justifyContent: 'center' },
  talentPlus: { color: '#FFF4E3', fontWeight: '900', fontSize: 15 },
  talentPlusOn: { color: '#1A0E22' },
  talentCost: { color: '#FFF4E3', fontWeight: '900', fontSize: 13 },
  talentMax: { minWidth: 58, textAlign: 'center', color: gold, fontWeight: '900', fontSize: 12 },
  talentHint: { color: '#FFB8EC', fontSize: 11, fontWeight: '700' },
  talentReset: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, height: 30, borderRadius: 10, backgroundColor: '#3A1D40', borderWidth: 1, borderColor: '#8A5BB8' },
  talentResetText: { color: '#E8D7F0', fontWeight: '800', fontSize: 12 },
  back: { alignSelf: 'center', paddingHorizontal: 18, height: 36, borderRadius: 18, borderWidth: 2, borderColor: gold, justifyContent: 'center', marginTop: 4 },
  backText: { color: '#FFE9A8', fontWeight: '900', fontSize: 13 },
});
