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
  cachedChapterIds?: string[];
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
  /** The site's base address. A source has exactly one. */
  baseUrl: string;
  publishUrl?: string; // e.g. address publish page
}

export interface HomeBookItem {
  id: string;
  title: string;
  author?: string;
  cover?: string;
  intro?: string;
  category?: string;
  status?: string;
  wordCount?: string;
  latestChapter?: string;
  updateTime?: string;
  tags?: string[];
  rank?: number;
}

export interface HomeTab {
  key: string;
  label: string;
  items: HomeBookItem[];
}

export interface HomeColumn {
  title: string;
  items: HomeBookItem[];
}

export interface HomeSection {
  id: string;
  title: string;
  type: 'banner' | 'grid' | 'ranking' | 'list' | 'tabs';
  moreUrl?: string;
  items?: HomeBookItem[];
  tabs?: HomeTab[];
  columns?: HomeColumn[];
}

export interface BookSource {
  meta: SourceMeta;
  search(keyword: string): Promise<SearchResult[]>;
  getDetail(bookId: string): Promise<BookDetail>;
  getChapter(bookId: string, chapterId: string): Promise<ChapterContent>;
  getHome?(): Promise<HomeSection[]>;
}
