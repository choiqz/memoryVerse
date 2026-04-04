import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Pressable,
  ScrollView,
  StyleSheet,
  RefreshControl,
  Platform,
} from 'react-native';
import Animated, {
  FadeInUp,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withSpring,
} from 'react-native-reanimated';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import { Fonts, Spacing, Radii, Shadows } from '../constants/Theme';
import { Display, Body, Caption, Overline, Title } from '../components/Typography';
import { IconBadge } from '../components/IconBadge';
import { Card } from '../components/Card';
import { getUserStats, getDueCount } from '../lib/db';
import type { UserStats } from '../lib/db/schema';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const GREETINGS = [
  'Ready to review?',
  'Let\'s get into the Word!',
  'Time to practice!',
  'Keep going!',
  'You\'ve got this!',
];

export default function HomeScreen() {
  const router = useRouter();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [dueCount, setDueCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [greeting] = useState(() => GREETINGS[Math.floor(Math.random() * GREETINGS.length)]);

  // Streak flame breathing animation
  const flameScale = useSharedValue(1);
  const flameStyle = useAnimatedStyle(() => ({
    transform: [{ scale: flameScale.value }],
  }));

  useEffect(() => {
    if ((stats?.streak ?? 0) > 0) {
      flameScale.value = withRepeat(
        withSequence(
          withTiming(1.12, { duration: 1000 }),
          withTiming(1, { duration: 1000 }),
        ),
        -1,
        true,
      );
    }
  }, [stats?.streak]);

  // CTA arrow pulse
  const arrowX = useSharedValue(0);
  const arrowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: arrowX.value }],
  }));

  useEffect(() => {
    arrowX.value = withRepeat(
      withSequence(
        withTiming(4, { duration: 600 }),
        withTiming(0, { duration: 600 }),
      ),
      -1,
      true,
    );
  }, []);

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
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
    >
      {/* Header */}
      <Animated.View entering={FadeInUp.duration(500)} style={styles.header}>
        <View>
          <Display color={Colors.primary}>memoryVerse</Display>
          <Body color={Colors.textSecondary} style={styles.greeting}>{greeting}</Body>
        </View>
        <Pressable
          style={styles.settingsBtn}
          onPress={() => router.push('/settings')}
          accessibilityLabel="Settings"
          hitSlop={8}
        >
          <Ionicons name="settings-outline" size={24} color={Colors.textSecondary} />
        </Pressable>
      </Animated.View>

      {/* Stats row */}
      <Animated.View entering={FadeInUp.delay(100).duration(500)} style={styles.statsRow}>
        <View style={styles.statPill}>
          <Animated.View style={flameStyle}>
            <IconBadge name="flame" color={Colors.streak} size={14} />
          </Animated.View>
          <Title style={[styles.statValue, { color: Colors.streak }]}>{streakDays}</Title>
          <Overline>streak</Overline>
        </View>

        <View style={styles.statDivider} />

        <View style={styles.statPill}>
          <IconBadge name="flash" color={Colors.xp} size={14} />
          <Title style={[styles.statValue, { color: Colors.secondary }]}>{totalXP.toLocaleString()}</Title>
          <Overline>xp</Overline>
        </View>

        <View style={styles.statDivider} />

        <View style={styles.statPill}>
          <IconBadge name="book" color={Colors.primary} size={14} />
          <Title style={[styles.statValue, { color: Colors.primary }]}>{versesLearned}</Title>
          <Overline>verses</Overline>
        </View>
      </Animated.View>

      {/* Hero CTA */}
      <AnimatedPressable
        entering={FadeInUp.delay(200).duration(500)}
        style={[styles.heroCta, dueCount === 0 && styles.heroCtaDone]}
        onPress={() => dueCount > 0 && router.push('/review')}
        disabled={dueCount === 0}
        accessibilityLabel={dueCount > 0 ? 'Start review session' : 'No verses due'}
        accessibilityRole="button"
      >
        {dueCount > 0 ? (
          <>
            <View style={styles.heroTop}>
              <Ionicons name="mic" size={22} color="rgba(255,255,255,0.8)" />
              <Title style={styles.heroDueText}>
                {dueCount} verse{dueCount !== 1 ? 's' : ''} due
              </Title>
            </View>
            <View style={styles.heroBottom}>
              <View style={styles.heroButton}>
                <Title style={styles.heroButtonText}>Start Review</Title>
                <Animated.View style={arrowStyle}>
                  <Ionicons name="arrow-forward" size={20} color={Colors.primary} />
                </Animated.View>
              </View>
            </View>
          </>
        ) : (
          <View style={styles.heroAllDone}>
            <Ionicons name="checkmark-circle" size={32} color="rgba(255,255,255,0.9)" />
            <Title style={styles.heroDoneTitle}>All caught up!</Title>
            <Body style={styles.heroDoneSubtitle}>Come back tomorrow for your next review.</Body>
          </View>
        )}
      </AnimatedPressable>

      {/* Quick actions */}
      <Animated.View entering={FadeInUp.delay(300).duration(500)} style={styles.quickActions}>
        <ActionCard
          icon="add-circle"
          iconColor={Colors.primary}
          iconBg={Colors.primaryFaint}
          label="Add Verses"
          subtitle="Browse & pick from KJV"
          onPress={() => router.push('/add')}
        />
        <ActionCard
          icon="bar-chart"
          iconColor={Colors.success}
          iconBg={Colors.successLight}
          label="Progress"
          subtitle="Activity & mastery"
          onPress={() => router.push('/progress')}
        />
      </Animated.View>
    </ScrollView>
  );
}

function ActionCard({
  icon,
  iconColor,
  iconBg,
  label,
  subtitle,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  iconBg: string;
  label: string;
  subtitle: string;
  onPress: () => void;
}) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      style={[styles.actionCard, animatedStyle]}
      onPressIn={() => { scale.value = withSpring(0.97, { damping: 15, stiffness: 300 }); }}
      onPressOut={() => { scale.value = withSpring(1, { damping: 15, stiffness: 300 }); }}
      onPress={onPress}
      accessibilityRole="button"
    >
      <View style={[styles.actionIcon, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={24} color={iconColor} />
      </View>
      <View style={styles.actionText}>
        <Title style={styles.actionLabel}>{label}</Title>
        <Caption>{subtitle}</Caption>
      </View>
      <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: Spacing.xl,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 40,
    gap: Spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.xs,
  },
  greeting: {
    marginTop: 2,
  },
  settingsBtn: {
    padding: Spacing.sm,
    marginTop: 4,
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radii.lg,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    ...Shadows.md,
  },
  statPill: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: 20,
    fontFamily: Fonts.extraBold,
    letterSpacing: -0.5,
  },
  statDivider: {
    width: 1,
    height: 36,
    backgroundColor: Colors.divider,
  },

  // Hero CTA
  heroCta: {
    borderRadius: Radii.xl,
    padding: Spacing.xl,
    backgroundColor: Colors.primary,
    gap: Spacing.lg,
    ...Shadows.lg,
    shadowColor: Colors.primary,
  },
  heroCtaDone: {
    backgroundColor: Colors.success,
    shadowColor: Colors.success,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  heroDueText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 16,
  },
  heroBottom: {
    alignItems: 'stretch',
  },
  heroButton: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  heroButtonText: {
    color: Colors.primary,
    fontSize: 17,
  },
  heroAllDone: {
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  heroDoneTitle: {
    color: '#FFFFFF',
    fontSize: 20,
  },
  heroDoneSubtitle: {
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
  },

  // Quick actions
  quickActions: {
    gap: Spacing.md,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radii.lg,
    padding: Spacing.lg,
    gap: Spacing.md,
    ...Shadows.sm,
  },
  actionIcon: {
    width: 44,
    height: 44,
    borderRadius: Radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: {
    flex: 1,
    gap: 2,
  },
  actionLabel: {
    fontSize: 15,
  },
});
