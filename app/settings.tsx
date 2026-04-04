import { useCallback, useState } from 'react';
import {
  View,
  Pressable,
  ScrollView,
  StyleSheet,
  Alert,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Colors } from '../constants/Colors';
import { Fonts, Spacing, Radii, Shadows } from '../constants/Theme';
import { Title, Body, Caption, Overline } from '../components/Typography';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { getUserStats, updateSettings } from '../lib/db';
import type { UserStats } from '../lib/db/schema';

export default function SettingsScreen() {
  const [stats, setStats] = useState<UserStats | null>(null);
  const [passThreshold, setPassThreshold] = useState(85);
  const [saving, setSaving] = useState(false);

  useFocusEffect(
    useCallback(() => {
      getUserStats().then((s) => {
        setStats(s);
        setPassThreshold(s.passThreshold);
      });
    }, []),
  );

  const save = useCallback(async () => {
    setSaving(true);
    await updateSettings({ passThreshold });
    setSaving(false);
    Alert.alert('Saved', 'Settings updated.');
  }, [passThreshold]);

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
            <Caption style={styles.optionTextSelected}>KJV</Caption>
          </View>
          <View style={styles.optionChip}>
            <Caption>NIV (coming soon)</Caption>
          </View>
          <View style={styles.optionChip}>
            <Caption>ESV (coming soon)</Caption>
          </View>
        </View>
      </Card>

      {/* Pass threshold */}
      <Card style={styles.section}>
        <Title>Pass Threshold</Title>
        <Body color={Colors.textSecondary} style={{ fontSize: 13 }}>
          Minimum similarity score to count a review as successful.
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

      {/* SM-2 info */}
      <Card variant="tinted" style={styles.infoSection}>
        <Title style={{ color: Colors.primary, fontSize: 14 }}>How spaced repetition works</Title>
        <Body style={styles.infoText}>
          memoryVerse uses the SM-2 algorithm (same as Anki). After each review,
          the next due date is calculated based on your performance.
          {'\n\n'}
          {'\u2022'} 95{'\u2013'}100% {'\u2192'} Perfect (next review in ~21 days after repeated success){'\n'}
          {'\u2022'} 85{'\u2013'}94% {'\u2192'} Good{'\n'}
          {'\u2022'} 70{'\u2013'}84% {'\u2192'} Okay{'\n'}
          {'\u2022'} 50{'\u2013'}69% {'\u2192'} Hard{'\n'}
          {'\u2022'} {'<'}50% {'\u2192'} Failed (re-queued immediately)
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

  infoSection: {
    gap: Spacing.sm,
  },
  infoText: {
    fontSize: 13,
    lineHeight: 20,
  },
});
