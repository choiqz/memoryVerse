import * as SQLite from 'expo-sqlite';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import { eq, lte, sql, and } from 'drizzle-orm';
import { verses, userVerses, sessions, userStats, versePacks, versePackItems } from './schema';
import type { Verse, UserVerse, UserStats, VersePack } from './schema';
import { sm2, initialCard, isDue, similarityToQuality, nextStreak, getMasteryLevel, type MasteryLevel } from '../srs';

// ─── Database Connection ──────────────────────────────────────────────────────

const sqliteDb = SQLite.openDatabaseSync('memoryverse.db');
export const db = drizzle(sqliteDb);

// ─── Migrations / Schema Setup ────────────────────────────────────────────────

export async function initDatabase(): Promise<void> {
  await sqliteDb.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS verses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      book TEXT NOT NULL,
      chapter INTEGER NOT NULL,
      verse INTEGER NOT NULL,
      verse_end INTEGER,
      text TEXT NOT NULL,
      translation TEXT NOT NULL DEFAULT 'BSB'
    );

    CREATE TABLE IF NOT EXISTS user_verses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      verse_id INTEGER NOT NULL REFERENCES verses(id),
      interval INTEGER NOT NULL DEFAULT 0,
      ease_factor REAL NOT NULL DEFAULT 2.5,
      due_date TEXT NOT NULL,
      repetitions INTEGER NOT NULL DEFAULT 0,
      last_score INTEGER NOT NULL DEFAULT 0,
      added_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      verses_reviewed INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_stats (
      id INTEGER PRIMARY KEY DEFAULT 1,
      streak INTEGER NOT NULL DEFAULT 0,
      longest_streak INTEGER NOT NULL DEFAULT 0,
      verses_learned INTEGER NOT NULL DEFAULT 0,
      last_review_date TEXT,
      daily_goal INTEGER NOT NULL DEFAULT 10,
      pass_threshold INTEGER NOT NULL DEFAULT 85,
      translation TEXT NOT NULL DEFAULT 'BSB'
    );

    CREATE TABLE IF NOT EXISTS verse_packs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT,
      icon TEXT NOT NULL DEFAULT 'book',
      verse_count INTEGER NOT NULL DEFAULT 0,
      translation TEXT NOT NULL DEFAULT 'BSB',
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS verse_pack_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pack_id INTEGER NOT NULL REFERENCES verse_packs(id),
      verse_id INTEGER NOT NULL REFERENCES verses(id),
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_user_verses_due
      ON user_verses(due_date);

    -- Seed user_stats row if missing
    INSERT OR IGNORE INTO user_stats (id) VALUES (1);
  `);

  // Add verse_end column for existing databases (idempotent)
  try {
    await sqliteDb.execAsync(`ALTER TABLE verses ADD COLUMN verse_end INTEGER`);
  } catch {
    // Column already exists
  }

  // Recreate index to include verse_end (safe for fresh + existing DBs)
  await sqliteDb.execAsync(`
    DROP INDEX IF EXISTS idx_verses_ref;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_verses_ref
      ON verses(book, chapter, verse, COALESCE(verse_end, 0), translation);
  `);
}

// ─── Verse Queries ────────────────────────────────────────────────────────────

export async function upsertVerses(verseList: Array<{
  book: string;
  chapter: number;
  verse: number;
  text: string;
  translation?: string;
}>): Promise<void> {
  for (const v of verseList) {
    await db.insert(verses).values({
      book: v.book,
      chapter: v.chapter,
      verse: v.verse,
      text: v.text,
      translation: v.translation ?? 'BSB',
    }).onConflictDoNothing();
  }
}

export async function upsertVerseWithRange(v: {
  book: string;
  chapter: number;
  verse: number;
  verseEnd: number | null;
  text: string;
  translation: string;
}): Promise<number> {
  const existing = await db
    .select({ id: verses.id })
    .from(verses)
    .where(
      and(
        eq(verses.book, v.book),
        eq(verses.chapter, v.chapter),
        eq(verses.verse, v.verse),
        eq(verses.translation, v.translation),
        v.verseEnd
          ? eq(verses.verseEnd, v.verseEnd)
          : sql`${verses.verseEnd} IS NULL`,
      )
    )
    .get();

  if (existing) return existing.id;

  const result = await db.insert(verses).values({
    book: v.book,
    chapter: v.chapter,
    verse: v.verse,
    verseEnd: v.verseEnd,
    text: v.text,
    translation: v.translation,
  });
  return Number(result.lastInsertRowId);
}

export async function getVersesByBook(book: string): Promise<Verse[]> {
  return db.select().from(verses).where(eq(verses.book, book)).all();
}

export async function getVersesByChapter(book: string, chapter: number): Promise<Verse[]> {
  return db
    .select()
    .from(verses)
    .where(and(eq(verses.book, book), eq(verses.chapter, chapter)))
    .all();
}

export async function searchVerses(query: string): Promise<Verse[]> {
  return db
    .select()
    .from(verses)
    .where(sql`lower(${verses.text}) LIKE ${'%' + query.toLowerCase() + '%'}`)
    .limit(50)
    .all();
}

export async function getAllBooks(): Promise<string[]> {
  const result = await db
    .selectDistinct({ book: verses.book })
    .from(verses)
    .all();
  return result.map((r) => r.book);
}

// ─── User Verse Queries ───────────────────────────────────────────────────────

export async function addVerseToLibrary(verseId: number): Promise<void> {
  const existing = await db
    .select()
    .from(userVerses)
    .where(eq(userVerses.verseId, verseId))
    .get();

  if (existing) return; // already in library

  const card = initialCard();
  await db.insert(userVerses).values({
    verseId,
    interval: card.interval,
    easeFactor: card.easeFactor,
    dueDate: card.dueDate,
    repetitions: card.repetitions,
    lastScore: 0,
    addedAt: new Date().toISOString(),
  });

  // Increment verses_learned stat
  await db
    .update(userStats)
    .set({ versesLearned: sql`${userStats.versesLearned} + 1` })
    .where(eq(userStats.id, 1));
}

export async function removeVerseFromLibrary(userVerseId: number): Promise<void> {
  await db.delete(userVerses).where(eq(userVerses.id, userVerseId));
  await db
    .update(userStats)
    .set({ versesLearned: sql`MAX(0, ${userStats.versesLearned} - 1)` })
    .where(eq(userStats.id, 1));
}

export async function isVerseInLibrary(verseId: number): Promise<boolean> {
  const row = await db
    .select({ id: userVerses.id })
    .from(userVerses)
    .where(eq(userVerses.verseId, verseId))
    .get();
  return !!row;
}

/**
 * Get all verses due for review today, joined with verse text.
 */
export async function getDueVerses(): Promise<Array<UserVerse & Verse>> {
  const today = new Date().toISOString().split('T')[0];
  const rows = await db
    .select({
      // user_verses fields
      id: userVerses.id,
      verseId: userVerses.verseId,
      interval: userVerses.interval,
      easeFactor: userVerses.easeFactor,
      dueDate: userVerses.dueDate,
      repetitions: userVerses.repetitions,
      lastScore: userVerses.lastScore,
      addedAt: userVerses.addedAt,
      // verses fields
      book: verses.book,
      chapter: verses.chapter,
      verse: verses.verse,
      verseEnd: verses.verseEnd,
      text: verses.text,
      translation: verses.translation,
    })
    .from(userVerses)
    .innerJoin(verses, eq(userVerses.verseId, verses.id))
    .where(lte(userVerses.dueDate, today))
    .orderBy(userVerses.dueDate)
    .all();

  return rows as Array<UserVerse & Verse>;
}

/**
 * Get all user verses (for progress screen), joined with verse text.
 */
export async function getAllUserVerses(): Promise<Array<UserVerse & Verse>> {
  const rows = await db
    .select({
      id: userVerses.id,
      verseId: userVerses.verseId,
      interval: userVerses.interval,
      easeFactor: userVerses.easeFactor,
      dueDate: userVerses.dueDate,
      repetitions: userVerses.repetitions,
      lastScore: userVerses.lastScore,
      addedAt: userVerses.addedAt,
      book: verses.book,
      chapter: verses.chapter,
      verse: verses.verse,
      verseEnd: verses.verseEnd,
      text: verses.text,
      translation: verses.translation,
    })
    .from(userVerses)
    .innerJoin(verses, eq(userVerses.verseId, verses.id))
    .all();

  return rows as Array<UserVerse & Verse>;
}

// ─── Review / SRS Update ─────────────────────────────────────────────────────

export interface ReviewResult {
  quality: number;
  passed: boolean;
  masteryBefore: MasteryLevel;
  masteryAfter: MasteryLevel;
  streak: number;
}

/**
 * Record a review result: update SRS state and streak.
 * Quality is derived from the similarity score using the user's pass threshold.
 */
export async function recordReview(
  userVerseId: number,
  similarityScore: number,  // 0–100
): Promise<ReviewResult> {
  const uv = await db
    .select()
    .from(userVerses)
    .where(eq(userVerses.id, userVerseId))
    .get();

  if (!uv) throw new Error(`UserVerse ${userVerseId} not found`);

  const stats = await getUserStats();
  const quality = similarityToQuality(similarityScore, stats.passThreshold);
  const masteryBefore = getMasteryLevel(uv.repetitions, uv.interval);

  const result = sm2(quality, {
    interval: uv.interval,
    easeFactor: uv.easeFactor,
    repetitions: uv.repetitions,
    dueDate: uv.dueDate,
  });

  const masteryAfter = getMasteryLevel(result.repetitions, result.interval);

  // Update user_verse SRS state
  await db
    .update(userVerses)
    .set({
      interval: result.interval,
      easeFactor: result.easeFactor,
      dueDate: result.dueDate,
      repetitions: result.repetitions,
      lastScore: similarityScore,
    })
    .where(eq(userVerses.id, userVerseId));

  // Update streak
  const streak = await updateStreak();

  // Log to today's session
  await logSessionReview();

  return { quality, passed: quality >= 3, masteryBefore, masteryAfter, streak };
}

async function updateStreak(): Promise<number> {
  const stats = await getUserStats();
  const today = new Date().toISOString().split('T')[0];
  const newStreak = nextStreak(stats.lastReviewDate, stats.streak);

  await db
    .update(userStats)
    .set({
      streak: newStreak,
      longestStreak: sql`MAX(${userStats.longestStreak}, ${newStreak})`,
      lastReviewDate: today,
    })
    .where(eq(userStats.id, 1));

  return newStreak;
}

async function logSessionReview(): Promise<void> {
  const today = new Date().toISOString().split('T')[0];
  const existing = await db
    .select()
    .from(sessions)
    .where(eq(sessions.date, today))
    .get();

  if (existing) {
    await db
      .update(sessions)
      .set({
        versesReviewed: sql`${sessions.versesReviewed} + 1`,
      })
      .where(eq(sessions.date, today));
  } else {
    await db.insert(sessions).values({
      date: today,
      versesReviewed: 1,
      createdAt: new Date().toISOString(),
    });
  }
}

// ─── Stats Queries ────────────────────────────────────────────────────────────

export async function getUserStats(): Promise<UserStats> {
  const stats = await db.select().from(userStats).where(eq(userStats.id, 1)).get();
  if (!stats) {
    // Should never happen after initDatabase(), but just in case
    await db.insert(userStats).values({ id: 1 }).onConflictDoNothing();
    return (await db.select().from(userStats).where(eq(userStats.id, 1)).get())!;
  }
  return stats;
}

export async function updateSettings(settings: {
  dailyGoal?: number;
  passThreshold?: number;
  translation?: string;
}): Promise<void> {
  await db
    .update(userStats)
    .set(settings)
    .where(eq(userStats.id, 1));
}

export async function getRecentSessions(days = 30): Promise<Array<{ date: string; versesReviewed: number }>> {
  const cutoff = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];
  return db
    .select({ date: sessions.date, versesReviewed: sessions.versesReviewed })
    .from(sessions)
    .where(sql`${sessions.date} >= ${cutoff}`)
    .orderBy(sessions.date)
    .all();
}

/**
 * How many verses were reviewed today (for the daily goal).
 */
export async function getTodayReviewCount(): Promise<number> {
  const today = new Date().toISOString().split('T')[0];
  const row = await db
    .select({ versesReviewed: sessions.versesReviewed })
    .from(sessions)
    .where(eq(sessions.date, today))
    .get();
  return row?.versesReviewed ?? 0;
}

export async function getDueCount(): Promise<number> {
  const today = new Date().toISOString().split('T')[0];
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(userVerses)
    .where(lte(userVerses.dueDate, today))
    .get();
  return result?.count ?? 0;
}

// ─── Verse Packs ─────────────────────────────────────────────────────────────

export async function getVersePacks(): Promise<VersePack[]> {
  return db.select().from(versePacks).orderBy(versePacks.sortOrder).all();
}

export async function getPackVerses(packId: number): Promise<Verse[]> {
  return db
    .select({
      id: verses.id,
      book: verses.book,
      chapter: verses.chapter,
      verse: verses.verse,
      verseEnd: verses.verseEnd,
      text: verses.text,
      translation: verses.translation,
    })
    .from(versePackItems)
    .innerJoin(verses, eq(versePackItems.verseId, verses.id))
    .where(eq(versePackItems.packId, packId))
    .orderBy(versePackItems.sortOrder)
    .all();
}

export async function getPackAddedCount(packId: number): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`count(*)` })
    .from(versePackItems)
    .innerJoin(userVerses, eq(versePackItems.verseId, userVerses.verseId))
    .where(eq(versePackItems.packId, packId))
    .get();
  return rows?.count ?? 0;
}

export async function addPackToLibrary(packId: number): Promise<number> {
  const packVerses = await getPackVerses(packId);
  let added = 0;
  for (const v of packVerses) {
    const existing = await db
      .select()
      .from(userVerses)
      .where(eq(userVerses.verseId, v.id))
      .get();
    if (!existing) {
      await addVerseToLibrary(v.id);
      added++;
    }
  }
  return added;
}

export async function insertVersePack(pack: {
  slug: string;
  name: string;
  description?: string;
  icon: string;
  verseCount: number;
  translation: string;
  sortOrder?: number;
}): Promise<number> {
  const result = await db.insert(versePacks).values({
    slug: pack.slug,
    name: pack.name,
    description: pack.description ?? null,
    icon: pack.icon,
    verseCount: pack.verseCount,
    translation: pack.translation,
    sortOrder: pack.sortOrder ?? 0,
  });
  return Number(result.lastInsertRowId);
}

export async function insertVersePackItem(item: {
  packId: number;
  verseId: number;
  sortOrder: number;
}): Promise<void> {
  await db.insert(versePackItems).values(item);
}

// ─── Backup / Restore ────────────────────────────────────────────────────────

export interface BackupData {
  app: 'memoryVerse';
  schemaVersion: 1;
  exportedAt: string;
  stats: {
    streak: number;
    longestStreak: number;
    lastReviewDate: string | null;
    dailyGoal: number;
    passThreshold: number;
  };
  verses: Array<{
    book: string;
    chapter: number;
    verse: number;
    verseEnd: number | null;
    text: string;
    translation: string;
    interval: number;
    easeFactor: number;
    dueDate: string;
    repetitions: number;
    lastScore: number;
    addedAt: string;
  }>;
  sessions: Array<{ date: string; versesReviewed: number }>;
}

/**
 * Serialize the user's progress (library, SRS state, stats, activity).
 * Verse text is embedded so a backup restores even on an install whose
 * bundled data differs. No transcripts or audio are ever stored.
 */
export async function exportBackup(): Promise<BackupData> {
  const stats = await getUserStats();
  const library = await getAllUserVerses();
  const allSessions = await db
    .select({ date: sessions.date, versesReviewed: sessions.versesReviewed })
    .from(sessions)
    .orderBy(sessions.date)
    .all();

  return {
    app: 'memoryVerse',
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    stats: {
      streak: stats.streak,
      longestStreak: stats.longestStreak,
      lastReviewDate: stats.lastReviewDate,
      dailyGoal: stats.dailyGoal,
      passThreshold: stats.passThreshold,
    },
    verses: library.map((uv) => ({
      book: uv.book,
      chapter: uv.chapter,
      verse: uv.verse,
      verseEnd: uv.verseEnd,
      text: uv.text,
      translation: uv.translation,
      interval: uv.interval,
      easeFactor: uv.easeFactor,
      dueDate: uv.dueDate,
      repetitions: uv.repetitions,
      lastScore: uv.lastScore,
      addedAt: uv.addedAt,
    })),
    sessions: allSessions,
  };
}

/**
 * Merge a backup into the current database:
 * - Verses are matched by reference + translation (created if missing);
 *   the backup's SRS state replaces any existing progress on the same verse.
 * - Session history merges by date, keeping the higher count.
 * - Streak comes from whichever side reviewed most recently.
 * Returns the number of verses restored.
 */
export async function importBackup(data: BackupData): Promise<number> {
  let imported = 0;

  for (const v of data.verses) {
    const verseId = await upsertVerseWithRange({
      book: v.book,
      chapter: v.chapter,
      verse: v.verse,
      verseEnd: v.verseEnd ?? null,
      text: v.text,
      translation: v.translation,
    });

    const srsState = {
      interval: v.interval,
      easeFactor: v.easeFactor,
      dueDate: v.dueDate,
      repetitions: v.repetitions,
      lastScore: v.lastScore,
      addedAt: v.addedAt,
    };

    const existing = await db
      .select({ id: userVerses.id })
      .from(userVerses)
      .where(eq(userVerses.verseId, verseId))
      .get();

    if (existing) {
      await db.update(userVerses).set(srsState).where(eq(userVerses.id, existing.id));
    } else {
      await db.insert(userVerses).values({ verseId, ...srsState });
    }
    imported++;
  }

  for (const s of data.sessions) {
    const existing = await db
      .select()
      .from(sessions)
      .where(eq(sessions.date, s.date))
      .get();
    if (existing) {
      if (s.versesReviewed > existing.versesReviewed) {
        await db
          .update(sessions)
          .set({ versesReviewed: s.versesReviewed })
          .where(eq(sessions.date, s.date));
      }
    } else {
      await db.insert(sessions).values({
        date: s.date,
        versesReviewed: s.versesReviewed,
        createdAt: new Date().toISOString(),
      });
    }
  }

  const current = await getUserStats();
  const importedDate = data.stats.lastReviewDate ?? '';
  const currentDate = current.lastReviewDate ?? '';
  const streak =
    importedDate === currentDate
      ? Math.max(current.streak, data.stats.streak)
      : importedDate > currentDate
        ? data.stats.streak
        : current.streak;

  const libraryCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(userVerses)
    .get();

  await db
    .update(userStats)
    .set({
      versesLearned: libraryCount?.count ?? 0,
      streak,
      longestStreak: Math.max(current.longestStreak, data.stats.longestStreak),
      lastReviewDate: importedDate > currentDate ? importedDate : current.lastReviewDate,
      dailyGoal: data.stats.dailyGoal,
      passThreshold: data.stats.passThreshold,
    })
    .where(eq(userStats.id, 1));

  return imported;
}
