'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Header } from '@/components/Header';
import { SourceMeta } from '@/sources/types';
import { ArrowLeft, Server, ExternalLink, HardDrive, Activity, RefreshCw, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

interface CacheStats {
  entries: number;
  dbPath: string;
  maxEntries: number;
  ttlMs: number;
  enabled: boolean;
  diskBytes: number;
  payloadBytes: number;
}

interface PingResult {
  status: 'idle' | 'testing' | 'success' | 'error';
  latencyMs?: number;
  message?: string;
}

function formatBytes(bytes: number): string {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export default function SourcesPage() {
  const [sources, setSources] = useState<SourceMeta[]>([]);
  const [stats, setStats] = useState<CacheStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [pingResults, setPingResults] = useState<Record<string, PingResult>>({});
  const [isPingingAll, setIsPingingAll] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch('/api/sources')
        .then((res) => res.json())
        .catch(() => null),
      fetch('/api/cache/stats')
        .then((res) => res.json())
        .catch(() => null),
    ])
      .then(([sourcesData, statsData]) => {
        if (sourcesData?.success && Array.isArray(sourcesData.data)) {
          setSources(sourcesData.data);
        }
        if (statsData?.success && statsData.data) {
          setStats(statsData.data as CacheStats);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const pingSource = async (sourceId: string) => {
    setPingResults((prev) => ({
      ...prev,
      [sourceId]: { status: 'testing' },
    }));

    const t0 = performance.now();
    try {
      const res = await fetch(`/api/search?keyword=天下&source=${sourceId}`);
      const data = await res.json();
      const latency = Math.round(performance.now() - t0);

      if (data.success) {
        setPingResults((prev) => ({
          ...prev,
          [sourceId]: {
            status: 'success',
            latencyMs: latency,
            message: `响应正常 (${latency}ms)`,
          },
        }));
      } else {
        setPingResults((prev) => ({
          ...prev,
          [sourceId]: {
            status: 'error',
            latencyMs: latency,
            message: data.error || '源站接口异常',
          },
        }));
      }
    } catch (err: any) {
      const latency = Math.round(performance.now() - t0);
      setPingResults((prev) => ({
        ...prev,
        [sourceId]: {
          status: 'error',
          latencyMs: latency,
          message: err.message || '连接超时',
        },
      }));
    }
  };

  const pingAllSources = async () => {
    if (sources.length === 0 || isPingingAll) return;
    setIsPingingAll(true);
    await Promise.all(sources.map((s) => pingSource(s.id)));
    setIsPingingAll(false);
  };

  return (
    <div className="min-h-screen flex flex-col transition-colors duration-200">
      <Header />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8 space-y-8">
        {/* Back navigation */}
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-mono text-zinc-500 hover:text-black transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            返回首页
          </Link>
          <span className="text-zinc-300">·</span>
          <Link
            href="/bookshelf"
            className="text-xs font-mono text-zinc-500 hover:text-black transition-colors"
          >
            前往书架
          </Link>
        </div>

        {/* Page Header */}
        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-bold text-zinc-950 flex items-center gap-2.5">
            <Server className="w-7 h-7 text-black" />
            书源与缓存状态
          </h1>
          <p className="text-xs text-zinc-500 font-mono">站点源信息 · 接口测速 · 章节中转缓存用量</p>
        </div>

        {loading ? (
          <div className="py-20 text-center">
            <div className="w-8 h-8 mx-auto border-2 border-black border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-xs text-zinc-500 font-mono">正在读取书源与缓存状态...</p>
          </div>
        ) : (
          <>
            {/* Sources */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-semibold text-zinc-500 font-mono">
                  已注册书源（共 {sources.length} 个）
                </h2>
                {sources.length > 0 && (
                  <button
                    type="button"
                    onClick={pingAllSources}
                    disabled={isPingingAll}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-mono transition-colors disabled:opacity-50"
                  >
                    {isPingingAll ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-600" />
                    ) : (
                      <Activity className="w-3.5 h-3.5 text-zinc-600" />
                    )}
                    <span>一键测速全部</span>
                  </button>
                )}
              </div>

              {sources.map((source) => {
                const ping = pingResults[source.id];
                return (
                  <div
                    key={source.id}
                    className="bg-white rounded-xl p-6 border border-zinc-200 shadow-sm space-y-4"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-base font-bold text-zinc-950">{source.name}</h3>
                          <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-black text-white font-medium">
                            启用中
                          </span>
                          <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-zinc-100 text-zinc-600 border border-zinc-200">
                            v{source.version}
                          </span>

                          {/* Ping Speed Badge */}
                          {ping?.status === 'testing' && (
                            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-zinc-100 text-zinc-700 border border-zinc-200 flex items-center gap-1">
                              <Loader2 className="w-3 h-3 animate-spin" />
                              <span>测速中...</span>
                            </span>
                          )}
                          {ping?.status === 'success' && (
                            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>{ping.latencyMs}ms 畅通</span>
                            </span>
                          )}
                          {ping?.status === 'error' && (
                            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-red-50 text-red-700 border border-red-200 flex items-center gap-1" title={ping.message}>
                              <AlertCircle className="w-3 h-3 text-red-600" />
                              <span>受限 / 异常</span>
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-zinc-500 mt-1.5">{source.description}</p>
                        <p className="text-[11px] text-zinc-400 font-mono mt-1.5 break-all">
                          {source.baseUrl}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => pingSource(source.id)}
                          disabled={ping?.status === 'testing'}
                          className="px-3 py-1.5 rounded-lg border border-zinc-200 hover:bg-zinc-50 text-zinc-800 text-xs font-mono flex items-center gap-1.5 transition-colors disabled:opacity-50"
                          title="测试此书源的连通性和响应耗时"
                        >
                          {ping?.status === 'testing' ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Activity className="w-3.5 h-3.5 text-zinc-500" />
                          )}
                          <span>测速</span>
                        </button>

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
                      </div>
                    </div>
                  </div>
                );
              })}
              {sources.length === 0 && (
                <div className="bg-white rounded-xl p-6 border border-zinc-200 text-xs text-zinc-500">
                  没有已注册的书源。往 <code className="font-mono">src/sources/plugins/</code>{' '}
                  添加一个插件文件并重新构建即可。
                </div>
              )}
            </section>

            {/* Chapter cache */}
            <section className="space-y-3">
              <h2 className="text-xs font-semibold text-zinc-500 font-mono">本地书库与章节缓存</h2>
              <div className="bg-white rounded-xl p-6 border border-zinc-200 shadow-sm">
                {!stats?.enabled ? (
                  <div className="flex items-start gap-2.5 text-xs text-zinc-500">
                    <HardDrive className="w-4 h-4 text-zinc-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-zinc-700">缓存未启用</p>
                      <p className="mt-1 leading-relaxed">
                        缓存目录不可写。详见服务端启动日志。
                      </p>
                    </div>
                  </div>
                ) : (
                  <dl className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                    <div>
                      <dt className="text-[11px] font-mono text-zinc-400">已缓存章节</dt>
                      <dd className="text-lg font-bold text-zinc-950 font-mono mt-0.5">
                        {stats.entries.toLocaleString()}
                        <span className="text-xs font-normal text-zinc-400">
                          {stats.maxEntries > 0 ? ` / ${stats.maxEntries.toLocaleString()}` : ' （永久保存）'}
                        </span>
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px] font-mono text-zinc-400">磁盘占用</dt>
                      <dd className="text-lg font-bold text-zinc-950 font-mono mt-0.5">
                        {formatBytes(stats.diskBytes)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px] font-mono text-zinc-400">有效期</dt>
                      <dd className="text-lg font-bold text-zinc-950 font-mono mt-0.5">
                        {stats.ttlMs > 0 ? `${Math.round(stats.ttlMs / 86400000)} 天` : '永久保存'}
                      </dd>
                    </div>
                  </dl>
                )}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
