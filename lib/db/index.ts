import * as SQLite from 'expo-sqlite';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import { eq, lte, sql, and } from 'drizzle-orm';
import { verses, userVerses, sessions, userStats } from './schema';
import type { Verse, UserVerse, UserStats } from './schema';
import { sm2, initialCard, isDue, similarityToQuality, calculateXP } from '../srs';

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
      text TEXT NOT NULL,
      translation TEXT NOT NULL DEFAULT 'KJV'
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
      xp_earned INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_stats (
      id INTEGER PRIMARY KEY DEFAULT 1,
      streak INTEGER NOT NULL DEFAULT 0,
      longest_streak INTEGER NOT NULL DEFAULT 0,
      total_xp INTEGER NOT NULL DEFAULT 0,
      verses_learned INTEGER NOT NULL DEFAULT 0,
      last_review_date TEXT,
      daily_goal INTEGER NOT NULL DEFAULT 10,
      pass_threshold INTEGER NOT NULL DEFAULT 85,
      translation TEXT NOT NULL DEFAULT 'KJV'
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_verses_ref
      ON verses(book, chapter, verse, translation);

    CREATE INDEX IF NOT EXISTS idx_user_verses_due
      ON user_verses(due_date);

    -- Seed user_stats row if missing
    INSERT OR IGNORE INTO user_stats (id) VALUES (1);
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
      translation: v.translation ?? 'KJV',
    }).onConflictDoNothing();
  }
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
      text: verses.text,
      translation: verses.translation,
    })
    .from(userVerses)
    .innerJoin(verses, eq(userVerses.verseId, verses.id))
    .where(lte(userVerses.dueDate, today))
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
      text: verses.text,
      translation: verses.translation,
    })
    .from(userVerses)
    .innerJoin(verses, eq(userVerses.verseId, verses.id))
    .all();

  return rows as Array<UserVerse & Verse>;
}

// ─── Review / SRS Update ─────────────────────────────────────────────────────

/**
 * Record a review result: update SRS state, award XP, update streak.
 */
export async function recordReview(
  userVerseId: number,
  similarityScore: number,  // 0–100
): Promise<{ xpEarned: number; quality: number }> {
  const uv = await db
    .select()
    .from(userVerses)
    .where(eq(userVerses.id, userVerseId))
    .get();

  if (!uv) throw new Error(`UserVerse ${userVerseId} not found`);

  const quality = similarityToQuality(similarityScore);
  const xpEarned = calculateXP(quality);

  const result = sm2(quality, {
    interval: uv.interval,
    easeFactor: uv.easeFactor,
    repetitions: uv.repetitions,
    dueDate: uv.dueDate,
  });

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

  // Update user stats: XP and streak
  await updateStreakAndXP(xpEarned);

  // Log to today's session
  await logSessionReview(xpEarned);

  return { xpEarned, quality };
}

async function updateStreakAndXP(xpEarned: number): Promise<void> {
  const stats = await getUserStats();
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  let newStreak = stats.streak;
  if (stats.lastReviewDate === today) {
    // Already reviewed today, streak unchanged
  } else if (stats.lastReviewDate === yesterday) {
    // Consecutive day: extend streak
    newStreak = stats.streak + 1;
  } else {
    // Streak broken (or first ever review)
    newStreak = 1;
  }

  await db
    .update(userStats)
    .set({
      totalXP: sql`${userStats.totalXP} + ${xpEarned}`,
      streak: newStreak,
      longestStreak: sql`MAX(${userStats.longestStreak}, ${newStreak})`,
      lastReviewDate: today,
    })
    .where(eq(userStats.id, 1));
}

async function logSessionReview(xpEarned: number): Promise<void> {
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
        xpEarned: sql`${sessions.xpEarned} + ${xpEarned}`,
      })
      .where(eq(sessions.date, today));
  } else {
    await db.insert(sessions).values({
      date: today,
      versesReviewed: 1,
      xpEarned,
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

export async function getRecentSessions(days = 30): Promise<Array<{ date: string; versesReviewed: number; xpEarned: number }>> {
  const cutoff = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];
  return db
    .select({ date: sessions.date, versesReviewed: sessions.versesReviewed, xpEarned: sessions.xpEarned })
    .from(sessions)
    .where(sql`${sessions.date} >= ${cutoff}`)
    .orderBy(sessions.date)
    .all();
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
