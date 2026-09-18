'use client';

import React, { useState, useEffect } from 'react';
import { BookmarkItem, storage } from '@/lib/storage';
import { Bookmark, BookmarkPlus, Trash2, X, Clock, ChevronRight, Check } from 'lucide-react';

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
  const [customNote, setCustomNote] = useState('');
  const [showAddNote, setShowAddNote] = useState(false);
  const [justAdded, setJustAdded] = useState(false);

  // Load bookmarks whenever modal opens or bookId changes
  useEffect(() => {
    if (isOpen && bookId) {
      setBookmarks(storage.getBookmarks(bookId));
      setShowAddNote(false);
      setCustomNote('');
      setJustAdded(false);
    }
  }, [isOpen, bookId]);

  if (!isOpen) return null;

  const isCurrentBookmarked = bookmarks.some((b) => b.chapterId === currentChapterId);

  const handleAddCurrentBookmark = () => {
    const excerptToUse = customNote.trim() || currentExcerpt.trim() || `书签记录于 ${currentChapterTitle}`;
    storage.addBookmark({
      bookId,
      sourceId,
      chapterId: currentChapterId,
      chapterTitle: currentChapterTitle,
      excerpt: excerptToUse,
    });
    setBookmarks(storage.getBookmarks(bookId));
    setJustAdded(true);
    setShowAddNote(false);
    setCustomNote('');
    setTimeout(() => setJustAdded(false), 2000);
  };

  const handleRemoveBookmark = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    storage.removeBookmark(id);
    setBookmarks(storage.getBookmarks(bookId));
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMin = Math.floor((now.getTime() - date.getTime()) / 60000);

    if (diffMin < 1) return '刚刚';
    if (diffMin < 60) return `${diffMin}分钟前`;
    if (diffMin < 1440) return `${Math.floor(diffMin / 60)}小时前`;

    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
      <div
        className="w-full sm:max-w-lg bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl border border-stone-200 text-stone-800 max-h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-stone-100 flex items-center justify-between bg-stone-50/50">
          <h3 className="font-serif font-bold text-lg text-stone-900 flex items-center gap-2">
            <Bookmark className="w-5 h-5 text-amber-800" />
            书签管理
            <span className="text-xs text-stone-500 font-normal">({bookmarks.length} 个书签)</span>
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Add Section */}
        <div className="p-4 bg-amber-50/50 border-b border-amber-100/80">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-xs text-amber-900/70 font-medium">当前阅读章节</div>
              <div className="text-sm font-semibold text-stone-900 truncate mt-0.5">{currentChapterTitle}</div>
            </div>
            <button
              onClick={handleAddCurrentBookmark}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm flex-shrink-0 ${
                justAdded
                  ? 'bg-emerald-600 text-white'
                  : isCurrentBookmarked
                  ? 'bg-amber-800/90 text-white hover:bg-amber-800'
                  : 'bg-amber-800 text-white hover:bg-amber-900'
              }`}
            >
              {justAdded ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  已保存书签
                </>
              ) : isCurrentBookmarked ? (
                <>
                  <BookmarkPlus className="w-3.5 h-3.5" />
                  更新此章书签
                </>
              ) : (
                <>
                  <BookmarkPlus className="w-3.5 h-3.5" />
                  添加当前位置书签
                </>
              )}
            </button>
          </div>

          {/* Optional custom note toggle */}
          <div className="mt-2.5 flex items-center justify-between text-xs text-stone-500">
            <button
              onClick={() => setShowAddNote(!showAddNote)}
              className="text-amber-800 hover:underline hover:text-amber-900"
            >
              {showAddNote ? '取消自定义备注' : '+ 填写书签备注'}
            </button>
            {currentExcerpt && !showAddNote && (
              <span className="truncate max-w-[240px] italic text-stone-400">“{currentExcerpt}”</span>
            )}
          </div>

          {showAddNote && (
            <div className="mt-2">
              <textarea
                value={customNote}
                onChange={(e) => setCustomNote(e.target.value)}
                placeholder="输入个性化备注或摘录心得..."
                rows={2}
                className="w-full text-xs p-2 rounded-lg border border-amber-200 bg-white text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-amber-800"
              />
            </div>
          )}
        </div>

        {/* Bookmarks List */}
        <div className="flex-1 overflow-y-auto p-3 divide-y divide-stone-100">
          {bookmarks.length === 0 ? (
            <div className="py-12 text-center flex flex-col items-center justify-center text-stone-400 gap-2">
              <Bookmark className="w-10 h-10 stroke-[1.5] text-stone-300" />
              <p className="text-sm">本书暂无书签</p>
              <p className="text-xs text-stone-400">点击上方按钮即可在当前章节留下印记</p>
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
                  className={`group p-3 rounded-xl transition-all cursor-pointer flex items-start justify-between gap-3 ${
                    isCurrent ? 'bg-amber-50/70 border border-amber-200/60' : 'hover:bg-stone-50'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm text-stone-900 line-clamp-1">{bm.chapterTitle}</span>
                      {isCurrent && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-800 text-white flex-shrink-0">
                          当前章
                        </span>
                      )}
                    </div>
                    {bm.excerpt && (
                      <p className="text-xs text-stone-500 line-clamp-2 leading-relaxed bg-stone-50/70 p-1.5 rounded border border-stone-100 mb-1.5">
                        {bm.excerpt}
                      </p>
                    )}
                    <div className="flex items-center gap-1.5 text-[11px] text-stone-400">
                      <Clock className="w-3 h-3" />
                      <span>{formatTime(bm.createTime)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0 pt-0.5">
                    <button
                      onClick={(e) => handleRemoveBookmark(e, bm.id)}
                      className="p-1.5 rounded-lg text-stone-300 hover:text-red-600 hover:bg-red-50 transition-colors opacity-80 group-hover:opacity-100"
                      title="删除书签"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <ChevronRight className="w-4 h-4 text-stone-300 group-hover:text-stone-500 transition-colors" />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
