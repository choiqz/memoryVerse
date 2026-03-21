import { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  FlatList,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Colors } from '../constants/Colors';
import { getUserStats, getAllUserVerses, getRecentSessions } from '../lib/db';
import type { UserStats, UserVerse, Verse } from '../lib/db/schema';
import { getMasteryLevel, MASTERY_LABELS, MASTERY_EMOJIS } from '../lib/srs';
import { formatRef } from '../lib/bible';

type UserVerseWithVerse = UserVerse & Verse;

export default function ProgressScreen() {
  const [stats, setStats] = useState<UserStats | null>(null);
  const [userVerses, setUserVerses] = useState<UserVerseWithVerse[]>([]);
  const [sessions, setSessions] = useState<{ date: string; versesReviewed: number; xpEarned: number }[]>([]);

  useFocusEffect(
    useCallback(() => {
      Promise.all([
        getUserStats(),
        getAllUserVerses(),
        getRecentSessions(30),
      ]).then(([s, uv, sess]) => {
        setStats(s);
        setUserVerses(uv);
        setSessions(sess);
      });
    }, []),
  );

  const masteryGroups = {
    'deep-rooted': userVerses.filter((v) => getMasteryLevel(v.repetitions, v.interval) === 'deep-rooted'),
    'rooted': userVerses.filter((v) => getMasteryLevel(v.repetitions, v.interval) === 'rooted'),
    'growing': userVerses.filter((v) => getMasteryLevel(v.repetitions, v.interval) === 'growing'),
    'seedling': userVerses.filter((v) => getMasteryLevel(v.repetitions, v.interval) === 'seedling'),
  } as const;

  // Build 30-day activity grid (7 rows × ~5 cols)
  const activityMap = new Map(sessions.map((s) => [s.date, s.versesReviewed]));
  const today = new Date();
  const activityGrid: Array<{ date: string; count: number }> = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    activityGrid.push({ date: dateStr, count: activityMap.get(dateStr) ?? 0 });
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Stats cards */}
      <View style={styles.statsGrid}>
        <StatCard
          emoji="🔥"
          value={String(stats?.streak ?? 0)}
          label="Day Streak"
          color={Colors.streak}
        />
        <StatCard
          emoji="🏆"
          value={String(stats?.longestStreak ?? 0)}
          label="Best Streak"
          color={Colors.secondary}
        />
        <StatCard
          emoji="⚡"
          value={(stats?.totalXP ?? 0).toLocaleString()}
          label="Total XP"
          color={Colors.primary}
        />
        <StatCard
          emoji="📖"
          value={String(stats?.versesLearned ?? 0)}
          label="Verses"
          color={Colors.success}
        />
      </View>

      {/* Activity heatmap */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Activity (Last 30 Days)</Text>
        <View style={styles.heatmap}>
          {activityGrid.map(({ date, count }) => (
            <View
              key={date}
              style={[
                styles.heatCell,
                count === 0 && styles.heatCell0,
                count >= 1 && count < 5 && styles.heatCell1,
                count >= 5 && count < 10 && styles.heatCell2,
                count >= 10 && styles.heatCell3,
              ]}
            />
          ))}
        </View>
        <View style={styles.heatLegend}>
          <Text style={styles.heatLegendText}>Less</Text>
          <View style={[styles.heatLegendCell, styles.heatCell0]} />
          <View style={[styles.heatLegendCell, styles.heatCell1]} />
          <View style={[styles.heatLegendCell, styles.heatCell2]} />
          <View style={[styles.heatLegendCell, styles.heatCell3]} />
          <Text style={styles.heatLegendText}>More</Text>
        </View>
      </View>

      {/* Mastery breakdown */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Verse Mastery</Text>
        {(['deep-rooted', 'rooted', 'growing', 'seedling'] as const).map((level) => {
          const count = masteryGroups[level].length;
          const total = userVerses.length;
          const pct = total > 0 ? (count / total) * 100 : 0;
          const color =
            level === 'deep-rooted' ? Colors.deepRooted :
            level === 'rooted' ? Colors.rooted :
            level === 'growing' ? Colors.growing : Colors.seedling;

          return (
            <View key={level} style={styles.masteryRow}>
              <Text style={styles.masteryEmoji}>{MASTERY_EMOJIS[level]}</Text>
              <View style={styles.masteryInfo}>
                <View style={styles.masteryLabelRow}>
                  <Text style={styles.masteryLabel}>{MASTERY_LABELS[level]}</Text>
                  <Text style={styles.masteryCount}>{count}</Text>
                </View>
                <View style={styles.masteryBar}>
                  <View style={[styles.masteryBarFill, { width: `${pct}%`, backgroundColor: color }]} />
                </View>
              </View>
            </View>
          );
        })}
      </View>

      {/* Recent activity */}
      {sessions.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Sessions</Text>
          {sessions.slice(-7).reverse().map((s) => (
            <View key={s.date} style={styles.sessionRow}>
              <Text style={styles.sessionDate}>{formatDate(s.date)}</Text>
              <Text style={styles.sessionVerses}>{s.versesReviewed} verses</Text>
              <Text style={styles.sessionXP}>+{s.xpEarned} XP</Text>
            </View>
          ))}
        </View>
      )}

      {/* All verses list */}
      {userVerses.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>My Library ({userVerses.length})</Text>
          {userVerses.map((uv) => {
            const level = getMasteryLevel(uv.repetitions, uv.interval);
            const color =
              level === 'deep-rooted' ? Colors.deepRooted :
              level === 'rooted' ? Colors.rooted :
              level === 'growing' ? Colors.growing : Colors.seedling;
            return (
              <View key={uv.id} style={styles.libraryItem}>
                <View style={styles.libraryItemLeft}>
                  <Text style={styles.libraryRef}>
                    {formatRef(uv.book, uv.chapter, uv.verse)}
                  </Text>
                  <Text style={styles.libraryText} numberOfLines={2}>{uv.text}</Text>
                </View>
                <View style={[styles.masteryDot, { backgroundColor: color }]}>
                  <Text style={styles.masteryDotText}>{MASTERY_EMOJIS[level]}</Text>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {userVerses.length === 0 && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>📖</Text>
          <Text style={styles.emptyTitle}>No verses yet</Text>
          <Text style={styles.emptyMsg}>Add verses from the Add Verses screen to start tracking your progress.</Text>
        </View>
      )}
    </ScrollView>
  );
}

function StatCard({ emoji, value, label, color }: { emoji: string; value: string; label: string; color: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statEmoji}>{emoji}</Text>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 20, paddingBottom: 40, gap: 20 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    gap: 4,
    shadowColor: '#000', shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 }, shadowRadius: 8, elevation: 2,
  },
  statEmoji: { fontSize: 24 },
  statValue: { fontSize: 26, fontWeight: '800' },
  statLabel: { fontSize: 11, color: Colors.textMuted, fontWeight: '600', textTransform: 'uppercase' },
  section: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    gap: 12,
    shadowColor: '#000', shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 }, shadowRadius: 8, elevation: 2,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: Colors.text },
  heatmap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 3,
  },
  heatCell: {
    width: 18,
    height: 18,
    borderRadius: 4,
  },
  heatCell0: { backgroundColor: Colors.divider },
  heatCell1: { backgroundColor: Colors.primary + '40' },
  heatCell2: { backgroundColor: Colors.primary + '80' },
  heatCell3: { backgroundColor: Colors.primary },
  heatLegend: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
  },
  heatLegendCell: { width: 14, height: 14, borderRadius: 3 },
  heatLegendText: { fontSize: 11, color: Colors.textMuted },
  masteryRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  masteryEmoji: { fontSize: 22, width: 32, textAlign: 'center' },
  masteryInfo: { flex: 1, gap: 4 },
  masteryLabelRow: { flexDirection: 'row', justifyContent: 'space-between' },
  masteryLabel: { fontSize: 14, fontWeight: '600', color: Colors.text },
  masteryCount: { fontSize: 14, fontWeight: '700', color: Colors.textMuted },
  masteryBar: { height: 6, backgroundColor: Colors.divider, borderRadius: 3, overflow: 'hidden' },
  masteryBarFill: { height: '100%', borderRadius: 3 },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  sessionDate: { flex: 1, fontSize: 14, color: Colors.text, fontWeight: '500' },
  sessionVerses: { fontSize: 13, color: Colors.textMuted, marginRight: 12 },
  sessionXP: { fontSize: 13, fontWeight: '700', color: Colors.secondary },
  libraryItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  libraryItemLeft: { flex: 1, gap: 2 },
  libraryRef: { fontSize: 12, fontWeight: '700', color: Colors.primary, textTransform: 'uppercase' },
  libraryText: { fontSize: 13, color: Colors.textMuted, lineHeight: 18 },
  masteryDot: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  masteryDotText: { fontSize: 16 },
  emptyState: { alignItems: 'center', padding: 40, gap: 12 },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: Colors.text },
  emptyMsg: { fontSize: 14, color: Colors.textMuted, textAlign: 'center', lineHeight: 22 },
});
