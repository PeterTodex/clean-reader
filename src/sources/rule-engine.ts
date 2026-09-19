import * as cheerio from 'cheerio';
import iconv from 'iconv-lite';
import {
  BookSource,
  SourceMeta,
  SearchResult,
  BookDetail,
  ChapterItem,
  ChapterContent,
} from './types';
import { fetchHtml, buildProxiedImageUrl } from '@/lib/request';

export interface RuleSourceMeta {
  id: string;
  name: string;
  description: string;
  baseUrl: string;
  version?: string;
  publishUrl?: string;
}

export interface RuleSearchConfig {
  url: string;
  method?: 'GET' | 'POST';
  charset?: 'utf-8' | 'gbk';
  headers?: Record<string, string>;
  postBody?: Record<string, string> | string;
  listSelector: string;
  titleSelector: string;
  authorSelector?: string;
  coverSelector?: string;
  latestChapterSelector?: string;
  detailUrlSelector: string;
  idRegex?: string;
}

export interface RuleDetailConfig {
  url?: string;
  charset?: 'utf-8' | 'gbk';
  headers?: Record<string, string>;
  titleSelector?: string;
  authorSelector?: string;
  coverSelector?: string;
  introSelector?: string;
  categorySelector?: string;
  statusSelector?: string;
  chapterListSelector: string;
  chapterTitleSelector?: string;
  chapterUrlSelector?: string;
  chapterIdRegex?: string;
}

export interface RuleChapterConfig {
  url?: string;
  charset?: 'utf-8' | 'gbk';
  headers?: Record<string, string>;
  titleSelector?: string;
  contentSelector: string;
  adFilters?: (string | RegExp)[];
  prevSelector?: string;
  nextSelector?: string;
}

export interface RuleBookSourceConfig {
  meta: RuleSourceMeta;
  search: RuleSearchConfig;
  detail: RuleDetailConfig;
  chapter: RuleChapterConfig;
}

/**
 * Helper to percent-encode a string into GBK or UTF-8
 */
export function encodeKeyword(keyword: string, charset: 'utf-8' | 'gbk' = 'utf-8'): string {
  if (charset === 'gbk') {
    const buf = iconv.encode(keyword, 'gbk');
    return Array.from(buf)
      .map((b) => '%' + b.toString(16).toUpperCase().padStart(2, '0'))
      .join('');
  }
  return encodeURIComponent(keyword);
}

/**
 * Resolve a potentially relative URL against a base URL
 */
export function resolveUrl(relativeOrAbsolute: string, baseUrl: string): string {
  if (!relativeOrAbsolute) return '';
  const trimmed = relativeOrAbsolute.trim();
  if (trimmed.startsWith('//')) {
    return `https:${trimmed}`;
  }
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  const cleanBase = baseUrl.replace(/\/+$/, '');
  const cleanPath = trimmed.replace(/^\/+/, '');
  return `${cleanBase}/${cleanPath}`;
}

export class RuleBasedSource implements BookSource {
  public meta: SourceMeta;
  public config: RuleBookSourceConfig;

  constructor(config: RuleBookSourceConfig) {
    this.config = config;

    this.meta = {
      id: config.meta.id,
      name: config.meta.name,
      description: config.meta.description,
      version: config.meta.version || '1.0.0',
      baseUrl: config.meta.baseUrl.replace(/\/+$/, ''),
      publishUrl: config.meta.publishUrl,
    };
  }

  protected getBaseUrl(): string {
    return this.meta.baseUrl.replace(/\/+$/, '');
  }

  public async search(keyword: string): Promise<SearchResult[]> {
    const baseUrl = this.getBaseUrl();
    const searchRule = this.config.search;
    const charset = searchRule.charset || 'utf-8';
    const method = searchRule.method || 'GET';
    const encodedKeyword = encodeKeyword(keyword, charset);

    let targetUrl: string;
    let postData: any = undefined;

    if (searchRule.url.includes('{keyword}') || searchRule.url.includes('{key}')) {
      const urlPath = searchRule.url
        .replace(/\{keyword\}/g, encodedKeyword)
        .replace(/\{key\}/g, encodedKeyword);
      targetUrl = resolveUrl(urlPath, baseUrl);
    } else if (method === 'GET') {
      const separator = searchRule.url.includes('?') ? '&' : '?';
      targetUrl = resolveUrl(`${searchRule.url}${separator}keyword=${encodedKeyword}`, baseUrl);
    } else {
      targetUrl = resolveUrl(searchRule.url, baseUrl);
    }

    if (method === 'POST') {
      if (typeof searchRule.postBody === 'string') {
        postData = searchRule.postBody
          .replace(/\{keyword\}/g, encodedKeyword)
          .replace(/\{key\}/g, encodedKeyword);
      } else if (searchRule.postBody && typeof searchRule.postBody === 'object') {
        postData = {};
        for (const [k, v] of Object.entries(searchRule.postBody)) {
          postData[k] = v.replace(/\{keyword\}/g, keyword).replace(/\{key\}/g, keyword);
        }
      } else {
        postData = { searchkey: keyword };
      }
    }

    try {
      const html = await fetchHtml(targetUrl, {
        method,
        data: postData,
        encoding: charset,
        headers: {
          Referer: baseUrl,
          ...(searchRule.headers || {}),
        },
      });

      const $ = cheerio.load(html);
      const results: SearchResult[] = [];

      $(searchRule.listSelector).each((_, el) => {
        const item = $(el);

        // Detail link & ID extraction
        const detailLink = searchRule.detailUrlSelector
          ? item.find(searchRule.detailUrlSelector).first()
          : item.find(searchRule.titleSelector).first();
        const rawHref = detailLink.attr('href') || item.attr('href') || '';
        if (!rawHref) return;

        const id = this.extractBookId(rawHref, searchRule.idRegex);
        if (!id) return;

        // Title
        const title = (
          item.find(searchRule.titleSelector).first().text() ||
          detailLink.text() ||
          ''
        ).trim();
        if (!title) return;

        // Author
        const author = searchRule.authorSelector
          ? item.find(searchRule.authorSelector).first().text().replace(/作者[：:]\s*/, '').trim()
          : '佚名';

        // Cover
        let cover = '';
        if (searchRule.coverSelector) {
          const coverEl = item.find(searchRule.coverSelector).first();
          cover =
            coverEl.attr('data-original') ||
            coverEl.attr('data-src') ||
            coverEl.attr('src') ||
            '';
        }
        if (cover) {
          cover = resolveUrl(cover, baseUrl);
        }

        // Latest chapter
        const latestChapter = searchRule.latestChapterSelector
          ? item.find(searchRule.latestChapterSelector).first().text().trim()
          : undefined;

        results.push({
          id,
          title,
          author: author || '佚名',
          cover: cover ? buildProxiedImageUrl(cover, baseUrl) : '',
          latestChapter,
          sourceId: this.meta.id,
        });
      });

      return results;
    } catch (err: any) {
      console.error(`[${this.meta.id}] search failed on ${baseUrl}:`, err.message);
      throw new Error(`[${this.meta.name}] 搜索失败: ${err.message}`);
    }
  }

  public async getDetail(bookId: string): Promise<BookDetail> {
    const baseUrl = this.getBaseUrl();
    const detailRule = this.config.detail;
    const charset = detailRule.charset || 'utf-8';

    let detailUrl: string;
    if (detailRule.url) {
      const path = detailRule.url
        .replace(/\{id\}/g, bookId)
        .replace(/\{bookId\}/g, bookId);
      detailUrl = resolveUrl(path, baseUrl);
    } else {
      detailUrl = resolveUrl(`/book/${bookId}/`, baseUrl);
    }

    try {
      const html = await fetchHtml(detailUrl, {
        encoding: charset,
        headers: {
          Referer: baseUrl,
          ...(detailRule.headers || {}),
        },
      });

      const $ = cheerio.load(html);

      // Extract metadata with fallbacks to OpenGraph tags
      const title =
        (detailRule.titleSelector ? $(detailRule.titleSelector).first().text().trim() : '') ||
        $('meta[property="og:novel:book_name"]').attr('content') ||
        $('meta[property="og:title"]').attr('content') ||
        $('h1').first().text().trim() ||
        '未知书名';

      let author =
        (detailRule.authorSelector ? $(detailRule.authorSelector).first().text().trim() : '') ||
        $('meta[property="og:novel:author"]').attr('content') ||
        '佚名';
      author = author.replace(/^作者[：:]\s*/, '').trim() || '佚名';

      let cover =
        (detailRule.coverSelector
          ? $(detailRule.coverSelector).first().attr('data-original') ||
            $(detailRule.coverSelector).first().attr('data-src') ||
            $(detailRule.coverSelector).first().attr('src')
          : '') ||
        $('meta[property="og:image"]').attr('content') ||
        '';
      if (cover) {
        cover = resolveUrl(cover, baseUrl);
      }

      const intro =
        (detailRule.introSelector ? $(detailRule.introSelector).first().text().trim() : '') ||
        $('meta[property="og:description"]').attr('content') ||
        '';

      const category =
        (detailRule.categorySelector ? $(detailRule.categorySelector).first().text().trim() : '') ||
        $('meta[property="og:novel:category"]').attr('content') ||
        undefined;

      const status =
        (detailRule.statusSelector ? $(detailRule.statusSelector).first().text().trim() : '') ||
        $('meta[property="og:novel:status"]').attr('content') ||
        '连载';

      const updateTime =
        $('meta[property="og:novel:update_time"]').attr('content') ||
        $('.last, .update').first().text().replace(/更新[：:]\s*/, '').trim() ||
        undefined;

      const latestChapter =
        $('meta[property="og:novel:latest_chapter_name"]').attr('content') ||
        undefined;

      // Parse chapters
      const chapters: ChapterItem[] = [];
      const seenIds = new Set<string>();

      $(detailRule.chapterListSelector).each((i, el) => {
        const item = $(el);
        const link = item.is('a') ? item : item.find('a').first();
        const href = link.attr('href') || item.attr('href') || '';
        if (!href || href.startsWith('javascript:')) return;

        const chapterTitle = (
          (detailRule.chapterTitleSelector ? item.find(detailRule.chapterTitleSelector).first().text() : '') ||
          link.text() ||
          item.text()
        ).trim();

        if (!chapterTitle) return;

        const chapterId = this.extractChapterId(href, detailRule.chapterIdRegex);
        if (!chapterId || seenIds.has(chapterId)) return;

        seenIds.add(chapterId);
        chapters.push({
          id: chapterId,
          title: chapterTitle,
          index: chapters.length + 1,
        });
      });

      return {
        id: bookId,
        title,
        author,
        cover: cover ? buildProxiedImageUrl(cover, baseUrl) : '',
        category,
        status,
        updateTime,
        latestChapter,
        intro: intro.replace(/[\r\n\t]+/g, '\n').trim(),
        chapters,
        sourceId: this.meta.id,
      };
    } catch (err: any) {
      console.error(`[${this.meta.id}] getDetail failed for ${bookId}:`, err.message);
      throw new Error(`[${this.meta.name}] 获取书籍详情失败: ${err.message}`);
    }
  }

  public async getChapter(bookId: string, chapterId: string): Promise<ChapterContent> {
    const baseUrl = this.getBaseUrl();
    const chapterRule = this.config.chapter;
    const charset = chapterRule.charset || 'utf-8';

    let chapterUrl: string;
    if (chapterRule.url) {
      const path = chapterRule.url
        .replace(/\{bookId\}/g, bookId)
        .replace(/\{chapterId\}/g, chapterId)
        .replace(/\{id\}/g, chapterId);
      chapterUrl = resolveUrl(path, baseUrl);
    } else {
      chapterUrl = resolveUrl(`/book/${bookId}/${chapterId}.html`, baseUrl);
    }

    try {
      const html = await fetchHtml(chapterUrl, {
        encoding: charset,
        headers: {
          Referer: baseUrl,
          ...(chapterRule.headers || {}),
        },
      });

      const $ = cheerio.load(html);

      // Title
      const title =
        (chapterRule.titleSelector ? $(chapterRule.titleSelector).first().text().trim() : '') ||
        $('h1').first().text().trim() ||
        $('title').text().split(/[-_]/)[0].trim() ||
        '正文';

      // Navigation links
      let prevChapterId: string | null = null;
      let nextChapterId: string | null = null;

      const prevEl = chapterRule.prevSelector
        ? $(chapterRule.prevSelector).first()
        : $('#prev_url, a:contains("上一章"), a:contains("上一页")').first();
      const prevHref = prevEl.attr('href') || '';
      if (prevHref && !prevHref.includes('index') && !prevHref.endsWith('/') && !prevHref.startsWith('javascript:')) {
        const pId = this.extractChapterId(prevHref, this.config.detail.chapterIdRegex);
        if (pId && pId !== chapterId && pId !== bookId) {
          prevChapterId = pId;
        }
      }

      const nextEl = chapterRule.nextSelector
        ? $(chapterRule.nextSelector).first()
        : $('#next_url, a:contains("下一章"), a:contains("下一页")').first();
      const nextHref = nextEl.attr('href') || '';
      if (nextHref && !nextHref.includes('index') && !nextHref.endsWith('/') && !nextHref.startsWith('javascript:')) {
        const nId = this.extractChapterId(nextHref, this.config.detail.chapterIdRegex);
        if (nId && nId !== chapterId && nId !== bookId) {
          nextChapterId = nId;
        }
      }

      // Content container
      let contentEl = $(chapterRule.contentSelector);
      if (contentEl.length === 0) {
        contentEl = $('#content, #booktxt, #htmlContent, .read-content, #chaptercontent, article').first();
      }

      // Purge scripts, styles, advertisements
      contentEl.find('script, style, iframe, ins, .advert, [class*="ads"], [id*="ads"]').remove();

      // Extract paragraphs
      const paragraphs: string[] = [];
      const pElements = contentEl.find('p');

      if (pElements.length > 0) {
        pElements.each((_, p) => {
          const raw = $(p).html() || '';
          const cleaned = this.cleanParagraph(raw, chapterRule.adFilters);
          if (cleaned) {
            paragraphs.push(cleaned);
          }
        });
      } else {
        const rawContent = contentEl.html() || '';
        const lines = rawContent.split(/<br\s*\/?>/i);
        for (const line of lines) {
          const cleaned = this.cleanParagraph(line, chapterRule.adFilters);
          if (cleaned) {
            paragraphs.push(cleaned);
          }
        }
      }

      return {
        id: chapterId,
        bookId,
        title,
        content: paragraphs.map((p) => `<p>${p}</p>`).join('\n'),
        paragraphs,
        nextChapterId,
        prevChapterId,
        sourceId: this.meta.id,
      };
    } catch (err: any) {
      console.error(`[${this.meta.id}] getChapter failed for ${bookId}/${chapterId}:`, err.message);
      throw new Error(`[${this.meta.name}] 获取章节内容失败: ${err.message}`);
    }
  }

  protected extractBookId(url: string, idRegex?: string): string {
    if (idRegex) {
      try {
        const m = url.match(new RegExp(idRegex));
        if (m && m[1]) return m[1];
      } catch {}
    }
    // Standard heuristics for book IDs:
    // e.g. /book/12345/ or /biquge/12345/ or /12345.html or /12345/
    const mBook = url.match(/(?:book|biquge|novel|info)\/([a-zA-Z0-9_-]+)/i);
    if (mBook) return mBook[1];

    const mHtml = url.match(/\/([a-zA-Z0-9_-]+)\.html/i);
    if (mHtml) return mHtml[1];

    const mNum = url.match(/\/(\d+)\/?$/);
    if (mNum) return mNum[1];

    const clean = url
      .replace(/^https?:\/\/[^\/]+/i, '')
      .replace(/^\/+|\/+$/g, '')
      .replace(/\//g, '_');
    return clean || url;
  }

  protected extractChapterId(url: string, chapterIdRegex?: string): string {
    if (chapterIdRegex) {
      try {
        const m = url.match(new RegExp(chapterIdRegex));
        if (m && m[1]) return m[1];
      } catch {}
    }
    // Standard heuristics for chapter IDs:
    // e.g. /123.html or /book/123/456.html or 456.html
    const mHtml = url.match(/\/([a-zA-Z0-9_-]+)\.html$/i);
    if (mHtml) return mHtml[1];

    const mPureHtml = url.match(/^([a-zA-Z0-9_-]+)\.html$/i);
    if (mPureHtml) return mPureHtml[1];

    const mNum = url.match(/\/(\d+)\/?$/);
    if (mNum) return mNum[1];

    return url.replace(/\.html$/i, '').replace(/.*\/+/, '');
  }

  protected cleanParagraph(html: string, adFilters?: (string | RegExp)[]): string {
    let text = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .trim();

    // Check ad filters
    if (adFilters && adFilters.length > 0) {
      for (const filter of adFilters) {
        if (typeof filter === 'string') {
          if (filter && text.includes(filter)) return '';
        } else if (filter instanceof RegExp) {
          if (filter.test(text)) return '';
        }
      }
    }

    // Strip remaining basic html tags but preserve text
    text = text.replace(/<[^>]+>/g, '').trim();

    // Clean whitespace and html entities
    text = text
      .replace(/&nbsp;/gi, ' ')
      .replace(/\u3000/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .trim();

    return text;
  }
}
