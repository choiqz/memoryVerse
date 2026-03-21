import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Animated,
  Alert,
  Platform,
  TextInput,
  KeyboardAvoidingView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors } from '../constants/Colors';
import { getDueVerses, recordReview } from '../lib/db';
import type { UserVerse, Verse } from '../lib/db/schema';
import { useSpeech } from '../lib/speech';
import { scoreSimilarity, generateHints, type HintWord } from '../lib/similarity';
import { similarityToQuality, calculateXP, getMasteryLevel, MASTERY_LABELS } from '../lib/srs';
import { formatRef } from '../lib/bible';

type ReviewItem = UserVerse & Verse;
type ReviewPhase = 'preview' | 'reciting' | 'scored';

const REVEAL_PENALTY = 2; // XP penalty per revealed word

export default function ReviewScreen() {
  const router = useRouter();
  const [queue, setQueue] = useState<ReviewItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [phase, setPhase] = useState<ReviewPhase>('preview');
  const [hints, setHints] = useState<HintWord[]>([]);
  const [score, setScore] = useState<number>(0);
  const [xpEarned, setXpEarned] = useState<number>(0);
  const [revealedCount, setRevealedCount] = useState(0);
  const [sessionXP, setSessionXP] = useState(0);
  const [sessionReviewed, setSessionReviewed] = useState(0);
  const [loading, setLoading] = useState(true);
  const [finished, setFinished] = useState(false);
  const [typedText, setTypedText] = useState('');

  // Animations
  const scoreAnim = useRef(new Animated.Value(0)).current;
  const cardAnim = useRef(new Animated.Value(1)).current;

  const currentVerse = queue[currentIndex];

  const speech = useSpeech(async (transcript) => {
    if (!currentVerse) return;
    await handleTranscript(transcript);
  });

  // Load due verses on mount
  useEffect(() => {
    getDueVerses().then((verses) => {
      setQueue(verses);
      if (verses.length > 0) {
        setHints(generateHints(verses[0].text));
      }
      setLoading(false);
    });
  }, []);

  const handleTranscript = useCallback(
    async (transcript: string) => {
      if (!currentVerse) return;
      const similarity = scoreSimilarity(transcript, currentVerse.text);
      const penalty = revealedCount * REVEAL_PENALTY;
      const finalScore = Math.max(0, similarity - penalty);
      const xp = calculateXP(similarityToQuality(finalScore));

      setScore(Math.round(finalScore));
      setXpEarned(xp);
      setPhase('scored');

      // Haptic feedback
      if (finalScore >= 85) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else if (finalScore >= 50) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      } else {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }

      // Animate score card in
      Animated.spring(scoreAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 120,
        friction: 8,
      }).start();

      // Persist the review result
      await recordReview(currentVerse.id, Math.round(finalScore));
    },
    [currentVerse, revealedCount, scoreAnim],
  );

  const advanceToNext = useCallback(() => {
    const xp = xpEarned;
    setSessionXP((prev) => prev + xp);
    setSessionReviewed((prev) => prev + 1);
    scoreAnim.setValue(0);

    const nextIndex = currentIndex + 1;
    if (nextIndex >= queue.length) {
      setFinished(true);
      return;
    }

    // Animate card out then in
    Animated.timing(cardAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setCurrentIndex(nextIndex);
      setPhase('preview');
      setHints(generateHints(queue[nextIndex].text));
      setRevealedCount(0);
      speech.reset();
      Animated.spring(cardAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 80,
        friction: 10,
      }).start();
    });
  }, [currentIndex, queue, xpEarned, cardAnim, scoreAnim, speech]);

  const revealWord = useCallback(
    (index: number) => {
      setHints((prev) => {
        const next = [...prev];
        if (!next[index].revealed) {
          next[index] = { ...next[index], revealed: true };
          setRevealedCount((c) => c + 1);
        }
        return next;
      });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    [],
  );

  const handleMicPress = useCallback(() => {
    if (phase !== 'reciting') {
      setPhase('reciting');
      speech.startListening();
    } else {
      speech.stopListening();
    }
  }, [phase, speech]);

  const handleSkip = useCallback(() => {
    Alert.alert(
      'Skip Verse',
      'This verse will be re-queued at the end.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Skip',
          onPress: () => {
            setQueue((q) => {
              const next = [...q];
              const [skipped] = next.splice(currentIndex, 1);
              next.push(skipped);
              return next;
            });
            setHints(generateHints(queue[currentIndex + 1]?.text ?? queue[0].text));
            setRevealedCount(0);
            setTypedText('');
            speech.reset();
          },
        },
      ],
    );
  }, [currentIndex, queue, speech]);

  // ─── Loading / Empty / Finished states ─────────────────────────────────────

  if (loading) {
    return (
      <View style={styles.center}>
        <Text style={styles.loadingText}>Loading your review session...</Text>
      </View>
    );
  }

  if (queue.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyEmoji}>🎉</Text>
        <Text style={styles.emptyTitle}>All caught up!</Text>
        <Text style={styles.emptyMsg}>No verses due for review. Come back tomorrow.</Text>
        <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.back()}>
          <Text style={styles.secondaryBtnText}>Back to Home</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (finished) {
    return (
      <View style={styles.center}>
        <Text style={styles.finishedEmoji}>🏆</Text>
        <Text style={styles.finishedTitle}>Session Complete!</Text>
        <View style={styles.sessionStats}>
          <StatPill label="Verses" value={String(sessionReviewed)} icon="📖" />
          <StatPill label="XP Earned" value={`+${sessionXP}`} icon="⚡" />
        </View>
        <TouchableOpacity style={styles.primaryBtn} onPress={() => router.back()}>
          <Text style={styles.primaryBtnText}>Back to Home</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ─── Main review UI ─────────────────────────────────────────────────────────

  const verse = currentVerse!;
  const ref = formatRef(verse.book, verse.chapter, verse.verse);
  const mastery = getMasteryLevel(verse.repetitions, verse.interval);
  const progress = (currentIndex / queue.length) * 100;

  return (
    <View style={styles.container}>
      {/* Progress bar */}
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${progress}%` }]} />
      </View>

      {/* Session counter */}
      <View style={styles.sessionRow}>
        <Text style={styles.sessionCounter}>
          {currentIndex + 1} / {queue.length}
        </Text>
        <View style={styles.masteryBadge}>
          <Text style={styles.masteryText}>{MASTERY_LABELS[mastery]}</Text>
        </View>
        <View style={styles.xpPill}>
          <Text style={styles.xpPillText}>+{sessionXP} XP</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Animated.View style={[styles.card, { opacity: cardAnim }]}>
          {/* Reference */}
          <Text style={styles.reference}>{ref}</Text>

          {/* Hint words */}
          <View style={styles.hintContainer}>
            {hints.map((hw, i) => (
              <TouchableOpacity
                key={i}
                onPress={() => phase === 'preview' && revealWord(i)}
                disabled={phase !== 'preview' || hw.revealed}
                style={styles.hintWordWrapper}
                accessibilityLabel={hw.revealed ? hw.word : `Tap to reveal word ${i + 1}`}
              >
                <Text
                  style={[
                    styles.hintWord,
                    hw.revealed && styles.hintWordRevealed,
                  ]}
                >
                  {hw.revealed ? hw.word : hw.hint}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {revealedCount > 0 && (
            <Text style={styles.revealPenalty}>
              -{revealedCount * REVEAL_PENALTY} XP penalty ({revealedCount} word{revealedCount !== 1 ? 's' : ''} revealed)
            </Text>
          )}
        </Animated.View>

        {/* Score result card */}
        {phase === 'scored' && (
          <Animated.View
            style={[
              styles.scoreCard,
              { opacity: scoreAnim, transform: [{ scale: scoreAnim }] },
              score >= 85 ? styles.scoreCardGood : score >= 50 ? styles.scoreCardOkay : styles.scoreCardBad,
            ]}
          >
            <Text style={styles.scoreEmoji}>
              {score >= 95 ? '🌟' : score >= 85 ? '✅' : score >= 70 ? '👍' : score >= 50 ? '😅' : '❌'}
            </Text>
            <Text style={styles.scoreValue}>{score}%</Text>
            <Text style={styles.scoreLabel}>
              {score >= 95 ? 'Perfect!' : score >= 85 ? 'Great job!' : score >= 70 ? 'Good effort' : score >= 50 ? 'Keep practicing' : 'Try again soon'}
            </Text>
            <Text style={styles.xpEarned}>+{xpEarned} XP</Text>

            {/* Transcript */}
            {speech.transcript ? (
              <View style={styles.transcriptBox}>
                <Text style={styles.transcriptLabel}>You said:</Text>
                <Text style={styles.transcriptText} numberOfLines={4}>
                  {speech.transcript}
                </Text>
              </View>
            ) : null}

            {/* Full verse reveal */}
            <View style={styles.fullVerseBox}>
              <Text style={styles.fullVerseLabel}>Verse:</Text>
              <Text style={styles.fullVerseText}>{verse.text}</Text>
            </View>
          </Animated.View>
        )}

        {/* Speech error */}
        {speech.error && phase !== 'scored' && (
          <View style={styles.errorBanner}>
            <Ionicons name="warning-outline" size={18} color={Colors.error} />
            <Text style={styles.errorText}>{speech.error}</Text>
          </View>
        )}

        {/* Interim transcript */}
        {phase === 'reciting' && speech.interimTranscript ? (
          <View style={styles.interimBox}>
            <Text style={styles.interimText} numberOfLines={3}>
              {speech.interimTranscript}
            </Text>
          </View>
        ) : null}
      </ScrollView>

      {/* Bottom controls */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.controls}
      >
        {phase === 'scored' ? (
          <TouchableOpacity style={styles.nextBtn} onPress={advanceToNext}>
            <Text style={styles.nextBtnText}>
              {currentIndex + 1 < queue.length ? 'Next Verse' : 'Finish Session'}
            </Text>
            <Ionicons name="arrow-forward" size={20} color={Colors.surface} />
          </TouchableOpacity>
        ) : speech.isSupported ? (
          /* ── Native mic UI ── */
          <View style={styles.micRow}>
            {phase === 'preview' && (
              <TouchableOpacity style={styles.skipBtn} onPress={handleSkip}>
                <Ionicons name="play-skip-forward-outline" size={22} color={Colors.textMuted} />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.micBtn, phase === 'reciting' && styles.micBtnActive]}
              onPress={handleMicPress}
              accessibilityLabel={phase === 'reciting' ? 'Stop recording' : 'Start recording'}
              accessibilityRole="button"
            >
              <Ionicons
                name={phase === 'reciting' ? 'stop' : 'mic'}
                size={36}
                color={Colors.surface}
              />
            </TouchableOpacity>
            <View style={styles.micHint}>
              <Text style={styles.micHintText}>
                {phase === 'preview' ? 'Tap mic to recite'
                  : phase === 'reciting' ? 'Listening...'
                  : 'Processing...'}
              </Text>
            </View>
          </View>
        ) : (
          /* ── Text input fallback (Expo Go) ── */
          <View style={styles.textInputArea}>
            <View style={styles.textInputBanner}>
              <Ionicons name="information-circle-outline" size={15} color={Colors.primary} />
              <Text style={styles.textInputBannerText}>
                Mic unavailable in Expo Go — type your recitation below
              </Text>
            </View>
            <View style={styles.textInputRow}>
              <TouchableOpacity style={styles.skipBtnSmall} onPress={handleSkip}>
                <Ionicons name="play-skip-forward-outline" size={20} color={Colors.textMuted} />
              </TouchableOpacity>
              <TextInput
                style={styles.textInput}
                placeholder="Type verse from memory..."
                placeholderTextColor={Colors.textLight}
                value={typedText}
                onChangeText={setTypedText}
                multiline
                returnKeyType="done"
                blurOnSubmit
              />
              <TouchableOpacity
                style={[styles.submitBtn, !typedText.trim() && styles.submitBtnDisabled]}
                onPress={() => {
                  if (!typedText.trim()) return;
                  handleTranscript(typedText.trim());
                  setTypedText('');
                }}
                disabled={!typedText.trim()}
              >
                <Ionicons name="checkmark" size={22} color={Colors.surface} />
              </TouchableOpacity>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

function StatPill({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <View style={styles.statPill}>
      <Text style={styles.statPillIcon}>{icon}</Text>
      <Text style={styles.statPillValue}>{value}</Text>
      <Text style={styles.statPillLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 16,
    backgroundColor: Colors.background,
  },
  loadingText: {
    color: Colors.textMuted,
    fontSize: 16,
  },
  emptyEmoji: { fontSize: 64 },
  emptyTitle: { fontSize: 24, fontWeight: '800', color: Colors.text },
  emptyMsg: { fontSize: 15, color: Colors.textMuted, textAlign: 'center' },
  finishedEmoji: { fontSize: 72 },
  finishedTitle: { fontSize: 26, fontWeight: '800', color: Colors.text },
  sessionStats: { flexDirection: 'row', gap: 16 },
  statPill: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    gap: 4,
    minWidth: 100,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 3,
  },
  statPillIcon: { fontSize: 24 },
  statPillValue: { fontSize: 22, fontWeight: '800', color: Colors.primary },
  statPillLabel: { fontSize: 12, color: Colors.textMuted, fontWeight: '600' },
  progressBar: {
    height: 4,
    backgroundColor: Colors.divider,
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
  },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 8,
  },
  sessionCounter: {
    fontSize: 14,
    color: Colors.textMuted,
    fontWeight: '600',
    flex: 1,
  },
  masteryBadge: {
    backgroundColor: Colors.primary + '18',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  masteryText: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '700',
  },
  xpPill: {
    backgroundColor: Colors.secondary + '22',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  xpPillText: {
    fontSize: 12,
    color: Colors.secondary,
    fontWeight: '700',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 160,
    gap: 16,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 24,
    gap: 20,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 16,
    elevation: 4,
  },
  reference: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.primary,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  hintContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    justifyContent: 'center',
  },
  hintWordWrapper: {
    minWidth: 24,
  },
  hintWord: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.primary,
    letterSpacing: 0.5,
  },
  hintWordRevealed: {
    fontSize: 18,
    fontWeight: '400',
    color: Colors.text,
    letterSpacing: 0,
  },
  revealPenalty: {
    fontSize: 12,
    color: Colors.error,
    textAlign: 'center',
  },
  scoreCard: {
    borderRadius: 20,
    padding: 24,
    gap: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 16,
    elevation: 4,
  },
  scoreCardGood: { backgroundColor: Colors.successLight },
  scoreCardOkay: { backgroundColor: Colors.warningLight },
  scoreCardBad: { backgroundColor: Colors.errorLight },
  scoreEmoji: { fontSize: 48 },
  scoreValue: { fontSize: 48, fontWeight: '800', color: Colors.text },
  scoreLabel: { fontSize: 16, fontWeight: '600', color: Colors.text },
  xpEarned: { fontSize: 20, fontWeight: '800', color: Colors.secondary },
  transcriptBox: {
    width: '100%',
    backgroundColor: Colors.surface + 'AA',
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  transcriptLabel: { fontSize: 11, color: Colors.textMuted, fontWeight: '700', textTransform: 'uppercase' },
  transcriptText: { fontSize: 14, color: Colors.text, fontStyle: 'italic' },
  fullVerseBox: {
    width: '100%',
    backgroundColor: Colors.surface + 'AA',
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  fullVerseLabel: { fontSize: 11, color: Colors.textMuted, fontWeight: '700', textTransform: 'uppercase' },
  fullVerseText: { fontSize: 14, color: Colors.text, lineHeight: 22 },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.errorLight,
    borderRadius: 12,
    padding: 12,
  },
  errorText: { fontSize: 14, color: Colors.error, flex: 1 },
  interimBox: {
    backgroundColor: Colors.primary + '12',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.primary + '30',
  },
  interimText: { fontSize: 15, color: Colors.text, fontStyle: 'italic', lineHeight: 22 },
  controls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.surface,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: -4 },
    shadowRadius: 12,
    elevation: 8,
  },
  nextBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 16,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  nextBtnText: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.surface,
  },
  micRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  skipBtn: {
    padding: 14,
    borderRadius: 14,
    backgroundColor: Colors.divider,
  },
  micBtn: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOpacity: 0.4,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 16,
    elevation: 8,
  },
  micBtnActive: {
    backgroundColor: Colors.error,
    shadowColor: Colors.error,
  },
  micHint: {
    width: 60,
  },
  micHintText: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  primaryBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 16,
    paddingHorizontal: 32,
    paddingVertical: 16,
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.surface,
  },
  secondaryBtn: {
    borderWidth: 2,
    borderColor: Colors.primary,
    borderRadius: 16,
    paddingHorizontal: 32,
    paddingVertical: 16,
  },
  secondaryBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.primary,
  },
  skipBtnSmall: {
    padding: 10,
    borderRadius: 12,
    backgroundColor: Colors.divider,
  },
  // ── Text input fallback (Expo Go) ──────────────────────────────────────────
  textInputArea: {
    gap: 8,
  },
  textInputBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primary + '12',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  textInputBannerText: {
    fontSize: 12,
    color: Colors.primary,
    flex: 1,
  },
  textInputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  textInput: {
    flex: 1,
    backgroundColor: Colors.divider,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.text,
    maxHeight: 100,
  },
  submitBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnDisabled: {
    backgroundColor: Colors.textLight,
  },
});
