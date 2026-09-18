'use client';

import React, { useState, useRef, useEffect } from 'react';
import { BookDetail } from '@/sources/types';
import { storage } from '@/lib/storage';
import {
  X,
  Download,
  Check,
  CheckCircle2,
  AlertCircle,
  BookOpen,
  Layers,
  FileText,
  Sparkles,
  Loader2,
} from 'lucide-react';

interface BookDownloaderModalProps {
  isOpen: boolean;
  onClose: () => void;
  book: BookDetail;
  sourceId: string;
}

type DownloadMode = 'all' | 'range';
type ExportStatus = 'idle' | 'exporting' | 'completed' | 'error';

export const BookDownloaderModal: React.FC<BookDownloaderModalProps> = ({
  isOpen,
  onClose,
  book,
  sourceId,
}) => {
  const totalChapters = book.chapters.length;

  const [mode, setMode] = useState<DownloadMode>('all');
  const [startChapter, setStartChapter] = useState<number>(1);
  const [endChapter, setEndChapter] = useState<number>(totalChapters || 1);
  const [status, setStatus] = useState<ExportStatus>('idle');
  const [progress, setProgress] = useState<{ current: number; total: number; percent: number }>({
    current: 0,
    total: totalChapters,
    percent: 0,
  });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastBlob, setLastBlob] = useState<{ blob: Blob; filename: string } | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  // Sync endChapter when book chapters update
  useEffect(() => {
    if (totalChapters > 0 && endChapter === 1) {
      setEndChapter(totalChapters);
    }
  }, [totalChapters, endChapter]);

  // Reset states when closed or opened
  useEffect(() => {
    if (isOpen) {
      if (status === 'completed' || status === 'error') {
        setStatus('idle');
        setErrorMessage(null);
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleClose = () => {
    if (status === 'exporting') {
      if (confirm('正在导出中，关闭弹窗将终止下载，确定要取消吗？')) {
        abortControllerRef.current?.abort();
        setStatus('idle');
        onClose();
      }
    } else {
      onClose();
    }
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleStartExport = async () => {
    if (totalChapters === 0) {
      setErrorMessage('本书籍没有可用章节');
      setStatus('error');
      return;
    }

    // Validate range
    let selectedChapters = book.chapters;
    let actualStart = 1;
    let actualEnd = totalChapters;

    if (mode === 'range') {
      actualStart = Math.max(1, Math.min(startChapter || 1, totalChapters));
      actualEnd = Math.max(actualStart, Math.min(endChapter || totalChapters, totalChapters));
      selectedChapters = book.chapters.slice(actualStart - 1, actualEnd);
    }

    const totalToFetch = selectedChapters.length;
    if (totalToFetch === 0) {
      setErrorMessage('请选择有效的下载章节范围');
      setStatus('error');
      return;
    }

    const chapterIds = selectedChapters.map((c) => c.id);

    setStatus('exporting');
    setErrorMessage(null);
    setProgress({ current: 0, total: totalToFetch, percent: 0 });

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const mirror = storage.getSettings().selectedMirror || undefined;

      const response = await fetch('/api/export/txt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bookId: book.id,
          sourceId,
          mirror,
          chapterIds,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({ error: '下载失败' }));
        throw new Error(errJson.error || `下载请求失败 (${response.status})`);
      }

      if (!response.body) {
        throw new Error('未接收到导出数据流');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      const chunks: BlobPart[] = [];
      let receivedText = '';
      let lastCount = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        if (value) {
          chunks.push(value);
          const chunkStr = decoder.decode(value, { stream: true });
          receivedText += chunkStr;

          // Count completed chapters by matching chapter headers: (?:^|\n\n)第\d+章\s
          const matches = receivedText.match(/(?:^|\n\n)第\d+章\s/g);
          const count = matches ? Math.min(matches.length, totalToFetch) : 0;

          if (count !== lastCount) {
            lastCount = count;
            const percent = Math.min(100, Math.round((count / totalToFetch) * 100));
            setProgress({
              current: count,
              total: totalToFetch,
              percent,
            });
          }
        }
      }

      // Stream fully read
      setProgress({
        current: totalToFetch,
        total: totalToFetch,
        percent: 100,
      });

      // Parse filename from Content-Disposition header
      const cd = response.headers.get('Content-Disposition') || '';
      let filename = `${book.title}.txt`;

      if (cd) {
        const utf8Match = cd.match(/filename\*=UTF-8''([^;]+)/i);
        if (utf8Match && utf8Match[1]) {
          try {
            filename = decodeURIComponent(utf8Match[1]);
          } catch {
            filename = utf8Match[1];
          }
        } else {
          const simpleMatch = cd.match(/filename="?([^";]+)"?/i);
          if (simpleMatch && simpleMatch[1]) {
            try {
              filename = decodeURIComponent(simpleMatch[1]);
            } catch {
              filename = simpleMatch[1];
            }
          }
        }
      }

      if (mode === 'range') {
        const baseName = filename.replace(/\.txt$/i, '');
        filename = `${baseName}_(第${actualStart}-${actualEnd}章).txt`;
      }

      const blob = new Blob(chunks, { type: 'text/plain;charset=utf-8' });
      setLastBlob({ blob, filename });
      setStatus('completed');

      // Trigger instant one-click download in browser
      downloadBlob(blob, filename);
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setStatus('idle');
      } else {
        console.error('[BookDownloader] Export failed:', err);
        setErrorMessage(err.message || '导出过程中发生异常，请稍后重试');
        setStatus('error');
      }
    } finally {
      abortControllerRef.current = null;
    }
  };

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setStatus('idle');
  };

  // Preset range helpers
  const handleSetPreset = (preset: 'first50' | 'first100' | 'last50' | 'all') => {
    setMode('range');
    if (preset === 'first50') {
      setStartChapter(1);
      setEndChapter(Math.min(50, totalChapters));
    } else if (preset === 'first100') {
      setStartChapter(1);
      setEndChapter(Math.min(100, totalChapters));
    } else if (preset === 'last50') {
      setStartChapter(Math.max(1, totalChapters - 49));
      setEndChapter(totalChapters);
    } else {
      setMode('all');
      setStartChapter(1);
      setEndChapter(totalChapters);
    }
  };

  const rangeCount =
    mode === 'all'
      ? totalChapters
      : Math.max(
          0,
          Math.min(endChapter || totalChapters, totalChapters) -
            Math.max(1, Math.min(startChapter || 1, totalChapters)) +
            1
        );

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm animate-fade-in"
      onClick={handleClose}
    >
      <div
        className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl border border-stone-200 text-stone-800 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100 bg-stone-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center text-amber-800">
              <Download className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-serif font-bold text-base text-stone-900 leading-none">
                下载纯净 TXT 小说
              </h3>
              <p className="text-xs text-stone-500 mt-1 line-clamp-1">
                《{book.title}》 · 共 {totalChapters} 章
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5">
          {/* Status: IDLE / CONFIGURATION */}
          {status === 'idle' && (
            <>
              {/* Option Selector */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-stone-500 uppercase tracking-wider block">
                  下载范围选择
                </label>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setMode('all')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      mode === 'all'
                        ? 'border-amber-800 bg-amber-50/70 ring-1 ring-amber-800'
                        : 'border-stone-200 hover:bg-stone-50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5 font-medium text-sm text-stone-900">
                        <BookOpen className="w-4 h-4 text-amber-800" />
                        全本下载
                      </div>
                      {mode === 'all' && <Check className="w-4 h-4 text-amber-800" />}
                    </div>
                    <p className="text-xs text-stone-500">下载全部 {totalChapters} 章</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMode('range')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      mode === 'range'
                        ? 'border-amber-800 bg-amber-50/70 ring-1 ring-amber-800'
                        : 'border-stone-200 hover:bg-stone-50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5 font-medium text-sm text-stone-900">
                        <Layers className="w-4 h-4 text-amber-800" />
                        指定范围
                      </div>
                      {mode === 'range' && <Check className="w-4 h-4 text-amber-800" />}
                    </div>
                    <p className="text-xs text-stone-500">按需选择起止章节</p>
                  </button>
                </div>
              </div>

              {/* Range Inputs if mode === 'range' */}
              {mode === 'range' && (
                <div className="p-4 rounded-xl bg-stone-50 border border-stone-200/70 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <label className="block text-xs font-medium text-stone-600 mb-1">起始章节</label>
                      <div className="relative">
                        <span className="absolute left-2.5 top-2 text-xs text-stone-400">第</span>
                        <input
                          type="number"
                          min={1}
                          max={totalChapters}
                          value={startChapter}
                          onChange={(e) => setStartChapter(Math.max(1, parseInt(e.target.value) || 1))}
                          className="w-full pl-7 pr-7 py-1.5 text-sm bg-white border border-stone-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-800"
                        />
                        <span className="absolute right-2.5 top-2 text-xs text-stone-400">章</span>
                      </div>
                    </div>

                    <div className="pt-5 text-stone-400 font-medium">至</div>

                    <div className="flex-1">
                      <label className="block text-xs font-medium text-stone-600 mb-1">结束章节</label>
                      <div className="relative">
                        <span className="absolute left-2.5 top-2 text-xs text-stone-400">第</span>
                        <input
                          type="number"
                          min={startChapter}
                          max={totalChapters}
                          value={endChapter}
                          onChange={(e) =>
                            setEndChapter(Math.min(totalChapters, parseInt(e.target.value) || totalChapters))
                          }
                          className="w-full pl-7 pr-7 py-1.5 text-sm bg-white border border-stone-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-800"
                        />
                        <span className="absolute right-2.5 top-2 text-xs text-stone-400">章</span>
                      </div>
                    </div>
                  </div>

                  {/* Preset quick buttons */}
                  <div className="flex items-center gap-1.5 flex-wrap pt-1">
                    <span className="text-[11px] text-stone-400 mr-1">快捷选择:</span>
                    <button
                      type="button"
                      onClick={() => handleSetPreset('first50')}
                      className="px-2 py-0.5 text-xs rounded bg-stone-200/80 hover:bg-stone-300 text-stone-700 transition-colors"
                    >
                      前 50 章
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSetPreset('first100')}
                      className="px-2 py-0.5 text-xs rounded bg-stone-200/80 hover:bg-stone-300 text-stone-700 transition-colors"
                    >
                      前 100 章
                    </button>
                    {totalChapters > 50 && (
                      <button
                        type="button"
                        onClick={() => handleSetPreset('last50')}
                        className="px-2 py-0.5 text-xs rounded bg-stone-200/80 hover:bg-stone-300 text-stone-700 transition-colors"
                      >
                        后 50 章
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Format features badges */}
              <div className="p-3 bg-amber-50/50 rounded-xl border border-amber-100 text-xs text-stone-600 space-y-1">
                <div className="flex items-center gap-1.5 font-medium text-amber-900 mb-1">
                  <Sparkles className="w-3.5 h-3.5 text-amber-700" />
                  TXT 格式化特性
                </div>
                <div className="grid grid-cols-2 gap-1 text-[11px] text-stone-500">
                  <div>✓ 智能多线路并发解析</div>
                  <div>✓ 深度过滤防屏蔽广告</div>
                  <div>✓ 标准小说段落两字缩进</div>
                  <div>✓ 规范章节标题标准化</div>
                </div>
              </div>

              {/* Action Trigger Button */}
              <button
                type="button"
                onClick={handleStartExport}
                className="w-full py-3 px-4 rounded-xl bg-amber-800 hover:bg-amber-900 text-white font-medium text-sm transition-colors shadow-sm flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                立即导出并下载 ({rangeCount} 章)
              </button>
            </>
          )}

          {/* Status: EXPORTING / PROGRESS BAR */}
          {status === 'exporting' && (
            <div className="py-4 space-y-5">
              <div className="text-center space-y-1">
                <div className="w-12 h-12 mx-auto rounded-full bg-amber-100 flex items-center justify-center text-amber-800 mb-3">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
                <h4 className="font-medium text-base text-stone-900">正在下载与排版章节...</h4>
                <p className="text-xs text-stone-500">
                  多线路并发抓取中，自动过滤广告并进行段落缩进排版
                </p>
              </div>

              {/* Progress bar and counter */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-stone-600 font-medium">
                  <span>
                    已解析: <strong className="text-amber-900 font-bold">{progress.current}</strong> / {progress.total} 章
                  </span>
                  <span className="font-mono text-amber-900 font-bold">{progress.percent}%</span>
                </div>

                <div className="w-full bg-stone-100 rounded-full h-3.5 overflow-hidden border border-stone-200 p-0.5">
                  <div
                    className="bg-gradient-to-r from-amber-700 to-amber-900 h-full rounded-full transition-all duration-300"
                    style={{ width: `${progress.percent}%` }}
                  />
                </div>
              </div>

              {/* Cancel Button */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="w-full py-2 px-4 rounded-xl border border-stone-300 hover:bg-stone-100 text-stone-700 text-xs font-medium transition-colors"
                >
                  取消导出
                </button>
              </div>
            </div>
          )}

          {/* Status: COMPLETED */}
          {status === 'completed' && (
            <div className="py-4 text-center space-y-4">
              <div className="w-12 h-12 mx-auto rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 mb-2">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <div>
                <h4 className="font-bold text-base text-stone-900">导出完成！</h4>
                <p className="text-xs text-stone-500 mt-1">
                  已成功下载并格式化 {progress.total} 章节，浏览器已自动启动下载。
                </p>
              </div>

              {lastBlob && (
                <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 text-left text-xs space-y-1">
                  <div className="font-medium text-stone-800 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-stone-500" />
                    <span className="truncate">{lastBlob.filename}</span>
                  </div>
                  <div className="text-[11px] text-stone-400">
                    文件大小: {(lastBlob.blob.size / 1024).toFixed(1)} KB · UTF-8 纯文本
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3 pt-2">
                {lastBlob && (
                  <button
                    type="button"
                    onClick={() => downloadBlob(lastBlob.blob, lastBlob.filename)}
                    className="flex-1 py-2.5 px-4 rounded-xl border border-stone-300 hover:bg-stone-50 text-stone-700 text-xs font-medium transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    再次保存
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-amber-800 hover:bg-amber-900 text-white text-xs font-medium transition-colors"
                >
                  完成
                </button>
              </div>
            </div>
          )}

          {/* Status: ERROR */}
          {status === 'error' && (
            <div className="py-4 text-center space-y-4">
              <div className="w-12 h-12 mx-auto rounded-full bg-red-100 flex items-center justify-center text-red-600 mb-2">
                <AlertCircle className="w-7 h-7" />
              </div>
              <div>
                <h4 className="font-bold text-base text-stone-900">下载中断或失败</h4>
                <p className="text-xs text-red-600 mt-1 max-h-24 overflow-y-auto px-2">
                  {errorMessage || '导出过程中发生异常，请检查网络或更换线路'}
                </p>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setStatus('idle')}
                  className="flex-1 py-2.5 px-4 rounded-xl border border-stone-300 hover:bg-stone-50 text-stone-700 text-xs font-medium transition-colors"
                >
                  返回重试
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-stone-200 hover:bg-stone-300 text-stone-800 text-xs font-medium transition-colors"
                >
                  关闭
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
