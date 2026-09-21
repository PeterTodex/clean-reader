'use client';

import React from 'react';
import Link from 'next/link';
import { BookshelfItem, storage } from '@/lib/storage';
import { BookMarked, BookOpen, Clock } from 'lucide-react';
import { BookCard } from './BookCard';

export { BookCard } from './BookCard';
export type { BookCardProps, BookCardData } from './BookCard';

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
    <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4 lg:gap-5">
      {items.map((book) => (
        <BookCard
          key={`${book.sourceId}-${book.id}`}
          book={book}
          variant="shelf"
          isOnShelf={true}
          onRemoveFromShelf={(e) => handleRemove(e, book.id, book.sourceId)}
        />
      ))}
    </div>
  );
};
