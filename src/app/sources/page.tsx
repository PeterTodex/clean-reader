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
  ExternalLink,
  Plus,
  RefreshCw,
  Sparkles,
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
    <div className="min-h-screen flex flex-col bg-[#fafafa]">
      <Header />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8 space-y-8">
        {/* Back navigation */}
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-mono text-zinc-500 hover:text-black transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          BACK TO BOOKSHELF
        </Link>

        {/* Page Header */}
        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-bold text-zinc-950 flex items-center gap-2.5">
            <Server className="w-7 h-7 text-black" />
            书籍站点源与节点管理
          </h1>
          <p className="text-xs text-zinc-500 font-mono">
            MULTI-SOURCE ENGINE · LATENCY MONITORING · CUSTOM ROUTING
          </p>
        </div>

        {/* Sources Cards */}
        {sources.map((source) => (
          <div
            key={source.id}
            className="bg-white rounded-xl p-6 sm:p-8 border border-zinc-200 shadow-sm space-y-6"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-100 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-zinc-950">{source.name}</h2>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-black text-white font-medium">
                    ACTIVE
                  </span>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-zinc-100 text-zinc-600 border border-zinc-200">
                    v{source.version}
                  </span>
                </div>
                <p className="text-xs text-zinc-500 mt-1">{source.description}</p>
              </div>

              <div className="flex items-center gap-2">
                {source.publishUrl && (
                  <a
                    href={source.publishUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 rounded-lg border border-zinc-300 hover:bg-zinc-50 text-zinc-800 text-xs font-medium flex items-center gap-1.5 transition-colors font-mono"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-zinc-500" />
                    发布页
                  </a>
                )}

                <button
                  onClick={testAllMirrors}
                  disabled={isTestingAll}
                  className="px-3.5 py-1.5 rounded-lg bg-black text-white hover:bg-zinc-800 text-xs font-medium flex items-center gap-1.5 transition-colors shadow-sm disabled:opacity-60 font-mono"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isTestingAll ? 'animate-spin' : ''}`} />
                  PING ALL
                </button>
              </div>
            </div>

            {/* Mirror List */}
            {source.mirrors && source.mirrors.length > 0 && (
              <div className="space-y-3">
                <label className="text-xs font-mono font-semibold text-zinc-500 uppercase tracking-wider block">
                  MIRROR NODES / 备用节点（点击切换首选线路）
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {source.mirrors.map((mirror) => {
                    const isSelected = selectedMirror === mirror || (!selectedMirror && mirror === source.defaultMirror);
                    const pingInfo = latencies[mirror];

                    return (
                      <div
                        key={mirror}
                        onClick={() => handleSelectMirror(mirror)}
                        className={`p-3 rounded-lg border flex items-center justify-between cursor-pointer transition-all ${
                          isSelected
                            ? 'border-black bg-zinc-100 shadow-sm'
                            : 'border-zinc-200 hover:border-zinc-400 hover:bg-zinc-50'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0 ${
                              isSelected ? 'border-black bg-black text-white' : 'border-zinc-300'
                            }`}
                          >
                            {isSelected && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-mono font-medium text-zinc-900 truncate">
                              {mirror}
                            </div>
                            {isSelected && (
                              <div className="text-[10px] text-zinc-950 font-mono font-bold mt-0.5">
                                PREFERRED NODE
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0 font-mono">
                          {pingInfo ? (
                            pingInfo.status === 'testing' ? (
                              <span className="text-[11px] text-zinc-400 animate-pulse">PING...</span>
                            ) : pingInfo.status === 'success' ? (
                              <span
                                className={`text-[11px] px-2 py-0.5 rounded font-mono font-medium ${
                                  pingInfo.latency < 400
                                    ? 'bg-zinc-200 text-zinc-950'
                                    : pingInfo.latency < 900
                                    ? 'bg-zinc-200 text-zinc-800'
                                    : 'bg-zinc-200 text-zinc-700'
                                }`}
                              >
                                {pingInfo.latency}ms
                              </span>
                            ) : (
                              <span className="text-[11px] px-2 py-0.5 rounded bg-red-100 text-red-700">
                                TIMEOUT
                              </span>
                            )
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                testMirror(mirror);
                              }}
                              className="text-zinc-400 hover:text-black p-1 text-xs"
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
            )}

            {/* Custom Mirror Input */}
            <form onSubmit={handleAddCustomMirror} className="pt-2 border-t border-zinc-100">
              <label className="text-xs font-semibold text-zinc-600 block mb-2">
                手动添加自定义备用域名 / 镜像
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="https://m.custom-domain.com"
                  value={customMirrorInput}
                  onChange={(e) => setCustomMirrorInput(e.target.value)}
                  className="flex-1 px-3 py-2 text-xs bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-black font-mono text-zinc-900"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-black hover:bg-zinc-800 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors font-mono"
                >
                  <Plus className="w-3.5 h-3.5" />
                  ADD NODE
                </button>
              </div>
            </form>
          </div>
        ))}

        {/* Extensibility & Custom Source Guide */}
        <div className="bg-zinc-100 rounded-xl p-6 border border-zinc-200 space-y-3 font-mono text-xs">
          <h3 className="font-bold text-zinc-950 text-xs flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-black" />
            RULE ENGINE EXTENSION / 规则引擎扩展
          </h3>
          <p className="text-zinc-600 leading-relaxed">
            本项目已全面支持规则驱动书源引擎（`RuleBasedSource`），可无缝接入其它小说源或导入阅读 3.0 格式规则。
          </p>
        </div>
      </main>
    </div>
  );
}
