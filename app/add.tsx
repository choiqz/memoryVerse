import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Pressable,
  FlatList,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors } from '../constants/Colors';
import { Fonts, Spacing, Radii, Shadows } from '../constants/Theme';
import { Title, Body, Caption, Overline } from '../components/Typography';
import { getAllBooks, getVersesByBook, getVersesByChapter, searchVerses, addVerseToLibrary, isVerseInLibrary, getVersePacks, getPackAddedCount, addPackToLibrary } from '../lib/db';
import type { Verse, VersePack } from '../lib/db/schema';
import { sortBooksByOrder, formatRef } from '../lib/bible';
import { Card } from '../components/Card';
import { IconBadge } from '../components/IconBadge';
import { Button } from '../components/Button';

type Mode = 'books' | 'chapters' | 'verses' | 'search';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function AddScreen() {
  const [mode, setMode] = useState<Mode>('books');
  const [books, setBooks] = useState<string[]>([]);
  const [selectedBook, setSelectedBook] = useState<string | null>(null);
  const [chapters, setChapters] = useState<number[]>([]);
  const [selectedChapter, setSelectedChapter] = useState<number | null>(null);
  const [verses, setVerses] = useState<Verse[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Verse[]>([]);
  const [libraryIds, setLibraryIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [packs, setPacks] = useState<VersePack[]>([]);
  const [packAddedCounts, setPackAddedCounts] = useState<Map<number, number>>(new Map());

  useEffect(() => {
    getAllBooks().then((bks) => {
      setBooks(sortBooksByOrder(bks));
    });
    getVersePacks().then(async (p) => {
      setPacks(p);
      const counts = new Map<number, number>();
      for (const pack of p) {
        counts.set(pack.id, await getPackAddedCount(pack.id));
      }
      setPackAddedCounts(counts);
    });
  }, []);

  useEffect(() => {
    const verseList = mode === 'search' ? searchResults : verses;
    if (verseList.length === 0) return;

    Promise.all(verseList.map((v) => isVerseInLibrary(v.id).then((inLib) => ({ id: v.id, inLib })))).then(
      (results) => {
        const ids = new Set<number>();
        results.forEach(({ id, inLib }) => { if (inLib) ids.add(id); });
        setLibraryIds(ids);
      },
    );
  }, [verses, searchResults, mode]);

  const selectBook = useCallback(async (book: string) => {
    setSelectedBook(book);
    setLoading(true);
    const bookVerses = await getVersesByBook(book);
    const uniqueChapters = [...new Set(bookVerses.map((v) => v.chapter))].sort((a, b) => a - b);
    setChapters(uniqueChapters);
    setMode('chapters');
    setLoading(false);
  }, []);

  const selectChapter = useCallback(async (chapter: number) => {
    if (!selectedBook) return;
    setSelectedChapter(chapter);
    setLoading(true);
    const chapterVerses = await getVersesByChapter(selectedBook, chapter);
    setVerses(chapterVerses);
    setMode('verses');
    setLoading(false);
  }, [selectedBook]);

  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query);
    if (query.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    setLoading(true);
    const results = await searchVerses(query.trim());
    setSearchResults(results);
    setLoading(false);
  }, []);

  const toggleVerse = useCallback(async (verse: Verse) => {
    if (libraryIds.has(verse.id)) {
      Alert.alert('Already Added', `${formatRef(verse.book, verse.chapter, verse.verse, verse.verseEnd)} is already in your library.`);
      return;
    }
    await addVerseToLibrary(verse.id);
    setLibraryIds((prev) => new Set([...prev, verse.id]));
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [libraryIds]);

  const goBack = useCallback(() => {
    if (mode === 'verses') {
      setMode('chapters');
      setVerses([]);
    } else if (mode === 'chapters') {
      setMode('books');
      setSelectedBook(null);
      setChapters([]);
    }
  }, [mode]);

  const renderBookItem = ({ item }: { item: string }) => (
    <Pressable style={styles.listItem} onPress={() => selectBook(item)}>
      <Body style={styles.listItemText}>{item}</Body>
      <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
    </Pressable>
  );

  const renderChapterItem = ({ item }: { item: number }) => (
    <Pressable style={styles.chapterChip} onPress={() => selectChapter(item)}>
      <Title style={styles.chapterChipText}>{item}</Title>
    </Pressable>
  );

  const renderVerseItem = ({ item }: { item: Verse }) => {
    const inLibrary = libraryIds.has(item.id);
    return (
      <VerseRow verse={item} inLibrary={inLibrary} onPress={() => toggleVerse(item)} />
    );
  };

  const isSearchMode = mode === 'search' || searchQuery.length > 0;
  const displayVerses = isSearchMode ? searchResults : verses;

  return (
    <View style={styles.container}>
      {/* Search bar */}
      <View style={styles.searchRow}>
        <View style={[styles.searchBox, searchFocused && styles.searchBoxFocused]}>
          <Ionicons name="search" size={18} color={searchFocused ? Colors.primary : Colors.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search verses..."
            placeholderTextColor={Colors.textTertiary}
            value={searchQuery}
            onChangeText={(text) => {
              handleSearch(text);
              if (text.length > 0) setMode('search');
              else if (mode === 'search') setMode('books');
            }}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <Pressable
              onPress={() => {
                setSearchQuery('');
                setSearchResults([]);
                setMode('books');
              }}
              hitSlop={8}
            >
              <Ionicons name="close-circle" size={18} color={Colors.textSecondary} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Breadcrumb */}
      {!isSearchMode && (mode === 'chapters' || mode === 'verses') && (
        <View style={styles.breadcrumb}>
          <Pressable onPress={goBack} style={styles.breadcrumbBack} hitSlop={8}>
            <Ionicons name="chevron-back" size={18} color={Colors.primary} />
          </Pressable>
          <Caption style={{ color: Colors.text, fontFamily: Fonts.semiBold }}>
            {selectedBook}{selectedChapter ? ` \u00B7 Chapter ${selectedChapter}` : ''}
          </Caption>
        </View>
      )}

      {loading && (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={Colors.primary} />
        </View>
      )}

      {/* Books list */}
      {!isSearchMode && mode === 'books' && (
        <FlatList
          data={books}
          keyExtractor={(item) => item}
          renderItem={renderBookItem}
          style={styles.list}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListHeaderComponent={
            packs.length > 0 ? (
              <View style={styles.packsSection}>
                <Title style={styles.sectionTitle}>Verse Packs</Title>
                {packs.map((pack) => (
                  <PackCard
                    key={pack.id}
                    pack={pack}
                    addedCount={packAddedCounts.get(pack.id) ?? 0}
                    onAddAll={async () => {
                      const added = await addPackToLibrary(pack.id);
                      const newCount = await getPackAddedCount(pack.id);
                      setPackAddedCounts((prev) => new Map(prev).set(pack.id, newCount));
                      Alert.alert('Added!', `${added} verse${added !== 1 ? 's' : ''} added to your library.`);
                      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    }}
                  />
                ))}
                <Title style={styles.sectionTitle}>Browse by Book</Title>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Body color={Colors.textSecondary}>No Bible data loaded.</Body>
              <Caption>Make sure kjv.json is in assets/bible/</Caption>
            </View>
          }
        />
      )}

      {/* Chapters grid */}
      {!isSearchMode && mode === 'chapters' && (
        <FlatList
          data={chapters}
          keyExtractor={(item) => String(item)}
          renderItem={renderChapterItem}
          numColumns={5}
          style={styles.list}
          contentContainerStyle={styles.chaptersGrid}
        />
      )}

      {/* Verses list */}
      {(mode === 'verses' || isSearchMode) && (
        <FlatList
          data={displayVerses}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderVerseItem}
          style={styles.list}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={
            !loading ? (
              <View style={styles.emptyState}>
                <Body color={Colors.textSecondary}>
                  {isSearchMode ? 'No results found.' : 'No verses in this chapter.'}
                </Body>
              </View>
            ) : null
          }
        />
      )}
    </View>
  );
}

function PackCard({ pack, addedCount, onAddAll }: { pack: VersePack; addedCount: number; onAddAll: () => void }) {
  const allAdded = addedCount >= pack.verseCount;
  return (
    <Card style={styles.packCard}>
      <View style={styles.packHeader}>
        <IconBadge name={pack.icon as any} color={Colors.primary} size={18} />
        <View style={{ flex: 1, gap: 2 }}>
          <Title>{pack.name}</Title>
          {pack.description ? <Caption>{pack.description}</Caption> : null}
        </View>
      </View>
      <View style={styles.packFooter}>
        <Caption>{addedCount}/{pack.verseCount} in library  ·  {pack.translation}</Caption>
        <Button
          size="sm"
          variant={allAdded ? 'secondary' : 'primary'}
          onPress={onAddAll}
          disabled={allAdded}
        >
          {allAdded ? 'All Added' : 'Add All'}
        </Button>
      </View>
    </Card>
  );
}

function VerseRow({ verse, inLibrary, onPress }: { verse: Verse; inLibrary: boolean; onPress: () => void }) {
  const bounceScale = useSharedValue(1);
  const bounceStyle = useAnimatedStyle(() => ({
    transform: [{ scale: bounceScale.value }],
  }));

  const handlePress = useCallback(() => {
    if (!inLibrary) {
      bounceScale.value = withSequence(
        withSpring(1.2, { damping: 8 }),
        withSpring(1, { damping: 12 }),
      );
    }
    onPress();
  }, [inLibrary, onPress]);

  return (
    <Pressable
      style={[styles.verseItem, inLibrary && styles.verseItemAdded]}
      onPress={handlePress}
      accessibilityLabel={`${formatRef(verse.book, verse.chapter, verse.verse, verse.verseEnd)} — ${inLibrary ? 'in library' : 'tap to add'}`}
    >
      <View style={styles.verseContent}>
        <Overline style={{ color: Colors.primary }}>v.{verse.verse}</Overline>
        <Body style={styles.verseText} numberOfLines={3}>{verse.text}</Body>
      </View>
      <AnimatedPressable
        style={[styles.verseAddBtn, inLibrary && styles.verseAddBtnAdded, bounceStyle]}
        onPress={handlePress}
      >
        <Ionicons
          name={inLibrary ? 'checkmark' : 'add'}
          size={20}
          color={inLibrary ? Colors.success : Colors.primary}
        />
      </AnimatedPressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  searchRow: {
    padding: Spacing.lg,
    paddingBottom: Spacing.sm,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.divider,
    borderRadius: Radii.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    gap: Spacing.sm,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  searchBoxFocused: {
    borderColor: Colors.primary,
    backgroundColor: Colors.surface,
  },
  searchInput: {
    flex: 1,
    fontFamily: Fonts.regular,
    fontSize: 15,
    color: Colors.text,
  },
  breadcrumb: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: 10,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 4,
  },
  breadcrumbBack: {
    padding: 4,
  },
  loadingRow: {
    padding: Spacing.lg,
    alignItems: 'center',
  },
  list: {
    flex: 1,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
    backgroundColor: Colors.surface,
  },
  listItemText: {
    flex: 1,
  },
  separator: {
    height: 1,
    backgroundColor: Colors.divider,
    marginLeft: Spacing.xl,
  },
  chaptersGrid: {
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  chapterChip: {
    flex: 1,
    margin: 4,
    aspectRatio: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: 64,
    ...Shadows.sm,
  },
  chapterChipText: {
    color: Colors.primary,
  },
  verseItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: Spacing.lg,
    paddingVertical: 14,
    backgroundColor: Colors.surface,
    gap: Spacing.md,
  },
  verseItemAdded: {
    backgroundColor: Colors.successLight,
    borderLeftWidth: 3,
    borderLeftColor: Colors.success,
  },
  verseContent: {
    flex: 1,
    gap: 4,
  },
  verseText: {
    fontSize: 14,
    lineHeight: 20,
  },
  verseAddBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verseAddBtnAdded: {
    borderColor: Colors.success,
    backgroundColor: Colors.successLight,
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  packsSection: {
    paddingBottom: Spacing.sm,
  },
  sectionTitle: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    color: Colors.textSecondary,
  },
  packCard: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
    gap: Spacing.md,
  },
  packHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  packFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
