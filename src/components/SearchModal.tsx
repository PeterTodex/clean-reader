'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import { SearchResult, SourceMeta } from '@/sources/types';
import { BookCoverPlaceholder } from './BookCoverPlaceholder';
import { Modal } from './Modal';
import { formatDisplayDate } from '@/lib/utils';
import {
  Search,
  X,
  Flame,
  RefreshCw,
  BookOpen,
  Loader2,
  SlidersHorizontal,
  ExternalLink,
  Layers,
  Sparkles,
} from 'lucide-react';

const HOT_KEYWORDS = ['重生', '穿越', '综漫', '都市', '武侠', '系统', '反派', '仙侠'];

type SortType = 'relevance' | 'update' | 'sources';

interface SourceOption {
  sourceId: string;
  sourceName: string;
  bookId: string;
  latestChapter?: string;
  updateTime?: string;
  durationMs?: number;
}

interface AggregatedBook {
  key: string;
  title: string;
  author: string;
  cover?: string;
  category?: string;
  intro?: string;
  sources: SourceOption[];
  relevanceScore: number;
}

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  sources?: SourceMeta[];
  selectedSourceId?: string;
  onSelectSource?: (sourceId: string) => void;
}

function calculateRelevance(title: string, author: string, intro: string | undefined, query: string): number {
  const normTitle = title.trim().toLowerCase();
  const normAuthor = (author || '').trim().toLowerCase();
  const q = query.trim().toLowerCase();

  let score = 0;

  // 1. Exact title match -> top priority (10,000)
  if (normTitle === q) {
    score += 10000;
  }
  // 2. Title starts with query -> 5,000
  else if (normTitle.startsWith(q)) {
    score += 5000 - Math.min(3000, normTitle.length * 20);
  }
  // 3. Title contains query -> 2,000
  else if (normTitle.includes(q)) {
    const idx = normTitle.indexOf(q);
    score += 2000 - Math.min(1500, idx * 50 + normTitle.length * 10);
  }

  // 4. Exact author match
  if (normAuthor && normAuthor === q) {
    score += 3000;
  } else if (normAuthor && normAuthor.includes(q)) {
    score += 1200;
  }

  // 5. Intro contains query
  if (intro && intro.toLowerCase().includes(q)) {
    score += 300;
  }

  return score;
}

export const SearchModal: React.FC<SearchModalProps> = ({
  isOpen,
  onClose,
  sources = [],
}) => {
  const [keyword, setKeyword] = useState('');
  const [activeQuery, setActiveQuery] = useState('');
  const [allSources, setAllSources] = useState<SourceMeta[]>(sources);
  const [isSearching, setIsSearching] = useState(false);
  const [rawResults, setRawResults] = useState<(SearchResult & { durationMs?: number })[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [completedCount, setCompletedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [sortBy, setSortBy] = useState<SortType>('relevance');

  const inputRef = useRef<HTMLInputElement>(null);
  const searchSeqRef = useRef<number>(0);

  // Sync sources prop or fetch if empty
  useEffect(() => {
    if (sources && sources.length > 0) {
      setAllSources(sources);
    } else {
      fetch('/api/sources')
        .then((res) => res.json())
        .then((data) => {
          if (data.success && Array.isArray(data.data)) {
            setAllSources(data.data);
          }
        })
        .catch(() => {});
    }
  }, [sources]);

  const sourceMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of allSources) {
      map.set(s.id, s.name);
    }
    return map;
  }, [allSources]);

  // Auto focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    } else {
      searchSeqRef.current++;
      setKeyword('');
      setActiveQuery('');
      setRawResults([]);
      setHasSearched(false);
      setIsSearching(false);
      setCompletedCount(0);
      setTotalCount(0);
      setSortBy('relevance');
    }
  }, [isOpen]);

  const handleSearch = async (queryToSearch?: string) => {
    const q = (queryToSearch !== undefined ? queryToSearch : keyword).trim();
    if (!q) return;

    setActiveQuery(q);
    const seq = ++searchSeqRef.current;
    setIsSearching(true);
    setHasSearched(true);
    setRawResults([]);
    setCompletedCount(0);

    let currentSources = allSources;
    if (currentSources.length === 0) {
      try {
        const res = await fetch('/api/sources');
        const data = await res.json();
        if (data.success && Array.isArray(data.data) && data.data.length > 0) {
          currentSources = data.data;
          setAllSources(data.data);
        }
      } catch {
        // Continue
      }
    }

    if (currentSources.length === 0) {
      try {
        const t0 = performance.now();
        const res = await fetch(`/api/search?keyword=${encodeURIComponent(q)}`);
        const data = await res.json();
        const duration = Math.round(performance.now() - t0);
        if (seq === searchSeqRef.current && data.success && Array.isArray(data.data)) {
          setRawResults(data.data.map((item: SearchResult) => ({ ...item, durationMs: duration })));
        }
      } catch {
        // Ignore
      } finally {
        if (seq === searchSeqRef.current) {
          setIsSearching(false);
        }
      }
      return;
    }

    setTotalCount(currentSources.length);
    let remaining = currentSources.length;

    // Search across all sources in parallel and progressively append results
    currentSources.forEach(async (source) => {
      const t0 = performance.now();
      try {
        const res = await fetch(
          `/api/search?keyword=${encodeURIComponent(q)}&source=${source.id}`
        );
        const data = await res.json();
        const duration = Math.round(performance.now() - t0);

        if (seq !== searchSeqRef.current) return;

        if (data.success && Array.isArray(data.data) && data.data.length > 0) {
          const items = data.data.map((item: SearchResult) => ({
            ...item,
            sourceId: item.sourceId || source.id,
            durationMs: duration,
          }));

          setRawResults((prev) => {
            const seen = new Set(prev.map((b) => `${b.sourceId}-${b.id}`));
            const additions = items.filter((b: SearchResult) => !seen.has(`${b.sourceId}-${b.id}`));
            return [...prev, ...additions];
          });
        }
      } catch (err) {
        console.warn(`[Search] Search failed on source ${source.id}:`, err);
      } finally {
        if (seq === searchSeqRef.current) {
          setCompletedCount((c) => c + 1);
          remaining--;
          if (remaining <= 0) {
            setIsSearching(false);
          }
        }
      }
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSearch();
  };

  const handleHotTagClick = (tag: string) => {
    setKeyword(tag);
    handleSearch(tag);
  };

  // Group by normalized title + author, compute relevance score
  const aggregatedBooks = useMemo(() => {
    const map = new Map<string, AggregatedBook>();

    for (const item of rawResults) {
      const cleanTitle = (item.title || '').replace(/^[《【\s]+|[》】\s]+$/g, '').trim();
      const normTitleKey = cleanTitle.toLowerCase();
      const normAuthorKey = (item.author || '').trim().toLowerCase();

      // Group key: if titles match and authors match or either author is unknown, group together
      let matchedKey: string | null = null;
      for (const [key, existing] of Array.from(map.entries())) {
        const existingTitleKey = existing.title.toLowerCase();
        if (existingTitleKey === normTitleKey) {
          const existingAuthorKey = (existing.author || '').trim().toLowerCase();
          if (
            !existingAuthorKey ||
            !normAuthorKey ||
            existingAuthorKey === normAuthorKey ||
            existingAuthorKey.includes(normAuthorKey) ||
            normAuthorKey.includes(existingAuthorKey)
          ) {
            matchedKey = key;
            break;
          }
        }
      }

      const sourceEntry: SourceOption = {
        sourceId: item.sourceId,
        sourceName: sourceMap.get(item.sourceId) || item.sourceId,
        bookId: item.id,
        latestChapter: item.latestChapter,
        updateTime: item.updateTime,
        durationMs: item.durationMs,
      };

      if (matchedKey) {
        const existing = map.get(matchedKey)!;
        if (!existing.sources.some((s) => s.sourceId === item.sourceId && s.bookId === item.id)) {
          existing.sources.push(sourceEntry);
        }
        if (!existing.cover && item.cover) existing.cover = item.cover;
        if ((!existing.intro || existing.intro.length < 20) && item.intro) existing.intro = item.intro;
      } else {
        const key = `${normTitleKey}__${normAuthorKey}`;
        const score = calculateRelevance(cleanTitle, item.author || '', item.intro, activeQuery);
        map.set(key, {
          key,
          title: cleanTitle,
          author: item.author || '佚名',
          cover: item.cover,
          intro: item.intro,
          sources: [sourceEntry],
          relevanceScore: score,
        });
      }
    }

    const list = Array.from(map.values());

    // Sort
    list.sort((a, b) => {
      if (sortBy === 'relevance') {
        if (b.relevanceScore !== a.relevanceScore) {
          return b.relevanceScore - a.relevanceScore;
        }
        return b.sources.length - a.sources.length;
      }
      if (sortBy === 'sources') {
        if (b.sources.length !== a.sources.length) {
          return b.sources.length - a.sources.length;
        }
        return b.relevanceScore - a.relevanceScore;
      }
      if (sortBy === 'update') {
        const aTime = a.sources.find((s) => s.updateTime)?.updateTime || '';
        const bTime = b.sources.find((s) => s.updateTime)?.updateTime || '';
        if (bTime && !aTime) return 1;
        if (aTime && !bTime) return -1;
        if (aTime && bTime && aTime !== bTime) {
          return bTime.localeCompare(aTime);
        }
        return b.relevanceScore - a.relevanceScore;
      }
      return 0;
    });

    return list;
  }, [rawResults, sourceMap, activeQuery, sortBy]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      position="top"
      maxWidth="2xl"
      showCloseButton={false}
      className="rounded-2xl max-h-[88vh]"
    >
      {/* Top Search Bar */}
      <div className="p-3.5 sm:p-4 border-b border-zinc-200 bg-white flex items-center gap-2">
        <form onSubmit={handleSubmit} className="flex-1 flex items-center gap-2">
          <div className="relative flex-1 flex items-center bg-zinc-100 rounded-xl px-3 py-2 border border-zinc-200/80 focus-within:border-zinc-400 focus-within:ring-1 focus-within:ring-zinc-400/30 transition-all">
            <Search className="w-4 h-4 text-zinc-400 shrink-0 mr-2" />
            <input
              ref={inputRef}
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="搜索全网小说：书名、作者或主角..."
              className="w-full bg-transparent border-none text-xs sm:text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none"
            />
            {keyword && (
              <button
                type="button"
                onClick={() => setKeyword('')}
                className="p-1 text-zinc-400 hover:text-zinc-600 rounded-md"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <button
            type="submit"
            disabled={isSearching || !keyword.trim()}
            className="px-4 py-2.5 rounded-xl bg-black hover:bg-zinc-800 text-white text-xs sm:text-sm font-medium transition-colors flex items-center gap-1.5 shrink-0 disabled:opacity-50"
          >
            {isSearching ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <span>搜索</span>
            )}
          </button>
        </form>
      </div>

      {/* Hot Keyword Tags */}
      <div className="px-4 py-2.5 bg-zinc-50 border-b border-zinc-100 flex items-center gap-2 overflow-x-auto scrollbar-none">
        <span className="text-[11px] text-zinc-400 font-mono flex items-center gap-1 shrink-0">
          <Flame className="w-3 h-3 text-zinc-500" />
          热搜：
        </span>
        <div className="flex items-center gap-1.5">
          {HOT_KEYWORDS.map((kw) => (
            <button
              key={kw}
              onClick={() => handleHotTagClick(kw)}
              className="text-[11px] px-2 py-0.5 rounded-md bg-white hover:bg-zinc-200 text-zinc-600 hover:text-zinc-900 transition-colors border border-zinc-200/80 whitespace-nowrap"
            >
              {kw}
            </button>
          ))}
        </div>
      </div>

      {/* Content Body: Results or Guide */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {hasSearched ? (
          aggregatedBooks.length === 0 ? (
            isSearching ? (
              /* Skeleton Loading State */
              <div className="space-y-3 py-2">
                <div className="flex items-center gap-2 text-xs text-zinc-500 font-mono mb-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>正在并发检索全网各书源...</span>
                </div>
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="flex gap-3.5 p-3.5 rounded-xl bg-zinc-50 border border-zinc-200/80 animate-pulse"
                  >
                    <div className="w-16 aspect-[4/5] bg-zinc-200 rounded-md shrink-0" />
                    <div className="flex-1 space-y-2.5 py-1">
                      <div className="h-4 bg-zinc-200 rounded w-1/3" />
                      <div className="h-3 bg-zinc-200 rounded w-1/4" />
                      <div className="h-3 bg-zinc-200 rounded w-full" />
                      <div className="h-3 bg-zinc-200 rounded w-3/4" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-16 text-center text-zinc-400 text-xs">
                全网各书源均未找到与 "{activeQuery}" 相关的书籍，请尝试更换关键词。
              </div>
            )
          ) : (
            <div className="space-y-3">
              {/* Header stats & Sort tabs */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-zinc-400 font-mono px-1 pb-1 border-b border-zinc-100">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-zinc-600">
                    聚合找到 {aggregatedBooks.length} 部作品（{rawResults.length} 条记录）
                  </span>
                  {isSearching && (
                    <span className="flex items-center gap-1 text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded-full border border-zinc-200">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span>检索中 ({completedCount}/{totalCount})</span>
                    </span>
                  )}
                </div>

                {/* Sort tabs */}
                <div className="flex items-center gap-1 self-end sm:self-auto">
                  <SlidersHorizontal className="w-3 h-3 text-zinc-400 mr-1" />
                  <button
                    type="button"
                    onClick={() => setSortBy('relevance')}
                    className={`px-2 py-0.5 rounded transition-colors ${
                      sortBy === 'relevance'
                        ? 'bg-black text-white font-semibold'
                        : 'text-zinc-500 hover:text-black hover:bg-zinc-100'
                    }`}
                  >
                    最佳匹配
                  </button>
                  <button
                    type="button"
                    onClick={() => setSortBy('update')}
                    className={`px-2 py-0.5 rounded transition-colors ${
                      sortBy === 'update'
                        ? 'bg-black text-white font-semibold'
                        : 'text-zinc-500 hover:text-black hover:bg-zinc-100'
                    }`}
                  >
                    最新更新
                  </button>
                  <button
                    type="button"
                    onClick={() => setSortBy('sources')}
                    className={`px-2 py-0.5 rounded transition-colors ${
                      sortBy === 'sources'
                        ? 'bg-black text-white font-semibold'
                        : 'text-zinc-500 hover:text-black hover:bg-zinc-100'
                    }`}
                  >
                    多源优先
                  </button>
                </div>
              </div>

              {/* Aggregated Cards List */}
              {aggregatedBooks.map((book) => {
                const isExact = book.title.toLowerCase() === activeQuery.toLowerCase();
                const primarySource = book.sources[0];

                return (
                  <div
                    key={book.key}
                    className={`p-3.5 rounded-xl border transition-all ${
                      isExact
                        ? 'bg-zinc-100/60 border-zinc-300 shadow-xs'
                        : 'bg-zinc-50 hover:bg-zinc-50/80 border-zinc-200 hover:border-zinc-300'
                    }`}
                  >
                    <div className="flex gap-3.5">
                      {/* Cover */}
                      <Link
                        href={`/book/${primarySource.bookId}?source=${primarySource.sourceId}`}
                        onClick={onClose}
                        className="w-16 sm:w-20 aspect-[4/5] bg-zinc-100 rounded-md overflow-hidden shrink-0 relative border border-zinc-200 hover:opacity-90 transition-opacity"
                      >
                        <BookCoverPlaceholder title={book.title} className="absolute inset-0" />
                        {book.cover ? (
                          <img
                            src={book.cover}
                            alt={book.title}
                            className="relative w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        ) : null}
                      </Link>

                      {/* Details */}
                      <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5 space-y-1.5">
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <Link
                              href={`/book/${primarySource.bookId}?source=${primarySource.sourceId}`}
                              onClick={onClose}
                              className="font-bold text-zinc-950 text-sm sm:text-base hover:underline line-clamp-1 flex items-center gap-1.5"
                            >
                              <span>{book.title}</span>
                              {isExact && (
                                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black text-white shrink-0">
                                  精确命中
                                </span>
                              )}
                            </Link>

                            {book.sources.length > 1 && (
                              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-200 text-zinc-700 font-medium flex items-center gap-1 shrink-0">
                                <Layers className="w-3 h-3 text-zinc-600" />
                                <span>{book.sources.length} 个书源</span>
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 text-xs text-zinc-500 mt-0.5 flex-wrap">
                            <span>作者：{book.author}</span>
                            {book.category && (
                              <span className="text-[10px] px-1.5 py-0.2 bg-zinc-100 text-zinc-600 rounded border border-zinc-200 font-mono">
                                {book.category}
                              </span>
                            )}
                          </div>

                          {book.intro && (
                            <p className="text-xs text-zinc-600 mt-1 line-clamp-2 leading-relaxed">
                              {book.intro}
                            </p>
                          )}
                        </div>

                        {/* Multi-source pill switcher */}
                        <div className="pt-2 border-t border-zinc-100 flex items-center gap-1.5 flex-wrap">
                          <span className="text-[11px] text-zinc-400 font-mono shrink-0 mr-0.5">
                            可用源：
                          </span>
                          {book.sources.map((src) => {
                            const latest = src.latestChapter || '';
                            const updateFormatted = formatDisplayDate(src.updateTime);
                            return (
                              <Link
                                key={`${src.sourceId}-${src.bookId}`}
                                href={`/book/${src.bookId}?source=${src.sourceId}`}
                                onClick={onClose}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-mono bg-white hover:bg-zinc-100 border border-zinc-200 text-zinc-800 transition-colors shadow-2xs group"
                                title={`点击前往 ${src.sourceName} 阅读${latest ? `（最新：${latest}）` : ''}`}
                              >
                                <span className="font-semibold text-zinc-950">{src.sourceName}</span>
                                {latest && (
                                  <span className="text-zinc-500 max-w-[120px] truncate hidden sm:inline">
                                    · {latest}
                                  </span>
                                )}
                                {updateFormatted && (
                                  <span className="text-zinc-400 hidden md:inline">
                                    · {updateFormatted}
                                  </span>
                                )}
                                <ExternalLink className="w-2.5 h-2.5 text-zinc-400 group-hover:text-zinc-800 shrink-0 ml-0.5" />
                              </Link>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Bottom progressive loading hint */}
              {isSearching && (
                <div className="py-3 flex items-center justify-center gap-2 text-xs text-zinc-400 font-mono">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>正在继续检索其他书源...</span>
                </div>
              )}
            </div>
          )
        ) : (
          <div className="py-12 text-center flex flex-col items-center justify-center text-zinc-400 gap-2">
            <BookOpen className="w-8 h-8 opacity-40" />
            <p className="text-xs">输入任意书名或主角名字，全网各书源并发检索</p>
          </div>
        )}
      </div>
    </Modal>
  );
};
