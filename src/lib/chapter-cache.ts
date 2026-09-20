import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, join } from 'node:path';
import type { ChapterContent, BookDetail, HomeSection } from '@/sources/types';

/**
 * File-based local library and chapter relay cache.
 *
 * Directory structure:
 *   .cache/books/
 *   ├── _home/
 *   │   └── [sourceId].json                       # Home sections cache
 *   └── [sourceId]/
 *       └── [safeTitle]_[bookId]/
 *           ├── meta.json                         # Book metadata (author, intro, cover, etc.)
 *           ├── toc.json                          # Table of contents index (id -> fileName mapping)
 *           └── chapters/
 *               ├── 0001_第一章 陨落的天才.txt
 *               ├── 0002_第二章 斗之气三段.txt
 *               └── ...
 *
 * Each chapter TXT file format:
 *   Line 1: Chapter title
 *   Lines 2..N: Paragraphs
 *
 * Server-only: imported in API route handlers on Node.js runtime.
 */

const MIN_TEXT_LENGTH = 100;
const MAX_IN_FLIGHT = 256;

function resolveStorageDir(): string {
  return process.env.CLEAN_READER_STORAGE_DIR || join(process.cwd(), '.cache', 'books');
}

const STORAGE_DIR = resolveStorageDir();

/**
 * Sanitize strings for safe filesystem directory and file names.
 * Replaces illegal characters (\ / : * ? " < > |), collapses whitespace,
 * and truncates to 80 chars to avoid ENAMETOOLONG on Linux ext4 (255 byte limit).
 */
export function sanitizePath(name: string): string {
  if (!name) return 'untitled';
  return (
    name
      .replace(/[\\/:*?"<>|]/g, '_')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 80) || 'untitled'
  );
}

/** In-memory cache mapping `${sourceId}::${bookId}` -> directory absolute path */
const bookDirCache = new Map<string, string>();

/** In-memory cache mapping `${sourceId}::${bookId}` -> TocData */
const tocCache = new Map<string, TocData>();

export interface TocChapterItem {
  id: string;
  index: number;
  title: string;
  fileName: string;
}

export interface TocData {
  updatedAt: number;
  chapters: TocChapterItem[];
}

export interface BookMetaFile {
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
  sourceId: string;
  cachedAt: number;
}

function getSourceDir(sourceId: string): string {
  return join(STORAGE_DIR, sanitizePath(sourceId));
}

/**
 * Locate the book folder inside the source directory.
 * Matches directory names ending with `_${bookId}` or strictly equal to `${bookId}`.
 */
function findBookDir(sourceId: string, bookId: string): string | null {
  const cacheKey = `${sourceId}::${bookId}`;
  const cached = bookDirCache.get(cacheKey);
  if (cached && existsSync(cached)) return cached;

  const sourceDir = getSourceDir(sourceId);
  if (!existsSync(sourceDir)) return null;

  try {
    const entries = readdirSync(sourceDir, { withFileTypes: true });
    const suffix = `_${bookId}`;
    for (const entry of entries) {
      if (entry.isDirectory() && (entry.name.endsWith(suffix) || entry.name === bookId)) {
        const fullPath = join(sourceDir, entry.name);
        bookDirCache.set(cacheKey, fullPath);
        return fullPath;
      }
    }
  } catch (err: any) {
    console.warn(`[chapter-cache] Failed to scan source directory ${sourceDir}:`, err?.message || err);
  }

  return null;
}

/**
 * Ensure the book directory exists and is registered in memory.
 * If title is available, names it `${safeTitle}_${bookId}`.
 */
function ensureBookDir(sourceId: string, bookId: string, title?: string): string {
  const existing = findBookDir(sourceId, bookId);
  if (existing) {
    if (title) {
      const dirName = basename(existing);
      const expectedName = `${sanitizePath(title)}_${bookId}`;
      if (dirName !== expectedName && (dirName === `book_${bookId}` || dirName === bookId)) {
        const newPath = join(getSourceDir(sourceId), expectedName);
        try {
          renameSync(existing, newPath);
          bookDirCache.set(`${sourceId}::${bookId}`, newPath);
          return newPath;
        } catch {
          // Continue using existing if rename fails
        }
      }
    }
    return existing;
  }

  const safeTitle = title ? sanitizePath(title) : `book_${bookId}`;
  const dirName = title ? `${safeTitle}_${bookId}` : `book_${bookId}`;
  const fullPath = join(getSourceDir(sourceId), dirName);
  mkdirSync(join(fullPath, 'chapters'), { recursive: true });
  bookDirCache.set(`${sourceId}::${bookId}`, fullPath);
  return fullPath;
}

/**
 * Atomic write helper: writes to a unique temporary file and renames it.
 * Guarantees zero half-written or corrupted files upon process interruption.
 */
function atomicWriteFileSync(filePath: string, content: string): void {
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  const tmpPath = `${filePath}.tmp.${Date.now()}.${Math.random().toString(36).slice(2, 8)}`;
  writeFileSync(tmpPath, content, 'utf-8');
  renameSync(tmpPath, filePath);
}

function readToc(sourceId: string, bookId: string): TocData | null {
  const cacheKey = `${sourceId}::${bookId}`;
  const inMem = tocCache.get(cacheKey);
  if (inMem) return inMem;

  const bookDir = findBookDir(sourceId, bookId);
  if (!bookDir) return null;

  const tocPath = join(bookDir, 'toc.json');
  if (!existsSync(tocPath)) return null;

  try {
    const raw = readFileSync(tocPath, 'utf-8');
    const parsed = JSON.parse(raw) as TocData;
    if (parsed && Array.isArray(parsed.chapters)) {
      tocCache.set(cacheKey, parsed);
      return parsed;
    }
  } catch (err: any) {
    console.warn(`[chapter-cache] Failed to read toc.json at ${tocPath}:`, err?.message || err);
  }
  return null;
}

function writeToc(sourceId: string, bookId: string, toc: TocData): void {
  const bookDir = ensureBookDir(sourceId, bookId);
  const tocPath = join(bookDir, 'toc.json');
  atomicWriteFileSync(tocPath, JSON.stringify(toc, null, 2));
  tocCache.set(`${sourceId}::${bookId}`, toc);
}

export function chapterCacheKey(sourceId: string, bookId: string, chapterId: string): string {
  return `${sourceId}::${bookId}::${chapterId}`;
}

export function isWorthCaching(content: ChapterContent | null | undefined): content is ChapterContent {
  if (!content) return false;
  if (!Array.isArray(content.paragraphs) || content.paragraphs.length === 0) return false;
  const textLength = content.paragraphs.reduce((sum, p) => sum + (p ? p.length : 0), 0);
  return textLength >= MIN_TEXT_LENGTH;
}

/**
 * Read cached chapter from the filesystem.
 */
export function readCachedChapter(
  sourceId: string,
  bookId: string,
  chapterId: string
): ChapterContent | null {
  try {
    const bookDir = findBookDir(sourceId, bookId);
    if (!bookDir) return null;

    const toc = readToc(sourceId, bookId);
    let fileName: string | undefined;
    let chTitle = '';
    let prevChapterId: string | null = null;
    let nextChapterId: string | null = null;

    if (toc) {
      const chIndex = toc.chapters.findIndex((c) => c.id === chapterId);
      if (chIndex >= 0) {
        const item = toc.chapters[chIndex];
        fileName = item.fileName;
        chTitle = item.title;
        prevChapterId = chIndex > 0 ? toc.chapters[chIndex - 1].id : null;
        nextChapterId = chIndex < toc.chapters.length - 1 ? toc.chapters[chIndex + 1].id : null;
      }
    }

    // Fallback: If not in toc, look in chapters directory by prefix or id
    const chaptersDir = join(bookDir, 'chapters');
    if (!existsSync(chaptersDir)) return null;

    if (!fileName) {
      const files = readdirSync(chaptersDir);
      fileName = files.find((f) => f.includes(`_${chapterId}`) || f.startsWith(`${chapterId}_`));
      if (!fileName) return null;
    }

    const filePath = join(chaptersDir, fileName);
    if (!existsSync(filePath)) return null;

    const raw = readFileSync(filePath, 'utf-8');
    const lines = raw.split('\n');
    const fileTitle = lines[0]?.trim();
    const paragraphs = lines.slice(1).map((p) => p.trim()).filter((p) => p.length > 0);

    // Validate content length
    const totalLength = paragraphs.reduce((sum, p) => sum + p.length, 0);
    if (totalLength < MIN_TEXT_LENGTH) {
      return null;
    }

    const title = chTitle || fileTitle || '未知章节';
    const content = paragraphs.map((p) => `<p>${p}</p>`).join('\n');

    return {
      id: chapterId,
      bookId,
      title,
      content,
      paragraphs,
      nextChapterId,
      prevChapterId,
      sourceId,
    };
  } catch (err: any) {
    console.warn(`[chapter-cache] Read chapter ${sourceId}/${bookId}/${chapterId} failed:`, err?.message || err);
    return null;
  }
}

/**
 * Write a chapter into its dedicated .txt file.
 */
export function writeCachedChapter(
  sourceId: string,
  bookId: string,
  chapterId: string,
  content: ChapterContent
): boolean {
  if (!isWorthCaching(content)) {
    console.warn(
      `[chapter-cache] Not caching ${sourceId}/${bookId}/${chapterId}: content failed the quality gate`
    );
    return false;
  }

  try {
    const bookDir = ensureBookDir(sourceId, bookId);
    let toc = readToc(sourceId, bookId);
    let fileName: string;

    if (!toc) {
      fileName = `0001_${sanitizePath(content.title)}.txt`;
      toc = {
        updatedAt: Date.now(),
        chapters: [
          {
            id: chapterId,
            index: 1,
            title: content.title,
            fileName,
          },
        ],
      };
      writeToc(sourceId, bookId, toc);
    } else {
      let item = toc.chapters.find((c) => c.id === chapterId);
      if (item) {
        fileName = item.fileName;
      } else {
        const nextIndex = toc.chapters.length + 1;
        fileName = `${String(nextIndex).padStart(4, '0')}_${sanitizePath(content.title)}.txt`;
        toc.chapters.push({
          id: chapterId,
          index: nextIndex,
          title: content.title,
          fileName,
        });
        toc.updatedAt = Date.now();
        writeToc(sourceId, bookId, toc);
      }
    }

    const chaptersDir = join(bookDir, 'chapters');
    if (!existsSync(chaptersDir)) {
      mkdirSync(chaptersDir, { recursive: true });
    }

    const targetFile = join(chaptersDir, fileName);
    const fileBody = `${content.title}\n${content.paragraphs.join('\n')}\n`;
    atomicWriteFileSync(targetFile, fileBody);
    return true;
  } catch (err: any) {
    console.warn(`[chapter-cache] Write chapter ${sourceId}/${bookId}/${chapterId} failed:`, err?.message || err);
    return false;
  }
}

// In-flight fetch deduplication map
const inFlightChapters = new Map<string, Promise<ChapterContent>>();

export interface CachedChapterResult {
  content: ChapterContent;
  cached: boolean;
}

/**
 * Read-through wrapper for chapter content.
 */
export async function fetchChapterWithCache(
  sourceId: string,
  bookId: string,
  chapterId: string,
  fetcher: () => Promise<ChapterContent>
): Promise<CachedChapterResult> {
  const cached = readCachedChapter(sourceId, bookId, chapterId);
  if (cached) return { content: cached, cached: true };

  const key = chapterCacheKey(sourceId, bookId, chapterId);
  const pending = inFlightChapters.get(key);
  if (pending) return { content: await pending, cached: false };

  if (inFlightChapters.size >= MAX_IN_FLIGHT) {
    const content = await fetcher();
    writeCachedChapter(sourceId, bookId, chapterId, content);
    return { content, cached: false };
  }

  const promise = fetcher();
  inFlightChapters.set(key, promise);
  try {
    const content = await promise;
    writeCachedChapter(sourceId, bookId, chapterId, content);
    return { content, cached: false };
  } finally {
    inFlightChapters.delete(key);
  }
}

/**
 * Retrieve all cached chapter IDs for a given book and source.
 */
export function getCachedChapterIds(sourceId: string, bookId: string): string[] {
  try {
    const bookDir = findBookDir(sourceId, bookId);
    if (!bookDir) return [];

    const toc = readToc(sourceId, bookId);
    if (!toc || !Array.isArray(toc.chapters) || toc.chapters.length === 0) return [];

    const chaptersDir = join(bookDir, 'chapters');
    if (!existsSync(chaptersDir)) return [];

    const existingFiles = new Set(readdirSync(chaptersDir));
    return toc.chapters.filter((c) => existingFiles.has(c.fileName)).map((c) => c.id);
  } catch (err: any) {
    console.warn(`[chapter-cache] getCachedChapterIds failed:`, err?.message || err);
    return [];
  }
}

/**
 * Check if a specific chapter is cached on disk.
 */
export function isChapterCached(sourceId: string, bookId: string, chapterId: string): boolean {
  try {
    const bookDir = findBookDir(sourceId, bookId);
    if (!bookDir) return false;

    const toc = readToc(sourceId, bookId);
    if (!toc) return false;

    const item = toc.chapters.find((c) => c.id === chapterId);
    if (!item) return false;

    return existsSync(join(bookDir, 'chapters', item.fileName));
  } catch {
    return false;
  }
}

// In-flight book fetch deduplication map
const inFlightBooks = new Map<string, Promise<BookDetail>>();

export function bookCacheKey(sourceId: string, bookId: string): string {
  return `${sourceId}::${bookId}`;
}

export function readCachedBook(sourceId: string, bookId: string): BookDetail | null {
  try {
    const bookDir = findBookDir(sourceId, bookId);
    if (!bookDir) return null;

    const metaPath = join(bookDir, 'meta.json');
    const tocPath = join(bookDir, 'toc.json');
    if (!existsSync(metaPath) || !existsSync(tocPath)) return null;

    const meta = JSON.parse(readFileSync(metaPath, 'utf-8')) as BookMetaFile;
    const toc = readToc(sourceId, bookId);
    if (!meta || !toc || !Array.isArray(toc.chapters) || toc.chapters.length === 0) return null;

    return {
      id: meta.id || bookId,
      title: meta.title,
      author: meta.author,
      cover: meta.cover,
      category: meta.category,
      status: meta.status,
      wordCount: meta.wordCount,
      latestChapter: meta.latestChapter,
      updateTime: meta.updateTime,
      intro: meta.intro,
      sourceId: meta.sourceId || sourceId,
      chapters: toc.chapters.map((c) => ({
        id: c.id,
        title: c.title,
        index: c.index,
      })),
    };
  } catch (err: any) {
    console.warn(`[chapter-cache] Read book ${sourceId}/${bookId} failed:`, err?.message || err);
    return null;
  }
}

export function writeCachedBook(sourceId: string, bookId: string, detail: BookDetail): void {
  if (!detail || !Array.isArray(detail.chapters) || detail.chapters.length === 0) return;
  try {
    const bookDir = ensureBookDir(sourceId, bookId, detail.title);

    // 1. Write meta.json
    const meta: BookMetaFile = {
      id: detail.id || bookId,
      title: detail.title,
      author: detail.author,
      cover: detail.cover,
      category: detail.category,
      status: detail.status,
      wordCount: detail.wordCount,
      latestChapter: detail.latestChapter,
      updateTime: detail.updateTime,
      intro: detail.intro,
      sourceId: detail.sourceId || sourceId,
      cachedAt: Date.now(),
    };
    atomicWriteFileSync(join(bookDir, 'meta.json'), JSON.stringify(meta, null, 2));

    // 2. Preserve existing chapter file mappings in toc.json
    const existingToc = readToc(sourceId, bookId);
    const existingFileMap = new Map<string, string>();
    if (existingToc) {
      for (const c of existingToc.chapters) {
        existingFileMap.set(c.id, c.fileName);
      }
    }

    const toc: TocData = {
      updatedAt: Date.now(),
      chapters: detail.chapters.map((ch, idx) => {
        const index = ch.index || idx + 1;
        const fileName =
          existingFileMap.get(ch.id) ||
          `${String(index).padStart(4, '0')}_${sanitizePath(ch.title)}.txt`;
        return {
          id: ch.id,
          index,
          title: ch.title,
          fileName,
        };
      }),
    };
    writeToc(sourceId, bookId, toc);
  } catch (err: any) {
    console.warn(`[chapter-cache] Write book ${sourceId}/${bookId} failed:`, err?.message || err);
  }
}

export async function fetchBookWithCache(
  sourceId: string,
  bookId: string,
  fetcher: () => Promise<BookDetail>,
  forceRefresh = false
): Promise<{ detail: BookDetail; cached: boolean }> {
  const key = bookCacheKey(sourceId, bookId);

  if (!forceRefresh) {
    const cached = readCachedBook(sourceId, bookId);
    if (cached) return { detail: cached, cached: true };
  }

  const pending = inFlightBooks.get(key);
  if (pending) {
    const detail = await pending;
    return { detail, cached: false };
  }

  const promise = fetcher();
  inFlightBooks.set(key, promise);
  try {
    const detail = await promise;
    writeCachedBook(sourceId, bookId, detail);
    return { detail, cached: false };
  } finally {
    inFlightBooks.delete(key);
  }
}

// In-flight home fetch deduplication map
const inFlightHome = new Map<string, Promise<HomeSection[]>>();

function getHomeCachePath(sourceId: string): string {
  return join(STORAGE_DIR, '_home', `${sanitizePath(sourceId)}.json`);
}

export function readCachedHome(sourceId: string): HomeSection[] | null {
  try {
    const filePath = getHomeCachePath(sourceId);
    if (!existsSync(filePath)) return null;
    const raw = readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed?.sections) && parsed.sections.length > 0) {
      return parsed.sections as HomeSection[];
    }
    return null;
  } catch {
    return null;
  }
}

export function writeCachedHome(sourceId: string, sections: HomeSection[]): void {
  if (!Array.isArray(sections) || sections.length === 0) return;
  try {
    const filePath = getHomeCachePath(sourceId);
    const data = {
      cachedAt: Date.now(),
      sections,
    };
    atomicWriteFileSync(filePath, JSON.stringify(data, null, 2));
  } catch (err: any) {
    console.warn(`[chapter-cache] Write home failed for ${sourceId}:`, err?.message || err);
  }
}

export async function fetchHomeWithCache(
  sourceId: string,
  fetcher: () => Promise<HomeSection[]>,
  forceRefresh = false
): Promise<{ sections: HomeSection[]; cached: boolean }> {
  if (!forceRefresh) {
    const cached = readCachedHome(sourceId);
    if (cached) return { sections: cached, cached: true };
  }

  const pending = inFlightHome.get(sourceId);
  if (pending) {
    const sections = await pending;
    return { sections, cached: false };
  }

  const promise = fetcher();
  inFlightHome.set(sourceId, promise);
  try {
    const sections = await promise;
    writeCachedHome(sourceId, sections);
    return { sections, cached: false };
  } catch (err: any) {
    // If upstream fetch fails, try serving stale cache
    const stale = readCachedHome(sourceId);
    if (stale) {
      console.warn(`[chapter-cache] Serving stale home cache for ${sourceId} after fetch error`);
      return { sections: stale, cached: true };
    }
    throw err;
  } finally {
    inFlightHome.delete(sourceId);
  }
}

export interface ChapterCacheStats {
  entries: number;
  dbPath: string;
  maxEntries: number;
  ttlMs: number;
  enabled: boolean;
  diskBytes: number;
  payloadBytes: number;
}

/** Cached stats calculation with 5-second throttling */
let lastStatsTime = 0;
let cachedStats: ChapterCacheStats = {
  entries: 0,
  dbPath: STORAGE_DIR,
  maxEntries: 0,
  ttlMs: 0,
  enabled: true,
  diskBytes: 0,
  payloadBytes: 0,
};

function calculateStats(): ChapterCacheStats {
  const now = Date.now();
  if (now - lastStatsTime < 5000) {
    return cachedStats;
  }

  try {
    if (!existsSync(STORAGE_DIR)) {
      mkdirSync(STORAGE_DIR, { recursive: true });
    }

    let entries = 0;
    let totalBytes = 0;

    const walk = (dir: string) => {
      const items = readdirSync(dir, { withFileTypes: true });
      for (const item of items) {
        const full = join(dir, item.name);
        if (item.isDirectory()) {
          walk(full);
        } else if (item.isFile()) {
          totalBytes += statSync(full).size;
          if (item.name.endsWith('.txt')) {
            entries++;
          }
        }
      }
    };

    walk(STORAGE_DIR);

    cachedStats = {
      entries,
      dbPath: STORAGE_DIR,
      maxEntries: 0, // 0 = permanent
      ttlMs: 0, // 0 = permanent
      enabled: true,
      diskBytes: totalBytes,
      payloadBytes: totalBytes,
    };
    lastStatsTime = now;
  } catch (err: any) {
    console.warn('[chapter-cache] Failed to calculate stats:', err?.message || err);
    cachedStats.enabled = false;
  }

  return cachedStats;
}

export function getChapterCacheStats(): ChapterCacheStats {
  return calculateStats();
}

export interface BackgroundCacheTaskStatus {
  status: 'running' | 'completed' | 'error';
  total: number;
  completed: number;
}

interface CacheTask {
  status: 'running' | 'completed' | 'error';
  total: number;
  completed: number;
  abortController: AbortController;
  startTime: number;
}

const activeCacheTasks = new Map<string, CacheTask>();

export function getBackgroundCacheStatus(
  sourceId: string,
  bookId: string
): BackgroundCacheTaskStatus | null {
  const taskKey = `${sourceId}::${bookId}`;
  const task = activeCacheTasks.get(taskKey);
  if (!task) return null;
  return {
    status: task.status,
    total: task.total,
    completed: task.completed,
  };
}

export function stopBackgroundBookCache(sourceId: string, bookId: string): boolean {
  const taskKey = `${sourceId}::${bookId}`;
  const task = activeCacheTasks.get(taskKey);
  if (task && task.status === 'running') {
    task.abortController.abort();
    activeCacheTasks.delete(taskKey);
    return true;
  }
  return false;
}

export async function startBackgroundBookCache(
  sourceId: string,
  bookId: string
): Promise<{
  status: 'running' | 'completed' | 'error';
  total: number;
  completed: number;
  alreadyRunning: boolean;
}> {
  const taskKey = `${sourceId}::${bookId}`;
  const existing = activeCacheTasks.get(taskKey);
  if (existing && existing.status === 'running') {
    return {
      status: 'running',
      total: existing.total,
      completed: existing.completed,
      alreadyRunning: true,
    };
  }

  const { sourceRegistry } = await import('@/sources');
  const source = sourceRegistry.getSource(sourceId);
  const { detail } = await fetchBookWithCache(source.meta.id, bookId, () =>
    source.getDetail(bookId)
  );

  if (!detail || !detail.chapters || detail.chapters.length === 0) {
    throw new Error('未找到书籍章节列表');
  }

  const alreadyCached = new Set(getCachedChapterIds(source.meta.id, bookId));
  const uncached = detail.chapters.filter((ch) => !alreadyCached.has(ch.id));

  if (uncached.length === 0) {
    return {
      status: 'completed',
      total: detail.chapters.length,
      completed: detail.chapters.length,
      alreadyRunning: false,
    };
  }

  const abortController = new AbortController();
  const task: CacheTask = {
    status: 'running',
    total: detail.chapters.length,
    completed: alreadyCached.size,
    abortController,
    startTime: Date.now(),
  };
  activeCacheTasks.set(taskKey, task);

  // Helper for abortable delay
  const abortableDelay = (ms: number, signal: AbortSignal): Promise<void> => {
    return new Promise((resolve) => {
      if (signal.aborted) return resolve();
      const timer = setTimeout(resolve, ms);
      signal.addEventListener(
        'abort',
        () => {
          clearTimeout(timer);
          resolve();
        },
        { once: true }
      );
    });
  };

  // Background caching loop with 2-5s random delay per chapter to prevent anti-crawler bans
  (async () => {
    try {
      for (let i = 0; i < uncached.length; i++) {
        if (abortController.signal.aborted) break;

        const ch = uncached[i];
        try {
          await fetchChapterWithCache(source.meta.id, bookId, ch.id, () =>
            source.getChapter(bookId, ch.id)
          );
          task.completed++;
        } catch (err: any) {
          console.warn(
            `[chapter-cache] Background cache failed for ${source.meta.id}/${bookId}/${ch.id}:`,
            err?.message || err
          );
        }

        // Random delay between 2000ms and 5000ms before requesting the next chapter
        if (i < uncached.length - 1 && !abortController.signal.aborted) {
          const randomDelay = Math.floor(Math.random() * 3000) + 2000;
          await abortableDelay(randomDelay, abortController.signal);
        }
      }
      task.status = 'completed';
    } catch (err: any) {
      console.error('[chapter-cache] Background task error:', err);
      task.status = 'error';
    } finally {
      setTimeout(() => {
        if (activeCacheTasks.get(taskKey) === task) {
          activeCacheTasks.delete(taskKey);
        }
      }, 60000);
    }
  })();

  return {
    status: 'running',
    total: detail.chapters.length,
    completed: alreadyCached.size,
    alreadyRunning: false,
  };
}

export interface ChapterSearchMatch {
  chapterId: string;
  index: number;
  title: string;
  count: number;
  snippets: string[];
}

export interface BookSearchResult {
  keyword: string;
  totalMatches: number;
  matchedChapterCount: number;
  cachedChapterCount: number;
  totalChapterCount: number;
  results: ChapterSearchMatch[];
}

interface SearchCacheEntry {
  timestamp: number;
  result: BookSearchResult;
}

const searchCache = new Map<string, SearchCacheEntry>();
const SEARCH_CACHE_TTL_MS = 120000; // 2 minutes

/**
 * Scan all cached chapter files of a book for a given keyword.
 * Counts occurrences per chapter, extracts context snippets, and returns results in chapter order.
 */
export function searchCachedBookContent(
  sourceId: string,
  bookId: string,
  keyword: string
): BookSearchResult {
  const cleanKeyword = keyword.trim();
  if (!cleanKeyword || cleanKeyword.length > 50) {
    return {
      keyword: cleanKeyword,
      totalMatches: 0,
      matchedChapterCount: 0,
      cachedChapterCount: 0,
      totalChapterCount: 0,
      results: [],
    };
  }

  const cacheKey = `${sourceId}::${bookId}::${cleanKeyword.toLowerCase()}`;
  const now = Date.now();
  const cached = searchCache.get(cacheKey);
  if (cached && now - cached.timestamp < SEARCH_CACHE_TTL_MS) {
    return cached.result;
  }

  const bookDir = findBookDir(sourceId, bookId);
  const toc = readToc(sourceId, bookId);

  if (!bookDir || !toc || !Array.isArray(toc.chapters) || toc.chapters.length === 0) {
    return {
      keyword: cleanKeyword,
      totalMatches: 0,
      matchedChapterCount: 0,
      cachedChapterCount: 0,
      totalChapterCount: 0,
      results: [],
    };
  }

  const chaptersDir = join(bookDir, 'chapters');
  if (!existsSync(chaptersDir)) {
    return {
      keyword: cleanKeyword,
      totalMatches: 0,
      matchedChapterCount: 0,
      cachedChapterCount: 0,
      totalChapterCount: toc.chapters.length,
      results: [],
    };
  }

  const results: ChapterSearchMatch[] = [];
  let totalMatches = 0;
  let cachedCount = 0;
  const lowerKeyword = cleanKeyword.toLowerCase();

  for (const ch of toc.chapters) {
    const filePath = join(chaptersDir, ch.fileName);
    if (!existsSync(filePath)) continue;
    cachedCount++;

    let raw: string;
    try {
      raw = readFileSync(filePath, 'utf-8');
    } catch {
      continue;
    }

    const lowerRaw = raw.toLowerCase();
    if (!lowerRaw.includes(lowerKeyword)) continue;

    let count = 0;
    let pos = 0;
    const snippets: string[] = [];

    while ((pos = lowerRaw.indexOf(lowerKeyword, pos)) !== -1) {
      count++;
      if (snippets.length < 2) {
        const start = Math.max(0, pos - 25);
        const end = Math.min(raw.length, pos + cleanKeyword.length + 25);
        let snippet = raw.slice(start, end).replace(/\r?\n+/g, ' ').trim();
        if (start > 0) snippet = '...' + snippet;
        if (end < raw.length) snippet = snippet + '...';
        snippets.push(snippet);
      }
      pos += cleanKeyword.length;
    }

    if (count > 0) {
      totalMatches += count;
      results.push({
        chapterId: ch.id,
        index: ch.index,
        title: ch.title,
        count,
        snippets,
      });
    }
  }

  const result: BookSearchResult = {
    keyword: cleanKeyword,
    totalMatches,
    matchedChapterCount: results.length,
    cachedChapterCount: cachedCount,
    totalChapterCount: toc.chapters.length,
    results,
  };

  // Keep search cache bounded to 100 entries
  if (searchCache.size > 100) {
    const firstKey = searchCache.keys().next().value;
    if (firstKey) searchCache.delete(firstKey);
  }
  searchCache.set(cacheKey, { timestamp: now, result });

  return result;
}

