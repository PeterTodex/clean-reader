'use client';

import React, { useState, useEffect } from 'react';
import { storage, BookmarkItem } from '@/lib/storage';
import { Bookmark, BookmarkPlus, X, Trash2, Check, Clock, FileText } from 'lucide-react';

interface BookmarkModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookId: string;
  sourceId: string;
  currentChapterId: string;
  currentChapterTitle: string;
  currentExcerpt?: string;
  onSelectBookmark: (chapterId: string) => void;
}

export const BookmarkModal: React.FC<BookmarkModalProps> = ({
  isOpen,
  onClose,
  bookId,
  sourceId,
  currentChapterId,
  currentChapterTitle,
  currentExcerpt = '',
  onSelectBookmark,
}) => {
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([]);
  const [justAdded, setJustAdded] = useState(false);

  // Load bookmarks on open
  useEffect(() => {
    if (isOpen) {
      setBookmarks(storage.getBookmarks(bookId));
      setJustAdded(false);
    }
  }, [isOpen, bookId]);

  if (!isOpen) return null;

  const isCurrentBookmarked = bookmarks.some((b) => b.chapterId === currentChapterId);

  const handleAddCurrentBookmark = () => {
    const newBookmark: BookmarkItem = {
      id: `${bookId}_${currentChapterId}_${Date.now()}`,
      bookId,
      sourceId,
      chapterId: currentChapterId,
      chapterTitle: currentChapterTitle,
      excerpt: currentExcerpt.trim() || '书签标记位置',
      createTime: Date.now(),
    };

    storage.addBookmark(newBookmark);
    setBookmarks(storage.getBookmarks(bookId));
    setJustAdded(true);

    setTimeout(() => {
      setJustAdded(false);
    }, 2000);
  };

  const handleRemoveBookmark = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    storage.removeBookmark(id);
    setBookmarks(storage.getBookmarks(bookId));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div
        className="w-full max-w-lg bg-white rounded-xl shadow-2xl border border-zinc-200 text-zinc-900 max-h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
          <h3 className="font-bold text-base text-zinc-950 flex items-center gap-2">
            <Bookmark className="w-4 h-4 text-zinc-900 dark:text-zinc-100" />
            书签
            <span className="text-xs font-mono font-normal text-zinc-400">（共 {bookmarks.length} 条）</span>
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Add Section */}
        <div className="p-4 bg-zinc-50 border-b border-zinc-200">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-mono text-zinc-400 font-medium">当前章节</div>
              <div className="text-xs font-bold text-zinc-900 truncate mt-0.5">{currentChapterTitle}</div>
              {currentExcerpt && (
                <div className="text-[11px] text-zinc-500 truncate mt-1 italic">“{currentExcerpt}”</div>
              )}
            </div>
            <button
              onClick={handleAddCurrentBookmark}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all shadow-sm flex-shrink-0 ${
                justAdded
                  ? 'bg-emerald-600 text-white'
                  : 'bg-black text-white hover:bg-zinc-800'
              }`}
            >
              {justAdded ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  已保存
                </>
              ) : isCurrentBookmarked ? (
                <>
                  <BookmarkPlus className="w-3.5 h-3.5" />
                  更新此章书签
                </>
              ) : (
                <>
                  <BookmarkPlus className="w-3.5 h-3.5" />
                  添加当前位置
                </>
              )}
            </button>
          </div>
        </div>

        {/* Bookmarks List */}
        <div className="flex-1 overflow-y-auto p-3 divide-y divide-zinc-100">
          {bookmarks.length === 0 ? (
            <div className="py-12 text-center flex flex-col items-center justify-center text-zinc-400 gap-2 font-mono">
              <Bookmark className="w-8 h-8 stroke-[1.5] text-zinc-300" />
              <p className="text-xs">暂无书签</p>
              <p className="text-[11px] text-zinc-400">点击上方按钮即可在当前章节留下印记</p>
            </div>
          ) : (
            bookmarks.map((bm) => {
              const isCurrent = bm.chapterId === currentChapterId;
              return (
                <div
                  key={bm.id}
                  onClick={() => {
                    onSelectBookmark(bm.chapterId);
                    onClose();
                  }}
                  className={`group p-3 rounded-lg transition-all cursor-pointer flex items-start justify-between gap-3 ${
                    isCurrent ? 'bg-zinc-100 border border-zinc-300' : 'hover:bg-zinc-50'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-xs text-zinc-900 line-clamp-1">{bm.chapterTitle}</span>
                      {isCurrent && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-black text-white font-mono flex-shrink-0">
                          当前
                        </span>
                      )}
                    </div>
                    {bm.excerpt && (
                      <p className="text-xs text-zinc-600 line-clamp-2 leading-relaxed bg-zinc-50 p-1.5 rounded border border-zinc-200 mb-1.5 font-mono">
                        {bm.excerpt}
                      </p>
                    )}
                    <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 font-mono">
                      <Clock className="w-3 h-3" />
                      <span>{new Date(bm.createTime).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>

                  <button
                    onClick={(e) => handleRemoveBookmark(e, bm.id)}
                    className="opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-red-600 p-1.5 rounded transition-all"
                    title="删除书签"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
