'use client';

import React from 'react';
import Link from 'next/link';
import { BookshelfItem, storage } from '@/lib/storage';
import { BookMarked, Trash2, ArrowRight, BookOpen, Clock } from 'lucide-react';
import { BookCoverPlaceholder } from './BookCoverPlaceholder';

interface BookshelfProps {
  items: BookshelfItem[];
  onRefresh: () => void;
  onOpenSearch: () => void;
}

export const Bookshelf: React.FC<BookshelfProps> = ({ items, onRefresh, onOpenSearch }) => {
  const handleRemove = (e: React.MouseEvent, id: string, sourceId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (confirm('确定要将该书从书架移出吗？')) {
      storage.removeFromBookshelf(id, sourceId);
      onRefresh();
    }
  };

  if (items.length === 0) {
    return (
      <div className="py-16 text-center border border-dashed border-zinc-300 rounded-xl bg-zinc-50/50">
        <div className="w-12 h-12 mx-auto mb-3 rounded-lg bg-zinc-100 flex items-center justify-center text-zinc-400 border border-zinc-200">
          <BookMarked className="w-6 h-6" />
        </div>
        <h3 className="text-sm font-bold text-zinc-900 mb-1">书架暂无藏书</h3>
        <p className="text-xs text-zinc-500 mb-5 max-w-sm mx-auto">
          你可以在搜书或阅读历史中将喜爱的小说加入书架，方便随时翻阅。
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={onOpenSearch}
            className="px-4 py-2 rounded-lg bg-black text-white hover:bg-zinc-800 transition-colors text-xs font-medium inline-flex items-center gap-2 shadow-sm"
          >
            <BookOpen className="w-4 h-4" />
            立即搜书
          </button>
          <Link
            href="/bookshelf?tab=history"
            className="px-4 py-2 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-800 transition-colors text-xs font-medium inline-flex items-center gap-2 border border-zinc-200"
          >
            <Clock className="w-4 h-4" />
            阅读足迹
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-4 lg:gap-5">
      {items.map((book) => {
        const readHref = book.lastChapterId
          ? `/read/${book.id}/${book.lastChapterId}?source=${book.sourceId}`
          : `/book/${book.id}?source=${book.sourceId}`;

        return (
          <div
            key={`${book.sourceId}-${book.id}`}
            className="group relative flex flex-col bg-white rounded-xl overflow-hidden border border-zinc-200 shadow-sm hover:shadow hover:border-black transition-all duration-200"
          >
            {/* Book Cover */}
            <Link href={readHref} className="relative aspect-[4/5] w-full bg-zinc-100 overflow-hidden block border-b border-zinc-100">
              <BookCoverPlaceholder title={book.title} className="absolute inset-0" />
              {book.cover ? (
                <img
                  src={book.cover}
                  alt={book.title}
                  className="relative w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  onError={(e) => {
                    // Reveal the placeholder underneath instead of a broken image.
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              ) : null}
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2 sm:p-2.5">
                <span className="text-white text-[10px] sm:text-xs font-medium flex items-center gap-1 font-mono">
                  继续阅读 <ArrowRight className="w-3 h-3" />
                </span>
              </div>
            </Link>

            {/* Book Info */}
            <div className="p-2 sm:p-3 flex-1 flex flex-col justify-between">
              <div>
                <Link href={`/book/${book.id}?source=${book.sourceId}`} className="block">
                  <h4 className="font-medium text-zinc-900 text-xs sm:text-sm line-clamp-1 group-hover:text-black transition-colors">
                    {book.title}
                  </h4>
                </Link>
                <p className="text-[10px] sm:text-xs text-zinc-500 mt-0.5 sm:mt-1 line-clamp-1">
                  {book.author || '佚名'}
                </p>
              </div>

              <div className="mt-2 sm:mt-3 pt-1.5 sm:pt-2.5 border-t border-zinc-100 flex items-center justify-between gap-1">
                <span className="text-[9px] sm:text-[10px] text-zinc-700 bg-zinc-100 border border-zinc-200 px-1 sm:px-1.5 py-0.5 rounded line-clamp-1 max-w-[75%] font-mono">
                  {book.lastChapterTitle || '尚未阅读'}
                </span>
                <button
                  onClick={(e) => handleRemove(e, book.id, book.sourceId)}
                  className="text-zinc-400 hover:text-red-600 transition-colors p-0.5 sm:p-1 rounded shrink-0"
                  title="移出书架"
                >
                  <Trash2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
