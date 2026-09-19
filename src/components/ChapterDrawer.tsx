'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import Link from 'next/link';
import { ChapterItem } from '@/sources/types';
import { X, Search, ArrowUpDown, Bookmark } from 'lucide-react';

interface ChapterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  chapters: ChapterItem[];
  bookId: string;
  sourceId: string;
  currentChapterId: string;
  onSelectChapter?: (chapterId: string) => void;
}

export const ChapterDrawer: React.FC<ChapterDrawerProps> = ({
  isOpen,
  onClose,
  chapters,
  bookId,
  sourceId,
  currentChapterId,
  onSelectChapter,
}) => {
  const [search, setSearch] = useState('');
  const [isReverse, setIsReverse] = useState(false);
  const currentItemRef = useRef<HTMLAnchorElement | null>(null);

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
        <div className="p-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
          <div>
            <h3 className="font-bold text-zinc-950 text-sm flex items-center gap-2">
              <Bookmark className="w-4 h-4 text-black" />
              目录列表
              <span className="text-xs font-mono font-normal text-zinc-400">（共 {chapters.length} 章）</span>
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsReverse(!isReverse)}
              className="px-2.5 py-1 text-xs text-zinc-700 bg-white hover:bg-zinc-100 border border-zinc-200 rounded-md flex items-center gap-1 transition-colors font-mono"
              title="切换正序/倒序"
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
              {isReverse ? '倒序' : '正序'}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 rounded-md"
            >
              <X className="w-4 h-4" />
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
        <div className="flex-1 overflow-y-auto p-2 divide-y divide-zinc-50">
          {displayedChapters.length === 0 ? (
            <div className="p-8 text-center text-xs text-zinc-400">没有匹配到相关章节</div>
          ) : (
            displayedChapters.map((c) => {
              const isCurrent = String(c.id) === String(currentChapterId);
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
                  className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-xs transition-colors ${
                    isCurrent
                      ? 'bg-amber-50 text-amber-950 font-bold border-l-2 border-amber-800'
                      : 'text-zinc-700 hover:bg-zinc-50 hover:text-black'
                  }`}
                >
                  <span className="line-clamp-1 flex-1 pr-2">{c.title}</span>
                  {isCurrent && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-800 text-white font-mono font-normal flex-shrink-0">
                      当前
                    </span>
                  )}
                </Link>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
