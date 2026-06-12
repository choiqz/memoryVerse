/**
 * Text similarity scoring for Bible verse recitation.
 * Handles speech-recognition noise, proper nouns, and partial credit.
 */

/**
 * Normalize text for comparison:
 * - lowercase
 * - strip punctuation
 * - collapse whitespace
 * - expand common contractions
 */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    // Expand common contractions
    .replace(/\bsha'n't\b/g, 'shall not')
    .replace(/\bshan't\b/g, 'shall not')
    .replace(/\bwon't\b/g, 'will not')
    .replace(/\bcan't\b/g, 'cannot')
    .replace(/\bdon't\b/g, 'do not')
    .replace(/\bdoesn't\b/g, 'does not')
    .replace(/\bdidn't\b/g, 'did not')
    .replace(/\bwasn't\b/g, 'was not')
    .replace(/\baren't\b/g, 'are not')
    .replace(/\bisn't\b/g, 'is not')
    .replace(/\bhadn't\b/g, 'had not')
    .replace(/\bhaven't\b/g, 'have not')
    .replace(/\bhasn't\b/g, 'has not')
    .replace(/\bweren't\b/g, 'were not')
    .replace(/\bwouldn't\b/g, 'would not')
    .replace(/\bcouldn't\b/g, 'could not')
    .replace(/\bshouldn't\b/g, 'should not')
    // Archaic pronouns (exact-word mappings; harmless for modern text,
    // helps if speech recognition outputs archaic forms)
    .replace(/\bthee\b/g, 'you')
    .replace(/\bthou\b/g, 'you')
    .replace(/\bthy\b/g, 'your')
    .replace(/\bthine\b/g, 'yours')
    // Remove punctuation
    .replace(/[^\w\s]/g, ' ')
    // Collapse whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Levenshtein edit distance between two strings.
 */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b[i - 1] === a[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1,     // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Word similarity using normalized Levenshtein (0–1, where 1 = identical).
 */
export function wordSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  const dist = levenshtein(a, b);
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - dist / maxLen;
}

/**
 * Score recitation similarity against the target verse (0–100).
 *
 * Order-aware fuzzy alignment (LCS-style dynamic programming): target and
 * recognized words are aligned in sequence, with per-word partial credit for
 * near matches (>= 0.75 Levenshtein similarity, tolerating speech-recognition
 * errors). Out-of-order words break the alignment and lose credit, and a mild
 * penalty is applied when the recitation runs longer than the target.
 */
export function scoreSimilarity(
  recognized: string,
  target: string,
  wordMatchThreshold = 0.75,
): number {
  if (!recognized.trim()) return 0;

  const normRecognized = normalizeText(recognized);
  const normTarget = normalizeText(target);

  if (normRecognized === normTarget) return 100;

  const targetWords = normTarget.split(' ').filter(Boolean);
  const recognizedWords = normRecognized.split(' ').filter(Boolean);

  if (targetWords.length === 0) return 100;
  if (recognizedWords.length === 0) return 0;

  // dp[i][j] = best total match weight aligning targetWords[0..i) with recognizedWords[0..j)
  const T = targetWords.length;
  const R = recognizedWords.length;
  const dp: number[][] = Array.from({ length: T + 1 }, () => new Array<number>(R + 1).fill(0));

  for (let i = 1; i <= T; i++) {
    for (let j = 1; j <= R; j++) {
      const sim = wordSimilarity(targetWords[i - 1], recognizedWords[j - 1]);
      const matched = sim >= wordMatchThreshold ? dp[i - 1][j - 1] + sim : 0;
      dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1], matched);
    }
  }

  const matchWeight = dp[T][R];
  const coverage = matchWeight / T;

  // Mild penalty for recitations longer than the target (half-weight per excess
  // word, so a couple of ASR filler words barely matter but rambling does).
  const excess = Math.max(0, R - T);
  const lengthPenalty = T / (T + 0.5 * excess);

  return Math.round(coverage * lengthPenalty * 100);
}

/**
 * Generate first-letter hints for a verse.
 * "For God so loved" → "F G s l"
 */
export function generateHints(text: string): HintWord[] {
  return text.split(/\s+/).filter(Boolean).map((word) => {
    // Strip leading/trailing punctuation for the hint letter
    const stripped = word.replace(/^[^a-zA-Z0-9]+/, '').replace(/[^a-zA-Z0-9]+$/, '');
    const letter = stripped.length > 0 ? stripped[0] : word[0];
    return { word, hint: letter, revealed: false };
  });
}

export interface HintWord {
  word: string;   // full word
  hint: string;   // first letter
  revealed: boolean;
}
