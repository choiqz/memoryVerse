import { describe, it, expect } from 'vitest';
import {
  sm2,
  initialCard,
  isDue,
  similarityToQuality,
  getMasteryLevel,
  nextStreak,
  type SRSCard,
} from '../srs';

function isoDaysFromNow(days: number): string {
  return new Date(Date.now() + days * 86400000).toISOString().split('T')[0];
}

describe('similarityToQuality', () => {
  it('maps score bands to SM-2 quality with default 85 threshold', () => {
    expect(similarityToQuality(100)).toBe(5);
    expect(similarityToQuality(95)).toBe(5);
    expect(similarityToQuality(94)).toBe(4);
    expect(similarityToQuality(90)).toBe(4);
    expect(similarityToQuality(89)).toBe(3);
    expect(similarityToQuality(85)).toBe(3);
    expect(similarityToQuality(84)).toBe(2);
    expect(similarityToQuality(51)).toBe(2);
    expect(similarityToQuality(50)).toBe(1);
    expect(similarityToQuality(26)).toBe(1);
    expect(similarityToQuality(25)).toBe(0);
    expect(similarityToQuality(0)).toBe(0);
  });

  it('passing requires meeting the user threshold', () => {
    // Lenient threshold: 70 passes
    expect(similarityToQuality(70, 70)).toBe(3);
    expect(similarityToQuality(83, 70)).toBe(4);
    expect(similarityToQuality(95, 70)).toBe(5);
    expect(similarityToQuality(69, 70)).toBe(2);
    // Strict threshold: 94 still fails at 95
    expect(similarityToQuality(94, 95)).toBe(2);
    expect(similarityToQuality(95, 95)).toBe(5);
  });

  it('clamps out-of-range thresholds', () => {
    expect(similarityToQuality(60, 10)).toBe(3);  // threshold clamped up to 50
    expect(similarityToQuality(96, 100)).toBe(5); // threshold clamped down to 95
  });
});

describe('sm2 scheduling', () => {
  it('first successful review schedules 1 day out', () => {
    const result = sm2(5, initialCard());
    expect(result.interval).toBe(1);
    expect(result.repetitions).toBe(1);
    expect(result.dueDate).toBe(isoDaysFromNow(1));
  });

  it('second successful review schedules 6 days out', () => {
    const card: SRSCard = { interval: 1, easeFactor: 2.5, repetitions: 1, dueDate: isoDaysFromNow(0) };
    const result = sm2(4, card);
    expect(result.interval).toBe(6);
    expect(result.repetitions).toBe(2);
  });

  it('third+ review multiplies interval by ease factor', () => {
    const card: SRSCard = { interval: 6, easeFactor: 2.5, repetitions: 2, dueDate: isoDaysFromNow(0) };
    const result = sm2(5, card);
    expect(result.interval).toBe(15); // round(6 * 2.5)
    expect(result.repetitions).toBe(3);
  });

  it('failure (quality < 3) resets repetitions and re-queues today', () => {
    const card: SRSCard = { interval: 30, easeFactor: 2.5, repetitions: 5, dueDate: isoDaysFromNow(0) };
    const result = sm2(1, card);
    expect(result.interval).toBe(1);
    expect(result.repetitions).toBe(0);
    expect(result.easeFactor).toBeCloseTo(2.3);
    expect(result.dueDate).toBe(isoDaysFromNow(0)); // due again today
  });

  it('perfect recall increases ease factor', () => {
    const card: SRSCard = { interval: 6, easeFactor: 2.5, repetitions: 2, dueDate: isoDaysFromNow(0) };
    const result = sm2(5, card);
    expect(result.easeFactor).toBeCloseTo(2.6);
  });

  it('hard recall (quality 3) decreases ease factor', () => {
    const card: SRSCard = { interval: 6, easeFactor: 2.5, repetitions: 2, dueDate: isoDaysFromNow(0) };
    const result = sm2(3, card);
    expect(result.easeFactor).toBeCloseTo(2.36);
  });

  it('ease factor never drops below 1.3', () => {
    let card: SRSCard = { interval: 1, easeFactor: 1.3, repetitions: 0, dueDate: isoDaysFromNow(0) };
    const failed = sm2(0, card);
    expect(failed.easeFactor).toBe(1.3);
    const hard = sm2(3, { ...card, repetitions: 2, interval: 6 });
    expect(hard.easeFactor).toBe(1.3);
  });

  it('clamps out-of-range quality values', () => {
    const result = sm2(99, initialCard());
    expect(result.repetitions).toBe(1); // treated as success
    const failResult = sm2(-5, initialCard());
    expect(failResult.repetitions).toBe(0); // treated as failure
  });
});

describe('isDue', () => {
  it('due today and overdue are due; future is not', () => {
    expect(isDue(isoDaysFromNow(0))).toBe(true);
    expect(isDue(isoDaysFromNow(-3))).toBe(true);
    expect(isDue(isoDaysFromNow(1))).toBe(false);
  });
});

describe('initialCard', () => {
  it('starts due today with default ease', () => {
    const card = initialCard();
    expect(card.interval).toBe(0);
    expect(card.easeFactor).toBe(2.5);
    expect(card.repetitions).toBe(0);
    expect(card.dueDate).toBe(isoDaysFromNow(0));
  });
});

describe('getMasteryLevel', () => {
  it('maps repetitions/interval to mastery levels', () => {
    expect(getMasteryLevel(0, 0)).toBe('seedling');
    expect(getMasteryLevel(1, 1)).toBe('growing');
    expect(getMasteryLevel(2, 6)).toBe('growing');
    expect(getMasteryLevel(3, 7)).toBe('rooted');
    expect(getMasteryLevel(3, 20)).toBe('rooted');
    expect(getMasteryLevel(4, 21)).toBe('deep-rooted');
    expect(getMasteryLevel(5, 60)).toBe('deep-rooted');
  });
});

describe('nextStreak', () => {
  const now = new Date('2026-06-11T12:00:00Z');

  it('first ever review starts streak at 1', () => {
    expect(nextStreak(null, 0, now)).toBe(1);
  });

  it('same-day review leaves streak unchanged', () => {
    expect(nextStreak('2026-06-11', 4, now)).toBe(4);
  });

  it('consecutive-day review extends streak', () => {
    expect(nextStreak('2026-06-10', 4, now)).toBe(5);
  });

  it('missed day resets streak to 1', () => {
    expect(nextStreak('2026-06-09', 10, now)).toBe(1);
    expect(nextStreak('2026-01-01', 99, now)).toBe(1);
  });
});
