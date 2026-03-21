/**
 * Text similarity scoring for Bible verse recitation.
 * Handles archaic language (thee, thou, hath), proper nouns, and partial credit.
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
    // Expand common KJV contractions
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
    // KJV-specific: speech recognition often mishears these
    .replace(/\bthee\b/g, 'you')
    .replace(/\bthou\b/g, 'you')
    .replace(/\bthy\b/g, 'your')
    .replace(/\bthine\b/g, 'yours')
    .replace(/\byea\b/g, 'yes')
    .replace(/\bseeketh\b/g, 'seeks')
    .replace(/\bspeaketh\b/g, 'speaks')
    // Normalize -eth endings: "hath" -> "has", "loveth" -> "loves", etc.
    .replace(/\b(\w+)eth\b/g, (_match, root) => root + 's')
    // Normalize -est endings: "knowest" -> "know"
    .replace(/\b(\w+)est\b/g, (_match, root) => root)
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
 * Uses word-by-word fuzzy matching with a 0.75 similarity threshold.
 * Each target word that has a sufficiently similar match in the recognized text
 * counts as matched. Order is not strictly enforced (greedy matching).
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

  // Greedy word matching: for each target word, find the best unmatched recognized word
  const usedIndices = new Set<number>();
  let matchCount = 0;

  for (const targetWord of targetWords) {
    let bestSim = 0;
    let bestIdx = -1;

    for (let i = 0; i < recognizedWords.length; i++) {
      if (usedIndices.has(i)) continue;
      const sim = wordSimilarity(targetWord, recognizedWords[i]);
      if (sim > bestSim) {
        bestSim = sim;
        bestIdx = i;
      }
    }

    if (bestSim >= wordMatchThreshold && bestIdx !== -1) {
      usedIndices.add(bestIdx);
      // Partial credit proportional to similarity
      matchCount += bestSim;
    }
  }

  return Math.round((matchCount / targetWords.length) * 100);
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
