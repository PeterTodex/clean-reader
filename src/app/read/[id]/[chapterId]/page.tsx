'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { ReaderView } from '@/components/ReaderView';
import { ReaderSkeleton } from '@/components/ReaderSkeleton';
import { ChapterContent, ChapterItem, BookDetail } from '@/sources/types';
import { storage } from '@/lib/storage';
import { clientChapterCache, clientBookCache } from '@/lib/client-cache';
import Link from 'next/link';
import { ArrowLeft, RefreshCw } from 'lucide-react';

export default function ReaderPage() {
  const params = useParams();
  const searchParams = useSearchParams();

  const bookId = params.id as string;
  const chapterId = params.chapterId as string;
  const sourceId = searchParams.get('source') || '';

  const chapterKey = `${sourceId}::${bookId}::${chapterId}`;
  const bookKey = `${sourceId}::${bookId}`;

  const [chapter, setChapter] = useState<ChapterContent | null>(() => clientChapterCache.get(chapterKey) || null);
  const [book, setBook] = useState<BookDetail | null>(() => clientBookCache.get(bookKey) || null);
  const [loading, setLoading] = useState(!clientChapterCache.has(chapterKey));
  const [error, setError] = useState<string | null>(null);
  const [slowLoading, setSlowLoading] = useState(false);

  const chapterRef = useRef(chapter);
  chapterRef.current = chapter;
  const bookRef = useRef(book);
  bookRef.current = book;

  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (loading && !chapter) {
      timer = setTimeout(() => {
        setSlowLoading(true);
      }, 3500);
    } else {
      setSlowLoading(false);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [loading, chapter]);

  useEffect(() => {
    if (!bookId || !chapterId) return;

    const currentChapter = chapterRef.current;
    if (currentChapter && currentChapter.id === chapterId && currentChapter.bookId === bookId) {
      return;
    }

    // 2. If present in client memory cache, switch instantly without loading spinner
    if (clientChapterCache.has(chapterKey)) {
      setChapter(clientChapterCache.get(chapterKey)!);
      setLoading(false);
      setError(null);
      return;
    }

    // 3. Only show full-screen spinner if no chapter is displayed yet
    if (!currentChapter) {
      setLoading(true);
    }
    setError(null);

    const promises: Promise<any>[] = [
      fetch(`/api/chapter?bookId=${bookId}&chapterId=${chapterId}&source=${sourceId}`).then((res) =>
        res.json()
      ),
    ];

    // Only fetch book detail if not already available in memory or state
    const currentBook = bookRef.current;
    if (!currentBook || currentBook.id !== bookId) {
      if (clientBookCache.has(bookKey)) {
        setBook(clientBookCache.get(bookKey)!);
      } else {
        promises.push(
          fetch(`/api/book?id=${bookId}&source=${sourceId}`).then((res) => res.json())
        );
      }
    }

    Promise.all(promises)
      .then(([chapterData, bookData]) => {
        if (!chapterData.success) {
          throw new Error(chapterData.error || '加载章节内容失败');
        }
        clientChapterCache.set(chapterKey, chapterData.data);
        setChapter(chapterData.data);

        if (bookData && bookData.success && bookData.data) {
          clientBookCache.set(bookKey, bookData.data);
          setBook(bookData.data);
        }
      })
      .catch((err) => {
        setError(err.message);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [bookId, chapterId, sourceId, chapterKey, bookKey]);

  const [mounted, setMounted] = useState(false);
  const [cachedBookTitle, setCachedBookTitle] = useState('书籍阅读');
  const [cachedChapterTitle, setCachedChapterTitle] = useState('');

  useEffect(() => {
    setMounted(true);
    const cachedBook = book || clientBookCache.get(bookKey);
    const resolvedBookTitle =
      cachedBook?.title ||
      storage.getBookshelf().find((b) => b.id === bookId)?.title ||
      storage.getHistory().find((h) => h.id === bookId)?.title ||
      '书籍阅读';
    setCachedBookTitle(resolvedBookTitle);

    const resolvedChapterTitle =
      cachedBook?.chapters.find((c) => String(c.id) === String(chapterId))?.title ||
      storage.getHistory().find((h) => h.id === bookId && String(h.lastChapterId) === String(chapterId))?.lastChapterTitle ||
      '';
    setCachedChapterTitle(resolvedChapterTitle);
  }, [bookId, chapterId, bookKey, book]);

  // SSR and initial client hydration strictly render ReaderSkeleton with stable title
  // Only after client mount does it switch to ReaderView or show local titles
  if (!mounted || (loading && !chapter)) {
    return (
      <ReaderSkeleton
        bookId={bookId}
        sourceId={sourceId}
        bookTitle={cachedBookTitle}
        chapterTitle={cachedChapterTitle}
        slowLoading={slowLoading}
      />
    );
  }

  if (error || !chapter) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 text-zinc-900">
        <div className="max-w-md w-full bg-white p-6 rounded-xl shadow-sm border border-zinc-200 text-center space-y-4">
          <div className="w-10 h-10 mx-auto rounded-full bg-red-100 text-red-600 flex items-center justify-center font-bold text-base">
            !
          </div>
          <h3 className="font-bold text-base text-zinc-900">章节加载失败</h3>
          <p className="text-xs text-zinc-500 leading-relaxed font-mono">
            {error || '章节内容不存在或源站线路受限'}
          </p>
          <div className="pt-2 flex items-center justify-center gap-2 flex-wrap">
            <button
              onClick={() => window.location.reload()}
              className="px-3.5 py-2 bg-black text-white hover:bg-zinc-800 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              重试本章
            </button>
            <Link
              href={`/?search=1&keyword=${encodeURIComponent(cachedBookTitle && cachedBookTitle !== '书籍阅读' ? cachedBookTitle : '')}`}
              className="px-3.5 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 border border-zinc-200 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
            >
              换源搜索
            </Link>
            <Link
              href={`/book/${bookId}?source=${sourceId}`}
              className="px-3.5 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors border border-zinc-200"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              返回目录
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ReaderView
      initialChapter={chapter}
      chapters={book?.chapters || []}
      bookTitle={book?.title || '书籍阅读'}
      bookCover={book?.cover}
      bookAuthor={book?.author}
      sourceId={sourceId}
      initialCachedChapterIds={book?.cachedChapterIds}
    />
  );
}
