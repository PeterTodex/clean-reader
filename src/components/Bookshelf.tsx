'use client';

import React from 'react';
import Link from 'next/link';
import { BookshelfItem, storage } from '@/lib/storage';
import { BookMarked, Trash2, ArrowRight, BookOpen } from 'lucide-react';

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
      <div className="py-16 text-center border-2 border-dashed border-stone-200 rounded-2xl bg-stone-50/50">
        <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-stone-100 flex items-center justify-center text-stone-400">
          <BookMarked className="w-7 h-7" />
        </div>
        <h3 className="text-base font-semibold text-stone-800 mb-1">书架空空如也</h3>
        <p className="text-sm text-stone-500 mb-6 max-w-sm mx-auto">
          你可以搜索任意小说阅读，系统会自动为您保存阅读进度并收藏在此处。
        </p>
        <button
          onClick={onOpenSearch}
          className="px-5 py-2.5 rounded-xl bg-amber-800 text-white hover:bg-amber-900 transition-colors shadow-sm text-sm font-medium inline-flex items-center gap-2"
        >
          <BookOpen className="w-4 h-4" />
          立即搜书
        </button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6">
      {items.map((book) => {
        const readHref = book.lastChapterId
          ? `/read/${book.id}/${book.lastChapterId}?source=${book.sourceId}`
          : `/book/${book.id}?source=${book.sourceId}`;

        return (
          <div
            key={`${book.sourceId}-${book.id}`}
            className="group relative flex flex-col bg-white rounded-xl overflow-hidden border border-stone-200/80 shadow-sm hover:shadow-md transition-all duration-200"
          >
            {/* Book Cover */}
            <Link href={readHref} className="relative aspect-[2/3] w-full bg-stone-100 overflow-hidden block">
              {book.cover ? (
                <img
                  src={book.cover}
                  alt={book.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  onError={(e) => {
                    // Fallback to stylized cover placeholder
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              ) : null}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2.5">
                <span className="text-white text-xs font-medium flex items-center gap-1">
                  继续阅读 <ArrowRight className="w-3 h-3" />
                </span>
              </div>
            </Link>

            {/* Book Info */}
            <div className="p-3 flex-1 flex flex-col justify-between">
              <div>
                <Link href={`/book/${book.id}?source=${book.sourceId}`} className="block">
                  <h4 className="font-medium text-stone-900 text-sm line-clamp-1 hover:text-amber-800 transition-colors">
                    {book.title}
                  </h4>
                </Link>
                <p className="text-xs text-stone-500 mt-1 line-clamp-1">
                  {book.author || '佚名'}
                </p>
              </div>

              <div className="mt-3 pt-2.5 border-t border-stone-100 flex items-center justify-between">
                <span className="text-[11px] text-amber-900 bg-amber-50 px-1.5 py-0.5 rounded line-clamp-1 max-w-[80%]">
                  {book.lastChapterTitle || '尚未阅读'}
                </span>
                <button
                  onClick={(e) => handleRemove(e, book.id, book.sourceId)}
                  className="text-stone-400 hover:text-red-600 transition-colors p-1 rounded"
                  title="移出书架"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
