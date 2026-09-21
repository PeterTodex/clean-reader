'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { storage, ReaderSettings, DEFAULT_READER_SETTINGS } from '@/lib/storage';
import { THEME_CHANGE_EVENT, ThemeType } from '@/lib/theme';

interface ReaderSkeletonProps {
  bookId: string;
  sourceId: string;
  bookTitle?: string;
  chapterTitle?: string;
  slowLoading?: boolean;
}

export const ReaderSkeleton: React.FC<ReaderSkeletonProps> = ({
  bookId,
  sourceId,
  bookTitle = '书籍阅读',
  chapterTitle = '',
  slowLoading = false,
}) => {
  const [settings, setSettings] = useState<ReaderSettings>(DEFAULT_READER_SETTINGS);
  // Ensure SSR and initial client hydration strictly match with stable placeholder text
  const [displayBookTitle, setDisplayBookTitle] = useState('书籍阅读');
  const [displayChapterTitle, setDisplayChapterTitle] = useState('');

  useEffect(() => {
    setSettings(storage.getSettings());

    const handleThemeChange = (e: Event) => {
      const customEvent = e as CustomEvent<ThemeType>;
      if (customEvent.detail) {
        setSettings((prev) => ({ ...prev, theme: customEvent.detail }));
      }
    };
    window.addEventListener(THEME_CHANGE_EVENT, handleThemeChange);
    return () => window.removeEventListener(THEME_CHANGE_EVENT, handleThemeChange);
  }, []);

  useEffect(() => {
    if (bookTitle) {
      setDisplayBookTitle(bookTitle);
    }
  }, [bookTitle]);

  useEffect(() => {
    if (chapterTitle) {
      setDisplayChapterTitle(chapterTitle);
    }
  }, [chapterTitle]);

  const themeClass = `theme-${settings.theme}`;

  const getFontFamilyStyle = () => {
    switch (settings.fontFamily) {
      case 'sans':
        return 'system-ui, -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif';
      case 'kaiti':
        return '"Kaiti SC", STKaiti, "KaiTi", serif';
      case 'serif':
      default:
        return '"Noto Serif SC", "Source Han Serif SC", SimSun, STSong, serif';
    }
  };

  return (
    <div className={`min-h-screen transition-colors duration-300 ${themeClass}`}>
      {/* Top Floating Bar - 52px */}
      <header className={`fixed top-0 inset-x-0 z-40 backdrop-blur-md border-b reader-border ${themeClass}`}>
        <div className="max-w-4xl mx-auto px-4 h-[52px] flex items-center justify-between">
          <Link
            href={`/book/${bookId}?source=${sourceId}`}
            className="flex items-center gap-1.5 text-sm font-medium hover:opacity-75 transition-opacity"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="line-clamp-1 max-w-[180px] sm:max-w-xs">{displayBookTitle}</span>
          </Link>

          {/* Minimal non-intrusive status pulse */}
          <div className="flex items-center gap-2 text-xs opacity-40 font-mono select-none">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span className="text-[11px] hidden sm:inline">正文载入中</span>
          </div>
        </div>
      </header>

      {/* Main Reading Area Skeleton */}
      <main
        className="w-full px-5 sm:px-8 pt-20 pb-32 select-none cursor-default"
        style={{
          fontSize: `${settings.fontSize}px`,
          lineHeight: settings.lineHeight,
          fontFamily: getFontFamilyStyle(),
        }}
      >
        <section className="animate-fade-in">
          {/* Chapter Title: Real title if available, otherwise title skeleton */}
          {displayChapterTitle ? (
            <h1 className="text-2xl sm:text-3xl font-bold font-serif mb-10 tracking-tight text-center pt-4">
              {displayChapterTitle}
            </h1>
          ) : (
            <div className="mb-10 pt-4 flex flex-col items-center">
              <div className="h-7 sm:h-8 bg-current opacity-[0.15] rounded-md w-52 sm:w-64 animate-pulse" />
            </div>
          )}

          {/* Chinese Novel Paragraph Skeletons (Standard 2em indent) */}
          <div className="space-y-7 pt-2">
            {/* Paragraph 1 */}
            <div className="space-y-3">
              <div className="h-4 bg-current opacity-[0.08] rounded w-[35%] ml-[2em] animate-pulse" />
              <div className="h-4 bg-current opacity-[0.08] rounded w-full animate-pulse" />
              <div className="h-4 bg-current opacity-[0.08] rounded w-[94%] animate-pulse" />
              <div className="h-4 bg-current opacity-[0.08] rounded w-[68%] animate-pulse" />
            </div>

            {/* Paragraph 2 */}
            <div className="space-y-3">
              <div className="h-4 bg-current opacity-[0.08] rounded w-[45%] ml-[2em] animate-pulse" />
              <div className="h-4 bg-current opacity-[0.08] rounded w-full animate-pulse" />
              <div className="h-4 bg-current opacity-[0.08] rounded w-[88%] animate-pulse" />
              <div className="h-4 bg-current opacity-[0.08] rounded w-[52%] animate-pulse" />
            </div>

            {/* Paragraph 3 */}
            <div className="space-y-3">
              <div className="h-4 bg-current opacity-[0.08] rounded w-[30%] ml-[2em] animate-pulse" />
              <div className="h-4 bg-current opacity-[0.08] rounded w-full animate-pulse" />
              <div className="h-4 bg-current opacity-[0.08] rounded w-[96%] animate-pulse" />
              <div className="h-4 bg-current opacity-[0.08] rounded w-[74%] animate-pulse" />
            </div>

            {/* Paragraph 4 */}
            <div className="space-y-3">
              <div className="h-4 bg-current opacity-[0.08] rounded w-[40%] ml-[2em] animate-pulse" />
              <div className="h-4 bg-current opacity-[0.08] rounded w-[86%] animate-pulse" />
              <div className="h-4 bg-current opacity-[0.08] rounded w-[48%] animate-pulse" />
            </div>
          </div>

          {/* Slow Network Reassurance */}
          {slowLoading && (
            <div className="pt-14 text-center">
              <p className="text-xs opacity-45 font-mono animate-fade-in">
                源站响应较慢，正在全力同步正文，请稍候...
              </p>
            </div>
          )}
        </section>
      </main>

      {/* Bottom Floating Bar - 52px */}
      <footer className={`fixed bottom-0 inset-x-0 z-40 backdrop-blur-md border-t reader-border shadow-sm ${themeClass}`}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-[52px] flex items-center justify-between text-xs opacity-35 select-none font-medium">
          <span>上一章</span>
          <span className="font-serif truncate max-w-[200px] sm:max-w-md">
            {displayChapterTitle || '正文载入中...'}
          </span>
          <span>下一章</span>
        </div>
      </footer>
    </div>
  );
};
