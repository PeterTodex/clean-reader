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
  availableMirrors?: string[];
}

export const ReaderView: React.FC<ReaderViewProps> = ({
  initialChapter,
  chapters,
  bookTitle,
  bookCover = '',
  bookAuthor = '',
  sourceId,
  availableMirrors = [],
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
        const mirrorParam = settings.selectedMirror ? `&mirror=${encodeURIComponent(settings.selectedMirror)}` : '';
        const res = await fetch(
          `/api/chapter?bookId=${chapter.bookId}&chapterId=${nextId}&source=${sourceId}${mirrorParam}`
        );
        const data = await res.json();
        if (data.success && data.data) {
          chapterCacheRef.current.set(nextId, data.data);
        }
      } catch (e) {
        // Silently fail prefetch
      }
    },
    [chapter.bookId, sourceId, settings.selectedMirror]
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
        router.push(`/read/${cached.bookId}/${cached.id}?source=${sourceId}`, { scroll: false });
        return;
      }

      setIsLoading(true);
      try {
        const mirrorParam = settings.selectedMirror ? `&mirror=${encodeURIComponent(settings.selectedMirror)}` : '';
        const res = await fetch(
          `/api/chapter?bookId=${chapter.bookId}&chapterId=${targetChapterId}&source=${sourceId}${mirrorParam}`
        );
        const data = await res.json();
        if (data.success && data.data) {
          chapterCacheRef.current.set(targetChapterId, data.data);
          setChapter(data.data);
          window.scrollTo({ top: 0, behavior: 'instant' });
          router.push(`/read/${data.data.bookId}/${data.data.id}?source=${sourceId}`, { scroll: false });
        } else {
          alert(`加载章节失败: ${data.error || '未知错误'}`);
        }
      } catch (err: any) {
        alert(`加载章节出错: ${err.message}`);
      } finally {
        setIsLoading(false);
      }
    },
    [chapter.bookId, sourceId, settings.selectedMirror, isLoading, router]
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
                  ? 'bg-amber-800 text-white hover:bg-amber-900 shadow-sm'
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
        onClick={() => setShowControls(!showControls)}
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
            <div className="w-8 h-8 border-3 border-amber-800 border-t-transparent rounded-full animate-spin" />
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
                  ? 'bg-amber-500/15 border-l-4 border-amber-600 pl-3.5 py-0.5 rounded-r shadow-sm'
                  : ''
              } ${showTts ? 'cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 rounded' : ''}`}
            />
          ))}
        </article>

        {/* Chapter Navigation Buttons */}
        <div
          onClick={(e) => e.stopPropagation()}
          className="mt-16 pt-8 border-t reader-border flex items-center justify-between gap-4 cursor-default"
        >
          {chapter.prevChapterId ? (
            <button
              onClick={() => navigateToChapter(chapter.prevChapterId!)}
              className="flex-1 py-3 px-4 rounded-xl border reader-border hover:opacity-80 transition-opacity flex items-center justify-center gap-1.5 text-sm font-medium"
            >
              <ChevronLeft className="w-4 h-4" />
              上一章
            </button>
          ) : (
            <div className="flex-1 py-3 px-4 rounded-xl border reader-border opacity-30 text-center text-sm">
              已是第一章
            </div>
          )}

          <button
            onClick={() => setShowDrawer(true)}
            className="px-4 py-3 rounded-xl border reader-border hover:opacity-80 transition-opacity text-sm font-medium"
          >
            目录
          </button>

          {chapter.nextChapterId ? (
            <button
              onClick={() => navigateToChapter(chapter.nextChapterId!)}
              className="flex-1 py-3 px-4 rounded-xl bg-amber-800 text-white hover:bg-amber-900 transition-colors flex items-center justify-center gap-1.5 text-sm font-medium shadow-sm"
            >
              下一章
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <div className="flex-1 py-3 px-4 rounded-xl border reader-border opacity-30 text-center text-sm">
              已是最新章
            </div>
          )}
        </div>
      </main>

      {/* Bottom Progress Floating Bar */}
      <footer
        className={`fixed bottom-0 inset-x-0 z-40 backdrop-blur-md border-t reader-border transition-all duration-300 ${
          showControls ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 pointer-events-none'
        } ${themeClass}`}
      >
        <div className="max-w-4xl mx-auto px-4 h-12 flex items-center justify-between text-xs">
          <div className="truncate max-w-[160px] sm:max-w-[220px] opacity-75">{chapter.title}</div>
          <div className="flex items-center gap-3">
            <span className="opacity-75">进度: {readingProgress}%</span>
            <div className="flex items-center gap-1 border-l reader-border pl-2 sm:pl-3">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowTts(!showTts);
                }}
                className={`px-2 py-1 rounded flex items-center gap-1 transition-colors text-xs font-medium ${
                  showTts
                    ? 'bg-amber-800 text-white'
                    : 'hover:bg-black/5 dark:hover:bg-white/10 text-amber-900 dark:text-amber-200'
                }`}
                title={showTts ? '关闭听书' : '开启听书'}
              >
                <Headphones className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">听书</span>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowBookmarkModal(true);
                }}
                className="px-2 py-1 rounded hover:bg-black/5 dark:hover:bg-white/10 flex items-center gap-1 transition-colors text-xs font-medium text-stone-700 dark:text-stone-300"
                title="添加/查看书签"
              >
                <Bookmark className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">书签</span>
              </button>
            </div>
            <span className="hidden md:inline opacity-50">快捷键: ←/→ 翻页</span>
          </div>
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
      />

      {/* Settings Modal */}
      <ReaderSettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
        availableMirrors={availableMirrors}
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
