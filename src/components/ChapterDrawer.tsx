'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import Link from 'next/link';
import { ChapterItem } from '@/sources/types';
import { X, Search, ArrowUpDown, Bookmark, CheckCircle2, Download, Loader2, Check } from 'lucide-react';

interface ChapterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  chapters: ChapterItem[];
  bookId: string;
  sourceId: string;
  currentChapterId: string;
  cachedChapterIds?: Set<string> | string[];
  onSelectChapter?: (chapterId: string) => void;
}

export const ChapterDrawer: React.FC<ChapterDrawerProps> = ({
  isOpen,
  onClose,
  chapters,
  bookId,
  sourceId,
  currentChapterId,
  cachedChapterIds,
  onSelectChapter,
}) => {
  const [search, setSearch] = useState('');
  const [isReverse, setIsReverse] = useState(false);
  const [cachedSet, setCachedSet] = useState<Set<string>>(() => new Set(cachedChapterIds || []));
  const [isCaching, setIsCaching] = useState(false);
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

  // Auto-scroll current chapter to center when drawer is opened
  useEffect(() => {
    if (isOpen && !search.trim()) {
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
  }, [isOpen, currentChapterId, isReverse, search]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-start bg-black/50 backdrop-blur-sm">
      <div
        className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col border-r border-zinc-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-zinc-100 bg-zinc-50/50 flex flex-col gap-2.5">
          {/* Row 1: Title and Close button */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Bookmark className="w-4 h-4 text-zinc-900 dark:text-zinc-100 shrink-0" />
              <h3 className="font-bold text-zinc-950 text-sm shrink-0">目录列表</h3>
              <span className="text-xs font-mono font-normal text-zinc-400 truncate">
                {cachedSet.size > 0
                  ? `（已缓存 ${cachedSet.size}/${chapters.length}）`
                  : `（共 ${chapters.length} 章）`}
              </span>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 rounded-md shrink-0 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Row 2: Action controls */}
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
        </div>

        {/* Filter input */}
        <div className="p-3 border-b border-zinc-100">
          <div className="relative">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="搜索章节名或序号..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-zinc-100 rounded-lg border border-zinc-200 focus:outline-none focus:ring-1 focus:ring-black focus:bg-white transition-all text-zinc-900 placeholder-zinc-400"
            />
          </div>
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
      </div>
    </div>
  );
};
