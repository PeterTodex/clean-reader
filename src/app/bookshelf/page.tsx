'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Header } from '@/components/Header';
import { Bookshelf } from '@/components/Bookshelf';
import { SearchModal } from '@/components/SearchModal';
import { BookCoverPlaceholder } from '@/components/BookCoverPlaceholder';
import { BookshelfItem, HistoryItem, storage } from '@/lib/storage';
import {
  Library,
  Clock,
  ArrowLeft,
  Search,
  RefreshCw,
  Trash2,
  BookOpen,
  ArrowRight,
  Plus,
  Check,
} from 'lucide-react';

function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return '刚刚';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}小时前`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}天前`;
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

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
            <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-4 lg:gap-5">
              {historyItems.map((book) => {
                const readHref = book.lastChapterId
                  ? `/read/${book.id}/${book.lastChapterId}?source=${book.sourceId}`
                  : `/book/${book.id}?source=${book.sourceId}`;
                const isSavedInShelf = shelfBookIds.has(`${book.sourceId}-${book.id}`);

                return (
                  <div
                    key={`${book.sourceId}-${book.id}`}
                    className="group relative flex flex-col bg-white rounded-xl overflow-hidden border border-zinc-200 shadow-sm hover:shadow-md hover:border-black transition-all duration-200"
                  >
                    {/* Cover */}
                    <Link
                      href={readHref}
                      className="relative aspect-[4/5] w-full bg-zinc-100 overflow-hidden block border-b border-zinc-100"
                    >
                      <BookCoverPlaceholder title={book.title} className="absolute inset-0" />
                      {book.cover ? (
                        <img
                          src={book.cover}
                          alt={book.title}
                          className="relative w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      ) : null}

                      {/* Time badge */}
                      <div className="absolute top-1.5 left-1.5 sm:top-2 sm:left-2 px-1 sm:px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-xs text-white text-[9px] sm:text-[10px] font-mono">
                        {formatRelativeTime(book.lastReadTime)}
                      </div>

                      {/* Hover Continue overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2 sm:p-2.5">
                        <span className="text-white text-[10px] sm:text-xs font-medium flex items-center gap-1 font-mono">
                          继续阅读 <ArrowRight className="w-3 h-3" />
                        </span>
                      </div>
                    </Link>

                    {/* Info */}
                    <div className="p-2 sm:p-3 flex-1 flex flex-col justify-between">
                      <div>
                        <Link href={`/book/${book.id}?source=${book.sourceId}`} className="block">
                          <h4 className="font-medium text-zinc-900 text-xs sm:text-sm line-clamp-1 group-hover:text-black transition-colors">
                            {book.title}
                          </h4>
                        </Link>
                        <p className="text-[10px] sm:text-xs text-zinc-500 mt-0.5 line-clamp-1">
                          {book.author || '佚名'}
                        </p>
                      </div>

                      <div className="mt-2 sm:mt-3 space-y-1.5 sm:space-y-2">
                        {/* Last Read Chapter + Progress */}
                        <div className="text-[9px] sm:text-[10px] text-zinc-600 bg-zinc-100 border border-zinc-200/80 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded line-clamp-1 font-mono flex items-center justify-between">
                          <span className="truncate flex-1">{book.lastChapterTitle || '阅读进度'}</span>
                          {book.progressPercent !== undefined && (
                            <span className="shrink-0 font-bold ml-1 text-zinc-800">
                              {book.progressPercent}%
                            </span>
                          )}
                        </div>

                        {/* Actions: Add to shelf + Delete */}
                        <div className="flex items-center justify-between pt-1 border-t border-zinc-100 text-xs gap-1">
                          <button
                            type="button"
                            onClick={(e) => handleToggleShelf(e, book)}
                            className={`px-1.5 sm:px-2 py-0.5 rounded text-[10px] sm:text-[11px] font-medium transition-colors flex items-center gap-1 shrink-0 ${
                              isSavedInShelf
                                ? 'bg-zinc-100 text-zinc-600 hover:text-red-600'
                                : 'bg-black text-white hover:bg-zinc-800'
                            }`}
                            title={isSavedInShelf ? '移出书架' : '加入书架'}
                          >
                            {isSavedInShelf ? (
                              <>
                                <Check className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                                <span>在书架</span>
                              </>
                            ) : (
                              <>
                                <Plus className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                                <span>加书架</span>
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={(e) => handleRemoveHistoryItem(e, book.id, book.sourceId)}
                            className="text-zinc-400 hover:text-red-600 p-0.5 sm:p-1 rounded transition-colors shrink-0"
                            title="删除足迹记录"
                          >
                            <Trash2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
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
