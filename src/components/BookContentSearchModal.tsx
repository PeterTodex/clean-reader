'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { ChapterItem } from '@/sources/types';
import { BookSearchResult, ChapterSearchMatch } from '@/lib/chapter-cache';
import { Drawer } from './Drawer';
import {
  X,
  Search,
  Loader2,
  BookOpen,
  ChevronRight,
  Sparkles,
} from 'lucide-react';

interface BookContentSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookId: string;
  sourceId: string;
  currentChapterId: string;
  chapters: ChapterItem[];
  themeClass?: string;
  onSelectChapter: (chapterId: string, keyword: string) => void;
}

export const BookContentSearchModal: React.FC<BookContentSearchModalProps> = ({
  isOpen,
  onClose,
  bookId,
  sourceId,
  currentChapterId,
  chapters,
  themeClass = '',
  onSelectChapter,
}) => {
  const [keyword, setKeyword] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<BookSearchResult | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'past' | 'future'>('all');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  // Current reading chapter index in chapters list
  const currentChapterIndex = useMemo(() => {
    return chapters.findIndex((c) => String(c.id) === String(currentChapterId));
  }, [chapters, currentChapterId]);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = keyword.trim();
    if (!clean) return;

    setIsSearching(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/book/search-content?bookId=${encodeURIComponent(bookId)}&source=${encodeURIComponent(
          sourceId
        )}&keyword=${encodeURIComponent(clean)}`
      );
      const data = await res.json();
      if (data.success && data.data) {
        setSearchResult(data.data);
      } else {
        setError(data.error || '检索失败');
      }
    } catch (err: any) {
      setError(err.message || '网络请求错误');
    } finally {
      setIsSearching(false);
    }
  };

  // Classify chapters into past, current, future
  const categorizedResults = useMemo(() => {
    if (!searchResult || !searchResult.results) {
      return { all: [], past: [], future: [] };
    }

    const past: (ChapterSearchMatch & { relation: 'past' | 'current' | 'future'; displayIndex: number })[] = [];
    const future: (ChapterSearchMatch & { relation: 'past' | 'current' | 'future'; displayIndex: number })[] = [];
    const all: (ChapterSearchMatch & { relation: 'past' | 'current' | 'future'; displayIndex: number })[] = [];

    searchResult.results.forEach((item) => {
      const idx = chapters.findIndex((c) => String(c.id) === String(item.chapterId));
      let relation: 'past' | 'current' | 'future' = 'past';
      if (idx !== -1 && currentChapterIndex !== -1) {
        if (idx < currentChapterIndex) relation = 'past';
        else if (idx === currentChapterIndex) relation = 'current';
        else relation = 'future';
      } else {
        // Fallback by item.index
        const currNum = currentChapterIndex !== -1 ? currentChapterIndex + 1 : 1;
        if (item.index < currNum) relation = 'past';
        else if (item.index === currNum) relation = 'current';
        else relation = 'future';
      }

      const enriched = { ...item, relation, displayIndex: idx !== -1 ? idx + 1 : item.index };
      all.push(enriched);
      if (relation === 'past' || relation === 'current') past.push(enriched);
      if (relation === 'future') future.push(enriched);
    });

    return { all, past, future };
  }, [searchResult, chapters, currentChapterIndex]);

  const displayedList = useMemo(() => {
    if (activeTab === 'past') return categorizedResults.past;
    if (activeTab === 'future') return categorizedResults.future;
    return categorizedResults.all;
  }, [activeTab, categorizedResults]);

  const highlightKeywordInText = (text: string, targetKeyword: string) => {
    if (!targetKeyword) return text;
    const parts = text.split(new RegExp(`(${targetKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
    return parts.map((part, i) =>
      part.toLowerCase() === targetKeyword.toLowerCase() ? (
        <mark key={i} className="highlight-search-kw">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      side="right"
      width="max-w-lg w-full"
      className={themeClass}
    >
        {/* Header */}
        <div className="p-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-zinc-900" />
            <h3 className="font-bold text-sm text-zinc-950">正文关键字检索</h3>
            {searchResult && (
              <span className="text-xs font-mono text-zinc-400">
                （命中 {searchResult.matchedChapterCount} 章 / {searchResult.totalMatches} 次）
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 rounded-md transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search Input Bar */}
        <div className="p-3 border-b border-zinc-100 bg-white">
          <form onSubmit={handleSearch} className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-2.5" />
              <input
                ref={inputRef}
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="搜索角色名、地名、功法或台词..."
                className="w-full pl-9 pr-8 py-1.5 text-xs bg-zinc-100 rounded-lg border border-zinc-200 focus:outline-none focus:ring-1 focus:ring-zinc-400 focus:border-zinc-400 transition-all text-zinc-900 placeholder-zinc-400"
              />
              {keyword && (
                <button
                  type="button"
                  onClick={() => {
                    setKeyword('');
                    setSearchResult(null);
                    inputRef.current?.focus();
                  }}
                  className="absolute right-2.5 top-2.5 text-zinc-400 hover:text-zinc-700"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <button
              type="submit"
              disabled={isSearching || !keyword.trim()}
              className="px-3.5 py-1.5 text-xs font-medium bg-black text-white rounded-lg hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all shrink-0 flex items-center gap-1 shadow-xs"
            >
              {isSearching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              <span>检索</span>
            </button>
          </form>

          {/* Filter Tabs */}
          {searchResult && (
            <div className="mt-3 pt-2.5 border-t border-zinc-100 flex items-center justify-between text-xs">
              <div className="flex items-center gap-1 bg-zinc-100 p-0.5 rounded-lg font-mono">
                <button
                  onClick={() => setActiveTab('all')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                    activeTab === 'all'
                      ? 'bg-white text-zinc-950 shadow-xs font-bold'
                      : 'text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  全部 ({categorizedResults.all.length})
                </button>
                <button
                  onClick={() => setActiveTab('past')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                    activeTab === 'past'
                      ? 'bg-white text-zinc-950 shadow-xs font-bold'
                      : 'text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  过往 ({categorizedResults.past.length})
                </button>
                <button
                  onClick={() => setActiveTab('future')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                    activeTab === 'future'
                      ? 'bg-white text-zinc-950 shadow-xs font-bold'
                      : 'text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  后续 ({categorizedResults.future.length})
                </button>
              </div>

              <span className="text-[11px] text-zinc-500 font-mono">
                共 {searchResult.totalMatches} 处出现
              </span>
            </div>
          )}
        </div>

        {/* Results Body */}
        <div className="flex-1 overflow-y-auto divide-y divide-zinc-100">
          {isSearching ? (
            <div className="py-20 flex flex-col items-center justify-center text-zinc-400 gap-3">
              <Loader2 className="w-6 h-6 animate-spin text-zinc-600" />
              <p className="text-xs font-mono">正在极速扫描本地已缓存章节...</p>
            </div>
          ) : error ? (
            <div className="py-16 text-center px-6">
              <p className="text-xs text-red-600 mb-2">{error}</p>
              <button
                onClick={() => handleSearch()}
                className="text-xs underline text-zinc-600 hover:text-black"
              >
                重试
              </button>
            </div>
          ) : searchResult ? (
            displayedList.length === 0 ? (
              <div className="py-20 text-center text-zinc-400 text-xs px-6 space-y-1.5">
                <BookOpen className="w-6 h-6 mx-auto opacity-40 mb-2" />
                <p>该分类下暂无包含 “{searchResult.keyword}” 的章节</p>
                {searchResult.cachedChapterCount < searchResult.totalChapterCount && (
                  <p className="text-[11px] text-zinc-400">
                    （当前本地缓存了 {searchResult.cachedChapterCount}/{searchResult.totalChapterCount} 章，可在目录中点击【缓存全部】后再次检索）
                  </p>
                )}
              </div>
            ) : (
              displayedList.map((item) => (
                <div
                  key={item.chapterId}
                  onClick={() => {
                    onSelectChapter(item.chapterId, searchResult.keyword);
                    onClose();
                  }}
                  className="p-3.5 hover:bg-zinc-100/50 transition-colors cursor-pointer group"
                >
                  {/* Chapter title line */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {/* Relative badge */}
                      {item.relation === 'current' ? (
                        <span className="chapter-badge-current text-[10px] font-mono font-medium px-1.5 py-0.5 rounded shrink-0">
                          当前阅读
                        </span>
                      ) : item.relation === 'past' ? (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-600 shrink-0">
                          过往
                        </span>
                      ) : (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-100 shrink-0">
                          后续
                        </span>
                      )}

                      <h4 className="text-xs sm:text-sm font-medium text-zinc-900 group-hover:opacity-75 transition-opacity truncate">
                        {item.title}
                      </h4>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[10px] font-mono text-zinc-600 bg-zinc-100 px-1.5 py-0.5 rounded border border-zinc-200">
                        出现 {item.count} 次
                      </span>
                      <ChevronRight className="w-3.5 h-3.5 text-zinc-300 group-hover:text-zinc-500 transition-colors" />
                    </div>
                  </div>

                  {/* Snippet preview - follows theme, clean and unboxed */}
                  <div className="mt-1.5 space-y-1">
                    {item.snippets.map((snippet, sIdx) => (
                      <p
                        key={sIdx}
                        className="text-xs text-zinc-500 leading-relaxed"
                      >
                        “{highlightKeywordInText(snippet, searchResult.keyword)}”
                      </p>
                    ))}
                  </div>
                </div>
              ))
            )
          ) : (
            <div className="py-24 text-center text-zinc-400 px-6 flex flex-col items-center justify-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-400">
                <Sparkles className="w-4 h-4" />
              </div>
              <p className="text-xs text-zinc-600 font-medium">全书章节正文关键词检索</p>
              <p className="text-[11px] text-zinc-400 max-w-xs leading-relaxed">
                输入主角名、配角名或任意词汇，一览其在过往与后续章节的出场记录与频次，点击直接跳转。
              </p>
            </div>
          )}
        </div>

        {/* Footer info */}
        {searchResult && (
          <div className="p-3 border-t border-zinc-100 bg-zinc-50/50 text-[11px] text-zinc-500 flex items-center justify-between font-mono">
            <span>已扫描 {searchResult.cachedChapterCount} 个本地缓存章节</span>
            <span className="text-zinc-400">点击卡片直接跳转正文</span>
          </div>
        )}
    </Drawer>
  );
};
