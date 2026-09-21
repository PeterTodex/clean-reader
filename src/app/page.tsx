'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Header } from '@/components/Header';
import { HomeFeed } from '@/components/HomeFeed';
import { SearchModal } from '@/components/SearchModal';
import { SourceMeta, HomeSection } from '@/sources/types';
import { storage, HistoryItem, BookshelfItem } from '@/lib/storage';
import { BookOpen, ArrowRight } from 'lucide-react';

export default function HomePage() {
  const [sources, setSources] = useState<SourceMeta[]>([]);
  const [selectedSource, setSelectedSource] = useState<string>('');
  const [homeSections, setHomeSections] = useState<HomeSection[]>([]);
  const [isLoadingHome, setIsLoadingHome] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [recentBook, setRecentBook] = useState<HistoryItem | BookshelfItem | null>(null);

  // Load recent reading record on mount
  useEffect(() => {
    const history = storage.getHistory();
    if (history.length > 0 && history[0].lastChapterId) {
      setRecentBook(history[0]);
    } else {
      const shelf = storage.getBookshelf();
      if (shelf.length > 0 && shelf[0].lastChapterId) {
        setRecentBook(shelf[0]);
      }
    }
  }, []);

  // Load sources on mount and check URL for ?search=1
  useEffect(() => {
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

    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('search') === '1' || params.get('search') === 'open') {
        setShowSearchModal(true);
      }
    }
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

  return (
    <div className="min-h-screen flex flex-col transition-colors duration-200">
      <Header onSearchClick={() => setShowSearchModal(true)} />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 pb-6 sm:pb-8 space-y-6">
        {/* Quick Resume Reading Banner */}
        {recentBook && recentBook.lastChapterId && (
          <div className="flex items-center justify-between py-2.5 border-b border-zinc-200/70 group">
            <div className="flex items-center gap-2 min-w-0">
              <BookOpen className="w-4 h-4 text-zinc-800 shrink-0" />
              <span className="text-xs text-zinc-500 shrink-0 font-medium hidden sm:inline">上次读到：</span>
              <span className="text-xs font-bold text-zinc-950 truncate group-hover:text-black">
                {recentBook.title}
              </span>
              {recentBook.lastChapterTitle && (
                <span className="text-xs text-zinc-500 truncate hidden md:inline font-mono">
                  · {recentBook.lastChapterTitle}
                </span>
              )}
            </div>
            <Link
              href={`/read/${recentBook.id}/${recentBook.lastChapterId}?source=${recentBook.sourceId}`}
              className="px-3 py-1.5 bg-black hover:bg-zinc-800 text-white rounded-lg text-xs font-medium shrink-0 ml-3 flex items-center gap-1.5 transition-colors shadow-2xs"
            >
              <span>继续阅读</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        )}

        {/* Source Switcher */}
        <div className="flex items-center gap-2 border-b border-zinc-200/80 pb-4">
          <span className="text-xs text-zinc-500 font-mono font-medium flex-shrink-0">书源广场：</span>
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
            {sources.map((s) => (
              <button
                key={s.id}
                onClick={() => setSelectedSource(s.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
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

        {/* Source Home Content Feed */}
        <HomeFeed
          sections={homeSections}
          sourceId={selectedSource}
          loading={isLoadingHome}
        />
      </main>

      {/* Floating Search Modal */}
      <SearchModal
        isOpen={showSearchModal}
        onClose={() => setShowSearchModal(false)}
        sources={sources}
        selectedSourceId={selectedSource}
        onSelectSource={setSelectedSource}
      />
    </div>
  );
}
