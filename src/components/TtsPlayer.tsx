'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Play,
  Pause,
  Square,
  SkipBack,
  SkipForward,
  Volume2,
  X,
  Gauge,
  Headphones,
  AlertCircle,
} from 'lucide-react';
import { stripHtml } from '@/lib/utils';

interface TtsPlayerProps {
  paragraphs: string[];
  chapterTitle: string;
  chapterId: string;
  nextChapterId: string | null;
  onNextChapter: () => void;
  onClose: () => void;
  currentParagraphIndex: number;
  onParagraphChange: (index: number) => void;
}


export const TtsPlayer: React.FC<TtsPlayerProps> = ({
  paragraphs,
  chapterTitle,
  chapterId,
  nextChapterId,
  onNextChapter,
  onClose,
  currentParagraphIndex,
  onParagraphChange,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [rate, setRate] = useState(1.0);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState<string>('');
  const [isSupported, setIsSupported] = useState(true);

  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const isPlayingRef = useRef(false);
  const isPausedRef = useRef(false);
  const rateRef = useRef(rate);
  const selectedVoiceURIRef = useRef(selectedVoiceURI);
  const currentParaIndexRef = useRef(currentParagraphIndex);
  const paragraphsRef = useRef(paragraphs);
  const nextChapterIdRef = useRef(nextChapterId);
  const chapterIdRef = useRef(chapterId);

  // Keep refs in sync
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  useEffect(() => {
    rateRef.current = rate;
  }, [rate]);

  useEffect(() => {
    selectedVoiceURIRef.current = selectedVoiceURI;
  }, [selectedVoiceURI]);

  useEffect(() => {
    currentParaIndexRef.current = currentParagraphIndex;
  }, [currentParagraphIndex]);

  useEffect(() => {
    paragraphsRef.current = paragraphs;
  }, [paragraphs]);

  useEffect(() => {
    nextChapterIdRef.current = nextChapterId;
  }, [nextChapterId]);

  useEffect(() => {
    chapterIdRef.current = chapterId;
  }, [chapterId]);

  // Check browser speech synthesis support & load voices
  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) {
      setIsSupported(false);
      return;
    }

    const loadVoices = () => {
      const allVoices = window.speechSynthesis.getVoices();
      if (!allVoices || allVoices.length === 0) return;

      // Filter Chinese voices or provide all voices if none found
      const zhVoices = allVoices.filter(
        (v) =>
          v.lang.toLowerCase().includes('zh') ||
          v.lang.toLowerCase().includes('cmn') ||
          v.name.includes('Chinese') ||
          v.name.includes('中文') ||
          v.name.includes('Mandarin')
      );

      const availableVoices = zhVoices.length > 0 ? zhVoices : allVoices;
      setVoices(availableVoices);

      // Auto pick best Chinese voice
      setSelectedVoiceURI((current) => {
        if (current && availableVoices.some((v) => v.voiceURI === current)) {
          return current;
        }
        const preferred =
          zhVoices.find((v) => v.lang === 'zh-CN' || v.lang === 'zh_CN') ||
          zhVoices[0] ||
          availableVoices[0];
        return preferred ? preferred.voiceURI : '';
      });
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;

    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, []);

  // Stop synthesis on unmount
  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Core speak paragraph logic
  const speakCurrentIndex = useCallback(
    (index: number) => {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
      window.speechSynthesis.cancel();

      const paras = paragraphsRef.current;
      if (index >= paras.length) {
        // Reached the end of current chapter
        if (nextChapterIdRef.current) {
          onNextChapter();
          // We stay in isPlaying=true state, the chapterId effect will continue playback
        } else {
          setIsPlaying(false);
          setIsPaused(false);
        }
        return;
      }

      const text = stripHtml(paras[index]);
      if (!text) {
        // Empty paragraph, skip to next
        const next = index + 1;
        onParagraphChange(next);
        speakCurrentIndex(next);
        return;
      }

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = rateRef.current;

      const voice = voices.find((v) => v.voiceURI === selectedVoiceURIRef.current);
      if (voice) {
        utterance.voice = voice;
        utterance.lang = voice.lang;
      } else {
        utterance.lang = 'zh-CN';
      }

      utterance.onend = () => {
        if (!isPlayingRef.current || isPausedRef.current) return;
        const nextIdx = index + 1;
        if (nextIdx < paragraphsRef.current.length) {
          onParagraphChange(nextIdx);
          speakCurrentIndex(nextIdx);
        } else {
          // Reached end of current chapter
          if (nextChapterIdRef.current) {
            onNextChapter();
          } else {
            setIsPlaying(false);
            setIsPaused(false);
          }
        }
      };

      utterance.onerror = (event) => {
        if (event.error !== 'interrupted' && event.error !== 'canceled') {
          console.warn('Speech synthesis error:', event.error);
        }
      };

      utteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    },
    [onNextChapter, onParagraphChange, voices]
  );

  // Auto-play next chapter when chapterId changes and was playing
  const prevChapterId = useRef(chapterId);
  useEffect(() => {
    if (prevChapterId.current !== chapterId) {
      prevChapterId.current = chapterId;
      onParagraphChange(0);
      if (isPlayingRef.current && !isPausedRef.current) {
        const timer = setTimeout(() => {
          speakCurrentIndex(0);
        }, 300);
        return () => clearTimeout(timer);
      }
    }
  }, [chapterId, onParagraphChange, speakCurrentIndex]);

  // Controls
  const handlePlay = () => {
    if (isPaused) {
      setIsPaused(false);
      window.speechSynthesis.resume();
      if (!window.speechSynthesis.speaking) {
        speakCurrentIndex(currentParagraphIndex);
      }
    } else {
      setIsPlaying(true);
      setIsPaused(false);
      speakCurrentIndex(currentParagraphIndex);
    }
  };

  const handlePause = () => {
    setIsPaused(true);
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.pause();
    }
  };

  const handleStop = () => {
    setIsPlaying(false);
    setIsPaused(false);
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  };

  const handlePrevParagraph = () => {
    const prev = Math.max(0, currentParagraphIndex - 1);
    onParagraphChange(prev);
    if (isPlaying && !isPaused) {
      speakCurrentIndex(prev);
    }
  };

  const handleNextParagraph = () => {
    if (currentParagraphIndex + 1 < paragraphs.length) {
      const next = currentParagraphIndex + 1;
      onParagraphChange(next);
      if (isPlaying && !isPaused) {
        speakCurrentIndex(next);
      }
    } else if (nextChapterId) {
      onNextChapter();
    }
  };

  const handleRateChange = (newRate: number) => {
    setRate(newRate);
    rateRef.current = newRate;
    if (isPlaying && !isPaused) {
      speakCurrentIndex(currentParagraphIndex);
    }
  };

  const handleVoiceChange = (uri: string) => {
    setSelectedVoiceURI(uri);
    selectedVoiceURIRef.current = uri;
    if (isPlaying && !isPaused) {
      speakCurrentIndex(currentParagraphIndex);
    }
  };

  const handleClose = () => {
    handleStop();
    onClose();
  };

  if (!isSupported) {
    return (
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[95%] max-w-lg bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border border-zinc-300 dark:border-zinc-700 shadow-2xl rounded-xl p-4 flex items-center justify-between gap-3 text-zinc-900 dark:text-zinc-100">
        <div className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>当前浏览器暂不支持 Web Speech 语音朗读，请使用 Chrome 或 Edge 浏览器</span>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    );
  }

  const currentSnippet = stripHtml(paragraphs[currentParagraphIndex] || '');

  return (
    <div className="fixed bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 z-50 w-[96%] max-w-2xl bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border border-zinc-200 dark:border-zinc-800 shadow-2xl rounded-xl p-3.5 sm:p-4 text-zinc-900 dark:text-zinc-100 transition-all select-none">
      {/* Top Header / Status */}
      <div className="flex items-center justify-between gap-3 pb-2.5 border-b border-zinc-100 dark:border-zinc-800 text-xs">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-black text-white font-mono text-[11px] font-medium flex-shrink-0">
            <Headphones className={`w-3.5 h-3.5 ${isPlaying && !isPaused ? 'animate-pulse text-white' : ''}`} />
            <span>听书</span>
          </div>
          <span className="font-semibold truncate text-stone-700 dark:text-stone-200">
            {chapterTitle}
          </span>
          <span className="text-stone-400 dark:text-stone-500 flex-shrink-0 font-mono">
            {paragraphs.length > 0 ? `${currentParagraphIndex + 1}/${paragraphs.length}段` : ''}
          </span>
        </div>

        <button
          onClick={handleClose}
          className="p-1 rounded-lg text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors flex-shrink-0"
          title="退出听书"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Subtext Snippet */}
      {currentSnippet && (
        <div className="py-2 text-xs text-stone-500 dark:text-stone-400 line-clamp-1 italic px-1">
          “{currentSnippet}”
        </div>
      )}

      {/* Bottom Main Controls */}
      <div className="pt-2 flex flex-wrap sm:flex-nowrap items-center justify-between gap-3">
        {/* Playback action buttons */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            onClick={handlePrevParagraph}
            disabled={currentParagraphIndex === 0}
            className="p-2 rounded-xl text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            title="上一段"
          >
            <SkipBack className="w-4 h-4" />
          </button>

          {isPlaying && !isPaused ? (
            <button
              onClick={handlePause}
              className="p-2.5 rounded-full bg-black text-white hover:bg-zinc-800 transition-transform active:scale-95 shadow-md"
              title="暂停朗读"
            >
              <Pause className="w-5 h-5 fill-current" />
            </button>
          ) : (
            <button
              onClick={handlePlay}
              className="p-2.5 rounded-full bg-black text-white hover:bg-zinc-800 transition-transform active:scale-95 shadow-md"
              title="开始朗读"
            >
              <Play className="w-5 h-5 fill-current ml-0.5" />
            </button>
          )}

          <button
            onClick={handleStop}
            className="p-2 rounded-xl text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
            title="停止"
          >
            <Square className="w-4 h-4" />
          </button>

          <button
            onClick={handleNextParagraph}
            disabled={currentParagraphIndex + 1 >= paragraphs.length && !nextChapterId}
            className="p-2 rounded-xl text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            title="下一段"
          >
            <SkipForward className="w-4 h-4" />
          </button>
        </div>

        {/* Speed Slider & Voice Selector */}
        <div className="flex items-center gap-3 ml-auto w-full sm:w-auto justify-between sm:justify-end">
          {/* Rate / Speed */}
          <div className="flex items-center gap-1.5">
            <Gauge className="w-3.5 h-3.5 text-stone-400 flex-shrink-0" />
            <span className="text-[11px] font-mono font-medium text-stone-600 dark:text-stone-300 w-8">
              {rate.toFixed(2)}x
            </span>
            <input
              type="range"
              min="0.75"
              max="2.0"
              step="0.25"
              value={rate}
              onChange={(e) => handleRateChange(parseFloat(e.target.value))}
              className="w-16 sm:w-20 accent-black cursor-pointer h-1.5"
              title={`语速: ${rate.toFixed(2)}x`}
            />
          </div>

          {/* Voice selector */}
          {voices.length > 0 && (
            <div className="flex items-center gap-1.5">
              <Volume2 className="w-3.5 h-3.5 text-stone-400 flex-shrink-0" />
              <select
                value={selectedVoiceURI}
                onChange={(e) => handleVoiceChange(e.target.value)}
                className="text-xs py-1 px-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 max-w-[130px] sm:max-w-[150px] truncate focus:outline-none focus:ring-1 focus:ring-zinc-400 focus:border-zinc-400"
              >
                {voices.map((v) => (
                  <option key={v.voiceURI} value={v.voiceURI}>
                    {v.name.replace(/(Google|Microsoft|Apple|Online \(Natural\))\s*/g, '')}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
