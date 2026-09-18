'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Header } from '@/components/Header';
import { SourceMeta } from '@/sources/types';
import { storage } from '@/lib/storage';
import {
  ArrowLeft,
  Server,
  Zap,
  CheckCircle2,
  ExternalLink,
  Plus,
  Radio,
  RefreshCw,
  Sliders,
  Sparkles,
  ShieldCheck,
} from 'lucide-react';

interface MirrorLatency {
  mirror: string;
  latency: number;
  status: 'testing' | 'success' | 'failed';
}

export default function SourcesPage() {
  const [sources, setSources] = useState<SourceMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [latencies, setLatencies] = useState<Record<string, MirrorLatency>>({});
  const [isTestingAll, setIsTestingAll] = useState(false);
  const [selectedMirror, setSelectedMirror] = useState<string>('');
  const [customMirrorInput, setCustomMirrorInput] = useState('');

  useEffect(() => {
    const settings = storage.getSettings();
    setSelectedMirror(settings.selectedMirror || '');

    fetch('/api/sources')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.data) {
          setSources(data.data);
        }
      })
      .catch((e) => console.error(e))
      .finally(() => setLoading(false));
  }, []);

  const testMirror = async (mirrorUrl: string) => {
    setLatencies((prev) => ({
      ...prev,
      [mirrorUrl]: { mirror: mirrorUrl, latency: 0, status: 'testing' },
    }));

    try {
      const res = await fetch('/api/sources/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mirror: mirrorUrl }),
      });
      const data = await res.json();
      if (data.success && data.available) {
        setLatencies((prev) => ({
          ...prev,
          [mirrorUrl]: { mirror: mirrorUrl, latency: data.latency, status: 'success' },
        }));
      } else {
        setLatencies((prev) => ({
          ...prev,
          [mirrorUrl]: { mirror: mirrorUrl, latency: -1, status: 'failed' },
        }));
      }
    } catch {
      setLatencies((prev) => ({
        ...prev,
        [mirrorUrl]: { mirror: mirrorUrl, latency: -1, status: 'failed' },
      }));
    }
  };

  const testAllMirrors = async () => {
    const diyibanzhu = sources.find((s) => s.id === 'diyibanzhu');
    if (!diyibanzhu || !diyibanzhu.mirrors) return;

    setIsTestingAll(true);
    const promises = diyibanzhu.mirrors.map((m) => testMirror(m));
    await Promise.all(promises);
    setIsTestingAll(false);
  };

  const handleSelectMirror = (mirror: string) => {
    setSelectedMirror(mirror);
    storage.saveSettings({ selectedMirror: mirror });
  };

  const handleAddCustomMirror = (e: React.FormEvent) => {
    e.preventDefault();
    let url = customMirrorInput.trim();
    if (!url) return;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = `https://${url}`;
    }
    url = url.replace(/\/$/, '');

    setSources((prev) =>
      prev.map((s) =>
        s.id === 'diyibanzhu'
          ? { ...s, mirrors: s.mirrors.includes(url) ? s.mirrors : [url, ...s.mirrors] }
          : s
      )
    );
    handleSelectMirror(url);
    testMirror(url);
    setCustomMirrorInput('');
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#faf8f5]">
      <Header />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8 space-y-8">
        {/* Back navigation */}
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-stone-500 hover:text-stone-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          返回书架
        </Link>

        {/* Page Header */}
        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-serif font-bold text-stone-900 flex items-center gap-2.5">
            <Server className="w-7 h-7 text-amber-800" />
            书籍站点源与防屏蔽管理
          </h1>
          <p className="text-sm text-stone-500">
            第一版主等站点因网络变动常更换域名。清阅内置官方发布页多线路探测、测速切换与自定义扩展能力。
          </p>
        </div>

        {/* Diyibanzhu Source Card */}
        {sources.map((source) => (
          <div
            key={source.id}
            className="bg-white rounded-2xl p-6 sm:p-8 border border-stone-200/80 shadow-sm space-y-6"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-100 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-stone-900">{source.name}</h2>
                  <span className="text-xs px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-medium">
                    已启用
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded bg-stone-100 text-stone-500">
                    v{source.version}
                  </span>
                </div>
                <p className="text-xs text-stone-500 mt-1">{source.description}</p>
              </div>

              <div className="flex items-center gap-2">
                {source.publishUrl && (
                  <a
                    href={source.publishUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 rounded-lg border border-stone-200 hover:bg-stone-50 text-stone-700 text-xs font-medium flex items-center gap-1.5 transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-stone-400" />
                    官方发布页
                  </a>
                )}

                <button
                  onClick={testAllMirrors}
                  disabled={isTestingAll}
                  className="px-3.5 py-1.5 rounded-lg bg-amber-800 text-white hover:bg-amber-900 text-xs font-medium flex items-center gap-1.5 transition-colors shadow-sm disabled:opacity-60"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isTestingAll ? 'animate-spin' : ''}`} />
                  全线路测速
                </button>
              </div>
            </div>

            {/* Mirror List */}
            <div className="space-y-3">
              <label className="text-xs font-semibold text-stone-500 uppercase tracking-wider block">
                备用镜像节点列表（点击即可切换为当前阅读优先线路）
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {source.mirrors.map((mirror) => {
                  const isSelected = selectedMirror === mirror || (!selectedMirror && mirror === source.defaultMirror);
                  const pingInfo = latencies[mirror];

                  return (
                    <div
                      key={mirror}
                      onClick={() => handleSelectMirror(mirror)}
                      className={`p-3.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                        isSelected
                          ? 'border-amber-800 bg-amber-50/70 shadow-sm'
                          : 'border-stone-200/80 hover:border-stone-300 hover:bg-stone-50'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0 ${
                            isSelected ? 'border-amber-800 bg-amber-800 text-white' : 'border-stone-300'
                          }`}
                        >
                          {isSelected && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-mono font-medium text-stone-800 truncate">
                            {mirror}
                          </div>
                          {isSelected && (
                            <div className="text-[11px] text-amber-800 font-semibold mt-0.5">
                              首选阅读线路
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        {pingInfo ? (
                          pingInfo.status === 'testing' ? (
                            <span className="text-[11px] text-stone-400 animate-pulse">测速中...</span>
                          ) : pingInfo.status === 'success' ? (
                            <span
                              className={`text-[11px] px-2 py-0.5 rounded font-mono font-medium ${
                                pingInfo.latency < 400
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : pingInfo.latency < 900
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {pingInfo.latency}ms
                            </span>
                          ) : (
                            <span className="text-[11px] px-2 py-0.5 rounded bg-red-100 text-red-700">
                              超时
                            </span>
                          )
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              testMirror(mirror);
                            }}
                            className="text-stone-400 hover:text-stone-700 p-1 text-xs"
                            title="单独测速"
                          >
                            <Zap className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Custom Mirror Input */}
            <form onSubmit={handleAddCustomMirror} className="pt-2 border-t border-stone-100">
              <label className="text-xs font-semibold text-stone-500 block mb-2">
                手动添加自定义备用域名 / 镜像
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="https://m.custom-domain.com"
                  value={customMirrorInput}
                  onChange={(e) => setCustomMirrorInput(e.target.value)}
                  className="flex-1 px-3 py-2 text-xs bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-800"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-stone-800 hover:bg-stone-900 text-white rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  添加线路
                </button>
              </div>
            </form>
          </div>
        ))}

        {/* Extensibility & Custom Source Guide */}
        <div className="bg-stone-100/60 rounded-2xl p-6 border border-stone-200/80 space-y-3">
          <h3 className="font-serif font-bold text-stone-900 text-sm flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-800" />
            后续扩展新书源指南 (Architecture Extensibility)
          </h3>
          <p className="text-xs text-stone-600 leading-relaxed">
            本项目采用模块化插件架构（`src/sources/`）。若需新增其它站点（如 69书吧、笔趣阁或自建站），只需在 <code className="bg-stone-200 px-1 py-0.5 rounded text-amber-900">src/sources/</code> 目录下实现 <code className="bg-stone-200 px-1 py-0.5 rounded text-amber-900">BookSource</code> 接口中的 <code className="bg-stone-200 px-1 py-0.5 rounded text-amber-900">search</code>、<code className="bg-stone-200 px-1 py-0.5 rounded text-amber-900">getDetail</code> 和 <code className="bg-stone-200 px-1 py-0.5 rounded text-amber-900">getChapter</code> 方法，并在 <code className="bg-stone-200 px-1 py-0.5 rounded text-amber-900">sourceRegistry</code> 中注册即可无缝切换！
          </p>
        </div>
      </main>
    </div>
  );
}
