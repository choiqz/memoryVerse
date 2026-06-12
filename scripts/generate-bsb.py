"""
Generate assets/bible/bsb.json (Berean Standard Bible, public domain) by
fetching verse text from the free BSB API at bible.helloao.org.

Reads the verse references from assets/bible/kjv.json (the curated 185-verse
list) and assets/packs/youth-group.json, fetches the BSB text for each, and
writes:
  - assets/bible/bsb.json          (replaces kjv.json as the bundled data)
  - assets/packs/youth-group.json  (text replaced with BSB, translation: BSB)

Run from the project root:  python scripts/generate-bsb.py
"""
import json
import os
import sys
import urllib.request

API_BASE = "https://bible.helloao.org/api/BSB"

# App book names -> USFM book IDs used by the API
BOOK_IDS = {
    "Genesis": "GEN", "Exodus": "EXO", "Leviticus": "LEV", "Numbers": "NUM",
    "Deuteronomy": "DEU", "Joshua": "JOS", "Judges": "JDG", "Ruth": "RUT",
    "1 Samuel": "1SA", "2 Samuel": "2SA", "1 Kings": "1KI", "2 Kings": "2KI",
    "1 Chronicles": "1CH", "2 Chronicles": "2CH", "Ezra": "EZR",
    "Nehemiah": "NEH", "Esther": "EST", "Job": "JOB", "Psalms": "PSA",
    "Proverbs": "PRO", "Ecclesiastes": "ECC", "Song of Solomon": "SNG",
    "Isaiah": "ISA", "Jeremiah": "JER", "Lamentations": "LAM",
    "Ezekiel": "EZK", "Daniel": "DAN", "Hosea": "HOS", "Joel": "JOL",
    "Amos": "AMO", "Obadiah": "OBA", "Jonah": "JON", "Micah": "MIC",
    "Nahum": "NAM", "Habakkuk": "HAB", "Zephaniah": "ZEP", "Haggai": "HAG",
    "Zechariah": "ZEC", "Malachi": "MAL",
    "Matthew": "MAT", "Mark": "MRK", "Luke": "LUK", "John": "JHN",
    "Acts": "ACT", "Romans": "ROM", "1 Corinthians": "1CO",
    "2 Corinthians": "2CO", "Galatians": "GAL", "Ephesians": "EPH",
    "Philippians": "PHP", "Colossians": "COL", "1 Thessalonians": "1TH",
    "2 Thessalonians": "2TH", "1 Timothy": "1TI", "2 Timothy": "2TI",
    "Titus": "TIT", "Philemon": "PHM", "Hebrews": "HEB", "James": "JAS",
    "1 Peter": "1PE", "2 Peter": "2PE", "1 John": "1JN", "2 John": "2JN",
    "3 John": "3JN", "Jude": "JUD", "Revelation": "REV",
}

_chapter_cache = {}


def fetch_chapter(book, chapter):
    """Fetch a chapter's verses from the API. Returns {verse_number: text}."""
    key = (book, chapter)
    if key in _chapter_cache:
        return _chapter_cache[key]

    url = f"{API_BASE}/{BOOK_IDS[book]}/{chapter}.json"
    with urllib.request.urlopen(url, timeout=30) as resp:
        data = json.load(resp)

    verses = {}
    for item in data["chapter"]["content"]:
        if item.get("type") != "verse":
            continue
        parts = []
        for part in item.get("content", []):
            if isinstance(part, str):
                parts.append(part)
            elif isinstance(part, dict) and "text" in part:
                # Poem lines / words of Jesus etc. — keep the text, skip footnotes
                parts.append(part["text"])
        text = " ".join(p.strip() for p in parts if p.strip())
        verses[item["number"]] = " ".join(text.split())

    _chapter_cache[key] = verses
    return verses


def get_text(book, chapter, verse, verse_end=None):
    chapter_verses = fetch_chapter(book, chapter)
    last = verse_end or verse
    out = []
    for v in range(verse, last + 1):
        if v not in chapter_verses:
            sys.exit(f"ERROR: {book} {chapter}:{v} not found in BSB API response")
        out.append(chapter_verses[v])
    return " ".join(out)


def main():
    # 1. Bundled verse list (re-fetch each reference in BSB)
    with open(os.path.join("assets", "bible", "kjv.json"), encoding="utf-8") as f:
        refs = json.load(f)

    bsb = []
    for r in refs:
        text = get_text(r["book"], r["chapter"], r["verse"])
        bsb.append({
            "book": r["book"],
            "chapter": r["chapter"],
            "verse": r["verse"],
            "text": text,
        })
        print(f'{r["book"]} {r["chapter"]}:{r["verse"]} -> {text[:60]}...')

    with open(os.path.join("assets", "bible", "bsb.json"), "w", encoding="utf-8") as f:
        json.dump(bsb, f, ensure_ascii=False, indent=2)
    print(f"\nWritten {len(bsb)} verses to assets/bible/bsb.json")

    # 2. Verse pack (replace text with BSB)
    pack_path = os.path.join("assets", "packs", "youth-group.json")
    with open(pack_path, encoding="utf-8") as f:
        pack = json.load(f)

    pack["translation"] = "BSB"
    for v in pack["verses"]:
        v["text"] = get_text(v["book"], v["chapter"], v["verse"], v.get("verse_end"))

    with open(pack_path, "w", encoding="utf-8") as f:
        json.dump(pack, f, ensure_ascii=False, indent=2)
    print(f"Updated {len(pack['verses'])} pack verses to BSB in {pack_path}")


if __name__ == "__main__":
    main()
