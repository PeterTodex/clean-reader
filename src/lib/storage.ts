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

export interface HistoryItem {
  id: string;
  title: string;
  author: string;
  cover: string;
  sourceId: string;
  lastChapterId: string;
  lastChapterTitle: string;
  lastReadTime: number;
  progressPercent?: number;
  totalChapters?: number;
}

export interface ReaderSettings {
  theme: 'white' | 'parchment' | 'eyecare' | 'apricot' | 'navy' | 'dark';
  fontSize: number;
  lineHeight: number;
  fontFamily: 'serif' | 'sans' | 'kaiti';
  maxWidth: number;
  readingMode: 'scroll' | 'page';
  autoPreloadNext: boolean;
}

export const DEFAULT_READER_SETTINGS: ReaderSettings = {
  theme: 'white',
  fontSize: 16,
  lineHeight: 1.85,
  fontFamily: 'serif',
  maxWidth: 820,
  readingMode: 'scroll',
  autoPreloadNext: true,
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
  HISTORY: 'clean_reader_history',
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

  getHistory(): HistoryItem[] {
    if (typeof window === 'undefined') return [];
    try {
      const data = localStorage.getItem(STORAGE_KEYS.HISTORY);
      const list: HistoryItem[] = data ? JSON.parse(data) : [];
      return list.sort((a, b) => b.lastReadTime - a.lastReadTime);
    } catch {
      return [];
    }
  },

  saveToHistory(item: Omit<HistoryItem, 'lastReadTime'>): void {
    if (typeof window === 'undefined') return;
    try {
      const history = storage.getHistory().filter(
        (h) => !(h.id === item.id && h.sourceId === item.sourceId)
      );
      const newItem: HistoryItem = {
        ...item,
        lastReadTime: Date.now(),
      };
      history.unshift(newItem);
      if (history.length > 200) history.length = 200;
      localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(history));

      // If the book is ALREADY on the bookshelf, keep bookshelf reading progress in sync!
      if (storage.isInBookshelf(item.id, item.sourceId)) {
        storage.updateReadingProgress(
          item.id,
          item.sourceId,
          item.lastChapterId,
          item.lastChapterTitle,
          item.progressPercent
        );
      }
    } catch (e) {
      console.error('Failed to save reading history:', e);
    }
  },

  removeFromHistory(bookId: string, sourceId: string): void {
    if (typeof window === 'undefined') return;
    try {
      const history = storage.getHistory().filter(
        (h) => !(h.id === bookId && h.sourceId === sourceId)
      );
      localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(history));
    } catch (e) {
      console.error('Failed to remove from history:', e);
    }
  },

  clearHistory(): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.removeItem(STORAGE_KEYS.HISTORY);
    } catch (e) {
      console.error('Failed to clear history:', e);
    }
  },

  getSettings(): ReaderSettings {
    if (typeof window === 'undefined') return DEFAULT_READER_SETTINGS;
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (!data) return DEFAULT_READER_SETTINGS;
      const parsed = JSON.parse(data);
      if (parsed.theme === 'oled') parsed.theme = 'dark';
      if (parsed.theme === 'eink') parsed.theme = 'white';
      return { ...DEFAULT_READER_SETTINGS, ...parsed };
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
      if (settings.theme) {
        let activeTheme = settings.theme as string;
        if (activeTheme === 'oled') activeTheme = 'dark';
        if (activeTheme === 'eink') activeTheme = 'white';
        const root = document.documentElement;
        const allThemes = ['white', 'dark', 'navy', 'apricot', 'parchment', 'eyecare', 'oled', 'eink'];
        allThemes.forEach((t) => root.classList.remove(`theme-${t}`));
        root.classList.add(`theme-${activeTheme}`);
        if (activeTheme === 'dark' || activeTheme === 'navy') {
          root.classList.add('dark');
        } else {
          root.classList.remove('dark');
        }
        window.dispatchEvent(new CustomEvent('clean-reader-theme-change', { detail: activeTheme }));
      }
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
