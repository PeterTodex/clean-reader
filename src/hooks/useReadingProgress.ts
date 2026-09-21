'use client';

import { useState, useEffect, useRef } from 'react';
import { ChapterContent } from '@/sources/types';

export interface UseReadingProgressOptions {
  chaptersList: ChapterContent[];
  switchingChapter?: { id: string; title: string } | null;
  loadNextChapter: () => void | Promise<void>;
  sourceId: string;
  initialActiveChapterIndex?: number;
}

export interface UseReadingProgressReturn {
  readingProgress: number;
  activeChapterIndex: number;
  setActiveChapterIndex: React.Dispatch<React.SetStateAction<number>>;
  setReadingProgress: React.Dispatch<React.SetStateAction<number>>;
}

export function useReadingProgress(options: UseReadingProgressOptions): UseReadingProgressReturn;
export function useReadingProgress(
  chaptersList: ChapterContent[],
  switchingChapter: { id: string; title: string } | null,
  loadNextChapter: () => void | Promise<void>,
  sourceId: string,
  initialActiveChapterIndex?: number
): UseReadingProgressReturn;
export function useReadingProgress(
  arg1: UseReadingProgressOptions | ChapterContent[],
  arg2?: { id: string; title: string } | null,
  arg3?: () => void | Promise<void>,
  arg4?: string,
  arg5?: number
): UseReadingProgressReturn {
  let chaptersList: ChapterContent[];
  let switchingChapter: { id: string; title: string } | null = null;
  let loadNextChapter: () => void | Promise<void>;
  let sourceId: string;
  let initialActiveChapterIndex = 0;

  if (Array.isArray(arg1)) {
    chaptersList = arg1;
    switchingChapter = arg2 ?? null;
    loadNextChapter = arg3!;
    sourceId = arg4!;
    if (typeof arg5 === 'number') initialActiveChapterIndex = arg5;
  } else {
    chaptersList = arg1.chaptersList;
    switchingChapter = arg1.switchingChapter ?? null;
    loadNextChapter = arg1.loadNextChapter;
    sourceId = arg1.sourceId;
    if (typeof arg1.initialActiveChapterIndex === 'number') {
      initialActiveChapterIndex = arg1.initialActiveChapterIndex;
    }
  }

  const [activeChapterIndex, setActiveChapterIndex] = useState(initialActiveChapterIndex);
  const [readingProgress, setReadingProgress] = useState(0);

  const activeChapter = chaptersList[activeChapterIndex] || chaptersList[0];
  const activeChapterId = activeChapter?.id;

  const chaptersListRef = useRef(chaptersList);
  chaptersListRef.current = chaptersList;
  const activeChapterIndexRef = useRef(activeChapterIndex);
  activeChapterIndexRef.current = activeChapterIndex;
  const activeChapterIdRef = useRef(activeChapterId);
  activeChapterIdRef.current = activeChapterId;
  const switchingChapterRef = useRef(switchingChapter);
  switchingChapterRef.current = switchingChapter;
  const loadNextChapterRef = useRef(loadNextChapter);
  loadNextChapterRef.current = loadNextChapter;
  const sourceIdRef = useRef(sourceId);
  sourceIdRef.current = sourceId;

  // Reset reading progress when switching chapter starts
  useEffect(() => {
    if (switchingChapter) {
      setReadingProgress(0);
    }
  }, [switchingChapter]);

  // Clamp activeChapterIndex when chaptersList length shrinks
  useEffect(() => {
    if (activeChapterIndex >= chaptersList.length && chaptersList.length > 0) {
      setActiveChapterIndex(0);
    }
  }, [chaptersList.length, activeChapterIndex]);

  // Scroll listener for reading progress, active chapter tracking, and seamless infinite scrolling
  useEffect(() => {
    const handleScroll = () => {
      if (switchingChapterRef.current) return;
      const scrollY =
        window.scrollY ||
        window.pageYOffset ||
        document.documentElement.scrollTop ||
        document.body.scrollTop ||
        0;
      const vh = window.innerHeight;
      const scrollHeight = Math.max(
        document.documentElement.scrollHeight,
        document.body.scrollHeight,
        1
      );

      // 1. Calculate reading progress for active chapter
      const currentChapterId = activeChapterIdRef.current;
      const activeEl = currentChapterId
        ? document.getElementById(`chapter-section-${currentChapterId}`)
        : null;
      let currentProgress = 0;
      if (activeEl && activeEl.offsetHeight > 0) {
        const chapterTop = activeEl.offsetTop;
        const chapterHeight = activeEl.offsetHeight;
        const chapterScroll = Math.max(0, scrollY - chapterTop);
        const chapterTotalHeight = Math.max(1, chapterHeight - vh * 0.4);
        currentProgress = Math.min(
          100,
          Math.max(0, Math.round((chapterScroll / chapterTotalHeight) * 100))
        );
      } else {
        const totalHeight = scrollHeight - vh;
        if (totalHeight > 0) {
          currentProgress = Math.min(
            100,
            Math.max(0, Math.round((scrollY / totalHeight) * 100))
          );
        }
      }
      setReadingProgress(currentProgress);

      // 2. Active chapter tracking based on scroll position
      const list = chaptersListRef.current;
      for (let i = list.length - 1; i >= 0; i--) {
        const el = document.getElementById(`chapter-section-${list[i].id}`);
        if (el && el.offsetTop <= scrollY + 250) {
          if (activeChapterIndexRef.current !== i) {
            activeChapterIndexRef.current = i;
            activeChapterIdRef.current = list[i].id;
            setActiveChapterIndex(i);
            const activeCh = list[i];
            window.history.replaceState(
              null,
              '',
              `/read/${activeCh.bookId}/${activeCh.id}?source=${sourceIdRef.current}`
            );
          }
          break;
        }
      }

      // 3. Infinite scroll trigger when within 1400px of bottom
      if (scrollHeight - (scrollY + vh) < 1400) {
        loadNextChapterRef.current();
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return {
    readingProgress,
    activeChapterIndex,
    setActiveChapterIndex,
    setReadingProgress,
  };
}
