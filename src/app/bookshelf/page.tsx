'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/Header';
import { Bookshelf } from '@/components/Bookshelf';
import { BookshelfItem, storage } from '@/lib/storage';
import { Library, ArrowLeft, Search, RefreshCw } from 'lucide-react';

export default function BookshelfPage() {
  const router = useRouter();
  const [items, setItems] = useState<BookshelfItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  const loadBookshelf = () => {
    setItems(storage.getBookshelf());
    setLoaded(true);
  };

  useEffect(() => {
    loadBookshelf();
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-[#fafafa]">
      <Header onSearchFocus={() => router.push('/')} />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-8 sm:py-10 space-y-8">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 pb-5">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="p-2 rounded-lg hover:bg-zinc-200/70 text-zinc-600 hover:text-zinc-900 transition-colors"
              title="返回首页"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-black flex items-center justify-center text-white shadow-xs">
                <Library className="w-4 h-4" />
              </div>
              <h1 className="text-xl sm:text-2xl font-bold font-serif text-zinc-950 tracking-tight">
                我的书架
              </h1>
            </div>
            {loaded && (
              <span className="text-xs text-zinc-500 font-mono bg-zinc-100 px-2.5 py-1 rounded-full border border-zinc-200/80">
                {items.length} 本藏书
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="px-3.5 py-1.5 text-xs font-medium rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-700 transition-colors flex items-center gap-1.5"
            >
              <Search className="w-3.5 h-3.5" />
              <span>发现新书</span>
            </Link>
            <button
              onClick={loadBookshelf}
              className="p-1.5 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-colors"
              title="刷新书架"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Bookshelf Content */}
        {loaded && (
          <Bookshelf
            items={items}
            onRefresh={loadBookshelf}
            onOpenSearch={() => router.push('/')}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-200 py-6 text-center text-xs text-zinc-400 mt-auto bg-white">
        <div className="max-w-5xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2 font-mono">
          <span>清阅 · 个人极简小说阅读器</span>
          <div className="flex items-center gap-4">
            <Link href="/" className="hover:text-zinc-800 transition-colors">
              首页发现
            </Link>
            <span>·</span>
            <Link href="/history" className="hover:text-zinc-800 transition-colors">
              阅读历史
            </Link>
            <span>·</span>
            <Link href="/sources" className="hover:text-zinc-800 transition-colors">
              书源引擎
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
