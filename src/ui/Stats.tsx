import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { TIERS } from '../data/buildings';
import { WEEKDAY_IDS } from '../data/calendar';
import { FESTIVAL_THEMES } from '../data/events';
import { CITIES } from '../data/franchise';
import { useT } from '../i18n';
import { usePoll } from '../render/useSimulation';
import { weekdayOf } from '../sim/calendar';
import { levelOf } from '../sim/economy/upgrades';
import { formatBig } from '../sim/format';
import type { GameState } from '../sim/game/types';
import { incomeRate } from '../sim/shop';
import { useSettings } from '../store/settings';
import { rosettes } from './Guide';
import { liveGame } from './liveGame';
import { Overlay, scrollFill } from './Overlay';
import { gold, panel, textShadow } from './theme';

// The restaurant's story in numbers (polish): everything the game counts, in one card.

const readStats = (s: GameState) => {
  const served = s.stats.served;
  const walkouts = s.stats.walkouts;
  return {
    day: s.day,
    weekday: weekdayOf(s.day),
    tier: TIERS[levelOf(s.levels, 'building')]?.id ?? TIERS[0]!.id,
    city: CITIES[s.city % CITIES.length]!.id,
    level: s.quests.level,
    served,
    delivered: s.stats.delivered,
    happy: served + walkouts > 0 ? Math.round((served / (served + walkouts)) * 100) : 100,
    earned: formatBig(s.stats.earned),
    perMinute: formatBig(incomeRate(s).mul(60).floor()),
    rating: s.rating.toFixed(1),
    fiveStars: s.stats.fiveStars,
    bestCombo: s.stats.bestCombo,
    team: s.staff.filter((st) => !st.leaving).length,
    hires: s.stats.hires,
    chefTrophies: s.trophies,
    festivalTrophies: s.festival.trophies.length,
    gems: s.gems,
    guide: rosettes(s.guide.stars, s.guide.plate),
  };
};

function Row({ icon, label, value }: { icon: string; label: string; value: string | number }) {
  return (
    <View style={styles.row}>
      <Text style={styles.icon}>{icon}</Text>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

export function StatsPanel({ onClose }: { onClose: () => void }) {
  const t = useT();
  const profile = useSettings((s) => s.profile);
  const d = usePoll(liveGame.ref, readStats, 1);
  return (
    <Overlay onClose={onClose} card={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>{`📊 ${profile?.restaurant || t('stats.title')}`}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="close" onPress={onClose} hitSlop={10} style={styles.close}>
          <Text style={styles.closeText}>{'✕'}</Text>
        </Pressable>
      </View>
      {!d ? (
        <Text style={styles.label}>{t('stats.none')}</Text>
      ) : (
        <ScrollView style={scrollFill} contentContainerStyle={styles.grid}>
          <Row icon="🏢" label={t('stats.building')} value={`${t(`tier.${d.tier}`)} · ${t(`city.${d.city}`)}`} />
          <Row icon="📅" label={t('stats.days')} value={`${d.day} · ${t(`week.${WEEKDAY_IDS[d.weekday]}`)}`} />
          <Row icon="🏅" label={t('stats.level')} value={d.level} />
          <Row icon="🍽️" label={t('stats.served')} value={d.served.toLocaleString()} />
          <Row icon="🛵" label={t('stats.delivered')} value={d.delivered.toLocaleString()} />
          <Row icon="😊" label={t('stats.happy')} value={`${d.happy}%`} />
          <Row icon="🪙" label={t('stats.earned')} value={d.earned} />
          <Row icon="📈" label={t('stats.perMinute')} value={d.perMinute} />
          <Row icon="⭐" label={t('stats.rating')} value={`${d.rating} / 5`} />
          <Row icon="🌟" label={t('stats.fiveStars')} value={d.fiveStars} />
          <Row icon="🔥" label={t('stats.combo')} value={`x${d.bestCombo}`} />
          <Row icon="👥" label={t('stats.team')} value={`${d.team} (${t('stats.hired')} ${d.hires})`} />
          <Row icon="🏆" label={t('stats.trophies')} value={d.chefTrophies} />
          <Row icon="🎪" label={t('stats.festival')} value={`${d.festivalTrophies}/${FESTIVAL_THEMES.length}`} />
          <Row icon="💎" label={t('stats.gems')} value={d.gems} />
          <Row icon="📕" label={t('stats.guide')} value={d.guide} />
        </ScrollView>
      )}
    </Overlay>
  );
}

const styles = StyleSheet.create({
  card: { width: 620, maxWidth: '96%', maxHeight: '92%', backgroundColor: panel.bg, borderRadius: 20, borderWidth: 2.5, borderColor: gold, padding: 12, gap: 8 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { flex: 1, color: '#FFE9A8', fontSize: 20, fontWeight: '900', ...textShadow('#120818', 2, 2) },
  close: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#4A2550', alignItems: 'center', justifyContent: 'center' },
  closeText: { color: '#FFE9A8', fontSize: 16, fontWeight: '900' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  row: { width: '48.5%', flexGrow: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: panel.row, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 7 },
  icon: { fontSize: 18 },
  label: { flex: 1, color: '#C9B3D6', fontSize: 12.5, fontWeight: '800' },
  value: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
});
