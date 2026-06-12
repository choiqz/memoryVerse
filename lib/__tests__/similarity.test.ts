import { describe, it, expect } from 'vitest';
import {
  normalizeText,
  levenshtein,
  wordSimilarity,
  scoreSimilarity,
  generateHints,
} from '../similarity';

describe('normalizeText', () => {
  it('lowercases, strips punctuation, collapses whitespace', () => {
    expect(normalizeText('  For God so loved   the world! ')).toBe('for god so loved the world');
  });

  it('expands contractions', () => {
    expect(normalizeText("don't won't can't")).toBe('do not will not cannot');
  });

  it('normalizes archaic pronouns', () => {
    expect(normalizeText('Thou art with me; thy rod and thy staff')).toBe(
      'you art with me your rod and your staff',
    );
  });

  it('does not mangle modern words ending in -est or -eth', () => {
    expect(normalizeText('the harvest is the greatest rest')).toBe(
      'the harvest is the greatest rest',
    );
    expect(normalizeText('from Nazareth')).toBe('from nazareth');
  });
});

describe('levenshtein', () => {
  it('computes edit distance', () => {
    expect(levenshtein('kitten', 'sitting')).toBe(3);
    expect(levenshtein('same', 'same')).toBe(0);
    expect(levenshtein('', 'abc')).toBe(3);
    expect(levenshtein('abc', '')).toBe(3);
  });
});

describe('wordSimilarity', () => {
  it('returns 1 for identical words and 0–1 otherwise', () => {
    expect(wordSimilarity('shepherd', 'shepherd')).toBe(1);
    // exactly at the 0.75 match threshold (still counts as a match via >=)
    expect(wordSimilarity('shepherd', 'shepard')).toBeGreaterThanOrEqual(0.75);
    expect(wordSimilarity('god', 'dog')).toBeLessThan(0.75);
  });
});

describe('scoreSimilarity', () => {
  const john316 =
    'For God so loved the world that He gave His one and only Son, that everyone who believes in Him shall not perish but have eternal life.';

  it('returns 100 for an exact recitation', () => {
    expect(scoreSimilarity(john316, john316)).toBe(100);
  });

  it('returns 0 for empty input', () => {
    expect(scoreSimilarity('', john316)).toBe(0);
    expect(scoreSimilarity('   ', john316)).toBe(0);
  });

  it('is robust to punctuation and casing differences', () => {
    const spoken = 'for god so loved the world that he gave his one and only son that everyone who believes in him shall not perish but have eternal life';
    expect(scoreSimilarity(spoken, john316)).toBe(100);
  });

  it('tolerates minor speech-recognition word errors', () => {
    const spoken =
      'For God so loved the world that He gave His one and only Son that everyone who believes in Him shall not parish but have eternal life';
    expect(scoreSimilarity(spoken, john316)).toBeGreaterThanOrEqual(90);
  });

  it('gives partial credit for partial recitation', () => {
    const spoken = 'For God so loved the world';
    const score = scoreSimilarity(spoken, john316);
    expect(score).toBeGreaterThan(10);
    expect(score).toBeLessThan(50);
  });

  it('scores unrelated text low', () => {
    const spoken = 'the quick brown fox jumps over the lazy dog';
    expect(scoreSimilarity(spoken, john316)).toBeLessThan(30);
  });

  it('penalizes out-of-order recitation', () => {
    const scrambled = 'eternal life have but perish not shall Him in believes who everyone that Son only and one His gave He that world the loved so God For';
    const score = scoreSimilarity(scrambled, john316);
    expect(score).toBeLessThan(50);
  });

  it('tolerates a couple of filler words', () => {
    const spoken = 'For God so loved the world that He gave His one and only Son that everyone who believes in Him shall not perish but have eternal life amen amen';
    expect(scoreSimilarity(spoken, john316)).toBeGreaterThanOrEqual(95);
  });

  it('penalizes reciting far more than the verse', () => {
    const doubled = `${john316} ${john316}`;
    const score = scoreSimilarity(doubled, john316);
    expect(score).toBeLessThan(75);
  });

  it('does not reward repeating one word many times', () => {
    const spoken = 'God God God God God God God God God God';
    expect(scoreSimilarity(spoken, john316)).toBeLessThan(20);
  });
});

describe('generateHints', () => {
  it('produces first-letter hints', () => {
    const hints = generateHints('For God so loved');
    expect(hints.map((h) => h.hint)).toEqual(['F', 'G', 's', 'l']);
    expect(hints.every((h) => !h.revealed)).toBe(true);
  });

  it('skips leading punctuation when picking the hint letter', () => {
    const hints = generateHints('"Behold, I stand');
    expect(hints[0].hint).toBe('B');
  });
});
