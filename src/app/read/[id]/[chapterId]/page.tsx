'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { ReaderView } from '@/components/ReaderView';
import { ChapterContent, ChapterItem, BookDetail } from '@/sources/types';
import { storage } from '@/lib/storage';
import Link from 'next/link';
import { ArrowLeft, RefreshCw } from 'lucide-react';

export default function ReaderPage() {
  const params = useParams();
  const searchParams = useSearchParams();

  const bookId = params.id as string;
  const chapterId = params.chapterId as string;
  const sourceId = searchParams.get('source') || 'diyibanzhu';

  const [chapter, setChapter] = useState<ChapterContent | null>(null);
  const [book, setBook] = useState<BookDetail | null>(null);
  const [availableMirrors, setAvailableMirrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!bookId || !chapterId) return;

    const settings = storage.getSettings();
    const mirrorParam = settings.selectedMirror ? `&mirror=${encodeURIComponent(settings.selectedMirror)}` : '';

    setLoading(true);
    setError(null);

    // Fetch sources to get available mirrors
    fetch('/api/sources')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.data) {
          const currentSource = data.data.find((s: any) => s.id === sourceId);
          if (currentSource?.mirrors) {
            setAvailableMirrors(currentSource.mirrors);
          }
        }
      })
      .catch(() => {});

    // Fetch chapter and book detail in parallel
    Promise.all([
      fetch(`/api/chapter?bookId=${bookId}&chapterId=${chapterId}&source=${sourceId}${mirrorParam}`).then((res) =>
        res.json()
      ),
      fetch(`/api/book?id=${bookId}&source=${sourceId}${mirrorParam}`).then((res) => res.json()),
    ])
      .then(([chapterData, bookData]) => {
        if (!chapterData.success) {
          throw new Error(chapterData.error || '加载章节内容失败');
        }
        setChapter(chapterData.data);

        if (bookData.success && bookData.data) {
          setBook(bookData.data);
        }
      })
      .catch((err) => {
        setError(err.message);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [bookId, chapterId, sourceId]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#f7f3e8] text-stone-700">
        <div className="w-10 h-10 border-3 border-amber-800 border-t-transparent rounded-full animate-spin mb-4" />
        <h3 className="font-serif font-medium text-base mb-1">正在净化排版并加载正文...</h3>
        <p className="text-xs text-stone-500">已自动过滤广告与弹窗，无感拼接分段</p>
      </div>
    );
  }

  if (error || !chapter) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-[#f7f3e8] text-stone-800">
        <div className="max-w-md w-full bg-white p-6 rounded-2xl shadow-md border border-stone-200 text-center space-y-4">
          <div className="w-12 h-12 mx-auto rounded-full bg-red-100 text-red-600 flex items-center justify-center font-bold text-xl">
            !
          </div>
          <h3 className="font-bold text-lg text-stone-900">章节加载失败</h3>
          <p className="text-xs text-stone-500 leading-relaxed">
            {error || '章节内容不存在或源站线路受限'}
          </p>
          <div className="pt-2 flex items-center justify-center gap-3">
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-amber-800 text-white hover:bg-amber-900 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              重试本章
            </button>
            <Link
              href={`/book/${bookId}?source=${sourceId}`}
              className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
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
      availableMirrors={availableMirrors}
    />
  );
}
