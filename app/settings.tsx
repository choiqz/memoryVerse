import { useCallback, useState } from 'react';
import {
  View,
  Pressable,
  ScrollView,
  StyleSheet,
  Alert,
  Linking,
  Platform,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { Colors } from '../constants/Colors';
import { Fonts, Spacing, Radii, Shadows } from '../constants/Theme';
import { Title, Body, Caption, Overline } from '../components/Typography';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { getUserStats, updateSettings } from '../lib/db';
import type { UserStats } from '../lib/db/schema';

const FEEDBACK_EMAIL = 'jeongwanc@gmail.com';

export default function SettingsScreen() {
  const [stats, setStats] = useState<UserStats | null>(null);
  const [passThreshold, setPassThreshold] = useState(85);
  const [dailyGoal, setDailyGoal] = useState(10);
  const [saving, setSaving] = useState(false);

  useFocusEffect(
    useCallback(() => {
      getUserStats().then((s) => {
        setStats(s);
        setPassThreshold(s.passThreshold);
        setDailyGoal(s.dailyGoal);
      });
    }, []),
  );

  const save = useCallback(async () => {
    setSaving(true);
    await updateSettings({ passThreshold, dailyGoal });
    setSaving(false);
    Alert.alert('Saved', 'Settings updated.');
  }, [passThreshold, dailyGoal]);

  const sendFeedback = useCallback(async () => {
    const version = Constants.expoConfig?.version ?? '1.0.0';
    const subject = encodeURIComponent('memoryVerse feedback');
    const body = encodeURIComponent(
      '\n\n—\n' +
      `App version: ${version}\n` +
      `Platform: ${Platform.OS} ${Platform.Version}\n` +
      `Verses in library: ${stats?.versesLearned ?? 0}`,
    );
    try {
      await Linking.openURL(`mailto:${FEEDBACK_EMAIL}?subject=${subject}&body=${body}`);
    } catch {
      Alert.alert('No email app found', `You can reach us at ${FEEDBACK_EMAIL}`);
    }
  }, [stats]);

  const thresholdLabel = (t: number) => {
    if (t >= 95) return 'Strict';
    if (t >= 85) return 'Standard';
    if (t >= 70) return 'Lenient';
    return 'Custom';
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Translation */}
      <Card style={styles.section}>
        <Title>Bible Translation</Title>
        <View style={styles.optionRow}>
          <View style={[styles.optionChip, styles.optionChipSelected]}>
            <Caption style={styles.optionTextSelected}>BSB</Caption>
          </View>
          <View style={styles.optionChip}>
            <Caption>More coming soon</Caption>
          </View>
        </View>
        <Caption color={Colors.textTertiary}>
          The Holy Bible, Berean Standard Bible, BSB is produced in cooperation
          with Bible Hub, Discovery Bible, OpenBible.com, and the Berean Bible
          Translation Committee. Public domain.
        </Caption>
      </Card>

      {/* Daily goal */}
      <Card style={styles.section}>
        <Title>Daily Goal</Title>
        <Body color={Colors.textSecondary} style={{ fontSize: 13 }}>
          How many verse reviews you aim to complete each day.
        </Body>
        <View style={styles.segmentedControl}>
          {[5, 10, 15, 20].map((v) => (
            <Pressable
              key={v}
              style={[styles.segment, dailyGoal === v && styles.segmentSelected]}
              onPress={() => setDailyGoal(v)}
            >
              <Caption
                style={[
                  styles.segmentText,
                  dailyGoal === v && styles.segmentTextSelected,
                ]}
              >
                {v}
              </Caption>
            </Pressable>
          ))}
        </View>
      </Card>

      {/* Pass threshold */}
      <Card style={styles.section}>
        <Title>Pass Threshold</Title>
        <Body color={Colors.textSecondary} style={{ fontSize: 13 }}>
          Minimum recitation score to count as successful recall. Scores below
          this re-queue the verse for more practice.
        </Body>
        <View style={styles.thresholdDisplay}>
          <Title style={styles.thresholdValue}>{passThreshold}%</Title>
          <Caption style={{ color: Colors.primary }}>{thresholdLabel(passThreshold)}</Caption>
        </View>
        {/* Segmented control */}
        <View style={styles.segmentedControl}>
          {[50, 60, 70, 80, 85, 90, 95].map((v) => (
            <Pressable
              key={v}
              style={[styles.segment, passThreshold === v && styles.segmentSelected]}
              onPress={() => setPassThreshold(v)}
            >
              <Caption
                style={[
                  styles.segmentText,
                  passThreshold === v && styles.segmentTextSelected,
                ]}
              >
                {v}
              </Caption>
            </Pressable>
          ))}
        </View>
      </Card>

      {/* Stats */}
      {stats && (
        <Card style={styles.section}>
          <Title>Account Stats</Title>
          <SettingsRow label="Longest Streak" value={`${stats.longestStreak} days`} />
          <SettingsRow label="Verses in Library" value={String(stats.versesLearned)} />
        </Card>
      )}

      {/* Feedback */}
      <Card style={styles.section}>
        <Title>Feedback</Title>
        <Pressable
          style={styles.feedbackRow}
          onPress={sendFeedback}
          accessibilityRole="button"
          accessibilityLabel="Send feedback by email"
        >
          <View style={styles.feedbackIcon}>
            <Ionicons name="chatbubble-ellipses" size={18} color={Colors.primary} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Body style={{ fontFamily: Fonts.semiBold }}>Send Feedback</Body>
            <Caption>Found a bug or have an idea? Email us.</Caption>
          </View>
          <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
        </Pressable>
      </Card>

      {/* SM-2 info */}
      <Card variant="tinted" style={styles.infoSection}>
        <Title style={{ color: Colors.primary, fontSize: 14 }}>How spaced repetition works</Title>
        <Body style={styles.infoText}>
          memoryVerse uses the SM-2 algorithm (same as Anki). After each review,
          the next due date is calculated based on your performance.
          {'\n\n'}
          Score at or above your pass threshold and the verse moves further
          out (1 day {'\u2192'} 6 days {'\u2192'} weeks). Score below it and the
          verse is re-queued for today so you can nail it down.
        </Body>
      </Card>

      {/* Save */}
      <Button size="lg" onPress={save} loading={saving}>
        Save Settings
      </Button>
    </ScrollView>
  );
}

function SettingsRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.settingsRow}>
      <Body>{label}</Body>
      <Caption style={{ fontFamily: Fonts.bold }}>{value}</Caption>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.xl, paddingBottom: 40, gap: Spacing.lg },

  section: { gap: Spacing.md },

  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  optionChip: {
    borderRadius: Radii.md,
    paddingHorizontal: 14,
    paddingVertical: Spacing.sm,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  optionChipSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryFaint,
  },
  optionTextSelected: { color: Colors.primary },

  thresholdDisplay: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.sm,
  },
  thresholdValue: {
    fontFamily: Fonts.extraBold,
    fontSize: 28,
    color: Colors.primary,
  },

  segmentedControl: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  segment: {
    paddingHorizontal: 14,
    paddingVertical: Spacing.sm,
    borderRadius: Radii.sm,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  segmentSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryFaint,
  },
  segmentText: {
    color: Colors.textSecondary,
  },
  segmentTextSelected: {
    color: Colors.primary,
    fontFamily: Fonts.bold,
  },

  settingsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },

  feedbackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  feedbackIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primaryFaint,
    alignItems: 'center',
    justifyContent: 'center',
  },

  infoSection: {
    gap: Spacing.sm,
  },
  infoText: {
    fontSize: 13,
    lineHeight: 20,
  },
});
