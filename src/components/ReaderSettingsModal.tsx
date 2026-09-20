'use client';

import React from 'react';
import { ReaderSettings } from '@/lib/storage';
import { THEMES } from '@/lib/theme';
import { X, Type } from 'lucide-react';

interface ReaderSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: ReaderSettings;
  onUpdateSettings: (newSettings: Partial<ReaderSettings>) => void;
}

export const ReaderSettingsModal: React.FC<ReaderSettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
}) => {
  if (!isOpen) return null;

  const fonts: { id: ReaderSettings['fontFamily']; label: string }[] = [
    { id: 'serif', label: '衬线宋体' },
    { id: 'sans', label: '现代黑体' },
    { id: 'kaiti', label: '典雅楷体' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm">
      <div
        className="w-full sm:max-w-lg bg-white dark:bg-zinc-900 rounded-t-2xl sm:rounded-xl p-6 shadow-2xl border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-zinc-800">
          <h3 className="font-bold text-base text-zinc-950 dark:text-zinc-50 flex items-center gap-2">
            <Type className="w-5 h-5 text-zinc-900 dark:text-zinc-100" />
            阅读偏好设置
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="py-4 space-y-6">
          {/* Theme selection */}
          <div>
            <label className="text-xs font-mono font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block mb-2.5">
              全局主题配色
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {THEMES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => onUpdateSettings({ theme: t.id })}
                  style={{ backgroundColor: t.bg, color: t.text, borderColor: t.border }}
                  className={`h-14 rounded-lg border flex flex-col items-center justify-center relative transition-all text-xs shadow-xs ${
                    settings.theme === t.id ? 'font-bold' : 'font-medium hover:opacity-90'
                  }`}
                >
                  <span>{t.label}</span>
                  {settings.theme === t.id && (
                    <span className="absolute top-1 right-1 w-3.5 h-3.5 rounded-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 flex items-center justify-center text-[9px] font-bold">
                      ✓
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Font size & Line height */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">字号大小</span>
                <span className="text-xs font-mono font-semibold text-zinc-800 dark:text-zinc-200">{settings.fontSize}px</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onUpdateSettings({ fontSize: Math.max(14, settings.fontSize - 2) })}
                  className="w-8 h-8 rounded border border-zinc-200 dark:border-zinc-700 flex items-center justify-center text-xs font-semibold hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 shrink-0 transition-colors"
                >
                  A-
                </button>
                <input
                  type="range"
                  min="14"
                  max="32"
                  step="1"
                  value={settings.fontSize}
                  onChange={(e) => onUpdateSettings({ fontSize: Number(e.target.value) })}
                  className="flex-1 accent-zinc-900 dark:accent-zinc-100"
                />
                <button
                  onClick={() => onUpdateSettings({ fontSize: Math.min(32, settings.fontSize + 2) })}
                  className="w-8 h-8 rounded border border-zinc-200 dark:border-zinc-700 flex items-center justify-center text-xs font-semibold hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 shrink-0 transition-colors"
                >
                  A+
                </button>
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">行距行高</span>
                <span className="text-xs font-mono font-semibold text-zinc-800 dark:text-zinc-200">{settings.lineHeight.toFixed(2)}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onUpdateSettings({ lineHeight: Math.max(1.4, Number((settings.lineHeight - 0.1).toFixed(2))) })}
                  className="px-2.5 h-8 rounded border border-zinc-200 dark:border-zinc-700 flex items-center justify-center text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 whitespace-nowrap shrink-0 transition-colors"
                >
                  紧凑
                </button>
                <input
                  type="range"
                  min="1.4"
                  max="2.6"
                  step="0.05"
                  value={settings.lineHeight}
                  onChange={(e) => onUpdateSettings({ lineHeight: Number(e.target.value) })}
                  className="flex-1 accent-zinc-900 dark:accent-zinc-100"
                />
                <button
                  onClick={() => onUpdateSettings({ lineHeight: Math.min(2.6, Number((settings.lineHeight + 0.1).toFixed(2))) })}
                  className="px-2.5 h-8 rounded border border-zinc-200 dark:border-zinc-700 flex items-center justify-center text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 whitespace-nowrap shrink-0 transition-colors"
                >
                  疏朗
                </button>
              </div>
            </div>
          </div>

          {/* Font family */}
          <div>
            <label className="text-xs font-mono font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block mb-2">
              排版字体
            </label>
            <div className="grid grid-cols-3 gap-2">
              {fonts.map((f) => (
                <button
                  key={f.id}
                  onClick={() => onUpdateSettings({ fontFamily: f.id })}
                  className={`py-2 px-3 rounded-lg border text-xs font-medium transition-all ${
                    settings.fontFamily === f.id
                      ? 'border-zinc-900 dark:border-zinc-100 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-bold shadow-xs'
                      : 'border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Max width container */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">页面版心宽度</span>
              <span className="text-xs font-mono font-semibold text-zinc-800 dark:text-zinc-200">{settings.maxWidth}px</span>
            </div>
            <input
              type="range"
              min="640"
              max="1100"
              step="20"
              value={settings.maxWidth}
              onChange={(e) => onUpdateSettings({ maxWidth: Number(e.target.value) })}
              className="w-full accent-zinc-900 dark:accent-zinc-100"
            />
          </div>

          {/* Reading mode */}
          <div>
            <label className="text-xs font-mono font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block mb-2">
              阅读翻页模式
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => onUpdateSettings({ readingMode: 'scroll' })}
                className={`py-2 px-3 rounded-lg border text-xs font-medium transition-all ${
                  settings.readingMode === 'scroll'
                    ? 'border-zinc-900 dark:border-zinc-100 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-bold shadow-xs'
                    : 'border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
                }`}
              >
                连续垂直滚动
              </button>
              <button
                onClick={() => onUpdateSettings({ readingMode: 'page' })}
                className={`py-2 px-3 rounded-lg border text-xs font-medium transition-all ${
                  settings.readingMode === 'page'
                    ? 'border-zinc-900 dark:border-zinc-100 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-bold shadow-xs'
                    : 'border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
                }`}
              >
                章节分页翻阅
              </button>
            </div>
          </div>

          {/* Toggle Next Chapter Auto Preload */}
          <div className="flex items-center justify-between pt-2 border-t border-zinc-100 dark:border-zinc-800">
            <div>
              <span className="text-xs font-medium text-zinc-900 dark:text-zinc-100 block">后台自动预加载下一章</span>
              <span className="text-[11px] text-zinc-400 dark:text-zinc-500">阅读时静默预加载，翻页秒开无顿挫</span>
            </div>
            <input
              type="checkbox"
              checked={settings.autoPreloadNext}
              onChange={(e) => onUpdateSettings({ autoPreloadNext: e.target.checked })}
              className="w-4 h-4 rounded text-zinc-900 dark:text-zinc-100 accent-zinc-900 dark:accent-zinc-100 cursor-pointer"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

