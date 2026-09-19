'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { HomeSection, HomeBookItem } from '@/sources/types';
import { BookCoverPlaceholder } from './BookCoverPlaceholder';
import { Flame, Trophy, Layers, Clock, Sparkles } from 'lucide-react';

interface HomeFeedProps {
  sections: HomeSection[];
  sourceId: string;
  loading: boolean;
}

export const HomeFeed: React.FC<HomeFeedProps> = ({ sections, sourceId, loading }) => {
  // Track active tabs for any 'tabs' type sections
  const [activeTabs, setActiveTabs] = useState<Record<string, number>>({});

  if (loading) {
    return (
      <section className="space-y-8 animate-pulse">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 bg-zinc-200 rounded" />
          <div className="w-32 h-6 bg-zinc-200 rounded" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="w-full aspect-[4/5] bg-zinc-200 rounded-lg" />
              <div className="w-3/4 h-4 bg-zinc-200 rounded" />
              <div className="w-1/2 h-3 bg-zinc-100 rounded" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  // If no sections or all empty, render nothing
  if (!sections || sections.length === 0) {
    return null;
  }

  const handleTabClick = (sectionId: string, tabIndex: number) => {
    setActiveTabs((prev) => ({ ...prev, [sectionId]: tabIndex }));
  };

  const getSectionIcon = (id: string, type: string) => {
    if (id.includes('hot')) return <Flame className="w-5 h-5 text-amber-600" />;
    if (id.includes('rank') || type === 'ranking') return <Trophy className="w-5 h-5 text-amber-600" />;
    if (id.includes('cat') || type === 'tabs') return <Layers className="w-5 h-5 text-zinc-700" />;
    if (id.includes('new')) return <Sparkles className="w-5 h-5 text-amber-600" />;
    return <Clock className="w-5 h-5 text-zinc-600" />;
  };

  return (
    <div className="space-y-12">
      {sections.map((section) => {
        // 1. Grid Type (e.g. 热门小说, 新书上架, 热门推荐, 最新小说)
        if (section.type === 'grid' && section.items && section.items.length > 0) {
          return (
            <section key={section.id} className="space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-200/80 pb-3">
                <div className="flex items-center gap-2">
                  {getSectionIcon(section.id, section.type)}
                  <h2 className="text-lg sm:text-xl font-bold font-serif text-zinc-900 tracking-tight">
                    {section.title}
                  </h2>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3.5 sm:gap-4">
                {section.items.map((book) => (
                  <Link
                    key={book.id}
                    href={`/book/${book.id}?source=${sourceId}`}
                    className="group flex flex-col space-y-2 p-2 rounded-xl bg-white border border-zinc-200/70 shadow-sm hover:shadow-md hover:border-zinc-300 transition-all"
                  >
                    <div className="w-full aspect-[4/5] rounded-lg overflow-hidden relative bg-zinc-100 shadow-inner">
                      {book.cover ? (
                        <img
                          src={book.cover}
                          alt={book.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          loading="lazy"
                          onError={(e) => {
                            // Fallback to placeholder on error
                            e.currentTarget.style.display = 'none';
                            e.currentTarget.parentElement?.querySelector('.cover-placeholder')?.classList.remove('hidden');
                          }}
                        />
                      ) : null}
                      <div className={`cover-placeholder w-full h-full ${book.cover ? 'hidden' : ''}`}>
                        <BookCoverPlaceholder title={book.title} />
                      </div>
                    </div>

                    <div className="flex-1 flex flex-col justify-between">
                      <h3
                        className="font-medium text-xs sm:text-sm text-zinc-900 line-clamp-2 leading-snug group-hover:text-amber-800 transition-colors"
                        title={book.title}
                      >
                        {book.title}
                      </h3>
                      {book.author && (
                        <p className="text-[11px] text-zinc-500 truncate mt-1">{book.author}</p>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          );
        }

        // 2. Ranking Type (e.g. 新作榜, 收藏榜, 热评榜, 本周人气榜)
        if (section.type === 'ranking' && section.columns && section.columns.length > 0) {
          return (
            <section key={section.id} className="space-y-4">
              <div className="flex items-center gap-2 border-b border-zinc-200/80 pb-3">
                {getSectionIcon(section.id, section.type)}
                <h2 className="text-lg sm:text-xl font-bold font-serif text-zinc-900 tracking-tight">
                  {section.title}
                </h2>
              </div>

              <div
                className={`grid grid-cols-1 ${
                  section.columns.length >= 3
                    ? 'sm:grid-cols-2 md:grid-cols-3'
                    : 'sm:grid-cols-2'
                } gap-4 sm:gap-6`}
              >
                {section.columns.map((col, cIdx) => (
                  <div
                    key={cIdx}
                    className="bg-white rounded-2xl border border-zinc-200/80 p-4 sm:p-5 shadow-sm space-y-3"
                  >
                    <div className="flex items-center justify-between border-b border-zinc-100 pb-2.5">
                      <h3 className="font-serif font-bold text-sm sm:text-base text-zinc-900 flex items-center gap-1.5">
                        <span className="w-1.5 h-4 bg-amber-600 rounded-full" />
                        {col.title}
                      </h3>
                      <span className="text-[11px] text-zinc-400 font-mono">TOP {col.items.length}</span>
                    </div>

                    <div className="space-y-2">
                      {col.items.map((book, bIdx) => {
                        const rankNum = book.rank || bIdx + 1;
                        const rankBadgeClass =
                          rankNum === 1
                            ? 'bg-amber-500 text-white shadow-xs font-bold'
                            : rankNum === 2
                            ? 'bg-zinc-400 text-white font-bold'
                            : rankNum === 3
                            ? 'bg-amber-700/80 text-white font-bold'
                            : 'bg-zinc-100 text-zinc-500 font-medium';

                        return (
                          <Link
                            key={book.id}
                            href={`/book/${book.id}?source=${sourceId}`}
                            className="group flex items-center gap-3 p-2 rounded-lg hover:bg-zinc-50 transition-colors"
                          >
                            <span
                              className={`w-5 h-5 flex items-center justify-center text-xs rounded-md shrink-0 font-mono ${rankBadgeClass}`}
                            >
                              {rankNum}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs sm:text-sm font-medium text-zinc-900 truncate group-hover:text-amber-800 transition-colors">
                                {book.title}
                              </p>
                              <div className="flex items-center gap-2 text-[11px] text-zinc-400 mt-0.5">
                                {book.author && <span className="truncate">{book.author}</span>}
                                {book.status && (
                                  <span className="truncate text-zinc-400 font-mono text-[10px]">
                                    {book.status}
                                  </span>
                                )}
                              </div>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          );
        }

        // 3. Tabs Type (e.g. 热门类型 - 奇幻玄幻, BG言情, BL耽美, GL百合, 现代都市, 穿越重生, 武侠仙侠)
        if (section.type === 'tabs' && section.tabs && section.tabs.length > 0) {
          const currentTabIndex = activeTabs[section.id] || 0;
          const currentTab = section.tabs[currentTabIndex] || section.tabs[0];

          return (
            <section key={section.id} className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-200/80 pb-3">
                <div className="flex items-center gap-2">
                  {getSectionIcon(section.id, section.type)}
                  <h2 className="text-lg sm:text-xl font-bold font-serif text-zinc-900 tracking-tight">
                    {section.title}
                  </h2>
                </div>

                {/* Tab Pill Buttons */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
                  {section.tabs.map((tab, tIdx) => (
                    <button
                      key={tab.key || tIdx}
                      onClick={() => handleTabClick(section.id, tIdx)}
                      className={`px-3 py-1 text-xs rounded-full font-medium transition-all whitespace-nowrap ${
                        currentTabIndex === tIdx
                          ? 'bg-zinc-900 text-white shadow-xs'
                          : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200/80'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tab Content Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3.5 sm:gap-4">
                {currentTab?.items?.map((book) => (
                  <Link
                    key={book.id}
                    href={`/book/${book.id}?source=${sourceId}`}
                    className="group flex flex-col space-y-2 p-2 rounded-xl bg-white border border-zinc-200/70 shadow-sm hover:shadow-md hover:border-zinc-300 transition-all"
                  >
                    <div className="w-full aspect-[4/5] rounded-lg overflow-hidden relative bg-zinc-100 shadow-inner">
                      {book.cover ? (
                        <img
                          src={book.cover}
                          alt={book.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          loading="lazy"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            e.currentTarget.parentElement?.querySelector('.cover-placeholder')?.classList.remove('hidden');
                          }}
                        />
                      ) : null}
                      <div className={`cover-placeholder w-full h-full ${book.cover ? 'hidden' : ''}`}>
                        <BookCoverPlaceholder title={book.title} />
                      </div>
                    </div>

                    <div className="flex-1 flex flex-col justify-between">
                      <h3
                        className="font-medium text-xs sm:text-sm text-zinc-900 line-clamp-2 leading-snug group-hover:text-amber-800 transition-colors"
                        title={book.title}
                      >
                        {book.title}
                      </h3>
                      {book.author && (
                        <p className="text-[11px] text-zinc-500 truncate mt-1">{book.author}</p>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          );
        }

        // 4. List Type (e.g. 最新更新)
        if (section.type === 'list' && section.items && section.items.length > 0) {
          return (
            <section key={section.id} className="space-y-4">
              <div className="flex items-center gap-2 border-b border-zinc-200/80 pb-3">
                {getSectionIcon(section.id, section.type)}
                <h2 className="text-lg sm:text-xl font-bold font-serif text-zinc-900 tracking-tight">
                  {section.title}
                </h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {section.items.map((book) => (
                  <Link
                    key={book.id}
                    href={`/book/${book.id}?source=${sourceId}`}
                    className="group flex items-center justify-between p-3 rounded-xl bg-white border border-zinc-200/70 hover:border-zinc-300 hover:shadow-sm transition-all"
                  >
                    <div className="min-w-0 pr-3">
                      <p className="text-xs sm:text-sm font-medium text-zinc-900 truncate group-hover:text-amber-800 transition-colors">
                        {book.title}
                      </p>
                      {book.latestChapter && (
                        <p className="text-[11px] text-zinc-500 truncate mt-0.5 font-serif">
                          {book.latestChapter}
                        </p>
                      )}
                    </div>

                    <div className="shrink-0 text-right">
                      {book.author && (
                        <p className="text-[11px] text-zinc-500 truncate">{book.author}</p>
                      )}
                      {book.updateTime && (
                        <p className="text-[10px] text-zinc-400 font-mono mt-0.5">
                          {book.updateTime}
                        </p>
                      )}
                      {book.status && !book.updateTime && (
                        <p className="text-[10px] text-zinc-400 font-mono mt-0.5">
                          {book.status}
                        </p>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          );
        }

        return null;
      })}
    </div>
  );
};
