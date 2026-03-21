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
 */
export function similarityToQuality(similarity: number): number {
  if (similarity >= 95) return 5; // perfect
  if (similarity >= 85) return 4; // good
  if (similarity >= 70) return 3; // okay
  if (similarity >= 50) return 2; // hard
  if (similarity >= 25) return 1; // very hard
  return 0;                        // blackout
}

/**
 * Calculate XP earned for a review.
 */
export function calculateXP(quality: number): number {
  const base = 10;
  const multipliers: Record<number, number> = {
    5: 2.0,
    4: 1.5,
    3: 1.0,
    2: 0.5,
    1: 0.25,
    0: 0,
  };
  return Math.round(base * (multipliers[quality] ?? 0));
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
