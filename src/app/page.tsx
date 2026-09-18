'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Header } from '@/components/Header';
import { Bookshelf } from '@/components/Bookshelf';
import { SearchResult, SourceMeta } from '@/sources/types';
import { BookshelfItem, storage } from '@/lib/storage';
import {
  Search,
  BookOpen,
  Sparkles,
  Library,
  Flame,
  ArrowRight,
  RefreshCw,
  Sliders,
} from 'lucide-react';

const HOT_KEYWORDS = ['重生', '穿越', '综漫', '都市', '武侠', '系统', '反派', '仙侠'];

export default function HomePage() {
  const [keyword, setKeyword] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [sources, setSources] = useState<SourceMeta[]>([]);
  const [selectedSource, setSelectedSource] = useState<string>('diyibanzhu');
  const [bookshelfItems, setBookshelfItems] = useState<BookshelfItem[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Load bookshelf and sources on mount
  useEffect(() => {
    setBookshelfItems(storage.getBookshelf());

    fetch('/api/sources')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.data) {
          setSources(data.data);
          if (data.data.length > 0) {
            setSelectedSource(data.data[0].id);
          }
        }
      })
      .catch((e) => console.error('Failed to load sources:', e));
  }, []);

  const handleRefreshShelf = () => {
    setBookshelfItems(storage.getBookshelf());
  };

  const handleSearch = async (queryToSearch?: string) => {
    const q = (queryToSearch !== undefined ? queryToSearch : keyword).trim();
    if (!q) return;

    setIsSearching(true);
    setHasSearched(true);

    try {
      const res = await fetch(`/api/search?keyword=${encodeURIComponent(q)}&source=${selectedSource}`);
      const data = await res.json();
      if (data.success && data.data) {
        setSearchResults(data.data);
      } else {
        setSearchResults([]);
        alert(data.error || '未搜索到结果');
      }
    } catch (err: any) {
      alert(`搜索出错: ${err.message}`);
    } finally {
      setIsSearching(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSearch();
  };

  const handleHotSearch = (kw: string) => {
    setKeyword(kw);
    handleSearch(kw);
  };

  const focusSearch = () => {
    searchInputRef.current?.focus();
    searchInputRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#faf8f5]">
      <Header onSearchFocus={focusSearch} />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-8 sm:py-12 space-y-12">
        {/* Hero & Search Section */}
        <section className="text-center max-w-2xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-100/80 text-amber-900 text-xs font-medium border border-amber-200/60 shadow-sm">
            <Sparkles className="w-3.5 h-3.5 text-amber-800" />
            清新无广 · 极速加载 · 纯粹悦读
          </div>
          <h1 className="text-3xl sm:text-4xl font-serif font-bold text-stone-900 tracking-tight">
            回归纯粹的阅读时光
          </h1>
          <p className="text-stone-500 text-sm sm:text-base">
            自动过滤多余弹窗广告、智能优化排版审美、支持多书源线路与智能章节合并。
          </p>

          {/* Search Bar */}
          <form onSubmit={handleFormSubmit} className="pt-2">
            <div className="relative flex items-center bg-white rounded-2xl shadow-md border border-stone-200/80 p-1.5 focus-within:ring-2 focus-within:ring-amber-800 transition-all">
              <Search className="w-5 h-5 text-stone-400 ml-3.5 flex-shrink-0" />
              <input
                ref={searchInputRef}
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="输入书名、主角或关键词搜索..."
                className="w-full px-3 py-2.5 text-sm sm:text-base bg-transparent border-none focus:outline-none text-stone-800 placeholder-stone-400"
              />

              {/* Source Selector */}
              {sources.length > 0 && (
                <div className="hidden sm:flex items-center pr-2 border-r border-stone-200 mr-2">
                  <select
                    value={selectedSource}
                    onChange={(e) => setSelectedSource(e.target.value)}
                    className="text-xs bg-stone-100 text-stone-700 py-1.5 px-2 rounded-lg border-none focus:ring-1 focus:ring-amber-800 cursor-pointer"
                  >
                    {sources.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <button
                type="submit"
                disabled={isSearching}
                className="px-5 py-2.5 rounded-xl bg-amber-800 hover:bg-amber-900 text-white text-sm font-medium transition-colors flex items-center gap-2 flex-shrink-0 shadow-sm disabled:opacity-60"
              >
                {isSearching ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>检索中</span>
                  </>
                ) : (
                  <span>搜索</span>
                )}
              </button>
            </div>
          </form>

          {/* Hot Tags */}
          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            <span className="text-xs text-stone-400 flex items-center gap-1">
              <Flame className="w-3.5 h-3.5 text-amber-600" />
              热搜词：
            </span>
            {HOT_KEYWORDS.map((kw) => (
              <button
                key={kw}
                onClick={() => handleHotSearch(kw)}
                className="text-xs px-2.5 py-1 rounded-full bg-stone-100/80 hover:bg-stone-200/80 text-stone-600 hover:text-stone-900 transition-colors"
              >
                {kw}
              </button>
            ))}
          </div>
        </section>

        {/* Search Results Display */}
        {hasSearched && (
          <section className="space-y-4">
            <div className="flex items-center justify-between border-b border-stone-200 pb-3">
              <h2 className="font-serif font-bold text-lg text-stone-900 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-amber-800" />
                搜索结果 ({searchResults.length})
              </h2>
              <button
                onClick={() => {
                  setHasSearched(false);
                  setSearchResults([]);
                }}
                className="text-xs text-stone-500 hover:text-stone-800"
              >
                收起结果
              </button>
            </div>

            {searchResults.length === 0 && !isSearching ? (
              <div className="py-12 text-center text-stone-400 text-sm">
                未找到与 "{keyword}" 相关的书籍，请尝试更换关键词或在书源设置中切换线路。
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {searchResults.map((book) => (
                  <Link
                    key={book.id}
                    href={`/book/${book.id}?source=${book.sourceId}`}
                    className="flex gap-3.5 p-3.5 bg-white rounded-xl border border-stone-200/80 shadow-sm hover:shadow-md hover:border-amber-700/40 transition-all group"
                  >
                    <div className="w-20 aspect-[2/3] bg-stone-100 rounded-lg overflow-hidden flex-shrink-0 relative">
                      {book.cover ? (
                        <img
                          src={book.cover}
                          alt={book.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      ) : null}
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                      <div>
                        <h4 className="font-medium text-stone-900 text-sm group-hover:text-amber-800 transition-colors line-clamp-1">
                          {book.title}
                        </h4>
                        <p className="text-xs text-stone-500 mt-1">作者：{book.author}</p>
                        {book.intro && (
                          <p className="text-xs text-stone-400 mt-1.5 line-clamp-2 leading-relaxed">
                            {book.intro}
                          </p>
                        )}
                      </div>
                      <div className="pt-2 text-[11px] text-amber-900 line-clamp-1">
                        最新：{book.latestChapter || '点击阅读'}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Bookshelf Section */}
        <section className="space-y-4">
          <div className="flex items-center justify-between border-b border-stone-200 pb-3">
            <h2 className="font-serif font-bold text-lg text-stone-900 flex items-center gap-2">
              <Library className="w-5 h-5 text-amber-800" />
              我的书架
            </h2>
            <span className="text-xs text-stone-500">
              共收藏 {bookshelfItems.length} 本书籍
            </span>
          </div>

          <Bookshelf
            items={bookshelfItems}
            onRefresh={handleRefreshShelf}
            onOpenSearch={focusSearch}
          />
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-stone-200 py-6 text-center text-xs text-stone-400 mt-auto">
        <div className="max-w-5xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>清阅 · 纯个人自用无广告阅读器</span>
          <div className="flex items-center gap-4">
            <Link href="/sources" className="hover:text-stone-600 transition-colors">
              书源线路管理
            </Link>
            <span>·</span>
            <span>自适应排版 · 自动防屏蔽</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
