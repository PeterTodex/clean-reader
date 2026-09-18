'use client';

import React from 'react';
import { ReaderSettings } from '@/lib/storage';
import { X, Type, Sun, Moon, Maximize2, Smartphone, Check } from 'lucide-react';

interface ReaderSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: ReaderSettings;
  onUpdateSettings: (newSettings: Partial<ReaderSettings>) => void;
  availableMirrors?: string[];
}

export const ReaderSettingsModal: React.FC<ReaderSettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  availableMirrors = [],
}) => {
  if (!isOpen) return null;

  const themes: { id: ReaderSettings['theme']; label: string; bg: string; text: string; border: string }[] = [
    { id: 'parchment', label: '羊皮纸', bg: '#f7f3e8', text: '#382e21', border: '#e5dbc7' },
    { id: 'eyecare', label: '豆沙绿', bg: '#e9f2e8', text: '#1a331c', border: '#cbe0cb' },
    { id: 'white', label: '纯净白', bg: '#ffffff', text: '#1e293b', border: '#e2e8f0' },
    { id: 'eink', label: '水墨灰', bg: '#eeeeee', text: '#111111', border: '#d1d5db' },
    { id: 'dark', label: '深色夜间', bg: '#18191c', text: '#cfd4dc', border: '#2b2e34' },
    { id: 'oled', label: '极致纯黑', bg: '#000000', text: '#9ca3af', border: '#1f2937' },
  ];

  const fonts: { id: ReaderSettings['fontFamily']; label: string }[] = [
    { id: 'serif', label: '衬线宋体' },
    { id: 'kaiti', label: '典雅楷体' },
    { id: 'sans', label: '现代黑体' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
      <div
        className="w-full sm:max-w-lg bg-white rounded-t-2xl sm:rounded-2xl p-6 shadow-2xl border border-stone-200 text-stone-800 max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-stone-100">
          <h3 className="font-serif font-bold text-lg text-stone-900 flex items-center gap-2">
            <Type className="w-5 h-5 text-amber-800" />
            阅读偏好设置
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="py-4 space-y-6">
          {/* Theme selection */}
          <div>
            <label className="text-xs font-semibold text-stone-500 uppercase tracking-wider block mb-2.5">
              阅读背景主题
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {themes.map((t) => (
                <button
                  key={t.id}
                  onClick={() => onUpdateSettings({ theme: t.id })}
                  style={{ backgroundColor: t.bg, color: t.text, borderColor: t.border }}
                  className={`h-14 rounded-xl border flex flex-col items-center justify-center relative transition-all text-xs font-medium shadow-sm ${
                    settings.theme === t.id
                      ? 'ring-2 ring-amber-700 ring-offset-2 scale-105'
                      : 'hover:opacity-90'
                  }`}
                >
                  <span>{t.label}</span>
                  {settings.theme === t.id && (
                    <span className="absolute top-1 right-1 w-3.5 h-3.5 rounded-full bg-amber-800 text-white flex items-center justify-center text-[9px]">
                      ✓
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Font size & Line height */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-semibold text-stone-500">字号大小</span>
                <span className="text-xs font-mono font-medium text-stone-700">{settings.fontSize}px</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onUpdateSettings({ fontSize: Math.max(14, settings.fontSize - 2) })}
                  className="w-9 h-9 rounded-lg border border-stone-200 flex items-center justify-center text-sm font-semibold hover:bg-stone-50"
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
                  className="flex-1 accent-amber-800"
                />
                <button
                  onClick={() => onUpdateSettings({ fontSize: Math.min(32, settings.fontSize + 2) })}
                  className="w-9 h-9 rounded-lg border border-stone-200 flex items-center justify-center text-sm font-semibold hover:bg-stone-50"
                >
                  A+
                </button>
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-semibold text-stone-500">行距行高</span>
                <span className="text-xs font-mono font-medium text-stone-700">{settings.lineHeight.toFixed(2)}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onUpdateSettings({ lineHeight: Math.max(1.4, Number((settings.lineHeight - 0.1).toFixed(2))) })}
                  className="w-9 h-9 rounded-lg border border-stone-200 flex items-center justify-center text-xs hover:bg-stone-50"
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
                  className="flex-1 accent-amber-800"
                />
                <button
                  onClick={() => onUpdateSettings({ lineHeight: Math.min(2.6, Number((settings.lineHeight + 0.1).toFixed(2))) })}
                  className="w-9 h-9 rounded-lg border border-stone-200 flex items-center justify-center text-xs hover:bg-stone-50"
                >
                  疏朗
                </button>
              </div>
            </div>
          </div>

          {/* Font family */}
          <div>
            <label className="text-xs font-semibold text-stone-500 uppercase tracking-wider block mb-2">
              排版字体
            </label>
            <div className="grid grid-cols-3 gap-2">
              {fonts.map((f) => (
                <button
                  key={f.id}
                  onClick={() => onUpdateSettings({ fontFamily: f.id })}
                  className={`py-2 px-3 rounded-lg border text-sm font-medium transition-all ${
                    settings.fontFamily === f.id
                      ? 'border-amber-800 bg-amber-50/80 text-amber-950 font-bold'
                      : 'border-stone-200 hover:bg-stone-50 text-stone-700'
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
              <span className="text-xs font-semibold text-stone-500">页面版心宽度</span>
              <span className="text-xs font-mono font-medium text-stone-700">{settings.maxWidth}px</span>
            </div>
            <input
              type="range"
              min="640"
              max="1100"
              step="20"
              value={settings.maxWidth}
              onChange={(e) => onUpdateSettings({ maxWidth: Number(e.target.value) })}
              className="w-full accent-amber-800"
            />
          </div>

          {/* Reading mode */}
          <div>
            <label className="text-xs font-semibold text-stone-500 uppercase tracking-wider block mb-2">
              阅读翻页体验
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => onUpdateSettings({ readingMode: 'scroll' })}
                className={`py-2 px-3 rounded-lg border text-sm font-medium transition-all ${
                  settings.readingMode === 'scroll'
                    ? 'border-amber-800 bg-amber-50/80 text-amber-950 font-bold'
                    : 'border-stone-200 hover:bg-stone-50 text-stone-700'
                }`}
              >
                📜 连续垂直滚动
              </button>
              <button
                onClick={() => onUpdateSettings({ readingMode: 'page' })}
                className={`py-2 px-3 rounded-lg border text-sm font-medium transition-all ${
                  settings.readingMode === 'page'
                    ? 'border-amber-800 bg-amber-50/80 text-amber-950 font-bold'
                    : 'border-stone-200 hover:bg-stone-50 text-stone-700'
                }`}
              >
                📖 章节分页翻阅
              </button>
            </div>
          </div>

          {/* Mirror selection if available */}
          {availableMirrors.length > 0 && (
            <div>
              <label className="text-xs font-semibold text-stone-500 uppercase tracking-wider block mb-2">
                当前站点镜像线路
              </label>
              <select
                value={settings.selectedMirror || ''}
                onChange={(e) => onUpdateSettings({ selectedMirror: e.target.value })}
                className="w-full py-2 px-3 rounded-lg border border-stone-200 text-sm bg-stone-50 text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-800"
              >
                <option value="">默认最优线路</option>
                {availableMirrors.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Toggle Next Chapter Auto Preload */}
          <div className="flex items-center justify-between pt-2 border-t border-stone-100">
            <div>
              <span className="text-sm font-medium text-stone-800 block">智能后台预加载下一章</span>
              <span className="text-xs text-stone-400">阅读时静默预加载，翻页秒开无停顿</span>
            </div>
            <input
              type="checkbox"
              checked={settings.autoPreloadNext}
              onChange={(e) => onUpdateSettings({ autoPreloadNext: e.target.checked })}
              className="w-5 h-5 rounded text-amber-800 accent-amber-800 cursor-pointer"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
