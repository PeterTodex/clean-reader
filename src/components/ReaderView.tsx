'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChapterContent, ChapterItem } from '@/sources/types';
import { ReaderSettings, storage } from '@/lib/storage';
import { ReaderSettingsModal } from './ReaderSettingsModal';
import { ChapterDrawer } from './ChapterDrawer';
import { BookmarkModal } from './BookmarkModal';
import { TtsPlayer } from './TtsPlayer';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  List,
  SlidersHorizontal,
  Maximize,
  Minimize,
  BookOpen,
  Bookmark,
  Headphones,
} from 'lucide-react';

interface ReaderViewProps {
  initialChapter: ChapterContent;
  chapters: ChapterItem[];
  bookTitle: string;
  bookCover?: string;
  bookAuthor?: string;
  sourceId: string;
}

export const ReaderView: React.FC<ReaderViewProps> = ({
  initialChapter,
  chapters,
  bookTitle,
  bookCover = '',
  bookAuthor = '',
  sourceId,
}) => {
  const router = useRouter();
  const [chapter, setChapter] = useState<ChapterContent>(initialChapter);
  const [settings, setSettings] = useState<ReaderSettings>(storage.getSettings());
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showDrawer, setShowDrawer] = useState(false);
  const [showBookmarkModal, setShowBookmarkModal] = useState(false);
  const [showTts, setShowTts] = useState(false);
  const [ttsParagraphIndex, setTtsParagraphIndex] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [readingProgress, setReadingProgress] = useState(0);

  // In-memory cache for chapters to make transitions instant
  const chapterCacheRef = useRef<Map<string, ChapterContent>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);
  const paragraphRefs = useRef<(HTMLParagraphElement | null)[]>([]);

  // Reset TTS paragraph index when chapter changes
  useEffect(() => {
    setTtsParagraphIndex(0);
  }, [chapter.id]);

  // Auto-scroll to active TTS paragraph when in TTS mode
  useEffect(() => {
    if (showTts && paragraphRefs.current[ttsParagraphIndex]) {
      paragraphRefs.current[ttsParagraphIndex]?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [ttsParagraphIndex, showTts]);

  // Current excerpt for bookmarking
  const currentExcerpt = useMemo(() => {
    if (!chapter || !chapter.paragraphs || chapter.paragraphs.length === 0) return '';
    const target = chapter.paragraphs[ttsParagraphIndex] || chapter.paragraphs[0] || '';
    return target.replace(/<[^>]*>/g, '').trim().slice(0, 120);
  }, [chapter, ttsParagraphIndex]);

  // Put initial chapter into cache
  useEffect(() => {
    setChapter(initialChapter);
    chapterCacheRef.current.set(initialChapter.id, initialChapter);
  }, [initialChapter]);

  // Sync settings
  const handleUpdateSettings = (newSettings: Partial<ReaderSettings>) => {
    const updated = storage.saveSettings(newSettings);
    setSettings(updated);
  };

  // Save reading progress to bookshelf
  useEffect(() => {
    if (chapter) {
      storage.saveToBookshelf({
        id: chapter.bookId,
        title: bookTitle,
        author: bookAuthor,
        cover: bookCover,
        sourceId,
        lastChapterId: chapter.id,
        lastChapterTitle: chapter.title,
        progressPercent: readingProgress,
        totalChapters: chapters.length,
      });
    }
  }, [chapter, bookTitle, bookAuthor, bookCover, sourceId, chapters.length, readingProgress]);

  // Prefetch next chapter
  const prefetchChapter = useCallback(
    async (nextId: string | null) => {
      if (!nextId || chapterCacheRef.current.has(nextId)) return;
      try {
        const res = await fetch(
          `/api/chapter?bookId=${chapter.bookId}&chapterId=${nextId}&source=${sourceId}`
        );
        const data = await res.json();
        if (data.success && data.data) {
          chapterCacheRef.current.set(nextId, data.data);
        }
      } catch (e) {
        // Silently fail prefetch
      }
    },
    [chapter.bookId, sourceId]
  );

  useEffect(() => {
    if (settings.autoPreloadNext && chapter.nextChapterId) {
      prefetchChapter(chapter.nextChapterId);
    }
  }, [chapter.nextChapterId, settings.autoPreloadNext, prefetchChapter]);

  // Load a chapter by id
  const navigateToChapter = useCallback(
    async (targetChapterId: string) => {
      if (!targetChapterId || isLoading) return;

      // Check cache first for instant load
      if (chapterCacheRef.current.has(targetChapterId)) {
        const cached = chapterCacheRef.current.get(targetChapterId)!;
        setChapter(cached);
        window.scrollTo({ top: 0, behavior: 'instant' });
        window.history.replaceState(null, '', `/read/${cached.bookId}/${cached.id}?source=${sourceId}`);
        return;
      }

      setIsLoading(true);
      try {
        const res = await fetch(
          `/api/chapter?bookId=${chapter.bookId}&chapterId=${targetChapterId}&source=${sourceId}`
        );
        const data = await res.json();
        if (data.success && data.data) {
          chapterCacheRef.current.set(targetChapterId, data.data);
          setChapter(data.data);
          window.scrollTo({ top: 0, behavior: 'instant' });
          window.history.replaceState(null, '', `/read/${data.data.bookId}/${data.data.id}?source=${sourceId}`);
        } else {
          alert(`加载章节失败: ${data.error || '未知错误'}`);
        }
      } catch (err: any) {
        alert(`加载章节出错: ${err.message}`);
      } finally {
        setIsLoading(false);
      }
    },
    [chapter.bookId, sourceId, isLoading]
  );

  // TTS next chapter auto trigger
  const handleTtsNextChapter = useCallback(() => {
    if (chapter.nextChapterId) {
      navigateToChapter(chapter.nextChapterId);
    }
  }, [chapter.nextChapterId, navigateToChapter]);

  // Fullscreen toggle
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === 'ArrowLeft' && chapter.prevChapterId) {
        navigateToChapter(chapter.prevChapterId);
      } else if (e.key === 'ArrowRight' && chapter.nextChapterId) {
        navigateToChapter(chapter.nextChapterId);
      } else if (e.key === 'PageDown' || (e.key === ' ' && !e.shiftKey)) {
        e.preventDefault();
        window.scrollBy({ top: Math.round(window.innerHeight * 0.85), behavior: 'smooth' });
      } else if (e.key === 'PageUp' || (e.key === ' ' && e.shiftKey)) {
        e.preventDefault();
        window.scrollBy({ top: -Math.round(window.innerHeight * 0.85), behavior: 'smooth' });
      } else if (e.key === 'f' || e.key === 'F') {
        toggleFullscreen();
      } else if (e.key === 'Escape') {
        setShowSettingsModal(false);
        setShowDrawer(false);
        setShowBookmarkModal(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [chapter, navigateToChapter]);

  // Scroll listener for reading progress
  useEffect(() => {
    const handleScroll = () => {
      const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (totalHeight > 0) {
        const currentProgress = Math.min(100, Math.round((window.scrollY / totalHeight) * 100));
        setReadingProgress(currentProgress);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Theme styling class
  const themeClass = `theme-${settings.theme}`;

  // Font family inline style
  const getFontFamilyStyle = () => {
    switch (settings.fontFamily) {
      case 'kaiti':
        return '"Kaiti SC", STKaiti, "KaiTi", serif';
      case 'sans':
        return 'system-ui, -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif';
      default:
        return '"Noto Serif SC", "Source Han Serif SC", SimSun, serif';
    }
  };

  // Click-to-turn-page handler: top half = page up, bottom half = page down, center = toggle menu
  const handleContentClick = (e: React.MouseEvent<HTMLElement>) => {
    // 1. If text is being selected, do not trigger page turning
    const selection = window.getSelection();
    if (selection && selection.toString().trim().length > 0) return;

    // 2. If controls are open, close them
    if (showControls) {
      setShowControls(false);
      return;
    }

    const vh = window.innerHeight;
    const vw = window.innerWidth;
    const clientY = e.clientY;
    const clientX = e.clientX;
    const yRatio = clientY / vh;
    const xRatio = clientX / vw;

    // 3. Center tap zone (middle 24% vertically, center 50% horizontally): toggle controls menu
    if (yRatio >= 0.38 && yRatio <= 0.62 && xRatio >= 0.25 && xRatio <= 0.75) {
      setShowControls(true);
      return;
    }

    // 4. Page distance: 85% of screen height (comfortable overlap)
    const pageDistance = Math.round(vh * 0.85);

    if (yRatio < 0.5) {
      // 上半部分：上一页
      if (window.scrollY <= 15) {
        if (chapter.prevChapterId) {
          navigateToChapter(chapter.prevChapterId);
        }
      } else {
        window.scrollBy({ top: -pageDistance, behavior: 'smooth' });
      }
    } else {
      // 下半部分：下一页
      const scrollBottom = window.scrollY + vh;
      const docHeight = document.documentElement.scrollHeight;
      if (scrollBottom >= docHeight - 30) {
        if (chapter.nextChapterId) {
          navigateToChapter(chapter.nextChapterId);
        }
      } else {
        window.scrollBy({ top: pageDistance, behavior: 'smooth' });
      }
    }
  };

  return (
    <div className={`min-h-screen transition-colors duration-300 ${themeClass}`}>
      {/* Top Floating Navigation Bar */}
      <header
        className={`fixed top-0 inset-x-0 z-40 backdrop-blur-md border-b reader-border transition-all duration-300 ${
          showControls ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0 pointer-events-none'
        } ${themeClass}`}
      >
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link
            href={`/book/${chapter.bookId}?source=${sourceId}`}
            className="flex items-center gap-1.5 text-sm font-medium hover:opacity-75 transition-opacity"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="line-clamp-1 max-w-[180px] sm:max-w-xs">{bookTitle}</span>
          </Link>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              onClick={() => setShowBookmarkModal(true)}
              className="p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
              title="书签管理"
            >
              <Bookmark className="w-5 h-5" />
            </button>
            <button
              onClick={() => setShowTts(!showTts)}
              className={`p-2 rounded-lg transition-colors ${
                showTts
                  ? 'bg-black text-white hover:bg-zinc-800 shadow-sm'
                  : 'hover:bg-black/5 dark:hover:bg-white/10'
              }`}
              title={showTts ? '关闭听书' : '语音朗读听书'}
            >
              <Headphones className="w-5 h-5" />
            </button>
            <button
              onClick={() => setShowDrawer(true)}
              className="p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
              title="目录"
            >
              <List className="w-5 h-5" />
            </button>
            <button
              onClick={() => setShowSettingsModal(true)}
              className="p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
              title="排版与主题设置"
            >
              <SlidersHorizontal className="w-5 h-5" />
            </button>
            <button
              onClick={toggleFullscreen}
              className="p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors hidden sm:inline-flex"
              title={isFullscreen ? '退出全屏' : '全屏阅读'}
            >
              {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* Main Reading Area */}
      <main
        ref={containerRef}
        onClick={handleContentClick}
        className="mx-auto px-5 sm:px-8 pt-20 pb-32 cursor-pointer select-text"
        style={{
          maxWidth: `${settings.maxWidth}px`,
          fontSize: `${settings.fontSize}px`,
          lineHeight: settings.lineHeight,
          fontFamily: getFontFamilyStyle(),
        }}
      >
        {/* Chapter Title */}
        <h1 className="text-2xl sm:text-3xl font-bold font-serif mb-10 tracking-tight text-center pt-4">
          {chapter.title}
        </h1>

        {/* Loading overlay indicator */}
        {isLoading && (
          <div className="py-20 text-center flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 border-2 border-black border-t-transparent rounded-full animate-spin" />
            <p className="text-sm opacity-60">加载章节正文中...</p>
          </div>
        )}

        {/* Clean Paragraphs */}
        <article className="reader-content select-text">
          {chapter.paragraphs.map((para, idx) => (
            <p
              key={idx}
              ref={(el) => {
                paragraphRefs.current[idx] = el;
              }}
              onClick={(e) => {
                if (showTts) {
                  e.stopPropagation();
                  setTtsParagraphIndex(idx);
                }
              }}
              dangerouslySetInnerHTML={{ __html: para }}
              className={`transition-all duration-300 ${
                showTts && ttsParagraphIndex === idx
                  ? 'bg-zinc-200/80 dark:bg-zinc-800/80 border-l-4 border-black dark:border-white pl-3.5 py-0.5 rounded-r shadow-sm font-medium'
                  : ''
              } ${showTts ? 'cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 rounded' : ''}`}
            />
          ))}
        </article>

        {/* Chapter End Mark */}
        <div className="mt-16 py-12 text-center text-xs opacity-35 font-mono tracking-widest select-none">
          —— 本章完 ——
        </div>
      </main>

      {/* Bottom Floating Bar */}
      <footer
        className={`fixed bottom-0 inset-x-0 z-40 backdrop-blur-md border-t reader-border transition-all duration-300 shadow-sm ${
          showControls ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 pointer-events-none'
        } ${themeClass}`}
      >
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-12 flex items-center justify-between text-xs">
          {/* 上一章（纯文字） */}
          <button
            disabled={!chapter.prevChapterId}
            onClick={(e) => {
              e.stopPropagation();
              if (chapter.prevChapterId) navigateToChapter(chapter.prevChapterId);
            }}
            className={`py-2 px-2 font-medium transition-opacity ${
              chapter.prevChapterId
                ? 'hover:opacity-70 active:opacity-50 cursor-pointer'
                : 'opacity-25 cursor-not-allowed'
            }`}
            title={chapter.prevChapterId ? '上一章' : '已是第一章'}
          >
            上一章
          </button>

          {/* 章节名 + 进度数字（点击打开目录列表） */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowDrawer(true);
            }}
            className="flex-1 min-w-0 text-center px-4 py-1 hover:opacity-75 transition-opacity"
            title="点击打开目录列表"
          >
            <span className="font-serif truncate inline-block max-w-[200px] sm:max-w-md align-middle text-xs sm:text-sm font-medium">
              {chapter.title}
            </span>
            <span className="opacity-50 ml-2 text-[11px] font-mono align-middle">
              {readingProgress}%
            </span>
          </button>

          {/* 下一章（纯文字） */}
          <button
            disabled={!chapter.nextChapterId}
            onClick={(e) => {
              e.stopPropagation();
              if (chapter.nextChapterId) navigateToChapter(chapter.nextChapterId);
            }}
            className={`py-2 px-2 font-medium transition-opacity ${
              chapter.nextChapterId
                ? 'hover:opacity-70 active:opacity-50 cursor-pointer'
                : 'opacity-25 cursor-not-allowed'
            }`}
            title={chapter.nextChapterId ? '下一章' : '已是最新章'}
          >
            下一章
          </button>
        </div>
      </footer>

      {/* Chapter Drawer */}
      <ChapterDrawer
        isOpen={showDrawer}
        onClose={() => setShowDrawer(false)}
        chapters={chapters}
        bookId={chapter.bookId}
        sourceId={sourceId}
        currentChapterId={chapter.id}
        onSelectChapter={(targetId) => {
          setShowDrawer(false);
          navigateToChapter(targetId);
        }}
      />

      {/* Settings Modal */}
      <ReaderSettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
      />

      {/* Bookmark Modal */}
      <BookmarkModal
        isOpen={showBookmarkModal}
        onClose={() => setShowBookmarkModal(false)}
        bookId={chapter.bookId}
        sourceId={sourceId}
        currentChapterId={chapter.id}
        currentChapterTitle={chapter.title}
        currentExcerpt={currentExcerpt}
        onSelectBookmark={(targetChapterId) => navigateToChapter(targetChapterId)}
      />

      {/* TTS Audio Player */}
      {showTts && (
        <TtsPlayer
          paragraphs={chapter.paragraphs}
          chapterTitle={chapter.title}
          chapterId={chapter.id}
          nextChapterId={chapter.nextChapterId}
          onNextChapter={handleTtsNextChapter}
          onClose={() => setShowTts(false)}
          currentParagraphIndex={ttsParagraphIndex}
          onParagraphChange={setTtsParagraphIndex}
        />
      )}
    </div>
  );
};
