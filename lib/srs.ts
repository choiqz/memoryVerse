/**
 * SM-2 Spaced Repetition Algorithm
 * Based on the SuperMemo SM-2 algorithm used by Anki.
 * https://www.supermemo.com/en/blog/application-of-a-computer-to-improve-the-results-obtained-in-working-with-the-supermemo-method
 */

export interface SRSCard {
  interval: number;      // days until next review
  easeFactor: number;    // difficulty multiplier (min 1.3, starts at 2.5)
  repetitions: number;   // consecutive successful reviews
  dueDate: string;       // ISO date string
}

export interface SRSResult {
  interval: number;
  easeFactor: number;
  repetitions: number;
  dueDate: string;
}

/**
 * Map similarity score (0–100) to SM-2 quality (0–5).
 *
 * The user's pass threshold sets the quality-3 boundary: scores at or above
 * it count as successful recall (quality 3–5), scores below it fail the card
 * (quality 0–2) and reset its repetition count.
 */
export function similarityToQuality(similarity: number, passThreshold = 85): number {
  const threshold = Math.max(50, Math.min(95, passThreshold));

  if (similarity >= threshold) {
    if (similarity >= 95) return 5;                          // perfect
    if (similarity >= threshold + (95 - threshold) / 2) return 4; // good
    return 3;                                                 // okay
  }
  if (similarity >= threshold * 0.6) return 2; // hard
  if (similarity >= threshold * 0.3) return 1; // very hard
  return 0;                                    // blackout
}

/**
 * Get mastery level based on repetitions and interval.
 */
export function getMasteryLevel(repetitions: number, interval: number): MasteryLevel {
  if (repetitions === 0) return 'seedling';
  if (interval < 7) return 'growing';
  if (interval < 21) return 'rooted';
  return 'deep-rooted';
}

export type MasteryLevel = 'seedling' | 'growing' | 'rooted' | 'deep-rooted';

export const MASTERY_LABELS: Record<MasteryLevel, string> = {
  'seedling': 'Seedling',
  'growing': 'Growing',
  'rooted': 'Rooted',
  'deep-rooted': 'Deep-Rooted',
};

export const MASTERY_EMOJIS: Record<MasteryLevel, string> = {
  'seedling': '🌱',
  'growing': '🌿',
  'rooted': '🌳',
  'deep-rooted': '🏆',
};

/**
 * SM-2 algorithm core.
 * @param quality - Review quality 0–5 (0=total blackout, 5=perfect)
 * @param card - Current card state
 * @returns Updated card state
 */
export function sm2(quality: number, card: SRSCard): SRSResult {
  const clampedQuality = Math.max(0, Math.min(5, Math.round(quality)));

  let { interval, easeFactor, repetitions } = card;

  if (clampedQuality < 3) {
    // Failed: reset repetitions but keep (slightly degraded) ease factor
    interval = 1;
    repetitions = 0;
    easeFactor = Math.max(1.3, easeFactor - 0.2);
  } else {
    // Successful recall
    if (repetitions === 0) {
      interval = 1;
    } else if (repetitions === 1) {
      interval = 6;
    } else {
      interval = Math.round(interval * easeFactor);
    }

    // Update ease factor: increases on easy (quality=5), decreases on hard (quality=3)
    easeFactor = easeFactor + (0.1 - (5 - clampedQuality) * (0.08 + (5 - clampedQuality) * 0.02));
    easeFactor = Math.max(1.3, easeFactor);
    repetitions += 1;
  }

  // If quality < 3, re-queue today regardless of interval
  const dueDate = addDays(new Date(), clampedQuality < 3 ? 0 : interval);

  return {
    interval,
    easeFactor,
    repetitions,
    dueDate: dueDate.toISOString().split('T')[0],
  };
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Compute the new streak after a review today.
 * - Same-day review: streak unchanged
 * - Reviewed yesterday: streak + 1
 * - Otherwise (gap or first review): reset to 1
 */
export function nextStreak(
  lastReviewDate: string | null,
  currentStreak: number,
  now: Date = new Date(),
): number {
  const today = now.toISOString().split('T')[0];
  const yesterday = new Date(now.getTime() - 86400000).toISOString().split('T')[0];

  if (lastReviewDate === today) return currentStreak;
  if (lastReviewDate === yesterday) return currentStreak + 1;
  return 1;
}

/**
 * Check if a card is due for review today.
 */
export function isDue(dueDate: string): boolean {
  const today = new Date().toISOString().split('T')[0];
  return dueDate <= today;
}

/**
 * Get initial card state for a new verse.
 */
export function initialCard(): SRSCard {
  const today = new Date().toISOString().split('T')[0];
  return {
    interval: 0,
    easeFactor: 2.5,
    repetitions: 0,
    dueDate: today,
  };
}
