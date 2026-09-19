import { mkdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { ChapterContent, BookDetail } from '@/sources/types';

/**
 * Server-side relay cache for chapter bodies.
 *
 * Every request for a chapter used to hit the third-party source site, no matter how many
 * readers had already fetched that same chapter. This module turns the server into a relay:
 * the first request for a chapter is fetched and stored, and every later request is served
 * from the local SQLite file without touching the source site again.
 *
 * This is a *shared* cache with no per-user partitioning — the key is the global
 * `(sourceId, bookId, chapterId)` triple.
 *
 * Server-only: this module pulls in `node:sqlite`, so it must never be imported from a
 * `'use client'` file. The project has no `server-only` guard package; like `axios`/`cheerio`
 * in `src/sources/**`, this constraint is maintained by convention.
 */

const DEFAULT_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
/**
 * Measured against diyibanzhu: ~121KB per chapter on disk (as UTF-8 bytes — note that SQLite's
 * `length()` on a TEXT column counts characters, not bytes, and undercounts Chinese by ~3x).
 * 2000 entries is therefore roughly 240MB, enough to hold a full-length novel.
 *
 * The payload is stored verbatim (see `writeCachedChapter`) because a cache hit must return
 * exactly what a cache miss would have. About half of that size is the `content` HTML field,
 * which is a pure function of `paragraphs` and which nothing currently reads — dropping it
 * would halve the footprint, but at the cost of hits and misses returning differently-shaped
 * objects, and of couples the cache to how each adapter builds `content`.
 *
 * Override with CLEAN_READER_CACHE_MAX_ENTRIES.
 */
const DEFAULT_MAX_ENTRIES = 2000;
/**
 * Shape version of the JSON stored in `payload`. Bump this whenever `ChapterContent` changes.
 *
 * Without it, a row written by an older build still parses cleanly after a field is renamed —
 * it just silently lacks the new field, and the reader renders a blank page with no error and
 * no log pointing at the cache. See the read path for the eviction that handles the mismatch.
 */
const SCHEMA_VERSION = 1;
/** Cap on concurrently tracked upstream fetches, so a slow source can't grow the map unbounded. */
const MAX_IN_FLIGHT = 256;
/** When over capacity, prune down to this fraction of the cap so pruning isn't run every write. */
const LOW_WATER_RATIO = 0.9;
/**
 * A chapter shorter than this is treated as a failed/interstitial fetch rather than content.
 * The gate matters more here than in a per-request cache: a bad row isn't one bad response,
 * it's a bad response served to every future reader until the TTL expires.
 */
const MIN_TEXT_LENGTH = 100;
/** Refresh `last_access` at most this often, so a cache hit doesn't cost a write every time. */
const LAST_ACCESS_THROTTLE_MS = 60 * 60 * 1000;

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const TTL_MS = envInt('CLEAN_READER_CACHE_TTL_MS', DEFAULT_TTL_MS);
const MAX_ENTRIES = envInt('CLEAN_READER_CACHE_MAX_ENTRIES', DEFAULT_MAX_ENTRIES);

function resolveDbPath(): string {
  return process.env.CLEAN_READER_CACHE_DB || join(process.cwd(), '.cache', 'clean-reader.db');
}

const DB_PATH = resolveDbPath();

type DatabaseSync = import('node:sqlite').DatabaseSync;
type DatabaseSyncCtor = new (
  path: string,
  options?: import('node:sqlite').DatabaseSyncOptions
) => DatabaseSync;

// `undefined` = not resolved yet, `null` = unavailable on this Node version.
let databaseSyncCtor: DatabaseSyncCtor | null | undefined;

/**
 * Resolve `node:sqlite` lazily so that an unsupported Node version degrades to "caching
 * disabled" instead of crashing the whole route at import time.
 */
function getDatabaseSyncCtor(): DatabaseSyncCtor | null {
  if (databaseSyncCtor !== undefined) return databaseSyncCtor;

  let resolved: DatabaseSyncCtor | null;
  try {
    const sqlite = require('node:sqlite') as typeof import('node:sqlite');
    resolved = sqlite.DatabaseSync;
  } catch (err: any) {
    console.warn(
      '[chapter-cache] node:sqlite is unavailable (requires Node >= 22.5). Chapter caching is disabled.',
      err?.message || err
    );
    resolved = null;
  }

  databaseSyncCtor = resolved;
  return resolved;
}

// Cached on globalThis so that `next dev` hot reloads don't leak database handles.
const globalForCache = globalThis as typeof globalThis & {
  __cleanReaderChapterDb?: DatabaseSync;
};

/** Latched so a read-only or unsupported filesystem warns once instead of on every request. */
let openFailed = false;

function openDb(): DatabaseSync | null {
  if (globalForCache.__cleanReaderChapterDb) return globalForCache.__cleanReaderChapterDb;
  if (openFailed) return null;

  const Ctor = getDatabaseSyncCtor();
  if (!Ctor) {
    openFailed = true;
    return null;
  }

  try {
    mkdirSync(dirname(DB_PATH), { recursive: true });

    // `timeout` sets SQLite's busy timeout. The default is 0, which throws SQLITE_BUSY the
    // instant another process holds the write lock — that would surface here as a failed cache
    // read, i.e. a silent miss, exactly when contention is highest.
    const db = new Ctor(DB_PATH, { timeout: 5000 });

    // WAL needs a shared-memory `-shm` mapping, which network filesystems don't support. Read
    // the mode back rather than assuming, so the fallback is visible instead of fatal.
    const journal = db.prepare('PRAGMA journal_mode = WAL').get() as { journal_mode?: string };
    if (journal?.journal_mode !== 'wal') {
      console.warn(
        `[chapter-cache] WAL unavailable (journal_mode=${journal?.journal_mode}); continuing without it`
      );
    }

    db.exec(`
      PRAGMA synchronous = NORMAL;
      CREATE TABLE IF NOT EXISTS chapters (
        key            TEXT PRIMARY KEY,
        source_id      TEXT NOT NULL,
        book_id        TEXT NOT NULL,
        chapter_id     TEXT NOT NULL,
        schema_version INTEGER NOT NULL,
        payload        TEXT NOT NULL,
        cached_at      INTEGER NOT NULL,
        last_access    INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_chapters_lru  ON chapters(last_access);
      CREATE INDEX IF NOT EXISTS idx_chapters_book ON chapters(source_id, book_id);

      CREATE TABLE IF NOT EXISTS books (
        key            TEXT PRIMARY KEY,
        source_id      TEXT NOT NULL,
        book_id        TEXT NOT NULL,
        payload        TEXT NOT NULL,
        cached_at      INTEGER NOT NULL,
        last_access    INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_books_key ON books(key);
    `);

    console.log(`[chapter-cache] Opened ${DB_PATH}`);
    globalForCache.__cleanReaderChapterDb = db;
    return db;
  } catch (err: any) {
    openFailed = true;
    console.warn(
      `[chapter-cache] Could not open ${DB_PATH} — chapter caching is disabled for this process. ` +
        `Set CLEAN_READER_CACHE_DB to a writable path if the filesystem is read-only.`,
      err?.message || err
    );
    return null;
  }
}

export function chapterCacheKey(sourceId: string, bookId: string, chapterId: string): string {
  return `${sourceId}::${bookId}::${chapterId}`;
}

/**
 * Decide whether a fetched chapter is fit to be stored.
 *
 * Never cache a failure: a rejected fetch or an ad/interstitial page that slipped through
 * would otherwise be replayed to every subsequent reader for the whole TTL.
 */
export function isWorthCaching(content: ChapterContent | null | undefined): content is ChapterContent {
  if (!content) return false;
  if (!Array.isArray(content.paragraphs) || content.paragraphs.length === 0) return false;
  const textLength = content.paragraphs.reduce((sum, p) => sum + (p ? p.length : 0), 0);
  return textLength >= MIN_TEXT_LENGTH;
}

export function readCachedChapter(
  sourceId: string,
  bookId: string,
  chapterId: string
): ChapterContent | null {
  try {
    const db = openDb();
    if (!db) return null;

    const key = chapterCacheKey(sourceId, bookId, chapterId);
    const row = db
      .prepare(
        'SELECT payload, cached_at, last_access, schema_version FROM chapters WHERE key = ?'
      )
      .get(key) as
      | { payload: string; cached_at: number; last_access: number; schema_version: number }
      | undefined;

    if (!row) return null;

    // Written by an older build, or below the quality gate. Drop it rather than hand the caller
    // an object that type-checks but is missing fields.
    if (row.schema_version !== SCHEMA_VERSION) {
      db.prepare('DELETE FROM chapters WHERE key = ?').run(key);
      return null;
    }

    const now = Date.now();
    if (now - row.cached_at > TTL_MS) {
      db.prepare('DELETE FROM chapters WHERE key = ?').run(key);
      return null;
    }

    if (now - row.last_access > LAST_ACCESS_THROTTLE_MS) {
      db.prepare('UPDATE chapters SET last_access = ? WHERE key = ?').run(now, key);
    }

    let parsed: ChapterContent;
    try {
      parsed = JSON.parse(row.payload) as ChapterContent;
    } catch (err: any) {
      // Truncated write or corrupt row: delete it, otherwise every future read re-parses it.
      console.warn(`[chapter-cache] Dropping unparseable row for ${key}:`, err?.message || err);
      db.prepare('DELETE FROM chapters WHERE key = ?').run(key);
      return null;
    }

    // Guard against rows written before the quality gate was tightened.
    if (!Array.isArray(parsed?.paragraphs) || parsed.paragraphs.length === 0) {
      db.prepare('DELETE FROM chapters WHERE key = ?').run(key);
      return null;
    }

    return parsed;
  } catch (err: any) {
    // A broken cache must never break a read — fall through to a live fetch.
    console.warn('[chapter-cache] Read failed:', err?.message || err);
    return null;
  }
}

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
    const db = openDb();
    if (!db) return false;

    const now = Date.now();
    db.prepare(
      `INSERT INTO chapters (key, source_id, book_id, chapter_id, schema_version, payload, cached_at, last_access)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET
         schema_version = excluded.schema_version,
         payload = excluded.payload,
         cached_at = excluded.cached_at,
         last_access = excluded.last_access`
    ).run(
      chapterCacheKey(sourceId, bookId, chapterId),
      sourceId,
      bookId,
      chapterId,
      SCHEMA_VERSION,
      JSON.stringify(content),
      now,
      now
    );

    pruneIfOverCapacity(db);
    return true;
  } catch (err: any) {
    console.warn('[chapter-cache] Write failed:', err?.message || err);
    return false;
  }
}

function pruneIfOverCapacity(db: DatabaseSync): void {
  try {
    const countRow = db.prepare('SELECT COUNT(*) AS n FROM chapters').get() as { n: number };
    if (countRow.n <= MAX_ENTRIES) return;

    const target = Math.floor(MAX_ENTRIES * LOW_WATER_RATIO);
    const toDelete = countRow.n - target;

    db.prepare(
      `DELETE FROM chapters WHERE key IN (
         SELECT key FROM chapters ORDER BY last_access ASC LIMIT ?
       )`
    ).run(toDelete);

    console.log(
      `[chapter-cache] Pruned ${toDelete} entries (had ${countRow.n}, cap ${MAX_ENTRIES})`
    );
  } catch (err: any) {
    console.warn('[chapter-cache] Prune failed:', err?.message || err);
  }
}

// Shared across both entry points (/api/chapter and the TXT export) so concurrent readers of
// the same chapter trigger a single upstream fetch.
const inFlight = new Map<string, Promise<ChapterContent>>();

export interface CachedChapterResult {
  content: ChapterContent;
  cached: boolean;
}

/**
 * Read-through wrapper: serve from cache when possible, otherwise run `fetcher` once and store
 * the result. Concurrent callers requesting the same chapter share a single `fetcher` call.
 */
export async function fetchChapterWithCache(
  sourceId: string,
  bookId: string,
  chapterId: string,
  fetcher: () => Promise<ChapterContent>
): Promise<CachedChapterResult> {
  // Stays synchronous on purpose: read → check in-flight → register must be one indivisible
  // step. Introducing an `await` before `inFlight.set` would let two concurrent callers both
  // see a miss and both hit the source — a race that only shows up under load.
  const cached = readCachedChapter(sourceId, bookId, chapterId);
  if (cached) return { content: cached, cached: true };

  const key = chapterCacheKey(sourceId, bookId, chapterId);
  const pending = inFlight.get(key);
  if (pending) return { content: await pending, cached: false };

  // When the source is slow, every concurrent request for a *different* chapter adds an entry.
  // Past the cap we stop de-duplicating rather than growing without bound — callers just fetch
  // independently, which is the pre-dedup behaviour.
  if (inFlight.size >= MAX_IN_FLIGHT) {
    const content = await fetcher();
    writeCachedChapter(sourceId, bookId, chapterId, content);
    return { content, cached: false };
  }

  const promise = fetcher();
  inFlight.set(key, promise);
  try {
    const content = await promise;
    writeCachedChapter(sourceId, bookId, chapterId, content);
    return { content, cached: false };
  } finally {
    // Must run on the rejection path too: a rejected promise left in the map would be handed
    // to every future caller, permanently breaking that chapter.
    inFlight.delete(key);
  }
}

export interface ChapterCacheStats {
  entries: number;
  dbPath: string;
  maxEntries: number;
  ttlMs: number;
  enabled: boolean;
  /** On-disk size of the database plus its WAL sidecar. */
  diskBytes: number;
  /** Approximate on-disk size of the cached payloads themselves. */
  payloadBytes: number;
}

const EMPTY_STATS: Omit<ChapterCacheStats, 'diskBytes' | 'payloadBytes'> = {
  entries: 0,
  dbPath: DB_PATH,
  maxEntries: MAX_ENTRIES,
  ttlMs: TTL_MS,
  enabled: false,
};

function diskUsage(): number {
  // WAL mode keeps recently written pages in a sidecar until a checkpoint, so the .db file
  // alone under-reports what the cache actually occupies.
  let total = 0;
  for (const suffix of ['', '-wal', '-shm']) {
    try {
      total += statSync(`${DB_PATH}${suffix}`).size;
    } catch {
      // Sidecar may not exist (yet); nothing to add.
    }
  }
  return total;
}

/** Diagnostics for the cache. Cheap enough to call from a route handler. */
export function getChapterCacheStats(): ChapterCacheStats {
  const db = openDb();
  if (!db) {
    return { ...EMPTY_STATS, diskBytes: diskUsage(), payloadBytes: 0 };
  }

  try {
    const row = db
      .prepare('SELECT COUNT(*) AS n, COALESCE(SUM(length(CAST(payload AS BLOB))), 0) AS bytes FROM chapters')
      .get() as { n: number; bytes: number };
    return {
      entries: row.n,
      dbPath: DB_PATH,
      maxEntries: MAX_ENTRIES,
      ttlMs: TTL_MS,
      enabled: true,
      diskBytes: diskUsage(),
      payloadBytes: Number(row.bytes),
    };
  } catch (err: any) {
    console.warn('[chapter-cache] Stats failed:', err?.message || err);
    return { ...EMPTY_STATS, diskBytes: diskUsage(), payloadBytes: 0 };
  }
}

// ==============================================================================
// Book Detail Cache (SQLite)
// ==============================================================================

const BOOK_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours
const inFlightBooks = new Map<string, Promise<BookDetail>>();

export function bookCacheKey(sourceId: string, bookId: string): string {
  return `${sourceId}::${bookId}`;
}

export function readCachedBook(sourceId: string, bookId: string): BookDetail | null {
  try {
    const db = openDb();
    if (!db) return null;

    const key = bookCacheKey(sourceId, bookId);
    const row = db
      .prepare('SELECT payload, cached_at FROM books WHERE key = ?')
      .get(key) as { payload: string; cached_at: number } | undefined;

    if (!row) return null;

    const now = Date.now();
    if (now - row.cached_at > BOOK_TTL_MS) {
      db.prepare('DELETE FROM books WHERE key = ?').run(key);
      return null;
    }

    let parsed: BookDetail;
    try {
      parsed = JSON.parse(row.payload) as BookDetail;
    } catch {
      db.prepare('DELETE FROM books WHERE key = ?').run(key);
      return null;
    }

    if (!parsed || !Array.isArray(parsed.chapters) || parsed.chapters.length === 0) {
      db.prepare('DELETE FROM books WHERE key = ?').run(key);
      return null;
    }

    return parsed;
  } catch (err: any) {
    console.warn('[chapter-cache] Read book failed:', err?.message || err);
    return null;
  }
}

export function writeCachedBook(sourceId: string, bookId: string, detail: BookDetail): void {
  if (!detail || !Array.isArray(detail.chapters) || detail.chapters.length === 0) return;
  try {
    const db = openDb();
    if (!db) return;

    const key = bookCacheKey(sourceId, bookId);
    const now = Date.now();
    const payload = JSON.stringify(detail);

    db.prepare(`
      INSERT INTO books (key, source_id, book_id, payload, cached_at, last_access)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        payload = excluded.payload,
        cached_at = excluded.cached_at,
        last_access = excluded.last_access
    `).run(key, sourceId, bookId, payload, now, now);
  } catch (err: any) {
    console.warn('[chapter-cache] Write book failed:', err?.message || err);
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
