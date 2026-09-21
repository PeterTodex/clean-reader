'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Header } from '@/components/Header';
import { Bookshelf } from '@/components/Bookshelf';
import { BookCard } from '@/components/BookCard';
import { SearchModal } from '@/components/SearchModal';
import { BookshelfItem, HistoryItem, storage } from '@/lib/storage';
import { formatRelativeTime } from '@/lib/utils';
import {
  Library,
  Clock,
  ArrowLeft,
  Trash2,
  BookOpen,
} from 'lucide-react';

type TabType = 'shelf' | 'history';

function BookshelfContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [activeTab, setActiveTab] = useState<TabType>(() => {
    return searchParams.get('tab') === 'history' ? 'history' : 'shelf';
  });
  const [shelfItems, setShelfItems] = useState<BookshelfItem[]>([]);
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [shelfBookIds, setShelfBookIds] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);

  const loadData = () => {
    const shelf = storage.getBookshelf();
    const history = storage.getHistory();
    setShelfItems(shelf);
    setHistoryItems(history);
    setShelfBookIds(new Set(shelf.map((b) => `${b.sourceId}-${b.id}`)));
    setLoaded(true);
  };

  useEffect(() => {
    loadData();
  }, [activeTab]);

  useEffect(() => {
    const handleFocus = () => {
      loadData();
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  // Sync tab change with URL without full reload
  const handleTabSwitch = (tab: TabType) => {
    setActiveTab(tab);
    const url = tab === 'history' ? '/bookshelf?tab=history' : '/bookshelf';
    window.history.replaceState(null, '', url);
  };

  const handleClearHistory = () => {
    if (confirm('确定要清空全部阅读历史吗？')) {
      storage.clearHistory();
      loadData();
    }
  };

  const handleRemoveHistoryItem = (e: React.MouseEvent, bookId: string, sourceId: string) => {
    e.preventDefault();
    e.stopPropagation();
    storage.removeFromHistory(bookId, sourceId);
    loadData();
  };

  const handleToggleShelf = (e: React.MouseEvent, item: HistoryItem) => {
    e.preventDefault();
    e.stopPropagation();
    const key = `${item.sourceId}-${item.id}`;
    if (shelfBookIds.has(key)) {
      storage.removeFromBookshelf(item.id, item.sourceId);
    } else {
      storage.saveToBookshelf({
        id: item.id,
        title: item.title,
        author: item.author,
        cover: item.cover,
        sourceId: item.sourceId,
        lastChapterId: item.lastChapterId,
        lastChapterTitle: item.lastChapterTitle,
        progressPercent: item.progressPercent,
        totalChapters: item.totalChapters,
      });
    }
    loadData();
  };

  return (
    <div className="min-h-screen flex flex-col transition-colors duration-200">
      <Header onSearchClick={() => setShowSearchModal(true)} />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-8 sm:py-10 space-y-8">
        {/* Page Header with Minimal Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 pb-5">
          <div className="flex items-center gap-3 flex-wrap">
            <Link
              href="/"
              className="p-2 rounded-lg hover:bg-zinc-200/70 text-zinc-600 hover:text-zinc-900 transition-colors shrink-0"
              title="返回首页"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>

            {/* Segmented Tab Controls */}
            <div className="segmented-tab-track flex items-center gap-1 p-1 rounded-xl text-xs font-medium">
              <button
                type="button"
                onClick={() => handleTabSwitch('shelf')}
                className={`segmented-tab-btn px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                  activeTab === 'shelf'
                    ? 'segmented-tab-btn-active font-bold'
                    : ''
                }`}
              >
                <Library className="w-3.5 h-3.5" />
                <span>我的藏书</span>
                {shelfItems.length > 0 && (
                  <span className={`font-mono text-[10px] px-1.5 py-0.2 rounded-full leading-tight ${
                    activeTab === 'shelf' ? 'segmented-tab-badge' : 'segmented-tab-badge-inactive'
                  }`}>
                    {shelfItems.length}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => handleTabSwitch('history')}
                className={`segmented-tab-btn px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                  activeTab === 'history'
                    ? 'segmented-tab-btn-active font-bold'
                    : ''
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>阅读足迹</span>
                {historyItems.length > 0 && (
                  <span className={`font-mono text-[10px] px-1.5 py-0.2 rounded-full leading-tight ${
                    activeTab === 'history' ? 'segmented-tab-badge' : 'segmented-tab-badge-inactive'
                  }`}>
                    {historyItems.length}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Action Bar: Only shows clear history when on history tab with items */}
          {activeTab === 'history' && historyItems.length > 0 && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleClearHistory}
                className="px-3 py-1.5 text-xs font-medium rounded-lg text-red-600 hover:text-red-700 hover:bg-red-50 transition-colors flex items-center gap-1"
                title="清空全部阅读足迹"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>清空</span>
              </button>
            </div>
          )}
        </div>

        {/* Tab 1: Bookshelf Content */}
        {loaded && activeTab === 'shelf' && (
          <Bookshelf
            items={shelfItems}
            onRefresh={loadData}
            onOpenSearch={() => setShowSearchModal(true)}
          />
        )}

        {/* Tab 2: Reading Footprints (History) Content */}
        {loaded && activeTab === 'history' && (
          historyItems.length === 0 ? (
            <div className="py-20 text-center border border-dashed border-zinc-300 rounded-2xl bg-zinc-50/50">
              <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-zinc-100 flex items-center justify-center text-zinc-400 border border-zinc-200">
                <Clock className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-zinc-900 mb-1">暂无阅读足迹</h3>
              <p className="text-xs text-zinc-500 mb-6 max-w-sm mx-auto">
                打开任何小说开始阅读，系统将在此自动记录您的阅读足迹与章节进度。
              </p>
              <Link
                href="/"
                className="px-4 py-2 rounded-xl bg-black text-white hover:bg-zinc-800 transition-colors text-xs font-medium inline-flex items-center gap-2 shadow-xs"
              >
                <BookOpen className="w-4 h-4" />
                去书源广场逛逛
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4 lg:gap-5">
              {historyItems.map((book) => (
                <BookCard
                  key={`${book.sourceId}-${book.id}`}
                  book={book}
                  variant="history"
                  isOnShelf={shelfBookIds.has(`${book.sourceId}-${book.id}`)}
                  onToggleShelf={(e) => handleToggleShelf(e, book)}
                  onRemoveFromHistory={(e) => handleRemoveHistoryItem(e, book.id, book.sourceId)}
                />
              ))}
            </div>
          )
        )}
      </main>

      {/* Search Modal */}
      <SearchModal
        isOpen={showSearchModal}
        onClose={() => {
          setShowSearchModal(false);
          loadData();
        }}
      />
    </div>
  );
}

export default function BookshelfPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <BookshelfContent />
    </Suspense>
  );
}
