'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Header } from '@/components/Header';
import { Bookshelf } from '@/components/Bookshelf';
import { BookCoverPlaceholder } from '@/components/BookCoverPlaceholder';
import { SearchResult, SourceMeta, HomeSection } from '@/sources/types';
import { BookshelfItem, storage } from '@/lib/storage';
import { HomeFeed } from '@/components/HomeFeed';
import {
  Search,
  BookOpen,
  Terminal,
  Library,
  Flame,
  RefreshCw,
} from 'lucide-react';

const HOT_KEYWORDS = ['重生', '穿越', '综漫', '都市', '武侠', '系统', '反派', '仙侠'];

export default function HomePage() {
  const [keyword, setKeyword] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [sources, setSources] = useState<SourceMeta[]>([]);
  const [selectedSource, setSelectedSource] = useState<string>('');
  const [bookshelfItems, setBookshelfItems] = useState<BookshelfItem[]>([]);
  const [homeSections, setHomeSections] = useState<HomeSection[]>([]);
  const [isLoadingHome, setIsLoadingHome] = useState(false);
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

  // Fetch home feed when selectedSource changes
  useEffect(() => {
    if (!selectedSource) return;
    setIsLoadingHome(true);
    fetch(`/api/home?source=${selectedSource}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.data)) {
          setHomeSections(data.data);
        } else {
          setHomeSections([]);
        }
      })
      .catch((e) => {
        console.warn('Failed to load home feed:', e);
        setHomeSections([]);
      })
      .finally(() => setIsLoadingHome(false));
  }, [selectedSource]);

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
    <div className="min-h-screen flex flex-col bg-[#fafafa]">
      <Header onSearchFocus={focusSearch} />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-8 sm:py-12 space-y-12">
        {/* Hero & Search Section */}
        <section className="text-center max-w-2xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-100 text-zinc-900 text-xs font-mono font-medium border border-zinc-200 shadow-sm">
            <Terminal className="w-3.5 h-3.5 text-zinc-900" />
            纯净 · 无广告 · 多书源
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-zinc-950 tracking-tight">
            极简 · 高效 · 纯粹悦读
          </h1>
          <p className="text-zinc-500 text-sm sm:text-base">
            自动过滤多余弹窗广告、智能优化排版审美、支持多书源线路与智能章节合并。
          </p>

          {/* Search Bar */}
          <form onSubmit={handleFormSubmit} className="pt-2">
            <div className="relative flex items-center bg-white rounded-xl shadow-sm border border-zinc-300 p-1.5 focus-within:ring-2 focus-within:ring-black focus-within:border-black transition-all">
              <Search className="w-5 h-5 text-zinc-400 ml-3.5 flex-shrink-0" />
              <input
                ref={searchInputRef}
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="输入书名、主角或关键词搜索..."
                className="w-full px-3 py-2.5 text-sm sm:text-base bg-transparent border-none focus:outline-none text-zinc-900 placeholder-zinc-400"
              />

              {/* Source Selector */}
              {sources.length > 0 && (
                <div className="flex items-center pr-2 border-r border-zinc-200 mr-2 shrink-0">
                  <select
                    value={selectedSource}
                    onChange={(e) => setSelectedSource(e.target.value)}
                    className="text-xs bg-zinc-100 text-zinc-800 py-1.5 px-2 rounded-lg border-none focus:ring-1 focus:ring-black cursor-pointer font-medium max-w-[85px] sm:max-w-none truncate"
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
                className="px-5 py-2.5 rounded-lg bg-black hover:bg-zinc-800 text-white text-sm font-medium transition-colors flex items-center gap-2 flex-shrink-0 shadow-sm disabled:opacity-60"
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
            <span className="text-xs text-zinc-400 flex items-center gap-1 font-mono">
              <Flame className="w-3.5 h-3.5 text-zinc-900" />
              热门：
            </span>
            {HOT_KEYWORDS.map((kw) => (
              <button
                key={kw}
                onClick={() => handleHotSearch(kw)}
                className="text-xs px-2.5 py-1 rounded-md bg-zinc-100 hover:bg-zinc-200 text-zinc-700 hover:text-zinc-950 transition-colors border border-zinc-200/60"
              >
                {kw}
              </button>
            ))}
          </div>
        </section>

        {/* Search Results Display */}
        {hasSearched && (
          <section className="space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
              <h2 className="font-bold text-lg text-zinc-950 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-black" />
                搜索结果 ({searchResults.length})
              </h2>
              <button
                onClick={() => {
                  setHasSearched(false);
                  setSearchResults([]);
                }}
                className="text-xs text-zinc-500 hover:text-zinc-900"
              >
                收起结果
              </button>
            </div>

            {searchResults.length === 0 && !isSearching ? (
              <div className="py-12 text-center text-zinc-400 text-sm">
                未找到与 "{keyword}" 相关的书籍，请尝试更换关键词或在书源设置中切换线路。
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {searchResults.map((book) => (
                  <Link
                    key={book.id}
                    href={`/book/${book.id}?source=${book.sourceId}`}
                    className="flex gap-3.5 p-3.5 bg-white rounded-xl border border-zinc-200 shadow-sm hover:shadow hover:border-black transition-all group"
                  >
                    <div className="w-20 aspect-[2/3] bg-zinc-100 rounded-lg overflow-hidden flex-shrink-0 relative border border-zinc-200">
                      <BookCoverPlaceholder title={book.title} className="absolute inset-0" />
                      {book.cover ? (
                        <img
                          src={book.cover}
                          alt={book.title}
                          className="relative w-full h-full object-cover group-hover:scale-105 transition-transform"
                          onError={(e) => {
                            // Reveal the placeholder underneath instead of a broken image.
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      ) : null}
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                      <div>
                        <h4 className="font-medium text-zinc-900 text-sm group-hover:text-black transition-colors line-clamp-1">
                          {book.title}
                        </h4>
                        <p className="text-xs text-zinc-500 mt-1">作者：{book.author}</p>
                        {book.intro && (
                          <p className="text-xs text-zinc-400 mt-1.5 line-clamp-2 leading-relaxed">
                            {book.intro}
                          </p>
                        )}
                      </div>
                      <div className="pt-2 text-[11px] text-zinc-600 font-medium line-clamp-1">
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
          <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
            <h2 className="font-bold text-lg text-zinc-950 flex items-center gap-2">
              <Library className="w-5 h-5 text-black" />
              我的书架
            </h2>
            <span className="text-xs text-zinc-500 font-mono">
              藏书 {bookshelfItems.length} 本
            </span>
          </div>

          <Bookshelf
            items={bookshelfItems}
            onRefresh={handleRefreshShelf}
            onOpenSearch={focusSearch}
          />
        </section>

        {/* Source Switcher & Home Feed */}
        {(homeSections.length > 0 || isLoadingHome || sources.length > 1) && (
          <section className="space-y-6">
            {sources.length > 1 && (
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-500 font-mono">书源广场：</span>
                  <div className="flex items-center gap-1.5 overflow-x-auto">
                    {sources.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => setSelectedSource(s.id)}
                        className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                          selectedSource === s.id
                            ? 'bg-black text-white shadow-xs'
                            : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                        }`}
                      >
                        {s.name}
                      </button>
                    ))}
                  </div>
                </div>

                <span className="text-[11px] text-zinc-400 font-mono hidden sm:inline">
                  随书源切换展示不同主页
                </span>
              </div>
            )}

            <HomeFeed
              sections={homeSections}
              sourceId={selectedSource}
              loading={isLoadingHome}
            />
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-200 py-6 text-center text-xs text-zinc-400 mt-auto bg-white">
        <div className="max-w-5xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2 font-mono">
          <span>清阅 · 个人极简小说阅读器</span>
          <div className="flex items-center gap-4">
            <Link href="/sources" className="hover:text-zinc-800 transition-colors">
              书源引擎
            </Link>
            <span>·</span>
            <span>无广告 · 极简黑白</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
