'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { Header } from '@/components/Header';
import { BookDownloaderModal } from '@/components/BookDownloaderModal';
import { BookCoverPlaceholder } from '@/components/BookCoverPlaceholder';
import { BookDetail, ChapterItem } from '@/sources/types';
import { storage } from '@/lib/storage';
import { clientBookCache } from '@/lib/client-cache';
import { formatDisplayDate } from '@/lib/utils';
import {
  BookOpen,
  Bookmark,
  BookmarkCheck,
  MoreHorizontal,
  Search,
  ArrowUpDown,
  Layers,
  Clock,
  Download,
  CheckCircle2,
  Loader2,
  X,
  MapPin,
} from 'lucide-react';

export default function BookDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const bookId = params.id as string;
  const sourceId = searchParams.get('source') || '';

  const [book, setBook] = useState<BookDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inShelf, setInShelf] = useState(false);
  const [chapterSearch, setChapterSearch] = useState('');
  const [isReverse, setIsReverse] = useState(false);
  const [lastReadChapterId, setLastReadChapterId] = useState<string | null>(null);
  const [selectedChunkIndex, setSelectedChunkIndex] = useState<number>(-1);
  const [jumpPageInput, setJumpPageInput] = useState('');
  const [showDownloader, setShowDownloader] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [cachedChapterIds, setCachedChapterIds] = useState<Set<string>>(new Set());
  const [isCaching, setIsCaching] = useState(false);
  const [showCacheConfirm, setShowCacheConfirm] = useState(false);
  const [isCurrentInView, setIsCurrentInView] = useState(true);

  const moreMenuRef = useRef<HTMLDivElement | null>(null);
  const chaptersContainerRef = useRef<HTMLDivElement | null>(null);

  const refreshCachedChapters = () => {
    if (!bookId) return;
    fetch(`/api/chapter/cache?bookId=${bookId}&source=${sourceId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.data)) {
          setCachedChapterIds(new Set(data.data));
          if (data.task && data.task.status === 'running') {
            setIsCaching(true);
          } else {
            setIsCaching(false);
          }
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    if (!bookId) return;

    // Check shelf status and reading history
    setInShelf(storage.isInBookshelf(bookId, sourceId));
    const shelfItem = storage.getBookshelf().find((b) => b.id === bookId && b.sourceId === sourceId);
    const historyItem = storage.getHistory().find((h) => h.id === bookId && h.sourceId === sourceId);
    const lastChapter = shelfItem?.lastChapterId || historyItem?.lastChapterId;
    if (lastChapter) {
      setLastReadChapterId(lastChapter);
    }

    setLoading(true);
    fetch(`/api/book?id=${bookId}&source=${sourceId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.data) {
          setBook(data.data);
          clientBookCache.set(`${sourceId}::${bookId}`, data.data);
          if (Array.isArray(data.data.cachedChapterIds)) {
            setCachedChapterIds(new Set(data.data.cachedChapterIds));
          }
          if (data.data.chapters && data.data.chapters.length > 100) {
            const lastIdx = data.data.chapters.findIndex((c: ChapterItem) => c.id === lastChapter);
            const initialChunk = lastIdx >= 0 ? Math.floor(lastIdx / 100) : 0;
            setSelectedChunkIndex(initialChunk);
          } else {
            setSelectedChunkIndex(-1);
          }
        } else {
          setError(data.error || '获取书籍信息失败');
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [bookId, sourceId]);

  useEffect(() => {
    if (!bookId) return;
    refreshCachedChapters();

    let timer: NodeJS.Timeout | null = null;
    if (isCaching) {
      timer = setInterval(refreshCachedChapters, 2000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [bookId, sourceId, isCaching]);

  const handleStartCacheAll = async () => {
    setShowCacheConfirm(false);
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
      refreshCachedChapters();
    } catch {}
  };

  const toggleBookshelf = () => {
    if (!book) return;
    if (inShelf) {
      storage.removeFromBookshelf(book.id, sourceId);
      setInShelf(false);
    } else {
      const historyItem = storage.getHistory().find((h) => h.id === book.id && h.sourceId === sourceId);
      storage.saveToBookshelf({
        id: book.id,
        title: book.title,
        author: book.author,
        cover: book.cover,
        sourceId,
        lastChapterId: historyItem?.lastChapterId || lastReadChapterId || book.chapters[0]?.id,
        lastChapterTitle: historyItem?.lastChapterTitle || book.chapters[0]?.title,
        progressPercent: historyItem?.progressPercent,
        totalChapters: book.chapters.length,
      });
      setInShelf(true);
    }
  };

  const CHUNK_SIZE = 100;

  const chapterChunks = useMemo(() => {
    if (!book || book.chapters.length <= CHUNK_SIZE) return [];
    const count = Math.ceil(book.chapters.length / CHUNK_SIZE);
    const chunks: { index: number; label: string; start: number; end: number }[] = [];
    for (let i = 0; i < count; i++) {
      const start = i * CHUNK_SIZE + 1;
      const end = Math.min((i + 1) * CHUNK_SIZE, book.chapters.length);
      chunks.push({
        index: i,
        label: `第 ${start} - ${end} 章`,
        start,
        end,
      });
    }
    return chunks;
  }, [book]);

  const filteredChapters = useMemo(() => {
    if (!book) return [];
    let list = [...book.chapters];
    if (chapterSearch.trim()) {
      const q = chapterSearch.trim().toLowerCase();
      list = list.filter((c) => c.title.toLowerCase().includes(q) || String(c.index).includes(q));
    } else if (selectedChunkIndex >= 0 && chapterChunks.length > 0) {
      const start = selectedChunkIndex * CHUNK_SIZE;
      list = list.slice(start, start + CHUNK_SIZE);
    }
    if (isReverse) {
      list.reverse();
    }
    return list;
  }, [book, chapterSearch, selectedChunkIndex, chapterChunks, isReverse]);

  const handleJumpToChapter = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseInt(jumpPageInput.trim(), 10);
    if (isNaN(num) || num <= 0 || !book || book.chapters.length === 0) return;
    const clampedIndex = Math.min(Math.max(1, num), book.chapters.length) - 1;
    const chunkIdx = Math.floor(clampedIndex / CHUNK_SIZE);
    setSelectedChunkIndex(chunkIdx);
    setChapterSearch('');
    const targetChapter = book.chapters[clampedIndex];
    if (targetChapter) {
      setTimeout(() => {
        const el = document.getElementById(`chapter-item-${targetChapter.id}`);
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 80);
    }
  };

  const hasLastReadInBook = useMemo(() => {
    if (!book || !lastReadChapterId) return false;
    return book.chapters.some((c) => c.id === lastReadChapterId);
  }, [book, lastReadChapterId]);

  const handleLocateLastRead = () => {
    if (!book || !lastReadChapterId) return;
    const lastIdx = book.chapters.findIndex((c) => c.id === lastReadChapterId);
    if (lastIdx >= 0) {
      const chunkIdx = Math.floor(lastIdx / CHUNK_SIZE);
      if (selectedChunkIndex !== chunkIdx && selectedChunkIndex !== -1) {
        setSelectedChunkIndex(chunkIdx);
      }
      setChapterSearch('');
      setTimeout(() => {
        const el = document.getElementById(`chapter-item-${lastReadChapterId}`);
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }
  };

  // Close More Menu on click outside or Escape
  useEffect(() => {
    if (!showMoreMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setShowMoreMenu(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowMoreMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showMoreMenu]);

  // Track if current chapter is currently visible in the chapter list viewport
  useEffect(() => {
    if (!hasLastReadInBook || !lastReadChapterId) {
      setIsCurrentInView(true);
      return;
    }

    const container = chaptersContainerRef.current;
    if (!container) return;

    if (typeof IntersectionObserver === 'undefined') {
      setIsCurrentInView(true);
      return;
    }

    let observer: IntersectionObserver | null = null;
    const timer = setTimeout(() => {
      const targetEl = document.getElementById(`chapter-item-${lastReadChapterId}`);
      if (!targetEl) {
        setIsCurrentInView(false);
        return;
      }

      observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            setIsCurrentInView(entry.isIntersecting);
          }
        },
        {
          root: container,
          threshold: 0,
        }
      );

      observer.observe(targetEl);
    }, 50);

    return () => {
      clearTimeout(timer);
      if (observer) {
        observer.disconnect();
      }
    };
  }, [hasLastReadInBook, lastReadChapterId, filteredChapters, selectedChunkIndex]);

  const startChapterId = lastReadChapterId || (book?.chapters[0]?.id ?? '');

  return (
    <div className="min-h-screen flex flex-col transition-colors duration-200">
      <Header />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-8 space-y-8">

        {loading ? (
          <div className="space-y-8 animate-pulse">
            {/* Book Meta Card Skeleton */}
            <div className="bg-white rounded-xl p-6 sm:p-8 border border-zinc-200 shadow-sm flex flex-col sm:flex-row gap-6 sm:gap-8 items-start">
              <div className="w-36 sm:w-44 aspect-[4/5] bg-zinc-200 rounded-lg shrink-0 mx-auto sm:mx-0" />
              <div className="flex-1 min-w-0 space-y-4 w-full">
                <div className="space-y-2">
                  <div className="h-4 bg-zinc-200 rounded w-24" />
                  <div className="h-7 bg-zinc-200 rounded w-2/3" />
                  <div className="h-4 bg-zinc-200 rounded w-32" />
                </div>
                <div className="h-4 bg-zinc-200 rounded w-48" />
                <div className="space-y-2 pt-2">
                  <div className="h-3 bg-zinc-200 rounded w-full" />
                  <div className="h-3 bg-zinc-200 rounded w-5/6" />
                  <div className="h-3 bg-zinc-200 rounded w-4/6" />
                </div>
                <div className="flex items-center gap-2 pt-3">
                  <div className="h-10 sm:h-11 bg-zinc-200 rounded-xl flex-1 sm:w-36 sm:flex-none" />
                  <div className="h-10 w-10 sm:h-11 sm:w-11 bg-zinc-200 rounded-xl shrink-0" />
                  <div className="h-10 w-10 sm:h-11 sm:w-11 bg-zinc-200 rounded-xl shrink-0" />
                </div>
              </div>
            </div>
            {/* Chapters Card Skeleton */}
            <div className="bg-white rounded-xl border border-zinc-200 p-6 space-y-4">
              <div className="h-5 bg-zinc-200 rounded w-36" />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {Array.from({ length: 9 }).map((_, i) => (
                  <div key={i} className="h-10 bg-zinc-100 rounded-lg" />
                ))}
              </div>
            </div>
          </div>
        ) : error || !book ? (
          <div className="py-16 text-center text-zinc-500">
            <p className="text-red-600 mb-4 text-sm">{error || '书籍不存在'}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-black hover:bg-zinc-800 rounded-lg text-xs text-white"
            >
              重新加载
            </button>
          </div>
        ) : (
          <>
            {/* Book Meta Card */}
            <div className="bg-white rounded-xl p-6 sm:p-8 border border-zinc-200 shadow-sm flex flex-col sm:flex-row gap-6 sm:gap-8 items-start">
              {/* Cover */}
              <div className="w-36 sm:w-44 aspect-[4/5] bg-zinc-100 rounded-lg overflow-hidden shadow-sm border border-zinc-200 flex-shrink-0 mx-auto sm:mx-0 relative">
                <BookCoverPlaceholder title={book.title} className="absolute inset-0" />
                {book.cover ? (
                  <img
                    src={book.cover}
                    alt={book.title}
                    className="relative w-full h-full object-cover"
                    onError={(e) => {
                      // Reveal the placeholder underneath instead of a broken image.
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                ) : null}
              </div>

              {/* Info Details */}
              <div className="flex-1 min-w-0 space-y-4">
                <div>
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded bg-black text-white">
                      {book.category || '小说'}
                    </span>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-zinc-100 text-zinc-700 border border-zinc-200">
                      {book.status || '连载'}
                    </span>
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-zinc-950 tracking-tight">
                    {book.title}
                  </h1>
                  <p className="text-xs text-zinc-500 mt-1">作者：{book.author}</p>
                </div>

                {/* Additional Stats */}
                <div className="flex flex-wrap gap-4 text-xs font-mono text-zinc-500 py-1">
                  <div className="flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-zinc-700" />
                    <span>共 {book.chapters.length} 章</span>
                  </div>
                  {book.updateTime && (
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-zinc-700" />
                      <span>{formatDisplayDate(book.updateTime)}</span>
                    </div>
                  )}
                </div>

                {/* Synopsis */}
                {book.intro && (
                  <p className="text-xs sm:text-sm text-zinc-600 leading-relaxed whitespace-pre-wrap">
                    {book.intro}
                  </p>
                )}

                {/* Action Buttons */}
                <div className="flex items-center gap-2 pt-2">
                  {startChapterId ? (
                    <Link
                      href={`/read/${book.id}/${startChapterId}?source=${sourceId}`}
                      className="flex-1 sm:flex-initial px-6 py-2.5 sm:py-3 rounded-xl bg-black text-white hover:bg-zinc-800 text-xs sm:text-sm font-medium transition-colors shadow-sm flex items-center justify-center gap-2 whitespace-nowrap"
                    >
                      <BookOpen className="w-4 h-4 shrink-0" />
                      <span>{lastReadChapterId ? '继续阅读' : '开始阅读'}</span>
                    </Link>
                  ) : null}

                  <button
                    type="button"
                    onClick={toggleBookshelf}
                    className={`h-10 w-10 sm:h-11 sm:w-11 rounded-xl border flex items-center justify-center transition-colors shrink-0 ${
                      inShelf
                        ? 'border-zinc-300 bg-zinc-100 text-zinc-900 hover:bg-zinc-200'
                        : 'border-zinc-200 bg-white text-zinc-600 hover:text-black hover:border-zinc-400 hover:bg-zinc-50'
                    }`}
                    title={inShelf ? '已在书架（点击移出）' : '加入书架'}
                    aria-label={inShelf ? '已在书架（点击移出）' : '加入书架'}
                  >
                    {inShelf ? (
                      <BookmarkCheck className="w-4 h-4 sm:w-5 sm:h-5 text-zinc-900" />
                    ) : (
                      <Bookmark className="w-4 h-4 sm:w-5 sm:h-5" />
                    )}
                  </button>

                  <div className="relative" ref={moreMenuRef}>
                    <button
                      type="button"
                      onClick={() => setShowMoreMenu(!showMoreMenu)}
                      className="h-10 w-10 sm:h-11 sm:w-11 rounded-xl border border-zinc-200 bg-white text-zinc-600 hover:text-black hover:border-zinc-400 hover:bg-zinc-50 flex items-center justify-center transition-colors shrink-0"
                      title="更多操作"
                      aria-label="更多操作"
                    >
                      <MoreHorizontal className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>

                    {showMoreMenu && (
                      <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-lg border border-zinc-200 p-1.5 z-30 space-y-0.5 animate-fade-in">
                        <button
                          type="button"
                          onClick={() => {
                            setShowMoreMenu(false);
                            setShowDownloader(true);
                          }}
                          className="w-full px-3 py-2 text-left text-xs text-zinc-800 hover:bg-zinc-100 rounded-lg flex items-center gap-2.5 transition-colors"
                        >
                          <Download className="w-4 h-4 text-zinc-600 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-zinc-900">下载 TXT</div>
                            <div className="text-[11px] text-zinc-400">导出离线单文件</div>
                          </div>
                        </button>

                        {book.chapters.length > 0 && cachedChapterIds.size >= book.chapters.length ? (
                          <div className="w-full px-3 py-2 text-left text-xs text-zinc-500 rounded-lg flex items-center gap-2.5 cursor-default bg-zinc-50">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-emerald-800">全本已离线缓存</div>
                              <div className="text-[11px] text-zinc-400">共 {book.chapters.length} 章已全部就绪</div>
                            </div>
                          </div>
                        ) : isCaching ? (
                          <button
                            type="button"
                            onClick={() => {
                              setShowMoreMenu(false);
                              handleStopCacheAll();
                            }}
                            className="w-full px-3 py-2 text-left text-xs text-zinc-800 hover:bg-zinc-100 rounded-lg flex items-center gap-2.5 transition-colors"
                          >
                            <Loader2 className="w-4 h-4 animate-spin text-zinc-600 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-zinc-900">暂停后台缓存</div>
                              <div className="text-[11px] text-zinc-400">
                                进度 {cachedChapterIds.size}/{book.chapters.length} 章（点击暂停）
                              </div>
                            </div>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setShowMoreMenu(false);
                              setShowCacheConfirm(true);
                            }}
                            className="w-full px-3 py-2 text-left text-xs text-zinc-800 hover:bg-zinc-100 rounded-lg flex items-center gap-2.5 transition-colors"
                          >
                            <Layers className="w-4 h-4 text-zinc-600 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-zinc-900">缓存全部</div>
                              <div className="text-[11px] text-zinc-400">
                                {cachedChapterIds.size > 0
                                  ? `已存 ${cachedChapterIds.size} 章，待存 ${book.chapters.length - cachedChapterIds.size} 章`
                                  : `后台将 ${book.chapters.length} 章保存至本地`}
                              </div>
                            </div>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            setShowMoreMenu(false);
                            router.push(`/search?q=${encodeURIComponent(book.title)}`);
                          }}
                          className="w-full px-3 py-2 text-left text-xs text-zinc-800 hover:bg-zinc-100 rounded-lg flex items-center gap-2.5 transition-colors"
                        >
                          <Search className="w-4 h-4 text-zinc-600 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-zinc-900">换源搜索此书</div>
                            <div className="text-[11px] text-zinc-400">在其他书源中查找</div>
                          </div>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Chapter List Card */}
            <div className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden">
              <div className="p-4 sm:p-5 border-b border-zinc-100 bg-zinc-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <Bookmark className="w-4 h-4 text-zinc-900 shrink-0" />
                  <h2 className="font-bold text-base text-zinc-950 shrink-0">目录</h2>
                  <span className="text-xs font-mono font-normal text-zinc-400 truncate">
                    {cachedChapterIds.size > 0
                      ? `（已缓存 ${cachedChapterIds.size}/${book.chapters.length}）`
                      : `（共 ${book.chapters.length} 章）`}
                  </span>
                  {isCaching && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-mono text-zinc-600 bg-zinc-100 px-2 py-0.5 rounded-full">
                      <Loader2 className="w-3 h-3 animate-spin text-zinc-600" />
                      <span>缓存中</span>
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative flex-1 sm:w-56">
                    <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      placeholder="搜索章节名或序号..."
                      value={chapterSearch}
                      onChange={(e) => setChapterSearch(e.target.value)}
                      className="w-full pl-9 pr-3 py-1.5 text-xs bg-zinc-100 rounded-lg border border-zinc-200 focus:outline-none focus:ring-1 focus:ring-zinc-400 focus:border-zinc-400 text-zinc-900 placeholder-zinc-400 transition-all"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsReverse(!isReverse)}
                    className="px-2.5 py-1.5 text-xs text-zinc-700 bg-white hover:bg-zinc-100 border border-zinc-200 rounded-lg flex items-center gap-1 transition-colors flex-shrink-0 font-mono"
                    title="切换正序/倒序"
                  >
                    <ArrowUpDown className="w-3.5 h-3.5" />
                    {isReverse ? '倒序' : '正序'}
                  </button>
                </div>
              </div>

              {/* Chapter Chunk Grouping & Fast Jump Bar */}
              {chapterChunks.length > 0 && !chapterSearch.trim() && (
                <div className="px-3 sm:px-4 py-2 bg-zinc-50 border-b border-zinc-100 flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                    <span className="text-[11px] font-mono text-zinc-500 shrink-0">分组</span>
                    <select
                      value={selectedChunkIndex}
                      onChange={(e) => setSelectedChunkIndex(Number(e.target.value))}
                      className="px-2 py-1 bg-white rounded-md border border-zinc-200 text-xs font-mono text-zinc-800 focus:outline-none focus:ring-1 focus:ring-zinc-400 shrink-0 max-w-[145px] sm:max-w-none truncate"
                    >
                      {chapterChunks.map((chunk) => (
                        <option key={chunk.index} value={chunk.index}>
                          {chunk.label}
                        </option>
                      ))}
                      <option value={-1}>全部展示（{book.chapters.length}章）</option>
                    </select>
                  </div>

                  <form onSubmit={handleJumpToChapter} className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                    <span className="text-[11px] font-mono text-zinc-500 shrink-0">跳转</span>
                    <input
                      type="number"
                      min="1"
                      max={book.chapters.length}
                      placeholder="章号"
                      value={jumpPageInput}
                      onChange={(e) => setJumpPageInput(e.target.value)}
                      className="w-12 sm:w-16 px-1.5 py-1 text-xs bg-white rounded border border-zinc-200 text-center font-mono focus:outline-none focus:border-zinc-400"
                    />
                    <button
                      type="submit"
                      disabled={!jumpPageInput.trim()}
                      className="px-2.5 py-1 bg-black hover:bg-zinc-800 text-white rounded text-[11px] font-mono disabled:opacity-40 transition-colors shrink-0"
                    >
                      跳转
                    </button>
                  </form>
                </div>
              )}

              {/* Chapters List */}
              <div className="relative">
                <div
                  ref={chaptersContainerRef}
                  className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 max-h-[600px] overflow-y-auto"
                >
                  {filteredChapters.length === 0 ? (
                    <div className="col-span-full py-12 text-center text-xs text-zinc-400">
                      没有匹配到相关章节
                    </div>
                  ) : (
                    filteredChapters.map((ch) => {
                      const isLastRead = ch.id === lastReadChapterId;
                      const isCached = cachedChapterIds.has(ch.id);
                      return (
                        <Link
                          key={ch.id}
                          id={`chapter-item-${ch.id}`}
                          href={`/read/${book.id}/${ch.id}?source=${sourceId}`}
                          className={`flex items-center justify-between px-4 py-3 text-xs transition-colors border-b border-zinc-100 ${
                            isLastRead
                              ? 'chapter-item-current bg-zinc-100 text-zinc-950 font-bold border-l-4 border-zinc-900'
                              : 'text-zinc-700 hover:bg-zinc-50 hover:text-zinc-950'
                          }`}
                        >
                          <span className="line-clamp-1 flex-1 pr-2">{ch.title}</span>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {isLastRead && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded font-mono font-medium flex-shrink-0 chapter-badge-current bg-black text-white">
                                当前
                              </span>
                            )}
                            {isCached && (
                              <span title="已缓存" className="text-emerald-600 flex items-center">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              </span>
                            )}
                          </div>
                        </Link>
                      );
                    })
                  )}
                </div>

                {/* Smart Locate Current Chapter floating button - only visible when current chapter is NOT in view */}
                {!isCurrentInView && hasLastReadInBook && !chapterSearch.trim() && (
                  <div className="absolute bottom-4 right-4 z-10 animate-fade-in">
                    <button
                      type="button"
                      onClick={handleLocateLastRead}
                      className="px-3.5 py-2 bg-black hover:bg-zinc-800 text-white text-xs font-mono rounded-full shadow-lg flex items-center gap-1.5 transition-all border border-zinc-700"
                      title="定位到当前阅读章节"
                    >
                      <MapPin className="w-3.5 h-3.5 text-zinc-200 shrink-0" />
                      <span>定位当前章</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            <BookDownloaderModal
              isOpen={showDownloader}
              onClose={() => {
                setShowDownloader(false);
                refreshCachedChapters();
              }}
              book={book}
              sourceId={sourceId}
            />

            {/* Cache All Confirmation Modal */}
            {showCacheConfirm && book && (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in"
                onClick={() => setShowCacheConfirm(false)}
              >
                <div
                  className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-zinc-200 space-y-4"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
                    <h3 className="font-bold text-base text-zinc-950 flex items-center gap-2">
                      <Download className="w-4 h-4 text-black" />
                      确认缓存全部章节
                    </h3>
                    <button
                      onClick={() => setShowCacheConfirm(false)}
                      className="p-1 rounded-lg text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="text-xs text-zinc-600 space-y-3 leading-relaxed">
                    <p>确定要在后台下载并缓存整本书籍吗？系统将自动下载所有未缓存的章节并保存到本地书库。</p>

                    <div className="p-3 bg-zinc-50 rounded-lg border border-zinc-200 space-y-1.5 font-mono text-zinc-700">
                      <div className="truncate">
                        书籍名称：<span className="font-bold text-zinc-950">{book.title}</span>
                      </div>
                      <div>总章节数：{book.chapters.length} 章</div>
                      <div>已缓存章：{cachedChapterIds.size} 章</div>
                      <div className="font-medium text-zinc-900">
                        待缓存章：{Math.max(0, book.chapters.length - cachedChapterIds.size)} 章
                      </div>
                    </div>

                    <p className="text-[11px] text-zinc-500 bg-zinc-50 p-2.5 rounded border border-zinc-200 leading-relaxed">
                      💡 <strong>提示</strong>：任务将在服务端后台异步执行，每章请求带 <strong>2~5 秒随机防封延时</strong>。期间您可以正常浏览、阅读或离开此页面，不影响您的操作与设备带宽。
                    </p>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      onClick={() => setShowCacheConfirm(false)}
                      className="px-4 py-2 rounded-lg border border-zinc-200 text-xs text-zinc-700 hover:bg-zinc-50 transition-colors"
                    >
                      取消
                    </button>
                    <button
                      onClick={handleStartCacheAll}
                      className="px-4 py-2 rounded-lg bg-black text-white text-xs font-medium hover:bg-zinc-800 transition-colors flex items-center gap-1.5 shadow-sm"
                    >
                      <Download className="w-3.5 h-3.5" />
                      确认在后台执行
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
