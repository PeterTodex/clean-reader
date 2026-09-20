'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Header } from '@/components/Header';
import { SourceMeta } from '@/sources/types';
import { ArrowLeft, Server, ExternalLink, HardDrive } from 'lucide-react';

interface CacheStats {
  entries: number;
  dbPath: string;
  maxEntries: number;
  ttlMs: number;
  enabled: boolean;
  diskBytes: number;
  payloadBytes: number;
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

  return (
    <div className="min-h-screen flex flex-col transition-colors duration-200">
      <Header />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8 space-y-8">
        {/* Back navigation */}
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-mono text-zinc-500 hover:text-black transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          返回书架
        </Link>

        {/* Page Header */}
        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-bold text-zinc-950 flex items-center gap-2.5">
            <Server className="w-7 h-7 text-black" />
            书源与缓存状态
          </h1>
          <p className="text-xs text-zinc-500 font-mono">站点源信息 · 章节中转缓存用量</p>
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
              <h2 className="text-xs font-semibold text-zinc-500 font-mono">已注册书源</h2>
              {sources.map((source) => (
                <div
                  key={source.id}
                  className="bg-white rounded-xl p-6 border border-zinc-200 shadow-sm space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-base font-bold text-zinc-950">{source.name}</h3>
                        <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-black text-white font-medium">
                          启用中
                        </span>
                        <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-zinc-100 text-zinc-600 border border-zinc-200">
                          v{source.version}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-500 mt-1.5">{source.description}</p>
                      <p className="text-[11px] text-zinc-400 font-mono mt-1.5 break-all">
                        {source.baseUrl}
                      </p>
                    </div>

                    {source.publishUrl && (
                      <a
                        href={source.publishUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-1.5 rounded-lg border border-zinc-300 hover:bg-zinc-50 text-zinc-800 text-xs font-medium flex items-center gap-1.5 transition-colors font-mono flex-shrink-0"
                      >
                        <ExternalLink className="w-3.5 h-3.5 text-zinc-500" />
                        发布页
                      </a>
                    )}
                  </div>
                </div>
              ))}
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
