import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Alert,
  Platform,
  TextInput,
  KeyboardAvoidingView,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withRepeat,
  withSequence,
  withDelay,
  FadeIn,
  SlideInDown,
  Easing,
  runOnJS,
  type SharedValue,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors } from '../constants/Colors';
import { Fonts, Spacing, Radii, Shadows } from '../constants/Theme';
import { Display, Heading, Title, Body, Caption, Overline } from '../components/Typography';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { IconBadge } from '../components/IconBadge';
import { ProgressBar } from '../components/ProgressBar';
import { AnimatedCounter } from '../components/AnimatedCounter';
import { ConfettiOverlay, type ConfettiRef } from '../components/ConfettiOverlay';
import { MasteryBadge } from '../components/MasteryBadge';
import { getDueVerses, recordReview, getUserStats, type ReviewResult } from '../lib/db';
import type { UserVerse, Verse, UserStats } from '../lib/db/schema';
import { useSpeech } from '../lib/speech';
import { scoreSimilarity, generateHints, type HintWord } from '../lib/similarity';
import { getMasteryLevel, MASTERY_LABELS, MASTERY_EMOJIS, type MasteryLevel } from '../lib/srs';
import { formatRef } from '../lib/bible';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type ReviewItem = UserVerse & Verse;
type ReviewPhase = 'learn' | 'preview' | 'reciting' | 'scored';

/** A verse the user has never attempted gets a read-first learn step. */
function isNewVerse(v: ReviewItem): boolean {
  return v.repetitions === 0 && v.lastScore === 0;
}

const REVEAL_PENALTY = 2;

const SCORE_TIERS = [
  { min: 95, icon: 'star' as const, color: Colors.secondary, label: 'Perfect!' },
  { min: 85, icon: 'checkmark-circle' as const, color: Colors.success, label: 'Great job!' },
  { min: 70, icon: 'thumbs-up' as const, color: Colors.growing, label: 'Good effort' },
  { min: 50, icon: 'refresh-circle' as const, color: Colors.streak, label: 'Keep practicing' },
  { min: 0, icon: 'close-circle' as const, color: Colors.error, label: 'Try again' },
];

function getScoreTier(score: number) {
  return SCORE_TIERS.find((t) => score >= t.min) ?? SCORE_TIERS[SCORE_TIERS.length - 1];
}

export default function ReviewScreen() {
  const router = useRouter();
  const confettiRef = useRef<ConfettiRef>(null);
  const [queue, setQueue] = useState<ReviewItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [phase, setPhase] = useState<ReviewPhase>('preview');
  const [hints, setHints] = useState<HintWord[]>([]);
  const [score, setScore] = useState<number>(0);
  const [revealedCount, setRevealedCount] = useState(0);
  const [sessionReviewed, setSessionReviewed] = useState(0);
  const [loading, setLoading] = useState(true);
  const [finished, setFinished] = useState(false);
  const [typedText, setTypedText] = useState('');
  const [reviewResult, setReviewResult] = useState<ReviewResult | null>(null);
  const [finalStats, setFinalStats] = useState<UserStats | null>(null);

  // Reanimated values
  const cardOpacity = useSharedValue(1);

  const currentVerse = queue[currentIndex];

  const speech = useSpeech(async (transcript) => {
    if (!currentVerse) return;
    await handleTranscript(transcript);
  });

  useEffect(() => {
    if (phase === 'reciting' && speech.state === 'error') {
      setPhase('preview');
    }
  }, [phase, speech.state]);

  useEffect(() => {
    getDueVerses().then((verses) => {
      setQueue(verses);
      if (verses.length > 0) {
        setHints(generateHints(verses[0].text));
        setPhase(isNewVerse(verses[0]) ? 'learn' : 'preview');
      }
      setLoading(false);
    });
  }, []);

  // Session-complete celebration
  useEffect(() => {
    if (finished) {
      getUserStats().then(setFinalStats);
      const t = setTimeout(() => confettiRef.current?.fire(), 400);
      return () => clearTimeout(t);
    }
  }, [finished]);

  const handleTranscript = useCallback(
    async (transcript: string) => {
      if (!currentVerse) return;
      const similarity = scoreSimilarity(transcript, currentVerse.text);
      const penalty = revealedCount * REVEAL_PENALTY;
      const finalScore = Math.max(0, similarity - penalty);

      setScore(Math.round(finalScore));
      setPhase('scored');

      if (finalScore >= 85) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else if (finalScore >= 50) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      } else {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }

      // Fire confetti on perfect score
      if (finalScore >= 95) {
        setTimeout(() => confettiRef.current?.fire(), 300);
      }

      const result = await recordReview(currentVerse.id, Math.round(finalScore));
      setReviewResult(result);
    },
    [currentVerse, revealedCount],
  );

  const advanceState = useCallback((nextIdx: number) => {
    setCurrentIndex(nextIdx);
    setPhase(isNewVerse(queue[nextIdx]) ? 'learn' : 'preview');
    setHints(generateHints(queue[nextIdx].text));
    setRevealedCount(0);
    setTypedText('');
    setReviewResult(null);
    speech.reset();
  }, [queue, speech]);

  const advanceToNext = useCallback(() => {
    setSessionReviewed((prev) => prev + 1);

    const nextIndex = currentIndex + 1;
    if (nextIndex >= queue.length) {
      setFinished(true);
      return;
    }

    // Card out → in transition
    cardOpacity.value = withTiming(0, { duration: 200 }, (done) => {
      if (done) {
        runOnJS(advanceState)(nextIndex);
        cardOpacity.value = withTiming(1, { duration: 250, easing: Easing.out(Easing.cubic) });
      }
    });
  }, [currentIndex, queue, cardOpacity, advanceState]);

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

  const handleStartRecording = useCallback(() => {
    setPhase('reciting');
    speech.startListening();
  }, [speech]);

  const handleDoneReciting = useCallback(() => {
    speech.stopListening();
  }, [speech]);

  const handleRestartReciting = useCallback(() => {
    speech.reset();
    setPhase('preview');
  }, [speech]);

  const handleSkip = useCallback(() => {
    Alert.alert(
      'Skip Verse',
      'This verse will be re-queued at the end.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Skip',
          onPress: () => {
            const next = [...queue];
            const [skipped] = next.splice(currentIndex, 1);
            next.push(skipped);
            const upcoming = next[currentIndex];
            setQueue(next);
            setHints(generateHints(upcoming.text));
            setPhase(isNewVerse(upcoming) ? 'learn' : 'preview');
            setRevealedCount(0);
            setTypedText('');
            speech.reset();
          },
        },
      ],
    );
  }, [currentIndex, queue, speech]);

  const cardAnimStyle = useAnimatedStyle(() => ({
    opacity: cardOpacity.value,
  }));

  // ─── Loading / Empty / Finished states ─────────────────────────────────

  if (loading) {
    return (
      <View style={styles.center}>
        <Body color={Colors.textSecondary}>Loading your review session...</Body>
      </View>
    );
  }

  if (queue.length === 0) {
    return (
      <View style={styles.center}>
        <Ionicons name="checkmark-circle" size={64} color={Colors.success} />
        <Heading>All caught up!</Heading>
        <Body color={Colors.textSecondary} style={{ textAlign: 'center' }}>
          No verses due for review. Come back tomorrow.
        </Body>
        <Button variant="secondary" onPress={() => router.back()}>Back to Home</Button>
      </View>
    );
  }

  if (finished) {
    const streak = finalStats?.streak ?? 0;
    const isRecord = streak > 1 && streak === (finalStats?.longestStreak ?? 0);
    return (
      <View style={styles.center}>
        <ConfettiOverlay ref={confettiRef} />
        <Animated.View entering={FadeIn.duration(400)} style={styles.finishedIcon}>
          <Ionicons name="checkmark-circle" size={48} color={Colors.success} />
        </Animated.View>
        <Heading>Session Complete!</Heading>
        <View style={styles.sessionStats}>
          <Card style={styles.finStatCard}>
            <IconBadge name="book" color={Colors.primary} size={16} />
            <AnimatedCounter value={sessionReviewed} color={Colors.primary} style={styles.finStatValue} />
            <Overline>Verses Reviewed</Overline>
          </Card>
          <Card style={styles.finStatCard}>
            <IconBadge name="flame" color={Colors.streak} size={16} />
            <AnimatedCounter value={streak} color={Colors.streak} style={styles.finStatValue} />
            <Overline>Day Streak</Overline>
          </Card>
        </View>
        {isRecord && (
          <Animated.View entering={FadeIn.delay(600).duration(400)} style={styles.recordBanner}>
            <Ionicons name="trophy" size={16} color={Colors.secondary} />
            <Body style={{ color: Colors.secondary, fontFamily: Fonts.bold, fontSize: 14 }}>
              Longest streak yet!
            </Body>
          </Animated.View>
        )}
        <Button size="lg" onPress={() => router.back()}>Back to Home</Button>
      </View>
    );
  }

  // ─── Main review UI ────────────────────────────────────────────────────

  const verse = currentVerse!;
  const ref = formatRef(verse.book, verse.chapter, verse.verse, verse.verseEnd);
  const mastery = getMasteryLevel(verse.repetitions, verse.interval);
  const progress = currentIndex / queue.length;

  return (
    <View style={styles.container}>
      <ConfettiOverlay ref={confettiRef} />

      {/* Progress bar */}
      <ProgressBar progress={progress} height={4} />

      {/* Session counter row */}
      <View style={styles.sessionRow}>
        <Caption style={styles.sessionCounter}>
          {currentIndex + 1} / {queue.length}
        </Caption>
        <MasteryBadge level={mastery} showLabel size={12} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Score result card — shown first when scored */}
        {phase === 'scored' && (
          <ScoreCard
            score={score}
            transcript={speech.transcript}
            verseText={verse.text}
            result={reviewResult}
          />
        )}

        {phase === 'learn' && (
          <Animated.View style={[styles.card, cardAnimStyle]}>
            <View style={styles.newBadge}>
              <Ionicons name="sparkles" size={12} color={Colors.primary} />
              <Overline style={{ color: Colors.primary }}>New Verse</Overline>
            </View>
            <View style={styles.refContainer}>
              <Title style={styles.reference} color={Colors.primary}>{ref}</Title>
              <View style={styles.refAccent} />
            </View>
            <Body style={styles.learnVerseText}>{verse.text}</Body>
            <Caption style={{ textAlign: 'center' }}>
              Read it aloud a few times. When it sticks, recite it from memory.
            </Caption>
          </Animated.View>
        )}

        {phase !== 'scored' && phase !== 'learn' && (
          <Animated.View style={[styles.card, cardAnimStyle]}>
            {/* Reference */}
            <View style={styles.refContainer}>
              <Title style={styles.reference} color={Colors.primary}>{ref}</Title>
              <View style={styles.refAccent} />
            </View>

            {/* Hint words */}
            <View style={styles.hintContainer}>
              {hints.map((hw, i) => (
                <Pressable
                  key={i}
                  onPress={() => phase === 'preview' && revealWord(i)}
                  disabled={phase !== 'preview' || hw.revealed}
                  style={styles.hintWordWrapper}
                  accessibilityLabel={hw.revealed ? hw.word : `Tap to reveal word ${i + 1}`}
                >
                  {hw.revealed ? (
                    <Animated.View entering={FadeIn.duration(300)}>
                      <Text style={styles.hintWordRevealed}>{hw.word}</Text>
                    </Animated.View>
                  ) : (
                    <View style={styles.hintPill}>
                      <Text style={styles.hintWord}>
                        {hw.hint.charAt(0)}
                        {'_'.repeat(Math.max(hw.word.length - 1, 2))}
                      </Text>
                    </View>
                  )}
                </Pressable>
              ))}
            </View>

            {revealedCount > 0 && (
              <View style={styles.revealPenaltyRow}>
                <Ionicons name="alert-circle" size={14} color={Colors.error} />
                <Caption style={{ color: Colors.error }}>
                  -{revealedCount * REVEAL_PENALTY}% penalty ({revealedCount} revealed)
                </Caption>
              </View>
            )}
          </Animated.View>
        )}

        {/* Speech error */}
        {speech.error && phase !== 'scored' && (
          <View style={styles.errorBanner}>
            <Ionicons name="warning-outline" size={18} color={Colors.error} />
            <Body style={{ color: Colors.error, flex: 1, fontSize: 14 }}>{speech.error}</Body>
          </View>
        )}

        {/* Live transcript */}
        {phase === 'reciting' && (speech.transcript || speech.interimTranscript) ? (
          <View style={styles.interimBox}>
            <Text style={styles.interimText}>
              {speech.transcript}
              {speech.transcript && speech.interimTranscript ? ' ' : ''}
              {speech.interimTranscript ? (
                <Text style={{ color: Colors.textTertiary }}>{speech.interimTranscript}</Text>
              ) : null}
              <Text style={styles.blinkingCursor}>|</Text>
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
          <Button size="lg" onPress={advanceToNext}>
            {currentIndex + 1 < queue.length ? 'Next Verse  \u2192' : 'Finish Session  \u2192'}
          </Button>
        ) : phase === 'learn' ? (
          <Button size="lg" onPress={() => setPhase('preview')}>
            Recite from Memory  {'\u2192'}
          </Button>
        ) : speech.isSupported ? (
          phase === 'reciting' ? (
            <RecitingControls
              onRestart={handleRestartReciting}
              onDone={handleDoneReciting}
            />
          ) : (
            <PreviewControls
              onRecord={handleStartRecording}
              onSkip={handleSkip}
            />
          )
        ) : (
          <TextInputFallback
            typedText={typedText}
            onChangeText={setTypedText}
            onSubmit={() => {
              if (!typedText.trim()) return;
              handleTranscript(typedText.trim());
              setTypedText('');
            }}
            onSkip={handleSkip}
          />
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

// ─── Score Card ──────────────────────────────────────────────────────────────

const MASTERY_RANK: Record<MasteryLevel, number> = {
  'seedling': 0,
  'growing': 1,
  'rooted': 2,
  'deep-rooted': 3,
};

function ScoreCard({
  score,
  transcript,
  verseText,
  result,
}: {
  score: number;
  transcript: string;
  verseText: string;
  result: ReviewResult | null;
}) {
  const tier = getScoreTier(score);
  const leveledUp =
    result && MASTERY_RANK[result.masteryAfter] > MASTERY_RANK[result.masteryBefore];

  return (
    <Animated.View
      entering={SlideInDown.springify().damping(20).stiffness(120)}
      style={[styles.scoreCard, { borderLeftColor: tier.color }]}
    >
      <View style={styles.scoreHero}>
        <IconBadge name={tier.icon} color={tier.color} size={28} bgOpacity={0.15} />
        <AnimatedCounter value={score} suffix="%" color={Colors.text} style={styles.scoreValue} />
        <Title style={{ color: tier.color, textAlign: 'center' }}>{tier.label}</Title>
      </View>

      {leveledUp && (
        <Animated.View entering={FadeIn.delay(500).duration(400)} style={styles.levelUpBanner}>
          <Text style={styles.levelUpEmoji}>{MASTERY_EMOJIS[result.masteryAfter]}</Text>
          <View style={{ flex: 1 }}>
            <Overline style={{ color: Colors.primary }}>Mastery Up</Overline>
            <Title style={{ fontSize: 15 }}>
              This verse is now {MASTERY_LABELS[result.masteryAfter]}
            </Title>
          </View>
        </Animated.View>
      )}

      {transcript ? (
        <View style={styles.transcriptBox}>
          <Overline>You said</Overline>
          <Body style={styles.transcriptText}>{transcript}</Body>
        </View>
      ) : null}

      <View style={styles.fullVerseBox}>
        <Overline>Verse</Overline>
        <Body style={styles.fullVerseText}>{verseText}</Body>
      </View>
    </Animated.View>
  );
}

// ─── Mic Button with Pulse ───────────────────────────────────────────────────

function PreviewControls({ onRecord, onSkip }: { onRecord: () => void; onSkip: () => void }) {
  const ring1Scale = useSharedValue(1);
  const ring1Opacity = useSharedValue(0.3);
  const ring2Scale = useSharedValue(1);
  const ring2Opacity = useSharedValue(0.3);

  useEffect(() => {
    ring1Scale.value = withRepeat(
      withSequence(
        withTiming(1.5, { duration: 1800, easing: Easing.out(Easing.cubic) }),
        withTiming(1, { duration: 0 }),
      ),
      -1,
    );
    ring1Opacity.value = withRepeat(
      withSequence(
        withTiming(0, { duration: 1800 }),
        withTiming(0.3, { duration: 0 }),
      ),
      -1,
    );
    ring2Scale.value = withDelay(
      900,
      withRepeat(
        withSequence(
          withTiming(1.5, { duration: 1800, easing: Easing.out(Easing.cubic) }),
          withTiming(1, { duration: 0 }),
        ),
        -1,
      ),
    );
    ring2Opacity.value = withDelay(
      900,
      withRepeat(
        withSequence(
          withTiming(0, { duration: 1800 }),
          withTiming(0.3, { duration: 0 }),
        ),
        -1,
      ),
    );
  }, []);

  const ring1Style = useAnimatedStyle(() => ({
    transform: [{ scale: ring1Scale.value }],
    opacity: ring1Opacity.value,
  }));

  const ring2Style = useAnimatedStyle(() => ({
    transform: [{ scale: ring2Scale.value }],
    opacity: ring2Opacity.value,
  }));

  const btnScale = useSharedValue(1);
  const btnStyle = useAnimatedStyle(() => ({
    transform: [{ scale: btnScale.value }],
  }));

  return (
    <View style={styles.micRow}>
      <Pressable style={styles.skipBtn} onPress={onSkip}>
        <Ionicons name="play-skip-forward" size={20} color={Colors.textSecondary} />
      </Pressable>

      <View style={styles.micContainer}>
        <Animated.View style={[styles.pulseRing, ring1Style]} />
        <Animated.View style={[styles.pulseRing, ring2Style]} />
        <AnimatedPressable
          style={[styles.micBtn, btnStyle]}
          onPressIn={() => { btnScale.value = withSpring(0.93, { damping: 15 }); }}
          onPressOut={() => { btnScale.value = withSpring(1, { damping: 15 }); }}
          onPress={onRecord}
          accessibilityLabel="Start recording"
          accessibilityRole="button"
        >
          <Ionicons name="mic" size={36} color="#FFFFFF" />
        </AnimatedPressable>
      </View>

      <View style={styles.micHint}>
        <Caption style={{ textAlign: 'center', fontSize: 11 }}>Tap to{'\n'}recite</Caption>
      </View>
    </View>
  );
}

// ─── Reciting Controls with Listening Bars ───────────────────────────────────

function ListeningBars() {
  const bar1 = useSharedValue(12);
  const bar2 = useSharedValue(18);
  const bar3 = useSharedValue(8);

  useEffect(() => {
    const animate = (sv: SharedValue<number>, min: number, max: number, dur: number) => {
      sv.value = withRepeat(
        withSequence(
          withTiming(max, { duration: dur }),
          withTiming(min, { duration: dur }),
        ),
        -1,
        true,
      );
    };
    animate(bar1, 6, 22, 300);
    animate(bar2, 8, 26, 250);
    animate(bar3, 4, 20, 350);
  }, []);

  const s1 = useAnimatedStyle(() => ({ height: bar1.value }));
  const s2 = useAnimatedStyle(() => ({ height: bar2.value }));
  const s3 = useAnimatedStyle(() => ({ height: bar3.value }));

  return (
    <View style={styles.listeningBars}>
      <Animated.View style={[styles.bar, s1]} />
      <Animated.View style={[styles.bar, s2]} />
      <Animated.View style={[styles.bar, s3]} />
    </View>
  );
}

function RecitingControls({ onRestart, onDone }: { onRestart: () => void; onDone: () => void }) {
  return (
    <View style={styles.recitingRow}>
      <Pressable style={styles.restartBtn} onPress={onRestart}>
        <Ionicons name="refresh" size={20} color={Colors.textSecondary} />
        <Caption>Restart</Caption>
      </Pressable>

      <ListeningBars />

      <Pressable style={styles.doneBtn} onPress={onDone}>
        <Ionicons name="checkmark-circle" size={22} color="#FFFFFF" />
        <Title style={{ color: '#FFFFFF', fontSize: 15 }}>Done</Title>
      </Pressable>
    </View>
  );
}

// ─── Text Input Fallback ─────────────────────────────────────────────────────

function TextInputFallback({
  typedText,
  onChangeText,
  onSubmit,
  onSkip,
}: {
  typedText: string;
  onChangeText: (t: string) => void;
  onSubmit: () => void;
  onSkip: () => void;
}) {
  return (
    <View style={styles.textInputArea}>
      <View style={styles.textInputBanner}>
        <Ionicons name="information-circle-outline" size={15} color={Colors.primary} />
        <Caption style={{ color: Colors.primary, flex: 1 }}>
          Mic unavailable in Expo Go — type your recitation below
        </Caption>
      </View>
      <View style={styles.textInputRow}>
        <Pressable style={styles.skipBtnSmall} onPress={onSkip}>
          <Ionicons name="play-skip-forward" size={18} color={Colors.textSecondary} />
        </Pressable>
        <TextInput
          style={styles.textInput}
          placeholder="Type verse from memory..."
          placeholderTextColor={Colors.textTertiary}
          value={typedText}
          onChangeText={onChangeText}
          multiline
          returnKeyType="done"
          blurOnSubmit
        />
        <Pressable
          style={[styles.submitBtn, !typedText.trim() && styles.submitBtnDisabled]}
          onPress={onSubmit}
          disabled={!typedText.trim()}
        >
          <Ionicons name="checkmark" size={22} color="#FFFFFF" />
        </Pressable>
      </View>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

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

  // Session row
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  sessionCounter: {
    flex: 1,
  },
  // Scroll
  scrollContent: {
    padding: Spacing.xl,
    paddingBottom: 180,
    gap: Spacing.lg,
  },

  // Verse card
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.xl,
    padding: Spacing['2xl'],
    gap: Spacing.xl,
    ...Shadows.md,
  },
  refContainer: {
    alignItems: 'center',
    gap: Spacing.sm,
  },
  reference: {
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    textAlign: 'center',
  },
  refAccent: {
    width: 40,
    height: 2,
    backgroundColor: Colors.primaryLight,
    borderRadius: 1,
  },

  // Hints
  hintContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  hintWordWrapper: {
    minWidth: 28,
  },
  hintPill: {
    backgroundColor: Colors.primaryFaint,
    borderRadius: Radii.sm,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  hintWord: {
    fontFamily: Fonts.bold,
    fontSize: 22,
    color: Colors.primary,
    letterSpacing: 1,
  },
  hintWordRevealed: {
    fontFamily: Fonts.regular,
    fontSize: 18,
    color: Colors.textSecondary,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  revealPenaltyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },

  // Learn phase
  newBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 6,
    backgroundColor: Colors.primaryFaint,
    borderRadius: Radii.sm,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  learnVerseText: {
    fontSize: 18,
    lineHeight: 30,
    textAlign: 'center',
  },

  // Mastery level-up
  levelUpBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.primaryFaint,
    borderRadius: Radii.md,
    padding: Spacing.md,
  },
  levelUpEmoji: {
    fontSize: 28,
  },

  // Score card
  scoreCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.xl,
    padding: Spacing['2xl'],
    gap: Spacing.md,
    borderLeftWidth: 4,
    ...Shadows.md,
  },
  scoreHero: {
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
  },
  scoreValue: {
    fontFamily: Fonts.extraBold,
    fontSize: 48,
    lineHeight: 56,
    letterSpacing: -1,
    textAlign: 'center',
  },
  transcriptBox: {
    backgroundColor: Colors.divider,
    borderRadius: Radii.md,
    padding: Spacing.md,
    gap: 6,
  },
  transcriptText: {
    fontStyle: 'italic',
    fontSize: 14,
  },
  fullVerseBox: {
    backgroundColor: Colors.divider,
    borderRadius: Radii.md,
    padding: Spacing.md,
    gap: 6,
  },
  fullVerseText: {
    fontSize: 14,
    lineHeight: 22,
  },

  // Error
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.errorLight,
    borderRadius: Radii.md,
    padding: Spacing.md,
  },

  // Interim transcript
  interimBox: {
    backgroundColor: Colors.primaryFaint,
    borderRadius: Radii.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.primaryLight + '60',
  },
  interimText: {
    fontFamily: Fonts.regular,
    fontSize: 15,
    color: Colors.text,
    fontStyle: 'italic',
    lineHeight: 22,
  },
  blinkingCursor: {
    color: Colors.primary,
    fontWeight: '100',
  },

  // Controls
  controls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.surface,
    padding: Spacing.xl,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
    ...Shadows.lg,
  },

  // Mic
  micRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xl,
  },
  micContainer: {
    width: 96,
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseRing: {
    position: 'absolute',
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: Colors.primaryLight,
  },
  micBtn: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.lg,
    shadowColor: Colors.primary,
  },
  skipBtn: {
    padding: Spacing.md,
    borderRadius: Radii.md,
    backgroundColor: Colors.divider,
  },
  micHint: {
    width: 60,
  },

  // Reciting
  recitingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.lg,
  },
  restartBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: Radii.lg,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  doneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: Spacing['2xl'],
    paddingVertical: Spacing.md,
    borderRadius: Radii.lg,
    backgroundColor: Colors.primary,
    ...Shadows.md,
    shadowColor: Colors.primary,
  },
  listeningBars: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    height: 28,
  },
  bar: {
    width: 4,
    backgroundColor: Colors.error,
    borderRadius: 2,
  },

  // Finished
  finishedIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.successLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sessionStats: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  finStatCard: {
    alignItems: 'center',
    gap: 6,
    minWidth: 110,
  },
  finStatValue: {
    fontFamily: Fonts.extraBold,
    fontSize: 24,
    letterSpacing: -0.5,
  },
  recordBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.warningLight,
    borderRadius: Radii.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },

  // Text input fallback
  textInputArea: {
    gap: Spacing.sm,
  },
  textInputBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primaryFaint,
    borderRadius: Radii.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  textInputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.sm,
  },
  skipBtnSmall: {
    padding: 10,
    borderRadius: Radii.md,
    backgroundColor: Colors.divider,
  },
  textInput: {
    flex: 1,
    fontFamily: Fonts.regular,
    backgroundColor: Colors.divider,
    borderRadius: Radii.md,
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
    backgroundColor: Colors.textTertiary,
  },
});
