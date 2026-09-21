'use client';

import { useEffect, useRef } from 'react';

export interface UseReaderKeyboardOptions {
  prevChapterId: string | null;
  nextChapterId: string | null;
  onNavigateChapter: (chapterId: string) => void;
  onCloseModals: () => void;
}

export function useReaderKeyboard(options: UseReaderKeyboardOptions): void;
export function useReaderKeyboard(
  prevChapterId: string | null,
  nextChapterId: string | null,
  onNavigateChapter: (chapterId: string) => void,
  onCloseModals: () => void
): void;
export function useReaderKeyboard(
  arg1: UseReaderKeyboardOptions | string | null,
  arg2?: string | null,
  arg3?: (chapterId: string) => void,
  arg4?: () => void
): void {
  let prevChapterId: string | null;
  let nextChapterId: string | null;
  let onNavigateChapter: (chapterId: string) => void;
  let onCloseModals: () => void;

  if (arg1 !== null && typeof arg1 === 'object') {
    prevChapterId = arg1.prevChapterId;
    nextChapterId = arg1.nextChapterId;
    onNavigateChapter = arg1.onNavigateChapter;
    onCloseModals = arg1.onCloseModals;
  } else {
    prevChapterId = arg1 ?? null;
    nextChapterId = arg2 ?? null;
    onNavigateChapter = arg3!;
    onCloseModals = arg4!;
  }

  const prevChapterIdRef = useRef(prevChapterId);
  prevChapterIdRef.current = prevChapterId;
  const nextChapterIdRef = useRef(nextChapterId);
  nextChapterIdRef.current = nextChapterId;
  const onNavigateChapterRef = useRef(onNavigateChapter);
  onNavigateChapterRef.current = onNavigateChapter;
  const onCloseModalsRef = useRef(onCloseModals);
  onCloseModalsRef.current = onCloseModals;

  useEffect(() => {
    const toggleFullscreen = () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement)?.isContentEditable
      ) {
        return;
      }

      if (e.key === 'ArrowLeft' && prevChapterIdRef.current) {
        onNavigateChapterRef.current(prevChapterIdRef.current);
      } else if (e.key === 'ArrowRight' && nextChapterIdRef.current) {
        onNavigateChapterRef.current(nextChapterIdRef.current);
      } else if (e.key === 'PageDown' || (e.key === ' ' && !e.shiftKey)) {
        e.preventDefault();
        window.scrollBy({ top: Math.round(window.innerHeight * 0.85), behavior: 'smooth' });
      } else if (e.key === 'PageUp' || (e.key === ' ' && e.shiftKey)) {
        e.preventDefault();
        window.scrollBy({ top: -Math.round(window.innerHeight * 0.85), behavior: 'smooth' });
      } else if (e.key === 'f' || e.key === 'F') {
        toggleFullscreen();
      } else if (e.key === 'Escape') {
        onCloseModalsRef.current();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
}
