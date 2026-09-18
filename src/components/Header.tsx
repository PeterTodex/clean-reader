'use client';

import React from 'react';
import Link from 'next/link';
import { BookOpen, Library, Settings, Search } from 'lucide-react';

interface HeaderProps {
  onSearchFocus?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onSearchFocus }) => {
  return (
    <header className="sticky top-0 z-40 bg-[#faf8f5]/90 backdrop-blur-md border-b border-stone-200/80 transition-colors">
      <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 rounded-xl bg-amber-800 flex items-center justify-center text-amber-100 shadow-sm group-hover:scale-105 transition-transform">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xl font-serif font-bold tracking-tight text-stone-900">清阅</span>
            <span className="hidden sm:inline-block ml-2 text-xs font-medium px-2 py-0.5 rounded-full bg-stone-100 text-stone-600 border border-stone-200/60">
              纯粹无广
            </span>
          </div>
        </Link>

        {/* Action Buttons */}
        <nav className="flex items-center gap-1.5 sm:gap-2">
          {onSearchFocus && (
            <button
              onClick={onSearchFocus}
              className="p-2 sm:px-3 sm:py-1.5 text-stone-600 hover:text-stone-900 hover:bg-stone-100/80 rounded-lg flex items-center gap-1.5 transition-colors text-sm"
              title="搜索小说"
            >
              <Search className="w-4 h-4" />
              <span className="hidden sm:inline">搜书</span>
            </button>
          )}

          <Link
            href="/"
            className="p-2 sm:px-3 sm:py-1.5 text-stone-600 hover:text-stone-900 hover:bg-stone-100/80 rounded-lg flex items-center gap-1.5 transition-colors text-sm"
            title="我的书架"
          >
            <Library className="w-4 h-4" />
            <span className="hidden sm:inline">书架</span>
          </Link>

          <Link
            href="/sources"
            className="p-2 sm:px-3 sm:py-1.5 text-stone-600 hover:text-stone-900 hover:bg-stone-100/80 rounded-lg flex items-center gap-1.5 transition-colors text-sm"
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
