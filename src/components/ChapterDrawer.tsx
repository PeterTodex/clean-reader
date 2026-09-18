'use client';

import React, { useState, useMemo } from 'react';
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
}

export const ChapterDrawer: React.FC<ChapterDrawerProps> = ({
  isOpen,
  onClose,
  chapters,
  bookId,
  sourceId,
  currentChapterId,
}) => {
  const [search, setSearch] = useState('');
  const [isReverse, setIsReverse] = useState(false);

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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-start bg-black/40 backdrop-blur-sm animate-fade-in">
      <div
        className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col border-r border-stone-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-stone-100 flex items-center justify-between bg-stone-50/50">
          <div>
            <h3 className="font-serif font-bold text-stone-900 text-base flex items-center gap-2">
              <Bookmark className="w-4 h-4 text-amber-800" />
              目录列表
              <span className="text-xs text-stone-500 font-normal">({chapters.length} 章)</span>
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsReverse(!isReverse)}
              className="px-2.5 py-1 text-xs text-stone-600 bg-white hover:bg-stone-100 border border-stone-200 rounded-lg flex items-center gap-1 transition-colors"
              title="切换正序/倒序"
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
              {isReverse ? '倒序' : '正序'}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter input */}
        <div className="p-3 border-b border-stone-100">
          <div className="relative">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="搜索章节名或序号..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-sm bg-stone-100/80 rounded-lg border-none focus:ring-2 focus:ring-amber-800 focus:bg-white transition-all text-stone-800 placeholder-stone-400"
            />
          </div>
        </div>

        {/* Chapter List */}
        <div className="flex-1 overflow-y-auto p-2 divide-y divide-stone-50">
          {displayedChapters.length === 0 ? (
            <div className="p-8 text-center text-sm text-stone-400">没有匹配到相关章节</div>
          ) : (
            displayedChapters.map((c) => {
              const isCurrent = c.id === currentChapterId;
              return (
                <Link
                  key={c.id}
                  href={`/read/${bookId}/${c.id}?source=${sourceId}`}
                  onClick={onClose}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-colors ${
                    isCurrent
                      ? 'bg-amber-100/70 text-amber-950 font-bold'
                      : 'text-stone-700 hover:bg-stone-50 hover:text-stone-900'
                  }`}
                >
                  <span className="line-clamp-1 flex-1 pr-2">{c.title}</span>
                  {isCurrent && (
                    <span className="text-[11px] px-1.5 py-0.5 rounded bg-amber-800 text-white font-normal flex-shrink-0">
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
