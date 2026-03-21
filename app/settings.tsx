import { useCallback, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  Switch,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Colors } from '../constants/Colors';
import { getUserStats, updateSettings } from '../lib/db';
import type { UserStats } from '../lib/db/schema';

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

  const thresholdLabel = (t: number) => {
    if (t >= 95) return 'Strict (≥95%)';
    if (t >= 85) return 'Standard (≥85%)';
    if (t >= 70) return 'Lenient (≥70%)';
    return `Custom (≥${t}%)`;
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Translation */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Bible Translation</Text>
        <View style={styles.optionRow}>
          <View style={[styles.optionChip, styles.optionChipSelected]}>
            <Text style={[styles.optionText, styles.optionTextSelected]}>KJV</Text>
          </View>
          <View style={styles.optionChip}>
            <Text style={styles.optionText}>NIV (coming soon)</Text>
          </View>
          <View style={styles.optionChip}>
            <Text style={styles.optionText}>ESV (coming soon)</Text>
          </View>
        </View>
      </View>

      {/* Pass threshold */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Pass Threshold</Text>
        <Text style={styles.sectionSubtitle}>
          Minimum similarity score to count a review as successful.
        </Text>
        <View style={styles.sliderRow}>
          <Text style={styles.sliderValue}>{passThreshold}%</Text>
          <Text style={styles.sliderLabel}>{thresholdLabel(passThreshold)}</Text>
        </View>
        <View style={styles.sliderContainer}>
          <Text style={styles.sliderMin}>50%</Text>
          <View style={styles.sliderWrap}>
            <View
              style={[
                styles.sliderFill,
                { width: `${((passThreshold - 50) / 50) * 100}%` },
              ]}
            />
            {/* Simple discrete buttons instead of slider to avoid the @react-native-community/slider dep */}
            <View style={styles.discreteSlider}>
              {[50, 60, 70, 80, 85, 90, 95].map((v) => (
                <TouchableOpacity
                  key={v}
                  style={[styles.discreteBtn, passThreshold === v && styles.discreteBtnSelected]}
                  onPress={() => setPassThreshold(v)}
                >
                  <Text style={[styles.discreteText, passThreshold === v && styles.discreteTextSelected]}>
                    {v}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <Text style={styles.sliderMax}>95%</Text>
        </View>
      </View>

      {/* Daily goal */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Daily Goal</Text>
        <Text style={styles.sectionSubtitle}>
          How many verses you aim to review each day.
        </Text>
        <View style={styles.discreteSlider}>
          {[5, 10, 15, 20, 30].map((v) => (
            <TouchableOpacity
              key={v}
              style={[styles.discreteBtn, dailyGoal === v && styles.discreteBtnSelected]}
              onPress={() => setDailyGoal(v)}
            >
              <Text style={[styles.discreteText, dailyGoal === v && styles.discreteTextSelected]}>
                {v}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Stats */}
      {stats && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account Stats</Text>
          <SettingsRow label="Total XP" value={stats.totalXP.toLocaleString()} />
          <SettingsRow label="Longest Streak" value={`${stats.longestStreak} days`} />
          <SettingsRow label="Verses in Library" value={String(stats.versesLearned)} />
        </View>
      )}

      {/* SM-2 info */}
      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>How spaced repetition works</Text>
        <Text style={styles.infoText}>
          memoryVerse uses the SM-2 algorithm (same as Anki). After each review,
          the next due date is calculated based on your performance.
          {'\n\n'}
          • 95–100% → Perfect (next review in ~21 days after repeated success){'\n'}
          • 85–94% → Good{'\n'}
          • 70–84% → Okay{'\n'}
          • 50–69% → Hard{'\n'}
          • &lt;50% → Failed (re-queued immediately)
        </Text>
      </View>

      {/* Save button */}
      <TouchableOpacity style={styles.saveBtn} onPress={save} disabled={saving}>
        <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Save Settings'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function SettingsRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.settingsRow}>
      <Text style={styles.settingsLabel}>{label}</Text>
      <Text style={styles.settingsValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 20, paddingBottom: 40, gap: 16 },
  section: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    gap: 12,
    shadowColor: '#000', shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 }, shadowRadius: 8, elevation: 2,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: Colors.text },
  sectionSubtitle: { fontSize: 13, color: Colors.textMuted, lineHeight: 18 },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  optionChip: {
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 2,
    borderColor: Colors.border,
  },
  optionChipSelected: { borderColor: Colors.primary, backgroundColor: Colors.primary + '12' },
  optionText: { fontSize: 14, fontWeight: '600', color: Colors.textMuted },
  optionTextSelected: { color: Colors.primary },
  sliderRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sliderValue: { fontSize: 28, fontWeight: '800', color: Colors.primary, minWidth: 60 },
  sliderLabel: { fontSize: 14, color: Colors.textMuted, flex: 1 },
  sliderContainer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sliderMin: { fontSize: 12, color: Colors.textLight, width: 30 },
  sliderMax: { fontSize: 12, color: Colors.textLight, width: 30, textAlign: 'right' },
  sliderWrap: { flex: 1 },
  sliderFill: { height: 4, backgroundColor: Colors.primary, borderRadius: 2, marginBottom: 8 },
  discreteSlider: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  discreteBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  discreteBtnSelected: { borderColor: Colors.primary, backgroundColor: Colors.primary + '12' },
  discreteText: { fontSize: 14, fontWeight: '600', color: Colors.textMuted },
  discreteTextSelected: { color: Colors.primary },
  settingsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  settingsLabel: { fontSize: 14, color: Colors.text },
  settingsValue: { fontSize: 14, fontWeight: '600', color: Colors.textMuted },
  infoCard: {
    backgroundColor: Colors.primary + '10',
    borderRadius: 16,
    padding: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.primary + '25',
  },
  infoTitle: { fontSize: 14, fontWeight: '700', color: Colors.primary },
  infoText: { fontSize: 13, color: Colors.text, lineHeight: 20 },
  saveBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    shadowColor: Colors.primary,
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 6,
  },
  saveBtnText: { fontSize: 16, fontWeight: '800', color: Colors.surface },
});
