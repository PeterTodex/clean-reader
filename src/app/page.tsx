'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Header } from '@/components/Header';
import { HomeFeed } from '@/components/HomeFeed';
import { SearchModal } from '@/components/SearchModal';
import { SourceMeta, HomeSection } from '@/sources/types';
import { Search } from 'lucide-react';

export default function HomePage() {
  const [sources, setSources] = useState<SourceMeta[]>([]);
  const [selectedSource, setSelectedSource] = useState<string>('');
  const [homeSections, setHomeSections] = useState<HomeSection[]>([]);
  const [isLoadingHome, setIsLoadingHome] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);

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
    <div className="min-h-screen flex flex-col bg-[#fafafa]">
      <Header onSearchClick={() => setShowSearchModal(true)} />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-6 sm:py-8 space-y-8">
        {/* Source Switcher & Quick Search Entry */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200/80 pb-4">
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500 font-mono font-medium">书源广场：</span>
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

          <button
            onClick={() => setShowSearchModal(true)}
            className="flex items-center gap-2 px-3.5 py-1.5 text-xs text-zinc-500 hover:text-zinc-950 bg-white hover:bg-zinc-50 border border-zinc-200/90 rounded-xl shadow-xs transition-all cursor-pointer"
            title="点击搜索小说"
          >
            <Search className="w-3.5 h-3.5 text-zinc-400" />
            <span>搜索全网小说...</span>
          </button>
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

      {/* Footer */}
      <footer className="border-t border-zinc-200 py-6 text-center text-xs text-zinc-400 mt-auto bg-white">
        <div className="max-w-5xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2 font-mono">
          <span>清阅 · 个人极简小说阅读器</span>
          <div className="flex items-center gap-4">
            <Link href="/bookshelf" className="hover:text-zinc-800 transition-colors">
              我的书架
            </Link>
            <span>·</span>
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
