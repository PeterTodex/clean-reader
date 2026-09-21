'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight, Check, Plus, Trash2 } from 'lucide-react';
import { BookCoverPlaceholder } from '@/components/BookCoverPlaceholder';
import { formatRelativeTime, cn } from '@/lib/utils';

export interface BookCardData {
  id: string;
  title: string;
  author?: string;
  cover?: string;
  sourceId: string;
  lastChapterId?: string;
  lastChapterTitle?: string;
  lastReadTime?: number;
  progressPercent?: number;
  totalChapters?: number;
}

export interface BookCardProps {
  // Support both passing a consolidated book object or individual props
  book?: BookCardData;
  id?: string;
  title?: string;
  author?: string;
  cover?: string;
  sourceId?: string;
  lastChapterId?: string;
  lastChapterTitle?: string;
  lastReadTime?: number;
  progressPercent?: number;

  // State & actions
  isOnShelf?: boolean;
  variant?: 'shelf' | 'history';
  onRemoveFromShelf?: (e: React.MouseEvent) => void;
  onToggleShelf?: (e: React.MouseEvent) => void;
  onRemoveFromHistory?: (e: React.MouseEvent) => void;
  className?: string;
}

export const BookCard: React.FC<BookCardProps> = ({
  book,
  id: propId,
  title: propTitle,
  author: propAuthor,
  cover: propCover,
  sourceId: propSourceId,
  lastChapterId: propLastChapterId,
  lastChapterTitle: propLastChapterTitle,
  lastReadTime: propLastReadTime,
  progressPercent: propProgressPercent,
  isOnShelf = false,
  variant,
  onRemoveFromShelf,
  onToggleShelf,
  onRemoveFromHistory,
  className = '',
}) => {
  const id = book?.id ?? propId ?? '';
  const title = book?.title ?? propTitle ?? '';
  const author = book?.author ?? propAuthor ?? '佚名';
  const cover = book?.cover ?? propCover;
  const sourceId = book?.sourceId ?? propSourceId ?? '';
  const lastChapterId = book?.lastChapterId ?? propLastChapterId;
  const lastChapterTitle = book?.lastChapterTitle ?? propLastChapterTitle;
  const lastReadTime = book?.lastReadTime ?? propLastReadTime;
  const progressPercent = book?.progressPercent ?? propProgressPercent;

  const isHistoryMode = variant === 'history' || Boolean(onToggleShelf || onRemoveFromHistory);

  const readHref = lastChapterId
    ? `/read/${id}/${lastChapterId}?source=${sourceId}`
    : `/book/${id}?source=${sourceId}`;

  const handleToggleShelfClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onToggleShelf?.(e);
  };

  const handleRemoveFromHistoryClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onRemoveFromHistory?.(e);
  };

  const handleRemoveFromShelfClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onRemoveFromShelf?.(e);
  };

  return (
    <div className={cn('group relative flex flex-col', className)}>
      {/* Book Cover */}
      <Link
        href={readHref}
        className="relative aspect-[4/5] w-full bg-zinc-100 rounded-lg overflow-hidden block"
      >
        <BookCoverPlaceholder title={title} className="absolute inset-0" />
        {cover ? (
          <img
            src={cover}
            alt={title}
            className="relative w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={(e) => {
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
        ) : null}

        {/* Time badge */}
        {lastReadTime ? (
          <div className="absolute top-1.5 left-1.5 sm:top-2 sm:left-2 px-1 sm:px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-xs text-white text-[9px] sm:text-[10px] font-mono">
            {formatRelativeTime(lastReadTime)}
          </div>
        ) : null}

        {/* Hover Continue overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2 sm:p-2.5">
          <span className="text-white text-[10px] sm:text-xs font-medium flex items-center gap-1 font-mono">
            继续阅读 <ArrowRight className="w-3 h-3" />
          </span>
        </div>
      </Link>

      {/* Book Info */}
      <div className="pt-2 flex-1 flex flex-col justify-between">
        <div>
          <Link href={`/book/${id}?source=${sourceId}`} className="block">
            <h4 className="font-medium text-zinc-900 text-xs sm:text-sm line-clamp-1 group-hover:text-black transition-colors">
              {title}
            </h4>
          </Link>
          <p className="text-[10px] sm:text-xs text-zinc-400 mt-0.5 line-clamp-1">
            {author || '佚名'}
          </p>
        </div>

        <div className="mt-2">
          {/* Last Read Chapter + Progress */}
          <div className="text-[10px] sm:text-[11px] text-zinc-500 font-mono truncate flex items-center justify-between">
            <span className="truncate flex-1">
              {lastChapterTitle || (isHistoryMode ? '阅读进度' : '尚未阅读')}
            </span>
            {progressPercent !== undefined && (
              <span className="shrink-0 font-bold ml-1 text-zinc-800">
                {progressPercent}%
              </span>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-1.5 border-t border-zinc-100 text-xs gap-1 mt-1.5">
            {isHistoryMode ? (
              <>
                {onToggleShelf && (
                  <button
                    type="button"
                    onClick={handleToggleShelfClick}
                    className={`px-1.5 sm:px-2 py-0.5 rounded text-[10px] sm:text-[11px] font-medium transition-colors flex items-center gap-1 shrink-0 ${
                      isOnShelf
                        ? 'bg-zinc-100 text-zinc-600 hover:text-red-600'
                        : 'bg-black text-white hover:bg-zinc-800'
                    }`}
                    title={isOnShelf ? '移出书架' : '加入书架'}
                  >
                    {isOnShelf ? (
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
                )}

                {onRemoveFromHistory && (
                  <button
                    type="button"
                    onClick={handleRemoveFromHistoryClick}
                    className="text-zinc-400 hover:text-red-600 p-0.5 sm:p-1 rounded transition-colors shrink-0"
                    title="删除足迹记录"
                  >
                    <Trash2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                  </button>
                )}
              </>
            ) : (
              <>
                {onRemoveFromShelf ? (
                  <button
                    type="button"
                    onClick={handleRemoveFromShelfClick}
                    className="px-1.5 sm:px-2 py-0.5 rounded text-[10px] sm:text-[11px] font-medium transition-colors flex items-center gap-1 shrink-0 bg-zinc-100 text-zinc-600 hover:text-red-600"
                    title="移出书架"
                  >
                    <Check className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                    <span>在书架</span>
                  </button>
                ) : (
                  <span className="px-1.5 sm:px-2 py-0.5 rounded text-[10px] sm:text-[11px] font-medium bg-zinc-100 text-zinc-500 flex items-center gap-1 shrink-0">
                    <Check className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                    <span>在书架</span>
                  </span>
                )}

                {onRemoveFromShelf && (
                  <button
                    type="button"
                    onClick={handleRemoveFromShelfClick}
                    className="text-zinc-400 hover:text-red-600 p-0.5 sm:p-1 rounded transition-colors shrink-0"
                    title="移出书架"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
