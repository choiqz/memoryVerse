# memoryVerse

A cross-platform iOS/Android app for memorizing Bible verses through microphone dictation, spaced repetition, and gamified UX.

## Features

- **Voice recitation** — Native iOS SpeechRecognizer / Android SpeechRecognizer (via `expo-speech-recognition`)
- **First-letter hints** — Tap any letter to reveal the full word (with XP penalty)
- **Spaced repetition** — SM-2 algorithm (same as Anki) schedules reviews automatically
- **Gamification** — XP, daily streaks, 4 mastery levels (Seedling → Deep-Rooted)
- **Offline-first** — All data stored locally in SQLite via Drizzle ORM
- **185 KJV verses** bundled across 17 books (popular memorization passages)

## Getting Started

```bash
npm install
npx expo start
```

Run on a **real device** for speech recognition (simulator mic is unreliable).

## Project Structure

```
app/              # expo-router screens
  index.tsx       # Home: streak, XP, review CTA
  review.tsx      # Active review session with mic
  add.tsx         # Browse/search KJV verses to add
  progress.tsx    # Activity heatmap, mastery breakdown
  settings.tsx    # Pass threshold, daily goal
lib/
  srs.ts          # SM-2 spaced repetition algorithm
  similarity.ts   # Word-by-word fuzzy text scoring
  speech.ts       # expo-speech-recognition wrapper
  bible.ts        # Bible data loader & seeder
  db/
    schema.ts     # Drizzle ORM schema
    index.ts      # All DB queries
constants/
  Colors.ts       # App color theme
assets/
  bible/
    kjv.json      # 185 KJV verses (bundled)
scripts/
  generate-kjv.py # Regenerate/expand the KJV dataset
```

## Adding More Bible Data

The `assets/bible/kjv.json` currently contains 185 popular memorization verses. To add more:

1. Edit `scripts/generate-kjv.py` to include additional verses
2. Run `python3 scripts/generate-kjv.py` from the project root
3. Restart the app — new verses appear automatically in the Add screen

For the full KJV (31K verses), download from [openscriptures/morphhb](https://github.com/openscriptures/morphhb) or similar public domain sources and convert to the same JSON format: `[{"book", "chapter", "verse", "text"}, ...]`

## Scoring & SM-2

| Similarity | Quality | Next review |
|-----------|---------|-------------|
| ≥95% | 5 (perfect) | Multiplied by ease factor |
| 85–94% | 4 (good) | Multiplied by ease factor |
| 70–84% | 3 (okay) | Multiplied by ease factor |
| 50–69% | 2 (hard) | Interval reset to 1 day |
| <50% | 0–1 (failed) | Re-queued immediately |

A verse reviewed perfectly ~5 times will reach a 21+ day interval.

## Testing

- Test speech recognition on a **real device** — simulator mic is unreliable
- KJV archaic words (thee, thou, hath) are normalized before scoring
- Verify streak resets at midnight by changing `lastReviewDate` in SQLite
