/**
 * Bible data loader.
 * Loads bundled KJV JSON and seeds the local SQLite database.
 */
import { upsertVerses, getAllBooks } from './db';

export interface BibleVerse {
  book: string;
  chapter: number;
  verse: number;
  text: string;
}

// KJV book order for display
export const KJV_BOOK_ORDER = [
  // Old Testament
  'Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy',
  'Joshua', 'Judges', 'Ruth', '1 Samuel', '2 Samuel',
  '1 Kings', '2 Kings', '1 Chronicles', '2 Chronicles',
  'Ezra', 'Nehemiah', 'Esther', 'Job', 'Psalms', 'Proverbs',
  'Ecclesiastes', 'Song of Solomon', 'Isaiah', 'Jeremiah',
  'Lamentations', 'Ezekiel', 'Daniel', 'Hosea', 'Joel', 'Amos',
  'Obadiah', 'Jonah', 'Micah', 'Nahum', 'Habakkuk', 'Zephaniah',
  'Haggai', 'Zechariah', 'Malachi',
  // New Testament
  'Matthew', 'Mark', 'Luke', 'John', 'Acts', 'Romans',
  '1 Corinthians', '2 Corinthians', 'Galatians', 'Ephesians',
  'Philippians', 'Colossians', '1 Thessalonians', '2 Thessalonians',
  '1 Timothy', '2 Timothy', 'Titus', 'Philemon', 'Hebrews',
  'James', '1 Peter', '2 Peter', '1 John', '2 John', '3 John',
  'Jude', 'Revelation',
];

export const KJV_TESTAMENT: Record<string, 'OT' | 'NT'> = {};
KJV_BOOK_ORDER.forEach((book, i) => {
  KJV_TESTAMENT[book] = i < 39 ? 'OT' : 'NT';
});

/**
 * Seed the database with bundled KJV data.
 * Only runs on first launch (checks if verses table is populated).
 */
export async function seedBibleData(): Promise<void> {
  const existingBooks = await getAllBooks();
  if (existingBooks.length > 0) return; // already seeded

  // Load the bundled KJV data (Metro bundler resolves JSON requires at build time)
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const kjvData: BibleVerse[] = require('../assets/bible/kjv.json') as BibleVerse[];
  await upsertVerses(kjvData);
}

/**
 * Format a verse reference: "John 3:16"
 */
export function formatRef(book: string, chapter: number, verse: number): string {
  return `${book} ${chapter}:${verse}`;
}

/**
 * Sort books by canonical KJV order.
 */
export function sortBooksByOrder(books: string[]): string[] {
  return [...books].sort((a, b) => {
    const ai = KJV_BOOK_ORDER.indexOf(a);
    const bi = KJV_BOOK_ORDER.indexOf(b);
    if (ai === -1 && bi === -1) return a.localeCompare(b);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
}
