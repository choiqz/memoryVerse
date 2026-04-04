import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

/**
 * All Bible verses available in the app (loaded from bundled JSON).
 */
export const verses = sqliteTable('verses', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  book: text('book').notNull(),
  chapter: integer('chapter').notNull(),
  verse: integer('verse').notNull(),
  verseEnd: integer('verse_end'),
  text: text('text').notNull(),
  translation: text('translation').notNull().default('KJV'),
});

/**
 * User's personal verse deck with spaced repetition state.
 */
export const userVerses = sqliteTable('user_verses', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  verseId: integer('verse_id').notNull().references(() => verses.id),
  interval: integer('interval').notNull().default(0),
  easeFactor: real('ease_factor').notNull().default(2.5),
  dueDate: text('due_date').notNull(),          // ISO date: YYYY-MM-DD
  repetitions: integer('repetitions').notNull().default(0),
  lastScore: integer('last_score').notNull().default(0), // 0–100
  addedAt: text('added_at').notNull(),
});

/**
 * Review sessions log.
 */
export const sessions = sqliteTable('sessions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  date: text('date').notNull(),                 // ISO date: YYYY-MM-DD
  versesReviewed: integer('verses_reviewed').notNull().default(0),
  xpEarned: integer('xp_earned').notNull().default(0),
  createdAt: text('created_at').notNull(),
});

/**
 * Single-row table for user stats and settings.
 */
export const userStats = sqliteTable('user_stats', {
  id: integer('id').primaryKey().default(1),
  streak: integer('streak').notNull().default(0),
  longestStreak: integer('longest_streak').notNull().default(0),
  totalXP: integer('total_xp').notNull().default(0),
  versesLearned: integer('verses_learned').notNull().default(0),
  lastReviewDate: text('last_review_date'),     // ISO date or null
  dailyGoal: integer('daily_goal').notNull().default(10),
  passThreshold: integer('pass_threshold').notNull().default(85), // 0–100
  translation: text('translation').notNull().default('KJV'),
});

/**
 * Curated verse packs (e.g., "Youth Group Memory Verses").
 */
export const versePacks = sqliteTable('verse_packs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  description: text('description'),
  icon: text('icon').notNull().default('book'),
  verseCount: integer('verse_count').notNull().default(0),
  translation: text('translation').notNull().default('ESV'),
  sortOrder: integer('sort_order').notNull().default(0),
});

/**
 * Links verses to packs.
 */
export const versePackItems = sqliteTable('verse_pack_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  packId: integer('pack_id').notNull().references(() => versePacks.id),
  verseId: integer('verse_id').notNull().references(() => verses.id),
  sortOrder: integer('sort_order').notNull().default(0),
});

export type Verse = typeof verses.$inferSelect;
export type NewVerse = typeof verses.$inferInsert;
export type UserVerse = typeof userVerses.$inferSelect;
export type NewUserVerse = typeof userVerses.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type UserStats = typeof userStats.$inferSelect;
export type VersePack = typeof versePacks.$inferSelect;
export type VersePackItem = typeof versePackItems.$inferSelect;
