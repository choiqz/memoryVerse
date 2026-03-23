import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  RefreshControl,
  Platform,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import { getUserStats, getDueCount } from '../lib/db';
import type { UserStats } from '../lib/db/schema';

export default function HomeScreen() {
  const router = useRouter();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [dueCount, setDueCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    const [s, d] = await Promise.all([getUserStats(), getDueCount()]);
    setStats(s);
    setDueCount(d);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const streakDays = stats?.streak ?? 0;
  const totalXP = stats?.totalXP ?? 0;
  const versesLearned = stats?.versesLearned ?? 0;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.appName}>memoryVerse</Text>
          <Text style={styles.tagline}>Hide it in your heart</Text>
        </View>
        <TouchableOpacity
          style={styles.settingsBtn}
          onPress={() => router.push('/settings')}
          accessibilityLabel="Settings"
        >
          <Ionicons name="settings-outline" size={24} color={Colors.textMuted} />
        </TouchableOpacity>
      </View>

      {/* Streak & XP row */}
      <View style={styles.statsRow}>
        <View style={[styles.statCard, styles.streakCard]}>
          <Text style={styles.statEmoji}>🔥</Text>
          <Text style={[styles.statValue, { color: Colors.streak }]}>{streakDays}</Text>
          <Text style={styles.statLabel}>Day Streak</Text>
        </View>
        <View style={[styles.statCard, styles.xpCard]}>
          <Text style={styles.statEmoji}>⚡</Text>
          <Text style={[styles.statValue, { color: Colors.secondary }]}>{totalXP.toLocaleString()}</Text>
          <Text style={styles.statLabel}>Total XP</Text>
        </View>
        <View style={[styles.statCard, styles.versesCard]}>
          <Text style={styles.statEmoji}>📖</Text>
          <Text style={[styles.statValue, { color: Colors.primary }]}>{versesLearned}</Text>
          <Text style={styles.statLabel}>Verses</Text>
        </View>
      </View>

      {/* Due count banner */}
      {dueCount > 0 && (
        <View style={styles.dueBanner}>
          <View style={styles.dueBannerLeft}>
            <Ionicons name="time-outline" size={20} color={Colors.primary} />
            <Text style={styles.dueBannerText}>
              <Text style={styles.dueBannerCount}>{dueCount}</Text> verse{dueCount !== 1 ? 's' : ''} due for review
            </Text>
          </View>
        </View>
      )}

      {/* Start Review CTA */}
      <TouchableOpacity
        style={[styles.reviewBtn, dueCount === 0 && styles.reviewBtnDisabled]}
        onPress={() => router.push('/review')}
        disabled={dueCount === 0}
        accessibilityLabel={dueCount > 0 ? 'Start review session' : 'No verses due'}
        accessibilityRole="button"
      >
        <Ionicons
          name="mic"
          size={28}
          color={dueCount > 0 ? Colors.surface : Colors.textMuted}
        />
        <Text style={[styles.reviewBtnText, dueCount === 0 && styles.reviewBtnTextDisabled]}>
          {dueCount > 0 ? `Start Review (${dueCount})` : 'All caught up!'}
        </Text>
      </TouchableOpacity>

      {dueCount === 0 && (
        <Text style={styles.caughtUpMsg}>
          Great work! Come back tomorrow for your next review.
        </Text>
      )}

      {/* Quick actions */}
      <View style={styles.quickActions}>
        <TouchableOpacity
          style={styles.actionCard}
          onPress={() => router.push('/add')}
          accessibilityRole="button"
        >
          <View style={[styles.actionIcon, { backgroundColor: Colors.primaryLight + '22' }]}>
            <Ionicons name="add-circle-outline" size={26} color={Colors.primary} />
          </View>
          <Text style={styles.actionLabel}>Add Verses</Text>
          <Text style={styles.actionSub}>Browse & pick from KJV</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionCard}
          onPress={() => router.push('/progress')}
          accessibilityRole="button"
        >
          <View style={[styles.actionIcon, { backgroundColor: Colors.success + '22' }]}>
            <Ionicons name="bar-chart-outline" size={26} color={Colors.success} />
          </View>
          <Text style={styles.actionLabel}>Progress</Text>
          <Text style={styles.actionSub}>Activity & mastery</Text>
        </TouchableOpacity>
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 40,
    gap: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  appName: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.primary,
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 14,
    color: Colors.textMuted,
    fontStyle: 'italic',
    marginTop: 2,
  },
  settingsBtn: {
    padding: 8,
    marginTop: 4,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 2,
    gap: 2,
  },
  streakCard: {},
  xpCard: {},
  versesCard: {},
  statEmoji: {
    fontSize: 22,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  statLabel: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  dueBanner: {
    backgroundColor: Colors.primary + '12',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: Colors.primary + '25',
  },
  dueBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dueBannerText: {
    fontSize: 14,
    color: Colors.text,
    fontWeight: '500',
  },
  dueBannerCount: {
    fontWeight: '800',
    color: Colors.primary,
  },
  reviewBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 18,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    shadowColor: Colors.primary,
    shadowOpacity: 0.35,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 16,
    elevation: 8,
  },
  reviewBtnDisabled: {
    backgroundColor: Colors.divider,
    shadowOpacity: 0,
    elevation: 0,
  },
  reviewBtnText: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.surface,
    letterSpacing: -0.2,
  },
  reviewBtnTextDisabled: {
    color: Colors.textMuted,
  },
  caughtUpMsg: {
    textAlign: 'center',
    color: Colors.textMuted,
    fontSize: 14,
    marginTop: -8,
  },
  quickActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    gap: 6,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 2,
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  actionLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  actionSub: {
    fontSize: 12,
    color: Colors.textMuted,
  },
});
