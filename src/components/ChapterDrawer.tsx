'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import Link from 'next/link';
import { ChapterItem } from '@/sources/types';
import { storage, BookmarkItem } from '@/lib/storage';
import { Drawer } from './Drawer';
import {
  X,
  Search,
  ArrowUpDown,
  Bookmark,
  BookmarkPlus,
  BookmarkCheck,
  CheckCircle2,
  Download,
  Loader2,
  Check,
  List,
  Trash2,
  Clock,
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

interface ChapterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  chapters: ChapterItem[];
  bookId: string;
  sourceId: string;
  currentChapterId: string;
  currentChapterTitle?: string;
  currentExcerpt?: string;
  cachedChapterIds?: Set<string> | string[];
  initialTab?: 'chapters' | 'bookmarks';
  onSelectChapter?: (chapterId: string) => void;
  onOpenSearchContent?: () => void;
}

export const ChapterDrawer: React.FC<ChapterDrawerProps> = ({
  isOpen,
  onClose,
  chapters,
  bookId,
  sourceId,
  currentChapterId,
  currentChapterTitle,
  currentExcerpt = '',
  cachedChapterIds,
  initialTab = 'chapters',
  onSelectChapter,
  onOpenSearchContent,
}) => {
  const [activeTab, setActiveTab] = useState<'chapters' | 'bookmarks'>(initialTab);
  const [search, setSearch] = useState('');
  const [isReverse, setIsReverse] = useState(false);
  const [cachedSet, setCachedSet] = useState<Set<string>>(() => new Set(cachedChapterIds || []));
  const [isCaching, setIsCaching] = useState(false);
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([]);
  const [bookmarkSaved, setBookmarkSaved] = useState(false);
  const currentItemRef = useRef<HTMLAnchorElement | null>(null);

  // Sync prop changes into local cachedSet
  useEffect(() => {
    if (cachedChapterIds) {
      setCachedSet((prev) => {
        const next = new Set(prev);
        cachedChapterIds.forEach((id) => next.add(id));
        return next;
      });
    }
  }, [cachedChapterIds]);

  // Load bookmarks & reset activeTab when drawer opens
  useEffect(() => {
    if (isOpen && bookId) {
      setBookmarks(storage.getBookmarks(bookId));
      setBookmarkSaved(false);
      if (initialTab) {
        setActiveTab(initialTab);
      }
    }
  }, [isOpen, bookId, initialTab]);

  // Sync server cache when drawer opens and poll if caching
  useEffect(() => {
    if (!isOpen || !bookId) return;

    let timer: NodeJS.Timeout | null = null;

    const pollCache = () => {
      fetch(`/api/chapter/cache?bookId=${bookId}&source=${sourceId}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.success && Array.isArray(data.data)) {
            setCachedSet(new Set(data.data));
            if (data.task && data.task.status === 'running') {
              setIsCaching(true);
            } else {
              setIsCaching(false);
            }
          }
        })
        .catch(() => {});
    };

    pollCache();

    if (isCaching) {
      timer = setInterval(pollCache, 2000);
    }

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isOpen, bookId, sourceId, isCaching]);

  const handleStartCacheAll = async () => {
    const uncachedCount = Math.max(0, chapters.length - cachedSet.size);
    if (
      !confirm(
        `确定要开始在后台缓存全部章节吗？\n\n共 ${chapters.length} 章，尚有 ${uncachedCount} 章未缓存。将在后台自动下载并保存到本地书库（每章带 2~5 秒随机防封延时）。`
      )
    ) {
      return;
    }

    setIsCaching(true);
    try {
      const res = await fetch('/api/chapter/cache', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookId, sourceId, action: 'start' }),
      });
      const data = await res.json();
      if (!data.success) {
        alert(data.error || '启动后台缓存失败');
        setIsCaching(false);
      }
    } catch (err: any) {
      alert(err.message || '网络请求失败');
      setIsCaching(false);
    }
  };

  const handleStopCacheAll = async () => {
    if (!confirm('确定要暂停/取消正在进行的后台缓存吗？已缓存的章节将被保留。')) {
      return;
    }
    try {
      await fetch('/api/chapter/cache', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookId, sourceId, action: 'stop' }),
      });
      setIsCaching(false);
    } catch {}
  };

  const displayedChapters = useMemo(() => {
    let list = [...chapters];
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((c) => c.title.toLowerCase().includes(q) || String(c.index).includes(q));
    }
    if (isReverse) {
      list.reverse();
    }
    return list;
  }, [chapters, search, isReverse]);

  // Check if current chapter is bookmarked
  const isCurrentBookmarked = useMemo(() => {
    return bookmarks.some((b) => String(b.chapterId) === String(currentChapterId));
  }, [bookmarks, currentChapterId]);

  // Quick add / update bookmark for current chapter
  const handleToggleBookmarkCurrent = () => {
    const currentChapterObj = chapters.find((c) => String(c.id) === String(currentChapterId));
    const title = currentChapterTitle || currentChapterObj?.title || `第 ${currentChapterId} 章`;
    const newBookmark: BookmarkItem = {
      id: `${bookId}_${currentChapterId}_${Date.now()}`,
      bookId,
      sourceId,
      chapterId: currentChapterId,
      chapterTitle: title,
      excerpt: currentExcerpt.trim() || '书签标记位置',
      createTime: Date.now(),
    };

    storage.addBookmark(newBookmark);
    setBookmarks(storage.getBookmarks(bookId));
    setBookmarkSaved(true);
    setTimeout(() => setBookmarkSaved(false), 2000);
  };

  const handleRemoveBookmark = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    storage.removeBookmark(id);
    setBookmarks(storage.getBookmarks(bookId));
  };

  // Auto-scroll current chapter to center when drawer is opened on chapters tab
  useEffect(() => {
    if (isOpen && activeTab === 'chapters' && !search.trim()) {
      const timer = setTimeout(() => {
        if (currentItemRef.current) {
          currentItemRef.current.scrollIntoView({
            behavior: 'instant',
            block: 'center',
          });
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen, activeTab, currentChapterId, isReverse, search]);

  return (
    <Drawer isOpen={isOpen} onClose={onClose} side="left" width="max-w-md w-full">
        {/* Header */}
        <div className="p-3 sm:p-4 border-b border-zinc-100 bg-zinc-50/50 flex flex-col gap-2.5">
          {/* Row 1: Dual Segmented Tabs & Close button */}
          <div className="flex items-center justify-between gap-2">
            <div className="segmented-tab-track flex items-center gap-1 p-1 rounded-xl text-xs font-medium">
              <button
                type="button"
                onClick={() => setActiveTab('chapters')}
                className={`segmented-tab-btn px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                  activeTab === 'chapters'
                    ? 'segmented-tab-btn-active font-bold'
                    : ''
                }`}
              >
                <List className="w-3.5 h-3.5 shrink-0" />
                <span>目录</span>
                <span className="font-mono text-[10px] segmented-tab-badge-inactive px-1.5 py-0.2 rounded-full leading-tight">
                  {chapters.length}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('bookmarks')}
                className={`segmented-tab-btn px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                  activeTab === 'bookmarks'
                    ? 'segmented-tab-btn-active font-bold'
                    : ''
                }`}
              >
                <Bookmark className="w-3.5 h-3.5 shrink-0" />
                <span>书签</span>
                {bookmarks.length > 0 && (
                  <span className={`font-mono text-[10px] px-1.5 py-0.2 rounded-full leading-tight ${
                    activeTab === 'bookmarks' ? 'segmented-tab-badge' : 'segmented-tab-badge-inactive'
                  }`}>
                    {bookmarks.length}
                  </span>
                )}
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 rounded-lg shrink-0 transition-colors"
              title="关闭"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Row 2: Context Actions per tab */}
          {activeTab === 'chapters' ? (
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {chapters.length > 0 && cachedSet.size >= chapters.length ? (
                  <div className="px-2 py-1 text-xs border rounded-md flex items-center gap-1.5 font-mono bg-emerald-50 text-emerald-700 border-emerald-200 cursor-default">
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span>已全部缓存</span>
                  </div>
                ) : isCaching ? (
                  <button
                    onClick={handleStopCacheAll}
                    className="px-2 py-1 text-xs border rounded-md flex items-center gap-1.5 font-mono bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100 transition-colors"
                    title="正在后台缓存中，点击可暂停/取消"
                  >
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600" />
                    <span>缓存中 ({cachedSet.size}/{chapters.length})</span>
                  </button>
                ) : (
                  <button
                    onClick={handleStartCacheAll}
                    className="px-2 py-1 text-xs border rounded-md flex items-center gap-1.5 font-mono text-zinc-700 bg-white hover:bg-zinc-100 border-zinc-200 transition-colors"
                    title="在后台将所有未缓存章节下载到本地"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>缓存全部</span>
                  </button>
                )}
              </div>
              <button
                onClick={() => setIsReverse(!isReverse)}
                className="px-2.5 py-1 text-xs text-zinc-700 bg-white hover:bg-zinc-100 border border-zinc-200 rounded-md flex items-center gap-1 transition-colors font-mono"
                title="切换正序/倒序"
              >
                <ArrowUpDown className="w-3.5 h-3.5" />
                {isReverse ? '倒序' : '正序'}
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs text-zinc-500 font-mono">
                {bookmarks.length > 0 ? `共 ${bookmarks.length} 处书签` : '书签列表'}
              </div>
              <button
                onClick={handleToggleBookmarkCurrent}
                className={`px-2.5 py-1 text-xs rounded-md font-medium flex items-center gap-1.5 transition-all ${
                  bookmarkSaved
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : isCurrentBookmarked
                    ? 'bg-zinc-100 hover:bg-zinc-200 text-zinc-800 border border-zinc-200'
                    : 'bg-black text-white hover:bg-zinc-800 shadow-xs'
                }`}
              >
                {bookmarkSaved ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>已保存</span>
                  </>
                ) : isCurrentBookmarked ? (
                  <>
                    <BookmarkCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>更新此章书签</span>
                  </>
                ) : (
                  <>
                    <BookmarkPlus className="w-3.5 h-3.5" />
                    <span>标记本章</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Content Body per Tab */}
        {activeTab === 'chapters' ? (
          <>
            {/* Filter input */}
            <div className="p-3 border-b border-zinc-100 flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="搜索章节名或序号..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-zinc-100 rounded-lg border border-zinc-200 focus:outline-none focus:ring-1 focus:ring-zinc-400 focus:border-zinc-400 transition-all text-zinc-900 placeholder-zinc-400"
                />
              </div>
              {onOpenSearchContent && (
                <button
                  onClick={() => {
                    onClose();
                    onOpenSearchContent();
                  }}
                  className="px-2.5 py-1.5 text-xs font-medium text-zinc-600 hover:text-black bg-zinc-100 hover:bg-zinc-200 rounded-lg border border-zinc-200 transition-colors whitespace-nowrap shrink-0 flex items-center gap-1"
                  title="搜索正文关键词 / 角色出场"
                >
                  <span>搜正文</span>
                </button>
              )}
            </div>

            {/* Chapter List */}
            <div className="flex-1 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800">
              {displayedChapters.length === 0 ? (
                <div className="p-8 text-center text-xs text-zinc-400">没有匹配到相关章节</div>
              ) : (
                displayedChapters.map((c) => {
                  const isCurrent = String(c.id) === String(currentChapterId);
                  const isCached = cachedSet.has(c.id);
                  return (
                    <Link
                      key={c.id}
                      ref={isCurrent ? currentItemRef : null}
                      href={`/read/${bookId}/${c.id}?source=${sourceId}`}
                      onClick={(e) => {
                        if (onSelectChapter) {
                          e.preventDefault();
                          onSelectChapter(c.id);
                        } else {
                          onClose();
                        }
                      }}
                      className={`flex items-center justify-between px-4 py-3 text-xs transition-colors ${
                        isCurrent
                          ? 'chapter-item-current bg-zinc-100 text-zinc-950 font-bold border-l-4 border-zinc-900'
                          : 'text-zinc-700 hover:bg-zinc-50 hover:text-zinc-950'
                      }`}
                    >
                      <span className="line-clamp-1 flex-1 pr-2">{c.title}</span>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {isCurrent && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded font-mono font-medium flex-shrink-0 chapter-badge-current bg-black text-white">
                            当前
                          </span>
                        )}
                        {isCached && (
                          <span title="已缓存" className="text-emerald-600 dark:text-emerald-400 flex items-center">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </span>
                        )}
                      </div>
                    </Link>
                  );
                })
              )}
            </div>
          </>
        ) : (
          /* Bookmarks List */
          <div className="flex-1 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800 p-2 sm:p-3">
            {bookmarks.length === 0 ? (
              <div className="py-16 text-center flex flex-col items-center justify-center text-zinc-400 gap-2.5 font-mono">
                <Bookmark className="w-8 h-8 stroke-[1.5] text-zinc-300" />
                <p className="text-xs text-zinc-600 font-medium">暂无书签记录</p>
                <p className="text-[11px] text-zinc-400">点击右上角“标记本章”可在此留下阅读印记</p>
                <button
                  onClick={handleToggleBookmarkCurrent}
                  className="mt-2 px-3 py-1.5 text-xs bg-black text-white rounded-lg hover:bg-zinc-800 transition-colors flex items-center gap-1.5 font-sans shadow-xs"
                >
                  <BookmarkPlus className="w-3.5 h-3.5" />
                  <span>标记当前章（{currentChapterTitle || '当前章节'}）</span>
                </button>
              </div>
            ) : (
              bookmarks.map((bm) => {
                const isCurrent = String(bm.chapterId) === String(currentChapterId);
                return (
                  <div
                    key={bm.id}
                    onClick={() => {
                      if (onSelectChapter) {
                        onSelectChapter(bm.chapterId);
                      }
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
                        <p className="text-xs text-zinc-600 line-clamp-2 leading-relaxed bg-zinc-50 p-2 rounded border border-zinc-200/80 mb-1.5 font-mono">
                          {bm.excerpt}
                        </p>
                      )}
                      <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 font-mono">
                        <Clock className="w-3 h-3" />
                        <span>{formatRelativeTime(bm.createTime)}</span>
                      </div>
                    </div>

                    <button
                      onClick={(e) => handleRemoveBookmark(e, bm.id)}
                      className="text-zinc-400 hover:text-red-600 p-1.5 rounded transition-all opacity-80 sm:opacity-0 sm:group-hover:opacity-100 hover:bg-zinc-100 shrink-0"
                      title="删除书签"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        )}
    </Drawer>
  );
};
