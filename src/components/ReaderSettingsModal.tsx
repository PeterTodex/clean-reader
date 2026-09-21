'use client';

import React from 'react';
import { ReaderSettings } from '@/lib/storage';
import { THEMES } from '@/lib/theme';
import { Type, Headphones } from 'lucide-react';
import { Modal } from './Modal';

interface ReaderSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: ReaderSettings;
  onUpdateSettings: (newSettings: Partial<ReaderSettings>) => void;
  onToggleTts?: () => void;
  isTtsActive?: boolean;
}

export const ReaderSettingsModal: React.FC<ReaderSettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  onToggleTts,
  isTtsActive = false,
}) => {
  const fonts: { id: ReaderSettings['fontFamily']; label: string }[] = [
    { id: 'serif', label: '衬线宋体' },
    { id: 'sans', label: '现代黑体' },
    { id: 'kaiti', label: '典雅楷体' },
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="阅读偏好设置"
      icon={<Type className="w-5 h-5" />}
      maxWidth="lg"
      position="responsive-bottom"
    >
      <div className="p-5 sm:p-6 space-y-6">
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
                className={`h-14 rounded-lg border flex flex-col items-center justify-center relative transition-all text-xs ${
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
            <input
              type="range"
              min="14"
              max="32"
              step="1"
              value={settings.fontSize}
              onChange={(e) => onUpdateSettings({ fontSize: Number(e.target.value) })}
              className="w-full accent-zinc-900 dark:accent-zinc-100"
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">行距行高</span>
              <span className="text-xs font-mono font-semibold text-zinc-800 dark:text-zinc-200">{settings.lineHeight.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="1.3"
              max="2.5"
              step="0.05"
              value={settings.lineHeight}
              onChange={(e) => onUpdateSettings({ lineHeight: Number(e.target.value) })}
              className="w-full accent-zinc-900 dark:accent-zinc-100"
            />
          </div>
        </div>

        {/* Font family */}
        <div>
          <label className="text-xs font-mono font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block mb-2.5">
            字体家族
          </label>
          <div className="grid grid-cols-3 gap-2">
            {fonts.map((f) => (
              <button
                key={f.id}
                onClick={() => onUpdateSettings({ fontFamily: f.id })}
                className={`py-2 px-3 rounded-lg border text-xs font-medium transition-all ${
                  settings.fontFamily === f.id
                    ? 'border-zinc-900 dark:border-zinc-100 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-bold'
                    : 'border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:border-zinc-400'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Auto preload next toggle */}
        <div className="flex items-center justify-between pt-2 border-t border-zinc-100 dark:border-zinc-800">
          <div>
            <div className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">自动预载下一章</div>
            <div className="text-[11px] text-zinc-400 font-mono">阅读接近尾声时自动拉取并解析下一章</div>
          </div>
          <button
            role="switch"
            aria-checked={Boolean(settings.autoPreloadNext)}
            aria-label="自动预载下一章"
            onClick={() => onUpdateSettings({ autoPreloadNext: !settings.autoPreloadNext })}
            className={`w-11 h-6 rounded-full transition-colors relative ${
              settings.autoPreloadNext ? 'bg-zinc-900 dark:bg-zinc-100' : 'bg-zinc-300 dark:bg-zinc-700'
            }`}
          >
            <span
              className={`block w-4 h-4 rounded-full bg-white dark:bg-zinc-900 transition-transform absolute top-1 ${
                settings.autoPreloadNext ? 'left-6' : 'left-1'
              }`}
            />
          </button>
        </div>

        {/* TTS Voice Reading Section */}
        {onToggleTts && (
          <div className="flex items-center justify-between pt-3 border-t border-zinc-100 dark:border-zinc-800">
            <div>
              <div className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                <Headphones className="w-3.5 h-3.5 text-zinc-700 dark:text-zinc-300" />
                <span>语音朗读（听书）</span>
              </div>
              <div className="text-[11px] text-zinc-400 font-mono">
                {isTtsActive ? '听书面板已开启，可在浮层控制播放' : '使用浏览器语音合成逐段朗读当前章节'}
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                onToggleTts();
                onClose();
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 shrink-0 ${
                isTtsActive
                  ? 'bg-zinc-100 hover:bg-zinc-200 text-zinc-800 border border-zinc-300 dark:bg-zinc-800 dark:text-zinc-200 dark:border-zinc-700'
                  : 'bg-black text-white hover:bg-zinc-800'
              }`}
            >
              <Headphones className="w-3.5 h-3.5" />
              <span>{isTtsActive ? '关闭听书' : '开启听书'}</span>
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
};
