import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  TextInput,
  SectionList,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors } from '../constants/Colors';
import { getAllBooks, getVersesByBook, getVersesByChapter, searchVerses, addVerseToLibrary, isVerseInLibrary } from '../lib/db';
import type { Verse } from '../lib/db/schema';
import { sortBooksByOrder, formatRef } from '../lib/bible';

type Mode = 'books' | 'chapters' | 'verses' | 'search';

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

  // Load books on mount
  useEffect(() => {
    getAllBooks().then((bks) => {
      setBooks(sortBooksByOrder(bks));
    });
  }, []);

  // Load library membership for visible verses
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
      Alert.alert('Already Added', `${formatRef(verse.book, verse.chapter, verse.verse)} is already in your library.`);
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
    <TouchableOpacity style={styles.listItem} onPress={() => selectBook(item)}>
      <Text style={styles.listItemText}>{item}</Text>
      <Ionicons name="chevron-forward" size={18} color={Colors.textLight} />
    </TouchableOpacity>
  );

  const renderChapterItem = ({ item }: { item: number }) => (
    <TouchableOpacity style={styles.chapterChip} onPress={() => selectChapter(item)}>
      <Text style={styles.chapterChipText}>{item}</Text>
    </TouchableOpacity>
  );

  const renderVerseItem = ({ item }: { item: Verse }) => {
    const inLibrary = libraryIds.has(item.id);
    return (
      <TouchableOpacity
        style={[styles.verseItem, inLibrary && styles.verseItemAdded]}
        onPress={() => toggleVerse(item)}
        accessibilityLabel={`${formatRef(item.book, item.chapter, item.verse)} — ${inLibrary ? 'in library' : 'tap to add'}`}
      >
        <View style={styles.verseContent}>
          <Text style={styles.verseRef}>v.{item.verse}</Text>
          <Text style={styles.verseText} numberOfLines={3}>{item.text}</Text>
        </View>
        <View style={[styles.verseAddBtn, inLibrary && styles.verseAddBtnAdded]}>
          <Ionicons
            name={inLibrary ? 'checkmark' : 'add'}
            size={20}
            color={inLibrary ? Colors.success : Colors.primary}
          />
        </View>
      </TouchableOpacity>
    );
  };

  const isSearchMode = mode === 'search' || searchQuery.length > 0;
  const displayVerses = isSearchMode ? searchResults : verses;

  return (
    <View style={styles.container}>
      {/* Search bar */}
      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color={Colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search verses..."
            placeholderTextColor={Colors.textLight}
            value={searchQuery}
            onChangeText={(text) => {
              handleSearch(text);
              if (text.length > 0) setMode('search');
              else if (mode === 'search') setMode('books');
            }}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => {
                setSearchQuery('');
                setSearchResults([]);
                setMode('books');
              }}
            >
              <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Breadcrumb */}
      {!isSearchMode && (mode === 'chapters' || mode === 'verses') && (
        <View style={styles.breadcrumb}>
          <TouchableOpacity onPress={goBack} style={styles.breadcrumbBack}>
            <Ionicons name="chevron-back" size={18} color={Colors.primary} />
          </TouchableOpacity>
          <Text style={styles.breadcrumbText}>
            {selectedBook}{selectedChapter ? ` · Chapter ${selectedChapter}` : ''}
          </Text>
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
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No Bible data loaded.</Text>
              <Text style={styles.emptySubtext}>Make sure kjv.json is in assets/bible/</Text>
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
                <Text style={styles.emptyText}>
                  {isSearchMode ? 'No results found.' : 'No verses in this chapter.'}
                </Text>
              </View>
            ) : null
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  searchRow: {
    padding: 16,
    paddingBottom: 8,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.divider,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: Colors.text,
  },
  breadcrumb: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 4,
  },
  breadcrumbBack: {
    padding: 4,
  },
  breadcrumbText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
  },
  loadingRow: {
    padding: 16,
    alignItems: 'center',
  },
  list: {
    flex: 1,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: Colors.surface,
  },
  listItemText: {
    flex: 1,
    fontSize: 16,
    color: Colors.text,
    fontWeight: '500',
  },
  separator: {
    height: 1,
    backgroundColor: Colors.divider,
    marginLeft: 20,
  },
  chaptersGrid: {
    padding: 16,
    gap: 8,
  },
  chapterChip: {
    flex: 1,
    margin: 4,
    aspectRatio: 1,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: 64,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 4,
    elevation: 1,
  },
  chapterChipText: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.primary,
  },
  verseItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: Colors.surface,
    gap: 12,
  },
  verseItemAdded: {
    backgroundColor: Colors.successLight,
  },
  verseContent: {
    flex: 1,
    gap: 4,
  },
  verseRef: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  verseText: {
    fontSize: 14,
    color: Colors.text,
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
    gap: 8,
  },
  emptyText: {
    fontSize: 16,
    color: Colors.textMuted,
    fontWeight: '500',
  },
  emptySubtext: {
    fontSize: 13,
    color: Colors.textLight,
    textAlign: 'center',
  },
});
