'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { ReaderView } from '@/components/ReaderView';
import { ChapterContent, ChapterItem, BookDetail } from '@/sources/types';
import Link from 'next/link';
import { ArrowLeft, RefreshCw } from 'lucide-react';

export default function ReaderPage() {
  const params = useParams();
  const searchParams = useSearchParams();

  const bookId = params.id as string;
  const chapterId = params.chapterId as string;
  const sourceId = searchParams.get('source') || '';

  const [chapter, setChapter] = useState<ChapterContent | null>(null);
  const [book, setBook] = useState<BookDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!bookId || !chapterId) return;

    setLoading(true);
    setError(null);

    // Fetch chapter and book detail in parallel
    Promise.all([
      fetch(`/api/chapter?bookId=${bookId}&chapterId=${chapterId}&source=${sourceId}`).then((res) =>
        res.json()
      ),
      fetch(`/api/book?id=${bookId}&source=${sourceId}`).then((res) => res.json()),
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
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#fafafa] text-zinc-800">
        <div className="w-9 h-9 border-2 border-black border-t-transparent rounded-full animate-spin mb-3" />
        <h3 className="font-bold text-sm mb-1 tracking-tight">正在净化排版并加载正文...</h3>
        <p className="text-xs text-zinc-400 font-mono">无广告过滤 · 章节智能拼接</p>
      </div>
    );
  }

  if (error || !chapter) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-[#fafafa] text-zinc-900">
        <div className="max-w-md w-full bg-white p-6 rounded-xl shadow-sm border border-zinc-200 text-center space-y-4">
          <div className="w-10 h-10 mx-auto rounded-full bg-red-100 text-red-600 flex items-center justify-center font-bold text-base">
            !
          </div>
          <h3 className="font-bold text-base text-zinc-900">章节加载失败</h3>
          <p className="text-xs text-zinc-500 leading-relaxed font-mono">
            {error || '章节内容不存在或源站线路受限'}
          </p>
          <div className="pt-2 flex items-center justify-center gap-3">
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-black text-white hover:bg-zinc-800 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              重试本章
            </button>
            <Link
              href={`/book/${bookId}?source=${sourceId}`}
              className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors border border-zinc-200"
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
    />
  );
}
