'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { BookOpen, Library, Settings, Search, Palette, Check } from 'lucide-react';
import { storage } from '@/lib/storage';
import { THEMES, setGlobalTheme, getGlobalTheme, ThemeType, THEME_CHANGE_EVENT } from '@/lib/theme';

interface HeaderProps {
  onSearchClick?: () => void;
  onSearchFocus?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onSearchClick, onSearchFocus }) => {
  const [shelfCount, setShelfCount] = useState<number>(0);
  const [currentTheme, setCurrentTheme] = useState<ThemeType>('white');
  const [showThemeMenu, setShowThemeMenu] = useState(false);
  const themeMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setShelfCount(storage.getBookshelf().length);
    setCurrentTheme(getGlobalTheme());

    const handleThemeChange = (e: Event) => {
      const customEvent = e as CustomEvent<ThemeType>;
      if (customEvent.detail) {
        setCurrentTheme(customEvent.detail);
      }
    };

    window.addEventListener(THEME_CHANGE_EVENT, handleThemeChange);
    return () => window.removeEventListener(THEME_CHANGE_EVENT, handleThemeChange);
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (themeMenuRef.current && !themeMenuRef.current.contains(e.target as Node)) {
        setShowThemeMenu(false);
      }
    };
    if (showThemeMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showThemeMenu]);

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

          {/* Theme Palette Switcher */}
          <div className="relative" ref={themeMenuRef}>
            <button
              onClick={() => setShowThemeMenu(!showThemeMenu)}
              className="p-2 sm:px-2.5 sm:py-1.5 text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100 rounded-lg flex items-center gap-1.5 transition-colors text-sm font-medium"
              title="切换全局主题配色"
            >
              <Palette className="w-4 h-4" />
              <span className="hidden sm:inline">主题</span>
            </button>

            {showThemeMenu && (
              <div className="absolute right-0 top-full mt-2 w-44 p-1.5 rounded-xl bg-white border border-zinc-200 shadow-xl z-50 animate-fade-in divide-y divide-zinc-100">
                <div className="px-2.5 py-1.5 text-[11px] font-mono font-semibold text-zinc-400">
                  全局主题配色
                </div>
                <div className="py-1 space-y-0.5">
                  {THEMES.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => {
                        setGlobalTheme(t.id);
                        setShowThemeMenu(false);
                      }}
                      className={`w-full px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between transition-colors ${
                        currentTheme === t.id
                          ? 'bg-zinc-100 font-bold text-zinc-950'
                          : 'text-zinc-700 hover:bg-zinc-50 hover:text-zinc-950'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="w-3.5 h-3.5 rounded-full border shadow-2xs shrink-0"
                          style={{ backgroundColor: t.bg, borderColor: t.border }}
                        />
                        <span>{t.label}</span>
                      </div>
                      {currentTheme === t.id && <Check className="w-3.5 h-3.5 text-zinc-900 dark:text-zinc-100" />}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
};
