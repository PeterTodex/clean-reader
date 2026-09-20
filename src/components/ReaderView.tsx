'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChapterContent, ChapterItem } from '@/sources/types';
import { ReaderSettings, storage } from '@/lib/storage';
import { THEME_CHANGE_EVENT, ThemeType } from '@/lib/theme';
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
  initialCachedChapterIds?: string[];
}

export const ReaderView: React.FC<ReaderViewProps> = ({
  initialChapter,
  chapters,
  bookTitle,
  bookCover = '',
  bookAuthor = '',
  sourceId,
  initialCachedChapterIds,
}) => {
  const router = useRouter();
  const [chaptersList, setChaptersList] = useState<ChapterContent[]>([initialChapter]);
  const [activeChapterIndex, setActiveChapterIndex] = useState(0);
  const [isLoadingNext, setIsLoadingNext] = useState(false);
  const [settings, setSettings] = useState<ReaderSettings>(storage.getSettings());
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showDrawer, setShowDrawer] = useState(false);
  const [showBookmarkModal, setShowBookmarkModal] = useState(false);
  const [showTts, setShowTts] = useState(false);
  const [ttsParagraphIndex, setTtsParagraphIndex] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [switchingChapter, setSwitchingChapter] = useState<{ id: string; title: string } | null>(null);
  const [readingProgress, setReadingProgress] = useState(0);
  const [cachedChapterIds, setCachedChapterIds] = useState<Set<string>>(() => {
    const set = new Set<string>(initialCachedChapterIds || []);
    if (initialChapter?.id) set.add(initialChapter.id);
    return set;
  });

  useEffect(() => {
    if (initialCachedChapterIds && initialCachedChapterIds.length > 0) {
      setCachedChapterIds((prev) => {
        const next = new Set(prev);
        initialCachedChapterIds.forEach((id) => next.add(id));
        return next;
      });
    }
  }, [initialCachedChapterIds]);

  // Sync settings when theme changes externally
  useEffect(() => {
    const handleThemeChange = (e: Event) => {
      const customEvent = e as CustomEvent<ThemeType>;
      if (customEvent.detail) {
        setSettings((prev) => ({ ...prev, theme: customEvent.detail }));
      }
    };
    window.addEventListener(THEME_CHANGE_EVENT, handleThemeChange);
    return () => window.removeEventListener(THEME_CHANGE_EVENT, handleThemeChange);
  }, []);

  // In-memory cache for chapters to make transitions instant
  const chapterCacheRef = useRef<Map<string, ChapterContent>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);
  const paragraphRefs = useRef<(HTMLParagraphElement | null)[]>([]);

  // Derived current active and last loaded chapters
  const chapter = chaptersList[activeChapterIndex] || chaptersList[0] || initialChapter;
  const lastChapter = chaptersList[chaptersList.length - 1] || chapter;
  const prevChapterId =
    activeChapterIndex > 0
      ? chaptersList[activeChapterIndex - 1].id
      : chaptersList[0]?.prevChapterId || null;
  const nextChapterId = chapter.nextChapterId;

  // Relative chapter navigation IDs when switching to un-cached chapter
  const switchingChapterIndex = switchingChapter
    ? chapters.findIndex((c) => String(c.id) === String(switchingChapter.id))
    : -1;
  const currentPrevChapterId = switchingChapter
    ? (switchingChapterIndex > 0 ? chapters[switchingChapterIndex - 1]?.id : null)
    : prevChapterId;
  const currentNextChapterId = switchingChapter
    ? (switchingChapterIndex !== -1 && switchingChapterIndex < chapters.length - 1
        ? chapters[switchingChapterIndex + 1]?.id
        : null)
    : nextChapterId;

  // Reset TTS paragraph index when active chapter changes
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

  // Put initial chapter into cache and sync when initialChapter prop changes
  useEffect(() => {
    setChaptersList([initialChapter]);
    setActiveChapterIndex(0);
    chapterCacheRef.current.set(initialChapter.id, initialChapter);
    setCachedChapterIds((prev) => new Set(prev).add(initialChapter.id));
  }, [initialChapter.id]);

  // Sync settings
  const handleUpdateSettings = (newSettings: Partial<ReaderSettings>) => {
    const updated = storage.saveSettings(newSettings);
    setSettings(updated);
  };

  // Save reading progress to history (does not auto-add to bookshelf)
  useEffect(() => {
    if (chapter) {
      storage.saveToHistory({
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
          setCachedChapterIds((prev) => new Set(prev).add(nextId));
        }
      } catch (e) {
        // Silently fail prefetch
      }
    },
    [chapter.bookId, sourceId]
  );

  useEffect(() => {
    if (settings.autoPreloadNext && lastChapter?.nextChapterId) {
      prefetchChapter(lastChapter.nextChapterId);
    }
  }, [lastChapter?.nextChapterId, settings.autoPreloadNext, prefetchChapter]);

  // Seamless continuous reading: auto load and append next chapter
  const loadNextChapter = useCallback(async () => {
    if (isLoadingNext) return;
    const currentLast = chaptersList[chaptersList.length - 1];
    if (!currentLast || !currentLast.nextChapterId) return;

    const nextId = currentLast.nextChapterId;
    if (chaptersList.some((c) => c.id === nextId)) return;

    setIsLoadingNext(true);
    try {
      if (chapterCacheRef.current.has(nextId)) {
        const cached = chapterCacheRef.current.get(nextId)!;
        setChaptersList((prev) => [...prev, cached]);
        return;
      }

      const res = await fetch(
        `/api/chapter?bookId=${currentLast.bookId}&chapterId=${nextId}&source=${sourceId}`
      );
      const data = await res.json();
      if (data.success && data.data) {
        chapterCacheRef.current.set(nextId, data.data);
        setCachedChapterIds((prev) => new Set(prev).add(nextId));
        setChaptersList((prev) => [...prev, data.data]);
      }
    } catch {
      // Silently ignore
    } finally {
      setIsLoadingNext(false);
    }
  }, [chaptersList, isLoadingNext, sourceId]);

  // Load / jump to a chapter by id
  const navigateToChapter = useCallback(
    async (targetChapterId: string) => {
      if (!targetChapterId || isLoading) return;

      // 1. If the chapter is already rendered in continuous chaptersList, smoothly scroll to it
      const existingIdx = chaptersList.findIndex((c) => c.id === targetChapterId);
      if (existingIdx !== -1) {
        const el = document.getElementById(`chapter-section-${targetChapterId}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth' });
          setActiveChapterIndex(existingIdx);
          window.history.replaceState(
            null,
            '',
            `/read/${chaptersList[existingIdx].bookId}/${targetChapterId}?source=${sourceId}`
          );
          return;
        }
      }

      // 2. Check cache first for instant load
      if (chapterCacheRef.current.has(targetChapterId)) {
        const cached = chapterCacheRef.current.get(targetChapterId)!;
        setSwitchingChapter(null);
        setChaptersList([cached]);
        setActiveChapterIndex(0);
        window.scrollTo({ top: 0, behavior: 'instant' });
        window.history.replaceState(null, '', `/read/${cached.bookId}/${cached.id}?source=${sourceId}`);
        return;
      }

      // 3. Optimistic UI: Immediately jump to top and render target chapter title with skeleton
      const targetItem = chapters.find((c) => String(c.id) === String(targetChapterId));
      const targetTitle = targetItem?.title || '正在加载章节...';

      setSwitchingChapter({ id: targetChapterId, title: targetTitle });
      setReadingProgress(0);
      window.scrollTo({ top: 0, behavior: 'instant' });
      window.history.replaceState(null, '', `/read/${chapter.bookId}/${targetChapterId}?source=${sourceId}`);

      setIsLoading(true);
      try {
        const res = await fetch(
          `/api/chapter?bookId=${chapter.bookId}&chapterId=${targetChapterId}&source=${sourceId}`
        );
        const data = await res.json();
        if (data.success && data.data) {
          chapterCacheRef.current.set(targetChapterId, data.data);
          setCachedChapterIds((prev) => new Set(prev).add(targetChapterId));
          setChaptersList([data.data]);
          setActiveChapterIndex(0);
          setSwitchingChapter(null);
          window.scrollTo({ top: 0, behavior: 'instant' });
          window.history.replaceState(null, '', `/read/${data.data.bookId}/${data.data.id}?source=${sourceId}`);
        } else {
          setSwitchingChapter(null);
          alert(`加载章节失败: ${data.error || '未知错误'}`);
        }
      } catch (err: any) {
        setSwitchingChapter(null);
        alert(`加载章节出错: ${err.message}`);
      } finally {
        setIsLoading(false);
      }
    },
    [chaptersList, chapter.bookId, chapters, sourceId, isLoading]
  );

  // TTS next chapter auto trigger
  const handleTtsNextChapter = useCallback(() => {
    if (chapter.nextChapterId) {
      navigateToChapter(chapter.nextChapterId);
    }
  }, [chapter.nextChapterId, navigateToChapter]);

  // Fullscreen toggle (keyboard 'f')
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === 'ArrowLeft' && currentPrevChapterId) {
        navigateToChapter(currentPrevChapterId);
      } else if (e.key === 'ArrowRight' && currentNextChapterId) {
        navigateToChapter(currentNextChapterId);
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
  }, [currentPrevChapterId, currentNextChapterId, navigateToChapter]);

  // Scroll listener for reading progress, active chapter tracking, and seamless infinite scrolling
  useEffect(() => {
    const handleScroll = () => {
      if (switchingChapter) return;
      const scrollY = window.scrollY;
      const vh = window.innerHeight;
      const scrollHeight = document.documentElement.scrollHeight;

      // 1. Calculate reading progress
      const totalHeight = scrollHeight - vh;
      if (totalHeight > 0) {
        const currentProgress = Math.min(100, Math.round((scrollY / totalHeight) * 100));
        setReadingProgress(currentProgress);
      }

      // 2. Active chapter tracking based on scroll position
      for (let i = chaptersList.length - 1; i >= 0; i--) {
        const el = document.getElementById(`chapter-section-${chaptersList[i].id}`);
        if (el && el.offsetTop <= scrollY + 250) {
          if (activeChapterIndex !== i) {
            setActiveChapterIndex(i);
            const activeCh = chaptersList[i];
            window.history.replaceState(
              null,
              '',
              `/read/${activeCh.bookId}/${activeCh.id}?source=${sourceId}`
            );
          }
          break;
        }
      }

      // 3. Infinite scroll trigger when within 1400px of bottom
      if (scrollHeight - (scrollY + vh) < 1400) {
        loadNextChapter();
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [chaptersList, activeChapterIndex, loadNextChapter, sourceId, switchingChapter]);

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

    // 3. If currently in switching skeleton state, toggle controls
    if (switchingChapter) {
      setShowControls(true);
      return;
    }

    const vh = window.innerHeight;
    const vw = window.innerWidth;
    const clientY = e.clientY;
    const clientX = e.clientX;
    const yRatio = clientY / vh;
    const xRatio = clientX / vw;

    // 4. Center tap zone (middle 24% vertically, center 50% horizontally): toggle controls menu
    if (yRatio >= 0.38 && yRatio <= 0.62 && xRatio >= 0.25 && xRatio <= 0.75) {
      setShowControls(true);
      return;
    }

    // 5. Page distance: 85% of screen height (comfortable overlap)
    const pageDistance = Math.round(vh * 0.85);

    if (yRatio < 0.5) {
      // 上半部分：上一页
      if (window.scrollY <= 15) {
        if (currentPrevChapterId) {
          navigateToChapter(currentPrevChapterId);
        }
      } else {
        window.scrollBy({ top: -pageDistance, behavior: 'smooth' });
      }
    } else {
      // 下半部分：下一页
      const scrollBottom = window.scrollY + vh;
      const docHeight = document.documentElement.scrollHeight;
      if (scrollBottom >= docHeight - 30) {
        if (currentNextChapterId) {
          navigateToChapter(currentNextChapterId);
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
        <div className="max-w-4xl mx-auto px-4 h-[52px] flex items-center justify-between">
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
          </div>
        </div>
      </header>

      {/* Main Reading Area */}
      <main
        ref={containerRef}
        onClick={handleContentClick}
        className="w-full px-5 sm:px-8 pt-20 pb-32 cursor-pointer select-text"
        style={{
          fontSize: `${settings.fontSize}px`,
          lineHeight: settings.lineHeight,
          fontFamily: getFontFamilyStyle(),
        }}
      >
        {/* If switching chapters to un-cached chapter, show optimistic target title + minimalist skeleton */}
        {switchingChapter ? (
          <section className="animate-fade-in select-none">
            <h1 className="text-2xl sm:text-3xl font-bold font-serif mb-10 tracking-tight text-center pt-4">
              {switchingChapter.title}
            </h1>

            {/* Minimalist Skeleton Paragraphs */}
            <div className="space-y-7 pt-2">
              <div className="space-y-3">
                <div className="h-4 bg-current opacity-[0.08] rounded w-[30%] ml-[2em] animate-pulse" />
                <div className="h-4 bg-current opacity-[0.08] rounded w-full animate-pulse" />
                <div className="h-4 bg-current opacity-[0.08] rounded w-[92%] animate-pulse" />
                <div className="h-4 bg-current opacity-[0.08] rounded w-[65%] animate-pulse" />
              </div>

              <div className="space-y-3">
                <div className="h-4 bg-current opacity-[0.08] rounded w-[40%] ml-[2em] animate-pulse" />
                <div className="h-4 bg-current opacity-[0.08] rounded w-full animate-pulse" />
                <div className="h-4 bg-current opacity-[0.08] rounded w-[88%] animate-pulse" />
                <div className="h-4 bg-current opacity-[0.08] rounded w-[55%] animate-pulse" />
              </div>

              <div className="space-y-3">
                <div className="h-4 bg-current opacity-[0.08] rounded w-[25%] ml-[2em] animate-pulse" />
                <div className="h-4 bg-current opacity-[0.08] rounded w-full animate-pulse" />
                <div className="h-4 bg-current opacity-[0.08] rounded w-[95%] animate-pulse" />
                <div className="h-4 bg-current opacity-[0.08] rounded w-[70%] animate-pulse" />
              </div>

              <div className="space-y-3">
                <div className="h-4 bg-current opacity-[0.08] rounded w-[35%] ml-[2em] animate-pulse" />
                <div className="h-4 bg-current opacity-[0.08] rounded w-[85%] animate-pulse" />
                <div className="h-4 bg-current opacity-[0.08] rounded w-[45%] animate-pulse" />
              </div>
            </div>

          </section>
        ) : (
          /* Continuous Chapter List */
          chaptersList.map((ch, chIdx) => (
            <section key={ch.id} id={`chapter-section-${ch.id}`} className={chIdx === 0 ? 'animate-fade-in' : ''}>
              {chIdx > 0 ? (
                /* Divider between continuous chapters */
                <div className="my-8 pt-6 pb-2 border-t reader-border text-center select-none">
                  <h2 className="text-2xl sm:text-3xl font-bold font-serif tracking-tight text-center">
                    {ch.title}
                  </h2>
                </div>
              ) : (
                /* First Chapter Title */
                <h1 className="text-2xl sm:text-3xl font-bold font-serif mb-10 tracking-tight text-center pt-4">
                  {ch.title}
                </h1>
              )}

              {/* Paragraphs */}
              <article className="reader-content select-text">
                {ch.paragraphs.map((para, pIdx) => {
                  const isTtsActive =
                    showTts && activeChapterIndex === chIdx && ttsParagraphIndex === pIdx;
                  return (
                    <p
                      key={pIdx}
                      ref={(el) => {
                        if (activeChapterIndex === chIdx) {
                          paragraphRefs.current[pIdx] = el;
                        }
                      }}
                      onClick={(e) => {
                        if (showTts) {
                          e.stopPropagation();
                          setActiveChapterIndex(chIdx);
                          setTtsParagraphIndex(pIdx);
                        }
                      }}
                      dangerouslySetInnerHTML={{ __html: para }}
                      className={`transition-all duration-300 ${
                        isTtsActive
                          ? 'bg-zinc-200/80 dark:bg-zinc-800/80 border-l-4 border-black dark:border-white pl-3.5 py-0.5 rounded-r shadow-sm font-medium'
                          : ''
                      } ${showTts ? 'cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 rounded' : ''}`}
                    />
                  );
                })}
              </article>
            </section>
          ))
        )}

        {/* Seamless infinite loading indicator */}
        {isLoadingNext && (
          <div className="py-12 text-center flex flex-col items-center justify-center gap-2 select-none">
            <div className="w-6 h-6 border-2 border-black border-t-transparent rounded-full animate-spin opacity-60" />
            <p className="text-xs opacity-50 font-mono">正在无缝加载下一章...</p>
          </div>
        )}

        {/* End of book / latest chapter indicator */}
        {!lastChapter?.nextChapterId && (
          <div className="mt-16 py-12 text-center text-xs opacity-35 font-mono tracking-widest select-none">
            —— 全书完 / 已是最新章节 ——
          </div>
        )}
      </main>

      {/* Bottom Floating Bar */}
      <footer
        className={`fixed bottom-0 inset-x-0 z-40 backdrop-blur-md border-t reader-border transition-all duration-300 shadow-sm ${
          showControls ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 pointer-events-none'
        } ${themeClass}`}
      >
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-[52px] flex items-center justify-between text-xs">
          {/* 上一章（纯文字） */}
          <button
            disabled={!currentPrevChapterId || isLoading}
            onClick={(e) => {
              e.stopPropagation();
              if (currentPrevChapterId) navigateToChapter(currentPrevChapterId);
            }}
            className={`py-2 px-2 font-medium transition-opacity ${
              currentPrevChapterId && !isLoading
                ? 'hover:opacity-70 active:opacity-50 cursor-pointer'
                : 'opacity-25 cursor-not-allowed'
            }`}
            title={currentPrevChapterId ? '上一章' : '已是第一章'}
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
              {switchingChapter ? switchingChapter.title : chapter.title}
            </span>
            <span className="opacity-50 ml-2 text-[11px] font-mono align-middle">
              {switchingChapter ? 0 : readingProgress}%
            </span>
          </button>

          {/* 下一章（纯文字） */}
          <button
            disabled={!currentNextChapterId || isLoading}
            onClick={(e) => {
              e.stopPropagation();
              if (currentNextChapterId) navigateToChapter(currentNextChapterId);
            }}
            className={`py-2 px-2 font-medium transition-opacity ${
              currentNextChapterId && !isLoading
                ? 'hover:opacity-70 active:opacity-50 cursor-pointer'
                : 'opacity-25 cursor-not-allowed'
            }`}
            title={currentNextChapterId ? '下一章' : '已是最新章'}
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
        currentChapterId={switchingChapter ? switchingChapter.id : chapter.id}
        cachedChapterIds={cachedChapterIds}
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
