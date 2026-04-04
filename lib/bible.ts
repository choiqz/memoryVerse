/**
 * Bible data loader.
 * Loads bundled KJV JSON and seeds the local SQLite database.
 */
import { upsertVerses, getAllBooks, getVersePacks, insertVersePack, upsertVerseWithRange, insertVersePackItem } from './db';

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
 * Seed verse packs from bundled JSON files.
 * Only runs if no packs exist yet.
 */
export async function seedPacks(): Promise<void> {
  const existingPacks = await getVersePacks();
  if (existingPacks.length > 0) return;

  const packFiles = [
    require('../assets/packs/youth-group.json'),
  ];

  for (const packData of packFiles) {
    const packId = await insertVersePack({
      slug: packData.slug,
      name: packData.name,
      description: packData.description,
      icon: packData.icon,
      verseCount: packData.verses.length,
      translation: packData.translation,
    });

    for (let i = 0; i < packData.verses.length; i++) {
      const v = packData.verses[i];
      const verseId = await upsertVerseWithRange({
        book: v.book,
        chapter: v.chapter,
        verse: v.verse,
        verseEnd: v.verse_end ?? null,
        text: v.text,
        translation: packData.translation,
      });

      await insertVersePackItem({
        packId,
        verseId,
        sortOrder: i,
      });
    }
  }
}

/**
 * Format a verse reference: "John 3:16" or "Philippians 2:3-4"
 */
export function formatRef(book: string, chapter: number, verse: number, verseEnd?: number | null): string {
  if (verseEnd && verseEnd > verse) {
    return `${book} ${chapter}:${verse}-${verseEnd}`;
  }
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
