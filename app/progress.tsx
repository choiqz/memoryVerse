import { useCallback, useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
} from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useFocusEffect } from 'expo-router';
import { Colors } from '../constants/Colors';
import { Fonts, Spacing, Radii, Shadows } from '../constants/Theme';
import { Heading, Title, Body, Caption, Overline } from '../components/Typography';
import { Card } from '../components/Card';
import { IconBadge } from '../components/IconBadge';
import { MasteryBadge } from '../components/MasteryBadge';
import { ProgressBar } from '../components/ProgressBar';
import { getUserStats, getAllUserVerses, getRecentSessions } from '../lib/db';
import type { UserStats, UserVerse, Verse } from '../lib/db/schema';
import { getMasteryLevel, MASTERY_LABELS, type MasteryLevel } from '../lib/srs';
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
      {/* Stats */}
      <Animated.View entering={FadeInUp.duration(400)} style={styles.statsGrid}>
        <Card style={styles.statCard}>
          <IconBadge name="flame" color={Colors.streak} size={16} />
          <Title style={{ color: Colors.streak }}>{stats?.streak ?? 0}</Title>
          <Overline>Day Streak</Overline>
        </Card>
        <Card style={styles.statCard}>
          <IconBadge name="trophy" color={Colors.secondary} size={16} />
          <Title style={{ color: Colors.secondary }}>{stats?.longestStreak ?? 0}</Title>
          <Overline>Best Streak</Overline>
        </Card>
        <Card style={styles.statCard}>
          <IconBadge name="flash" color={Colors.xp} size={16} />
          <Title style={{ color: Colors.primary }}>{(stats?.totalXP ?? 0).toLocaleString()}</Title>
          <Overline>Total XP</Overline>
        </Card>
        <Card style={styles.statCard}>
          <IconBadge name="book" color={Colors.success} size={16} />
          <Title style={{ color: Colors.success }}>{stats?.versesLearned ?? 0}</Title>
          <Overline>Verses</Overline>
        </Card>
      </Animated.View>

      {/* Heatmap */}
      <Animated.View entering={FadeInUp.delay(100).duration(400)}>
        <Card style={styles.section}>
          <Title>Activity (Last 30 Days)</Title>
          <View style={styles.heatmap}>
            {activityGrid.map(({ date, count }, i) => (
              <Animated.View
                key={date}
                entering={FadeInUp.delay(i * 15).duration(200)}
                style={[
                  styles.heatCell,
                  {
                    backgroundColor:
                      count === 0 ? Colors.divider :
                      count < 5 ? Colors.primaryLight + '60' :
                      count < 10 ? Colors.primaryLight :
                      Colors.primary,
                  },
                ]}
              />
            ))}
          </View>
          <View style={styles.heatLegend}>
            <Caption>Less</Caption>
            <View style={[styles.heatLegendCell, { backgroundColor: Colors.divider }]} />
            <View style={[styles.heatLegendCell, { backgroundColor: Colors.primaryLight + '60' }]} />
            <View style={[styles.heatLegendCell, { backgroundColor: Colors.primaryLight }]} />
            <View style={[styles.heatLegendCell, { backgroundColor: Colors.primary }]} />
            <Caption>More</Caption>
          </View>
        </Card>
      </Animated.View>

      {/* Mastery */}
      <Animated.View entering={FadeInUp.delay(200).duration(400)}>
        <Card style={styles.section}>
          <Title>Verse Mastery</Title>
          {(['deep-rooted', 'rooted', 'growing', 'seedling'] as const).map((level) => {
            const count = masteryGroups[level].length;
            const total = userVerses.length;
            const pct = total > 0 ? count / total : 0;

            return (
              <View key={level} style={styles.masteryRow}>
                <MasteryBadge level={level} size={16} />
                <View style={styles.masteryInfo}>
                  <View style={styles.masteryLabelRow}>
                    <Caption style={{ color: Colors.text }}>{MASTERY_LABELS[level]}</Caption>
                    <Caption>{count}</Caption>
                  </View>
                  <ProgressBar
                    progress={pct}
                    height={6}
                    color={
                      level === 'deep-rooted' ? Colors.deepRooted :
                      level === 'rooted' ? Colors.rooted :
                      level === 'growing' ? Colors.growing :
                      Colors.seedling
                    }
                  />
                </View>
              </View>
            );
          })}
        </Card>
      </Animated.View>

      {/* Recent sessions */}
      {sessions.length > 0 && (
        <Animated.View entering={FadeInUp.delay(300).duration(400)}>
          <Card style={styles.section}>
            <Title>Recent Sessions</Title>
            {sessions.slice(-7).reverse().map((s) => (
              <View key={s.date} style={styles.sessionRow}>
                <Body style={{ flex: 1 }}>{formatDate(s.date)}</Body>
                <Caption>{s.versesReviewed} verses</Caption>
                <Caption style={{ color: Colors.secondary, fontFamily: Fonts.bold }}>+{s.xpEarned} XP</Caption>
              </View>
            ))}
          </Card>
        </Animated.View>
      )}

      {/* Library */}
      {userVerses.length > 0 && (
        <Animated.View entering={FadeInUp.delay(400).duration(400)}>
          <Card style={styles.section}>
            <Title>My Library ({userVerses.length})</Title>
            {userVerses.map((uv) => {
              const level = getMasteryLevel(uv.repetitions, uv.interval);
              return (
                <View key={uv.id} style={styles.libraryItem}>
                  <View style={styles.libraryItemLeft}>
                    <Overline style={{ color: Colors.primary }}>
                      {formatRef(uv.book, uv.chapter, uv.verse)}
                    </Overline>
                    <Caption numberOfLines={2}>{uv.text}</Caption>
                  </View>
                  <MasteryBadge level={level} size={14} />
                </View>
              );
            })}
          </Card>
        </Animated.View>
      )}

      {userVerses.length === 0 && (
        <View style={styles.emptyState}>
          <IconBadge name="book-outline" color={Colors.textTertiary} size={28} bgOpacity={0.08} />
          <Heading>No verses yet</Heading>
          <Body color={Colors.textSecondary} style={{ textAlign: 'center' }}>
            Add verses from the Add Verses screen to start tracking your progress.
          </Body>
        </View>
      )}
    </ScrollView>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.xl, paddingBottom: 40, gap: Spacing.lg },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  statCard: {
    flex: 1,
    minWidth: '45%',
    alignItems: 'center',
    gap: 6,
  },

  section: { gap: Spacing.md },

  heatmap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 3,
  },
  heatCell: {
    width: 20,
    height: 20,
    borderRadius: 5,
  },
  heatLegend: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
  },
  heatLegendCell: { width: 14, height: 14, borderRadius: 3 },

  masteryRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  masteryInfo: { flex: 1, gap: 4 },
  masteryLabelRow: { flexDirection: 'row', justifyContent: 'space-between' },

  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
    gap: Spacing.md,
  },

  libraryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  libraryItemLeft: { flex: 1, gap: 2 },

  emptyState: { alignItems: 'center', padding: 40, gap: Spacing.md },
});
