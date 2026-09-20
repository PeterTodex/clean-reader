'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/Header';
import { BookCoverPlaceholder } from '@/components/BookCoverPlaceholder';
import { HistoryItem, storage } from '@/lib/storage';
import {
  Clock,
  ArrowLeft,
  Search,
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

export default function HistoryPage() {
  const router = useRouter();
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [shelfBookIds, setShelfBookIds] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState(false);

  const loadData = () => {
    const historyList = storage.getHistory();
    setItems(historyList);

    const shelf = storage.getBookshelf();
    const ids = new Set(shelf.map((b) => `${b.sourceId}-${b.id}`));
    setShelfBookIds(ids);

    setLoaded(true);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRemoveOne = (e: React.MouseEvent, bookId: string, sourceId: string) => {
    e.preventDefault();
    e.stopPropagation();
    storage.removeFromHistory(bookId, sourceId);
    loadData();
  };

  const handleClearAll = () => {
    if (confirm('确定要清空全部阅读历史吗？')) {
      storage.clearHistory();
      loadData();
    }
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
      <Header onSearchClick={() => router.push('/?search=1')} />

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
                <Clock className="w-4 h-4" />
              </div>
              <h1 className="text-xl sm:text-2xl font-bold font-serif text-zinc-950 tracking-tight">
                阅读历史
              </h1>
            </div>
            {loaded && (
              <span className="text-xs text-zinc-500 font-mono bg-zinc-100 px-2.5 py-1 rounded-full border border-zinc-200/80">
                共 {items.length} 本
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="px-3.5 py-1.5 text-xs font-medium rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-700 transition-colors flex items-center gap-1.5"
            >
              <Search className="w-3.5 h-3.5" />
              <span>发现好书</span>
            </Link>
            {items.length > 0 && (
              <button
                onClick={handleClearAll}
                className="px-3 py-1.5 text-xs font-medium rounded-lg text-red-600 hover:text-red-700 hover:bg-red-50 transition-colors flex items-center gap-1"
                title="清空全部历史记录"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>清空</span>
              </button>
            )}
          </div>
        </div>

        {/* History Content */}
        {loaded && (
          items.length === 0 ? (
            <div className="py-20 text-center border border-dashed border-zinc-300 rounded-2xl bg-zinc-50/50">
              <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-zinc-100 flex items-center justify-center text-zinc-400 border border-zinc-200">
                <Clock className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-zinc-900 mb-1">暂无阅读历史</h3>
              <p className="text-xs text-zinc-500 mb-6 max-w-sm mx-auto">
                打开任何小说开始阅读，系统将在此按时间顺序记录您的阅读足迹。
              </p>
              <Link
                href="/"
                className="px-4 py-2 rounded-xl bg-black text-white hover:bg-zinc-800 transition-colors text-xs font-medium inline-flex items-center gap-2 shadow-xs"
              >
                <BookOpen className="w-4 h-4" />
                去首页逛逛
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-5">
              {items.map((book) => {
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
                      <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-xs text-white text-[10px] font-mono">
                        {formatRelativeTime(book.lastReadTime)}
                      </div>

                      {/* Hover Continue overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2.5">
                        <span className="text-white text-xs font-medium flex items-center gap-1 font-mono">
                          继续阅读 <ArrowRight className="w-3 h-3" />
                        </span>
                      </div>
                    </Link>

                    {/* Info */}
                    <div className="p-3 flex-1 flex flex-col justify-between">
                      <div>
                        <Link href={`/book/${book.id}?source=${book.sourceId}`} className="block">
                          <h4 className="font-medium text-zinc-900 text-sm line-clamp-1 group-hover:text-amber-800 transition-colors">
                            {book.title}
                          </h4>
                        </Link>
                        <p className="text-xs text-zinc-500 mt-0.5 line-clamp-1">
                          {book.author || '佚名'}
                        </p>
                      </div>

                      <div className="mt-3 space-y-2">
                        {/* Last Read Chapter + Progress */}
                        <div className="text-[10px] text-zinc-600 bg-zinc-100 border border-zinc-200/80 px-2 py-1 rounded line-clamp-1 font-mono flex items-center justify-between">
                          <span className="truncate flex-1">{book.lastChapterTitle || '阅读进度'}</span>
                          {book.progressPercent !== undefined && (
                            <span className="shrink-0 font-bold ml-1 text-zinc-800">
                              {book.progressPercent}%
                            </span>
                          )}
                        </div>

                        {/* Actions: Add to shelf + Delete */}
                        <div className="flex items-center justify-between pt-1 border-t border-zinc-100 text-xs">
                          <button
                            onClick={(e) => handleToggleShelf(e, book)}
                            className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors flex items-center gap-1 ${
                              isSavedInShelf
                                ? 'bg-zinc-100 text-zinc-600 hover:text-red-600'
                                : 'bg-black text-white hover:bg-zinc-800'
                            }`}
                            title={isSavedInShelf ? '移出书架' : '加入书架'}
                          >
                            {isSavedInShelf ? (
                              <>
                                <Check className="w-3 h-3" />
                                <span>在书架</span>
                              </>
                            ) : (
                              <>
                                <Plus className="w-3 h-3" />
                                <span>加书架</span>
                              </>
                            )}
                          </button>

                          <button
                            onClick={(e) => handleRemoveOne(e, book.id, book.sourceId)}
                            className="text-zinc-400 hover:text-red-600 p-1 rounded transition-colors"
                            title="删除历史记录"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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
    </div>
  );
}
