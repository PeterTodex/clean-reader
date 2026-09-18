export interface BookshelfItem {
  id: string;
  title: string;
  author: string;
  cover: string;
  sourceId: string;
  lastChapterId?: string;
  lastChapterTitle?: string;
  lastReadTime: number;
  progressPercent?: number;
  totalChapters?: number;
}

export interface ReaderSettings {
  theme: 'parchment' | 'eyecare' | 'white' | 'eink' | 'dark' | 'oled';
  fontSize: number;
  lineHeight: number;
  fontFamily: 'serif' | 'sans' | 'kaiti';
  maxWidth: number;
  readingMode: 'scroll' | 'page';
  autoPreloadNext: boolean;
  selectedMirror?: string;
}

export const DEFAULT_READER_SETTINGS: ReaderSettings = {
  theme: 'white',
  fontSize: 20,
  lineHeight: 1.85,
  fontFamily: 'serif',
  maxWidth: 820,
  readingMode: 'scroll',
  autoPreloadNext: true,
  selectedMirror: '',
};

export interface BookmarkItem {
  id: string;
  bookId: string;
  sourceId: string;
  chapterId: string;
  chapterTitle: string;
  excerpt: string;
  createTime: number;
}

const STORAGE_KEYS = {
  BOOKSHELF: 'clean_reader_bookshelf',
  SETTINGS: 'clean_reader_settings',
  ACTIVE_SOURCE: 'clean_reader_source',
  BOOKMARKS: 'clean_reader_bookmarks',
};

export const storage = {
  getBookshelf(): BookshelfItem[] {
    if (typeof window === 'undefined') return [];
    try {
      const data = localStorage.getItem(STORAGE_KEYS.BOOKSHELF);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  saveToBookshelf(item: Omit<BookshelfItem, 'lastReadTime'>): void {
    if (typeof window === 'undefined') return;
    const shelf = storage.getBookshelf();
    const existingIndex = shelf.findIndex((b) => b.id === item.id && b.sourceId === item.sourceId);
    
    const newItem: BookshelfItem = {
      ...item,
      lastReadTime: Date.now(),
    };

    if (existingIndex >= 0) {
      shelf[existingIndex] = { ...shelf[existingIndex], ...newItem };
    } else {
      shelf.unshift(newItem);
    }

    try {
      localStorage.setItem(STORAGE_KEYS.BOOKSHELF, JSON.stringify(shelf));
    } catch (e) {
      console.error('Failed to save bookshelf:', e);
    }
  },

  updateReadingProgress(
    bookId: string,
    sourceId: string,
    chapterId: string,
    chapterTitle: string,
    progressPercent?: number
  ): void {
    if (typeof window === 'undefined') return;
    const shelf = storage.getBookshelf();
    const existingIndex = shelf.findIndex((b) => b.id === bookId && b.sourceId === sourceId);
    if (existingIndex >= 0) {
      shelf[existingIndex] = {
        ...shelf[existingIndex],
        lastChapterId: chapterId,
        lastChapterTitle: chapterTitle,
        lastReadTime: Date.now(),
        ...(progressPercent !== undefined ? { progressPercent } : {}),
      };
      localStorage.setItem(STORAGE_KEYS.BOOKSHELF, JSON.stringify(shelf));
    }
  },

  removeFromBookshelf(bookId: string, sourceId: string): void {
    if (typeof window === 'undefined') return;
    const shelf = storage.getBookshelf().filter((b) => !(b.id === bookId && b.sourceId === sourceId));
    localStorage.setItem(STORAGE_KEYS.BOOKSHELF, JSON.stringify(shelf));
  },

  isInBookshelf(bookId: string, sourceId: string): boolean {
    if (typeof window === 'undefined') return false;
    return storage.getBookshelf().some((b) => b.id === bookId && b.sourceId === sourceId);
  },

  getSettings(): ReaderSettings {
    if (typeof window === 'undefined') return DEFAULT_READER_SETTINGS;
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      return data ? { ...DEFAULT_READER_SETTINGS, ...JSON.parse(data) } : DEFAULT_READER_SETTINGS;
    } catch {
      return DEFAULT_READER_SETTINGS;
    }
  },

  saveSettings(settings: Partial<ReaderSettings>): ReaderSettings {
    if (typeof window === 'undefined') return DEFAULT_READER_SETTINGS;
    const current = storage.getSettings();
    const updated = { ...current, ...settings };
    try {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to save settings:', e);
    }
    return updated;
  },

  getBookmarks(bookId?: string): BookmarkItem[] {
    if (typeof window === 'undefined') return [];
    try {
      const data = localStorage.getItem(STORAGE_KEYS.BOOKMARKS);
      const list: BookmarkItem[] = data ? JSON.parse(data) : [];
      if (bookId) {
        return list.filter((b) => b.bookId === bookId);
      }
      return list;
    } catch {
      return [];
    }
  },

  addBookmark(item: Omit<BookmarkItem, 'id' | 'createTime'> & { id?: string; createTime?: number }): BookmarkItem {
    const newItem: BookmarkItem = {
      id: item.id || `bm_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      createTime: item.createTime || Date.now(),
      ...item,
    };
    if (typeof window === 'undefined') return newItem;
    try {
      const bookmarks = storage.getBookmarks();
      const existingIndex = bookmarks.findIndex(
        (b) => b.id === newItem.id || (b.bookId === newItem.bookId && b.chapterId === newItem.chapterId)
      );
      if (existingIndex >= 0) {
        bookmarks[existingIndex] = newItem;
      } else {
        bookmarks.unshift(newItem);
      }
      localStorage.setItem(STORAGE_KEYS.BOOKMARKS, JSON.stringify(bookmarks));
    } catch (e) {
      console.error('Failed to save bookmark:', e);
    }
    return newItem;
  },

  removeBookmark(id: string): void {
    if (typeof window === 'undefined') return;
    try {
      const bookmarks = storage.getBookmarks().filter((b) => b.id !== id);
      localStorage.setItem(STORAGE_KEYS.BOOKMARKS, JSON.stringify(bookmarks));
    } catch (e) {
      console.error('Failed to remove bookmark:', e);
    }
  },
};
