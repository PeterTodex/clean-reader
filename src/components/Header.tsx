'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { BookOpen, Library, Settings, Search, Clock } from 'lucide-react';
import { storage } from '@/lib/storage';

interface HeaderProps {
  onSearchClick?: () => void;
  onSearchFocus?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onSearchClick, onSearchFocus }) => {
  const [shelfCount, setShelfCount] = useState<number>(0);

  useEffect(() => {
    setShelfCount(storage.getBookshelf().length);
  }, []);

  const handleSearchAction = () => {
    if (onSearchClick) {
      onSearchClick();
    } else if (onSearchFocus) {
      onSearchFocus();
    } else {
      window.location.href = '/?search=1';
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-zinc-200/80 transition-colors">
      <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-lg bg-black flex items-center justify-center text-white shadow-sm group-hover:scale-105 transition-transform">
            <BookOpen className="w-4 h-4" />
          </div>
          <span className="text-xl font-bold tracking-tight text-zinc-950">清阅</span>
        </Link>

        {/* Action Buttons */}
        <nav className="flex items-center gap-1.5 sm:gap-2">
          <button
            onClick={handleSearchAction}
            className="p-2 sm:px-3 sm:py-1.5 text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100 rounded-lg flex items-center gap-1.5 transition-colors text-sm font-medium"
            title="搜索小说"
          >
            <Search className="w-4 h-4" />
            <span className="hidden sm:inline">搜书</span>
          </button>

          <Link
            href="/history"
            className="p-2 sm:px-3 sm:py-1.5 text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100 rounded-lg flex items-center gap-1.5 transition-colors text-sm font-medium"
            title="阅读历史"
          >
            <Clock className="w-4 h-4" />
            <span className="hidden sm:inline">历史</span>
          </Link>

          <Link
            href="/bookshelf"
            className="p-2 sm:px-3 sm:py-1.5 text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100 rounded-lg flex items-center gap-1.5 transition-colors text-sm font-medium"
            title="我的书架"
          >
            <Library className="w-4 h-4" />
            <span className="hidden sm:inline">书架</span>
            {shelfCount > 0 && (
              <span className="text-[10px] font-mono bg-zinc-900 text-white px-1.5 py-0.2 rounded-full leading-tight">
                {shelfCount}
              </span>
            )}
          </Link>

          <Link
            href="/sources"
            className="p-2 sm:px-3 sm:py-1.5 text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100 rounded-lg flex items-center gap-1.5 transition-colors text-sm font-medium"
            title="书源设置与测速"
          >
            <Settings className="w-4 h-4" />
            <span className="hidden sm:inline">书源</span>
          </Link>
        </nav>
      </div>
    </header>
  );
};
