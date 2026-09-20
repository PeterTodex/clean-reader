'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import { SearchResult, SourceMeta } from '@/sources/types';
import { BookCoverPlaceholder } from './BookCoverPlaceholder';
import { Modal } from './Modal';
import { Search, X, Flame, RefreshCw, BookOpen, Loader2 } from 'lucide-react';

const HOT_KEYWORDS = ['重生', '穿越', '综漫', '都市', '武侠', '系统', '反派', '仙侠'];

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  sources?: SourceMeta[];
  selectedSourceId?: string;
  onSelectSource?: (sourceId: string) => void;
}

export const SearchModal: React.FC<SearchModalProps> = ({
  isOpen,
  onClose,
  sources = [],
}) => {
  const [keyword, setKeyword] = useState('');
  const [allSources, setAllSources] = useState<SourceMeta[]>(sources);
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [completedCount, setCompletedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
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
      setSearchResults([]);
      setHasSearched(false);
      setIsSearching(false);
      setCompletedCount(0);
      setTotalCount(0);
    }
  }, [isOpen]);



  const handleSearch = async (queryToSearch?: string) => {
    const q = (queryToSearch !== undefined ? queryToSearch : keyword).trim();
    if (!q) return;

    const seq = ++searchSeqRef.current;
    setIsSearching(true);
    setHasSearched(true);
    setSearchResults([]);
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
      // Fallback: search without explicit source
      try {
        const res = await fetch(`/api/search?keyword=${encodeURIComponent(q)}`);
        const data = await res.json();
        if (seq === searchSeqRef.current && data.success && Array.isArray(data.data)) {
          setSearchResults(data.data);
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
      try {
        const res = await fetch(
          `/api/search?keyword=${encodeURIComponent(q)}&source=${source.id}`
        );
        const data = await res.json();

        // Discard stale responses from older searches
        if (seq !== searchSeqRef.current) return;

        if (data.success && Array.isArray(data.data) && data.data.length > 0) {
          const items = data.data.map((item: SearchResult) => ({
            ...item,
            sourceId: item.sourceId || source.id,
          }));

          // Render this source's results immediately!
          setSearchResults((prev) => {
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
            <Flame className="w-3 h-3 text-amber-600" />
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
            searchResults.length === 0 ? (
              isSearching ? (
                <div className="py-16 text-center flex flex-col items-center justify-center gap-3">
                  <div className="w-6 h-6 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  <p className="text-xs text-zinc-500 font-mono">正在检索全网各书源...</p>
                </div>
              ) : (
                <div className="py-16 text-center text-zinc-400 text-xs">
                  全网各书源均未找到与 "{keyword}" 相关的书籍，请尝试更换关键词。
                </div>
              )
            ) : (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-[11px] text-zinc-400 font-mono px-1">
                  <span>找到 {searchResults.length} 本相关作品</span>
                  {isSearching && (
                    <span className="flex items-center gap-1.5 text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded-full border border-zinc-200">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span>正在检索更多书源 ({completedCount}/{totalCount})...</span>
                    </span>
                  )}
                </div>

                {searchResults.map((book) => {
                  const sourceName = sourceMap.get(book.sourceId) || book.sourceId;
                  return (
                    <Link
                      key={`${book.sourceId}-${book.id}`}
                      href={`/book/${book.id}?source=${book.sourceId}`}
                      onClick={onClose}
                      className="flex gap-3.5 p-3 rounded-xl bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 hover:border-zinc-300 transition-all group"
                    >
                      <div className="w-14 aspect-[4/5] bg-zinc-100 rounded-md overflow-hidden shrink-0 relative border border-zinc-200">
                        <BookCoverPlaceholder title={book.title} className="absolute inset-0" />
                        {book.cover ? (
                          <img
                            src={book.cover}
                            alt={book.title}
                            className="relative w-full h-full object-cover group-hover:scale-105 transition-transform"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        ) : null}
                      </div>
                      <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <h4 className="font-medium text-zinc-900 text-xs sm:text-sm group-hover:opacity-75 transition-opacity line-clamp-1">
                              {book.title}
                            </h4>
                            {sourceName && (
                              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-600 border border-zinc-200 flex-shrink-0">
                                {sourceName}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-zinc-500 mt-0.5">作者：{book.author || '佚名'}</p>
                          {book.intro && (
                            <p className="text-[11px] text-zinc-400 mt-1 line-clamp-2 leading-relaxed">
                              {book.intro}
                            </p>
                          )}
                        </div>
                        {book.latestChapter && (
                          <p className="text-[10px] text-zinc-500 font-mono truncate mt-1">
                            最新：{book.latestChapter}
                          </p>
                        )}
                      </div>
                    </Link>
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
