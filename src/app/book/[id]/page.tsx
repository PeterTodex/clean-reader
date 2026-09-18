'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { Header } from '@/components/Header';
import { BookDownloaderModal } from '@/components/BookDownloaderModal';
import { BookDetail, ChapterItem } from '@/sources/types';
import { storage } from '@/lib/storage';
import {
  ArrowLeft,
  BookOpen,
  Bookmark,
  Check,
  Plus,
  Search,
  ArrowUpDown,
  Layers,
  Clock,
  Download,
} from 'lucide-react';

export default function BookDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const bookId = params.id as string;
  const sourceId = searchParams.get('source') || 'diyibanzhu';

  const [book, setBook] = useState<BookDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inShelf, setInShelf] = useState(false);
  const [chapterSearch, setChapterSearch] = useState('');
  const [isReverse, setIsReverse] = useState(false);
  const [lastReadChapterId, setLastReadChapterId] = useState<string | null>(null);
  const [showDownloader, setShowDownloader] = useState(false);

  useEffect(() => {
    if (!bookId) return;

    // Check shelf status
    setInShelf(storage.isInBookshelf(bookId, sourceId));
    const shelf = storage.getBookshelf();
    const shelfItem = shelf.find((b) => b.id === bookId && b.sourceId === sourceId);
    if (shelfItem?.lastChapterId) {
      setLastReadChapterId(shelfItem.lastChapterId);
    }

    setLoading(true);
    fetch(`/api/book?id=${bookId}&source=${sourceId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.data) {
          setBook(data.data);
        } else {
          setError(data.error || '获取书籍信息失败');
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [bookId, sourceId]);

  const toggleBookshelf = () => {
    if (!book) return;
    if (inShelf) {
      storage.removeFromBookshelf(book.id, sourceId);
      setInShelf(false);
    } else {
      storage.saveToBookshelf({
        id: book.id,
        title: book.title,
        author: book.author,
        cover: book.cover,
        sourceId,
        lastChapterId: book.chapters[0]?.id,
        lastChapterTitle: book.chapters[0]?.title,
        totalChapters: book.chapters.length,
      });
      setInShelf(true);
    }
  };

  const filteredChapters = useMemo(() => {
    if (!book) return [];
    let list = [...book.chapters];
    if (chapterSearch.trim()) {
      const q = chapterSearch.trim().toLowerCase();
      list = list.filter((c) => c.title.toLowerCase().includes(q) || String(c.index).includes(q));
    }
    if (isReverse) {
      list.reverse();
    }
    return list;
  }, [book, chapterSearch, isReverse]);

  const startChapterId = lastReadChapterId || (book?.chapters[0]?.id ?? '');

  return (
    <div className="min-h-screen flex flex-col bg-[#fafafa]">
      <Header />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-8 space-y-8">
        {/* Back Link */}
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-mono text-zinc-500 hover:text-black transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          BACK TO BOOKSHELF
        </Link>

        {loading ? (
          <div className="py-24 text-center">
            <div className="w-8 h-8 mx-auto border-2 border-black border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-xs text-zinc-500 font-mono">LOADING NOVEL METADATA...</p>
          </div>
        ) : error || !book ? (
          <div className="py-16 text-center text-zinc-500">
            <p className="text-red-600 mb-4 text-sm">{error || '书籍不存在'}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-black hover:bg-zinc-800 rounded-lg text-xs text-white"
            >
              重新加载
            </button>
          </div>
        ) : (
          <>
            {/* Book Meta Card */}
            <div className="bg-white rounded-xl p-6 sm:p-8 border border-zinc-200 shadow-sm flex flex-col sm:flex-row gap-6 sm:gap-8 items-start">
              {/* Cover */}
              <div className="w-36 sm:w-44 aspect-[2/3] bg-zinc-100 rounded-lg overflow-hidden shadow-sm border border-zinc-200 flex-shrink-0 mx-auto sm:mx-0">
                {book.cover ? (
                  <img
                    src={book.cover}
                    alt={book.title}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                ) : null}
              </div>

              {/* Info Details */}
              <div className="flex-1 min-w-0 space-y-4">
                <div>
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded bg-black text-white">
                      {book.category || '小说'}
                    </span>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-zinc-100 text-zinc-700 border border-zinc-200">
                      {book.status || '连载'}
                    </span>
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-zinc-950 tracking-tight">
                    {book.title}
                  </h1>
                  <p className="text-xs text-zinc-500 mt-1">作者：{book.author}</p>
                </div>

                {/* Additional Stats */}
                <div className="flex flex-wrap gap-4 text-xs font-mono text-zinc-500 py-1">
                  <div className="flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-zinc-700" />
                    <span>{book.chapters.length} CHAPTERS</span>
                  </div>
                  {book.updateTime && (
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-zinc-700" />
                      <span>{book.updateTime}</span>
                    </div>
                  )}
                </div>

                {/* Synopsis */}
                {book.intro && (
                  <div className="bg-zinc-50 p-3.5 rounded-lg border border-zinc-200 text-xs sm:text-sm text-zinc-600 leading-relaxed max-h-32 overflow-y-auto whitespace-pre-wrap">
                    {book.intro}
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex flex-wrap items-center gap-3 pt-2">
                  {startChapterId ? (
                    <Link
                      href={`/read/${book.id}/${startChapterId}?source=${sourceId}`}
                      className="px-5 py-2.5 rounded-lg bg-black text-white hover:bg-zinc-800 text-xs font-medium transition-colors shadow-sm flex items-center gap-2"
                    >
                      <BookOpen className="w-4 h-4" />
                      {lastReadChapterId ? '继续阅读' : '开始阅读'}
                    </Link>
                  ) : null}

                  <button
                    onClick={toggleBookshelf}
                    className={`px-4 py-2.5 rounded-lg border text-xs font-medium transition-colors flex items-center gap-2 ${
                      inShelf
                        ? 'border-zinc-300 bg-zinc-100 text-zinc-700'
                        : 'border-black text-black hover:bg-zinc-100'
                    }`}
                  >
                    {inShelf ? (
                      <>
                        <Check className="w-4 h-4 text-black" />
                        已在书架
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4" />
                        加入书架
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => setShowDownloader(true)}
                    className="px-4 py-2.5 rounded-lg border border-zinc-300 hover:border-black bg-white hover:bg-zinc-50 text-zinc-800 text-xs font-medium transition-colors flex items-center gap-2 shadow-sm"
                  >
                    <Download className="w-4 h-4 text-black" />
                    下载全本 TXT
                  </button>
                </div>
              </div>
            </div>

            {/* Chapter List Card */}
            <div className="bg-white rounded-xl p-6 sm:p-8 border border-zinc-200 shadow-sm space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-100 pb-4">
                <div>
                  <h2 className="font-bold text-base text-zinc-950 flex items-center gap-2">
                    <Bookmark className="w-4 h-4 text-black" />
                    正文章节目录
                    <span className="text-xs font-mono font-normal text-zinc-400">
                      ({book.chapters.length} TOTAL)
                    </span>
                  </h2>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative flex-1 sm:w-60">
                    <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      placeholder="搜索章节..."
                      value={chapterSearch}
                      onChange={(e) => setChapterSearch(e.target.value)}
                      className="w-full pl-9 pr-3 py-1.5 text-xs bg-zinc-100 rounded-lg border border-zinc-200 focus:outline-none focus:ring-1 focus:ring-black text-zinc-900"
                    />
                  </div>

                  <button
                    onClick={() => setIsReverse(!isReverse)}
                    className="px-3 py-1.5 text-xs text-zinc-700 bg-zinc-100 hover:bg-zinc-200 rounded-lg flex items-center gap-1 transition-colors flex-shrink-0 border border-zinc-200 font-mono"
                  >
                    <ArrowUpDown className="w-3.5 h-3.5" />
                    {isReverse ? '倒序' : '正序'}
                  </button>
                </div>
              </div>

              {/* Chapters Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-[600px] overflow-y-auto pr-1">
                {filteredChapters.map((ch) => {
                  const isLastRead = ch.id === lastReadChapterId;
                  return (
                    <Link
                      key={ch.id}
                      href={`/read/${book.id}/${ch.id}?source=${sourceId}`}
                      className={`p-2.5 rounded-lg text-xs transition-colors flex items-center justify-between border ${
                        isLastRead
                          ? 'border-black bg-zinc-100 font-bold text-black shadow-sm'
                          : 'border-transparent hover:border-zinc-200 hover:bg-zinc-50 text-zinc-700'
                      }`}
                    >
                      <span className="line-clamp-1 flex-1 pr-2">{ch.title}</span>
                      {isLastRead && (
                        <span className="text-[10px] bg-black text-white px-1.5 py-0.5 rounded font-mono font-normal flex-shrink-0">
                          RECENT
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>

            <BookDownloaderModal
              isOpen={showDownloader}
              onClose={() => setShowDownloader(false)}
              book={book}
              sourceId={sourceId}
            />
          </>
        )}
      </main>
    </div>
  );
}
