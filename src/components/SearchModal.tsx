'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { SearchResult, SourceMeta } from '@/sources/types';
import { BookCoverPlaceholder } from './BookCoverPlaceholder';
import { Search, X, Flame, RefreshCw, BookOpen } from 'lucide-react';

const HOT_KEYWORDS = ['重生', '穿越', '综漫', '都市', '武侠', '系统', '反派', '仙侠'];

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  sources: SourceMeta[];
  selectedSourceId: string;
  onSelectSource?: (sourceId: string) => void;
}

export const SearchModal: React.FC<SearchModalProps> = ({
  isOpen,
  onClose,
  sources,
  selectedSourceId,
  onSelectSource,
}) => {
  const [keyword, setKeyword] = useState('');
  const [currentSource, setCurrentSource] = useState(selectedSourceId);
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync selectedSourceId prop
  useEffect(() => {
    if (selectedSourceId) {
      setCurrentSource(selectedSourceId);
    }
  }, [selectedSourceId]);

  // Auto focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    } else {
      setKeyword('');
      setSearchResults([]);
      setHasSearched(false);
    }
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSearch = async (queryToSearch?: string) => {
    const q = (queryToSearch !== undefined ? queryToSearch : keyword).trim();
    if (!q) return;

    setIsSearching(true);
    setHasSearched(true);

    try {
      const res = await fetch(
        `/api/search?keyword=${encodeURIComponent(q)}&source=${currentSource}`
      );
      const data = await res.json();
      if (data.success && data.data) {
        setSearchResults(data.data);
      } else {
        setSearchResults([]);
      }
    } catch {
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSearch();
  };

  const handleHotTagClick = (tag: string) => {
    setKeyword(tag);
    handleSearch(tag);
  };

  const handleSourceChange = (sourceId: string) => {
    setCurrentSource(sourceId);
    if (onSelectSource) {
      onSelectSource(sourceId);
    }
    if (keyword.trim() && hasSearched) {
      // Re-search under new source
      setIsSearching(true);
      fetch(`/api/search?keyword=${encodeURIComponent(keyword.trim())}&source=${sourceId}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.data) setSearchResults(data.data);
        })
        .finally(() => setIsSearching(false));
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center p-3 sm:p-6 md:pt-16 bg-black/60 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-zinc-200 overflow-hidden flex flex-col max-h-[88vh] animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Search Bar */}
        <div className="p-3.5 sm:p-4 border-b border-zinc-200 bg-white flex items-center gap-2">
          <form onSubmit={handleSubmit} className="flex-1 flex items-center gap-2">
            <div className="relative flex-1 flex items-center bg-zinc-100 rounded-xl px-3 py-2 border border-zinc-200/80 focus-within:ring-2 focus-within:ring-black focus-within:border-black focus-within:bg-white transition-all">
              <Search className="w-4 h-4 text-zinc-400 shrink-0 mr-2" />
              <input
                ref={inputRef}
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="搜索书名、作者或主角..."
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

            {/* Source Selector */}
            {sources.length > 0 && (
              <select
                value={currentSource}
                onChange={(e) => handleSourceChange(e.target.value)}
                className="text-xs bg-zinc-100 hover:bg-zinc-200 text-zinc-800 py-2.5 px-2.5 rounded-xl border border-zinc-200 cursor-pointer font-medium max-w-[100px] sm:max-w-none truncate"
                title="切换搜索书源"
              >
                {sources.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            )}

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

          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 rounded-xl transition-colors"
            title="关闭 (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Hot Keyword Tags */}
        <div className="px-4 py-2.5 bg-zinc-50/70 border-b border-zinc-100 flex items-center gap-2 overflow-x-auto scrollbar-none">
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
          {isSearching ? (
            <div className="py-16 text-center flex flex-col items-center justify-center gap-3">
              <div className="w-6 h-6 border-2 border-black border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-zinc-500 font-mono">正在检索各书源章节库...</p>
            </div>
          ) : hasSearched ? (
            searchResults.length === 0 ? (
              <div className="py-16 text-center text-zinc-400 text-xs">
                未找到与 "{keyword}" 相关的书籍，可尝试切换右上角书源后重新搜索。
              </div>
            ) : (
              <div className="space-y-2.5">
                <div className="text-[11px] text-zinc-400 font-mono px-1">
                  找到 {searchResults.length} 本相关作品
                </div>
                {searchResults.map((book) => (
                  <Link
                    key={book.id}
                    href={`/book/${book.id}?source=${book.sourceId || currentSource}`}
                    onClick={onClose}
                    className="flex gap-3.5 p-3 rounded-xl bg-zinc-50/60 hover:bg-zinc-100 border border-zinc-200/70 hover:border-zinc-300 transition-all group"
                  >
                    <div className="w-14 aspect-[2/3] bg-zinc-100 rounded-md overflow-hidden shrink-0 relative border border-zinc-200">
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
                        <h4 className="font-medium text-zinc-900 text-xs sm:text-sm group-hover:text-amber-800 transition-colors line-clamp-1">
                          {book.title}
                        </h4>
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
                ))}
              </div>
            )
          ) : (
            <div className="py-12 text-center flex flex-col items-center justify-center text-zinc-400 gap-2">
              <BookOpen className="w-8 h-8 opacity-40" />
              <p className="text-xs">输入任意书名或主角名字快速检索全网小说</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
