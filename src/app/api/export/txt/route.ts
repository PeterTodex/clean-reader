import { NextRequest, NextResponse } from 'next/server';
import { sourceRegistry } from '@/sources';
import { ChapterItem } from '@/sources/types';
import { fetchChapterWithCache } from '@/lib/chapter-cache';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes max duration

const AD_PATTERNS: RegExp[] = [
  /怕找不到回家的路/i,
  /请截图保存本站发布地址/i,
  /请截图保存/i,
  /截屏或拍照记录当前页面/i,
  /截屏或拍照/i,
  /本章未完.*继续阅读/i,
  /网络屏蔽/i,
  /发送邮件/i,
  /dybzwz/i,
  /37mx/i,
  /zt51/i,
  /917q/i,
  /ct4k/i,
  /13ye/i,
  /dss7/i,
  /e-yp/i,
  /680t/i,
  /永久域名/i,
  /发布地址/i,
  /防屏蔽/i,
  /请收藏本站/i,
  /免费提供.*阅读/i,
  /最新章节列表/i,
  /记住本站网址/i,
  /投推荐票/i,
  /加入书签/i,
  /手机版访问/i,
  /百度搜索.*关注/i,
  /百合小说网/i,
  /https?:\/\/[^\s]+/i,
  /www\.[a-zA-Z0-9-]+\.[a-zA-Z]+/i,
];

function cleanParagraph(raw: string): string {
  if (!raw) return '';

  // 1. Strip scripts, styles, and HTML tags
  let text = raw
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, '');

  // 2. Decode standard HTML entities
  text = text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&mdash;/gi, '—')
    .replace(/&hellip;/gi, '…');

  // 3. Trim whitespace
  text = text.replace(/^[\s\u3000\u00A0]+/, '').replace(/[\s\u3000\u00A0]+$/, '');
  if (!text) return '';

  // 4. Filter ads
  for (const pattern of AD_PATTERNS) {
    if (pattern.test(text)) {
      return '';
    }
  }

  return text;
}

function formatChapterTitle(index: number, rawTitle: string): string {
  const cleanTitle = (rawTitle || '')
    .replace(/<[^>]+>/g, '')
    .trim();

  // Strip existing "第...章", "第...节", "第...回" prefix if present
  const prefixMatch = cleanTitle.match(/^第[0-9一二三四五六七八九十百千万]+[章节回话集卷]\s*(.*)$/);
  if (prefixMatch) {
    const subTitle = prefixMatch[1].trim();
    return subTitle ? `第${index}章 ${subTitle}` : `第${index}章 ${cleanTitle}`;
  }

  // Strip existing number prefix like "01. 章节名"
  const numberMatch = cleanTitle.match(/^\d+[\s.、:：_-]+(.*)$/);
  if (numberMatch && numberMatch[1].trim()) {
    return `第${index}章 ${numberMatch[1].trim()}`;
  }

  return `第${index}章 ${cleanTitle}`;
}

function formatChapterText(index: number, rawTitle: string, rawParagraphs: string[]): string {
  const title = formatChapterTitle(index, rawTitle);
  const cleanedParas: string[] = [];

  for (const p of rawParagraphs) {
    const lines = p.split(/\r?\n|<br\s*\/?>/i);
    for (const line of lines) {
      const cleaned = cleanParagraph(line);
      if (cleaned) {
        // Standard novel indent: two full-width spaces
        cleanedParas.push(`　　${cleaned}`);
      }
    }
  }

  const body = cleanedParas.length > 0 ? cleanedParas.join('\n\n') : '　　[暂无正文内容]';
  return `${title}\n\n${body}\n\n`;
}

async function fetchChapterWithRetry(
  source: any,
  bookId: string,
  chapterId: string,
  maxRetries = 2
) {
  const fetchFromSource = async () => {
    let lastErr: any = null;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await source.getChapter(bookId, chapterId);
      } catch (err: any) {
        lastErr = err;
        if (attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, 300 * (attempt + 1)));
        }
      }
    }
    throw lastErr ?? new Error(`Failed to fetch chapter ${chapterId}`);
  };

  try {
    // Routed through the relay cache: exporting a whole book pulls hundreds of chapters, and
    // anything already read (or already exported) should not hit the source site again.
    const { content } = await fetchChapterWithCache(
      source.meta.id,
      bookId,
      chapterId,
      fetchFromSource
    );
    return content;
  } catch (err: any) {
    console.warn(
      `[export/txt] Failed to fetch chapter ${chapterId} after ${maxRetries + 1} attempts:`,
      err?.message || err
    );
    return null;
  }
}

export async function POST(req: NextRequest) {
  let body: {
    bookId?: string;
    sourceId?: string;
    chapterIds?: string[];
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: '无效的 JSON 请求体' }, { status: 400 });
  }

  const { bookId, sourceId, chapterIds } = body;

  if (!bookId) {
    return NextResponse.json({ success: false, error: '书籍 ID 不能为空' }, { status: 400 });
  }

  let source;
  try {
    source = sourceRegistry.getSource(sourceId);
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }

  let detail;
  try {
    detail = await source.getDetail(bookId);
  } catch (err: any) {
    return NextResponse.json({ success: false, error: `获取书籍详情失败: ${err.message}` }, { status: 500 });
  }

  if (!detail || !detail.chapters || detail.chapters.length === 0) {
    return NextResponse.json({ success: false, error: '未找到该书籍的章节目录' }, { status: 404 });
  }

  // Filter or select target chapters
  let targetChapters: ChapterItem[] = [];
  if (chapterIds && Array.isArray(chapterIds) && chapterIds.length > 0) {
    const chapterMap = new Map(detail.chapters.map((c) => [c.id, c]));
    for (const cid of chapterIds) {
      const ch = chapterMap.get(cid);
      if (ch) {
        targetChapters.push(ch);
      }
    }
  } else {
    targetChapters = [...detail.chapters];
  }

  if (targetChapters.length === 0) {
    return NextResponse.json({ success: false, error: '没有可供导出的章节' }, { status: 400 });
  }

  const bookTitle = detail.title || 'novel';
  const safeTitle = bookTitle.replace(/[/\\?%*:|"<>]/g, '_');
  const encodedFilename = encodeURIComponent(`${safeTitle}.txt`);

  const encoder = new TextEncoder();
  let isAborted = false;

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Book metadata intro header
        const headerText = `《${detail.title}》\n作者：${detail.author}\n${
          detail.intro ? `\n简介：\n${detail.intro.replace(/^/gm, '　　')}\n` : ''
        }\n==================================================\n\n`;
        controller.enqueue(encoder.encode(headerText));

        // Process in batches of 4 concurrent requests (within 3-5 concurrent requests requirement)
        const BATCH_SIZE = 4;
        for (let i = 0; i < targetChapters.length; i += BATCH_SIZE) {
          if (isAborted) break;

          const batch = targetChapters.slice(i, i + BATCH_SIZE);
          const results = await Promise.all(
            batch.map(async (ch) => {
              const content = await fetchChapterWithRetry(source, bookId, ch.id);
              return { ch, content };
            })
          );

          if (isAborted) break;

          for (const res of results) {
            if (res.content && Array.isArray(res.content.paragraphs)) {
              const chapterFormatted = formatChapterText(
                res.ch.index,
                res.ch.title || res.content.title,
                res.content.paragraphs
              );
              controller.enqueue(encoder.encode(chapterFormatted));
            } else {
              const fallbackTitle = formatChapterTitle(res.ch.index, res.ch.title);
              controller.enqueue(
                encoder.encode(`${fallbackTitle}\n\n　　[本章节正文获取失败，请稍后重试]\n\n`)
              );
            }
          }

          // Small interval between batches to respect target server rate limits
          if (i + BATCH_SIZE < targetChapters.length) {
            await new Promise((resolve) => setTimeout(resolve, 100));
          }
        }
      } catch (err: any) {
        console.error('[export/txt] stream processing error:', err);
      } finally {
        try {
          controller.close();
        } catch {
          // Stream already closed or aborted
        }
      }
    },
    cancel() {
      isAborted = true;
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Disposition': `attachment; filename="${encodedFilename}"; filename*=UTF-8''${encodedFilename}`,
      'X-Total-Chapters': String(targetChapters.length),
      'Cache-Control': 'no-cache, no-transform',
    },
  });
}
