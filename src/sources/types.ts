export interface SearchResult {
  id: string;
  title: string;
  author: string;
  cover: string;
  latestChapter?: string;
  updateTime?: string;
  intro?: string;
  sourceId: string;
}

export interface ChapterItem {
  id: string;
  title: string;
  index: number;
}

export interface BookDetail {
  id: string;
  title: string;
  author: string;
  cover: string;
  category?: string;
  status?: string;
  wordCount?: string;
  latestChapter?: string;
  updateTime?: string;
  intro: string;
  chapters: ChapterItem[];
  sourceId: string;
}

export interface ChapterContent {
  id: string;
  bookId: string;
  title: string;
  content: string; // Clean HTML content with formatted paragraphs
  paragraphs: string[];
  nextChapterId: string | null;
  prevChapterId: string | null;
  sourceId: string;
}

export interface SourceMeta {
  id: string;
  name: string;
  description: string;
  version: string;
  defaultMirror: string;
  mirrors: string[];
  publishUrl?: string; // e.g. address publish page
}

export interface BookSource {
  meta: SourceMeta;
  search(keyword: string, customMirror?: string): Promise<SearchResult[]>;
  getDetail(bookId: string, customMirror?: string): Promise<BookDetail>;
  getChapter(bookId: string, chapterId: string, customMirror?: string): Promise<ChapterContent>;
}
