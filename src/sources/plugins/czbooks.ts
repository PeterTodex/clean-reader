import * as cheerio from 'cheerio';
import * as OpenCC from 'opencc-js';
import {
  BookSource,
  SourceMeta,
  SearchResult,
  BookDetail,
  ChapterItem,
  ChapterContent,
  HomeSection,
  HomeBookItem,
} from '../types';
import { fetchHtml, buildProxiedImageUrl } from '@/lib/request';

/**
 * 小说狂人 (czbooks.net)
 *
 * Characteristics:
 * - Hosted behind Cloudflare; serves Traditional Chinese (zh-TW) content.
 * - Search query is automatically converted to Traditional Chinese (OpenCC cn -> tw) for optimal recall.
 * - All titles, authors, categories, intros, and chapter paragraphs are converted to Simplified Chinese
 *   (OpenCC tw -> cn) to provide a consistent, native reading experience for Chinese readers.
 * - The entire catalog is rendered inline on the book detail page (1000+ chapters in one HTML),
 *   allowing instant catalog retrieval without pagination.
 * - Chapters are single-page with clean paragraphs separated by <br />.
 */

const BASE_URL = 'https://czbooks.net';
const DEFAULT_TIMEOUT = 12000;
const DETAIL_TIMEOUT = 18000;

// Initialize converters once at module level for optimal performance
const toTraditional = OpenCC.Converter({ from: 'cn', to: 'tw' });
const toSimplified = OpenCC.Converter({ from: 'tw', to: 'cn' });

export class CzbooksSource implements BookSource {
  public meta: SourceMeta = {
    id: 'czbooks',
    name: '小说狂人',
    description: '小说狂人（CZBooks）适配器，海量主流完本书籍，全量目录极速直出，智能简繁双向转换',
    version: '1.0.0',
    baseUrl: BASE_URL,
    publishUrl: BASE_URL,
  };

  private getBaseUrl(): string {
    return this.meta.baseUrl.replace(/\/$/, '');
  }

  private normalizeUrl(url: string): string {
    if (!url) return '';
    if (url.startsWith('//')) return `https:${url}`;
    if (url.startsWith('/')) return `${this.getBaseUrl()}${url}`;
    return url;
  }

  private extractBookId(href: string): string {
    const m = href.match(/\/n\/([a-zA-Z0-9]+)/);
    return m ? m[1] : '';
  }

  private extractChapterId(href: string): string {
    const m = href.match(/\/n\/[a-zA-Z0-9]+\/([a-zA-Z0-9]+)/);
    return m ? m[1] : '';
  }

  private formatCover(rawUrl: string): string {
    if (!rawUrl || rawUrl.includes('default_no_thumbnail.jpg')) {
      return '';
    }
    const fullUrl = this.normalizeUrl(rawUrl);
    return buildProxiedImageUrl(fullUrl, this.getBaseUrl());
  }

  public async search(keyword: string): Promise<SearchResult[]> {
    const baseUrl = this.getBaseUrl();
    const cleanKeyword = keyword.trim();
    if (!cleanKeyword) return [];

    // Convert search keyword to Traditional Chinese for czbooks search engine
    const twKeyword = toTraditional(cleanKeyword);
    const searchUrl = `${baseUrl}/s/${encodeURIComponent(twKeyword)}?q=${encodeURIComponent(twKeyword)}`;

    try {
      const html = await fetchHtml(searchUrl, {
        headers: { Referer: baseUrl },
        timeout: DEFAULT_TIMEOUT,
      });

      const $ = cheerio.load(html);
      const results: SearchResult[] = [];
      const seenIds = new Set<string>();

      $('.novel-item-wrapper .novel-item').each((_, el) => {
        const $item = $(el);
        const detailHref =
          $item.find('.novel-item-cover-wrapper a').attr('href') ||
          $item.find('a').attr('href') ||
          '';
        const id = this.extractBookId(detailHref);
        if (!id || seenIds.has(id)) return;
        seenIds.add(id);

        const rawTitle = $item.find('.novel-item-title').text().trim();
        const rawAuthor =
          $item.find('.novel-item-author a').text().trim() ||
          $item.find('.novel-item-author').text().replace(/作者[:：]/, '').trim();
        const rawLatest = $item.find('.novel-item-newest-chapter a').text().trim();
        const rawDate = $item.find('.novel-item-date').text().trim();
        const coverSrc = $item.find('.novel-item-thumbnail img').attr('src') || '';

        results.push({
          id,
          title: toSimplified(rawTitle),
          author: toSimplified(rawAuthor || '未知作者'),
          cover: this.formatCover(coverSrc),
          latestChapter: rawLatest ? toSimplified(rawLatest) : undefined,
          updateTime: rawDate || undefined,
          sourceId: this.meta.id,
        });
      });

      return results;
    } catch (err: any) {
      console.warn(`[CzbooksSource] search failed for keyword "${keyword}":`, err?.message || err);
      return [];
    }
  }

  public async getDetail(bookId: string): Promise<BookDetail> {
    const baseUrl = this.getBaseUrl();
    const detailUrl = `${baseUrl}/n/${bookId}`;

    const html = await fetchHtml(detailUrl, {
      headers: { Referer: baseUrl },
      timeout: DETAIL_TIMEOUT,
    });

    const $ = cheerio.load(html);

    // Title
    const rawTitle =
      $('.info .title').text().trim() ||
      $('h1').text().trim() ||
      $('title').text().replace(/【.*?】/, '').split(/[|\-_]/)[0].trim();
    const title = toSimplified(rawTitle.replace(/^[《【\s]+|[》】\s]+$/g, '').trim());

    // Author
    const rawAuthor =
      $('.info .author a').text().trim() ||
      $('.info .author').text().replace(/作者[:：]/, '').trim();
    const author = toSimplified(rawAuthor || '未知作者');

    // Category
    const rawCategory = $('#novel-category').text().trim();
    const category = rawCategory ? toSimplified(rawCategory) : undefined;

    // Intro
    const rawIntro = $('.description').text().trim();
    const intro = toSimplified(rawIntro || '暂无简介');

    // Cover
    const coverSrc =
      $('.novel-detail .thumbnail img').attr('src') ||
      $('.thumbnail img').attr('src') ||
      $('img[src*="/images/"]').attr('src') ||
      '';
    const cover = this.formatCover(coverSrc);

    // Status
    let status = '连载中';
    const bodyText = $.text();
    if (bodyText.includes('已完结') || bodyText.includes('【完结】')) {
      status = '已完结';
    }

    // Chapters list (all chapters are rendered directly on the detail page)
    const chapters: ChapterItem[] = [];
    const seenChapterIds = new Set<string>();

    $('#chapter-list li a, ul.chapter-list li a').each((_, el) => {
      const href = $(el).attr('href') || '';
      const chapterId = this.extractChapterId(href);
      if (!chapterId || seenChapterIds.has(chapterId)) return;
      seenChapterIds.add(chapterId);

      const chapterTitle = toSimplified($(el).text().trim());
      chapters.push({
        id: chapterId,
        title: chapterTitle,
        index: chapters.length,
      });
    });

    return {
      id: bookId,
      title,
      author,
      cover,
      category,
      status,
      intro,
      chapters,
      sourceId: this.meta.id,
      latestChapter: chapters.length > 0 ? chapters[chapters.length - 1].title : undefined,
    };
  }

  public async getChapter(bookId: string, chapterId: string): Promise<ChapterContent> {
    const baseUrl = this.getBaseUrl();
    const chapterUrl = `${baseUrl}/n/${bookId}/${chapterId}`;

    const html = await fetchHtml(chapterUrl, {
      headers: { Referer: `${baseUrl}/n/${bookId}` },
      timeout: DEFAULT_TIMEOUT,
    });

    const $ = cheerio.load(html);

    // Title
    const rawTitle =
      $('.chapter-detail .name').text().trim() ||
      $('title').text().split(/[|\-_]/)[0].trim();
    const title = toSimplified(rawTitle.replace(/^《.*?》\s*/, '').trim());

    // Content paragraphs
    const contentEl = $('.chapter-detail .content');
    const contentHtml = contentEl.html() || '';

    const paragraphs: string[] = [];
    const chunks = contentHtml.split(/<br\s*\/?>/gi);

    for (const chunk of chunks) {
      const text = cheerio.load(chunk).text().trim();
      if (!text) continue;

      // Filter out unwanted interactive buttons or noise
      if (/^\[回報錯誤\]|^\[繁\]|^\[简\]/i.test(text)) continue;

      paragraphs.push(toSimplified(text));
    }

    const cleanHtml = paragraphs.map((p) => `<p>${p}</p>`).join('');

    // Previous / Next chapter navigation
    const nextHref = $('a.next-chapter').attr('href') || '';
    const prevHref = $('a.prev-chapter').attr('href') || '';

    const nextChapterId = this.extractChapterId(nextHref) || null;
    const prevChapterId = this.extractChapterId(prevHref) || null;

    return {
      id: chapterId,
      bookId,
      title,
      content: cleanHtml,
      paragraphs,
      nextChapterId: nextChapterId === chapterId ? null : nextChapterId,
      prevChapterId: prevChapterId === chapterId ? null : prevChapterId,
      sourceId: this.meta.id,
    };
  }

  public async getHome(): Promise<HomeSection[]> {
    const baseUrl = this.getBaseUrl();

    try {
      const html = await fetchHtml(baseUrl, {
        headers: { Referer: baseUrl },
        timeout: DEFAULT_TIMEOUT,
      });

      const $ = cheerio.load(html);
      const sections: HomeSection[] = [];

      // Parse each of the 3 ranking lists on the homepage
      const parseRankList = (ul: ReturnType<typeof $>) => {
        const rawTitle = ul.find('.novel-list-title').text().replace(/\(.*?\)/g, '').trim();
        const items: HomeBookItem[] = [];

        ul.find('li.novel-item-wrapper').each((idx, el) => {
          const $item = $(el).find('.novel-item');
          const detailHref =
            $item.find('.novel-item-cover-wrapper a').attr('href') ||
            $item.find('a').attr('href') ||
            '';
          const id = this.extractBookId(detailHref);
          if (!id) return;

          const rawTitle = $item.find('.novel-item-title').text().trim();
          const rawAuthor =
            $item.find('.novel-item-author a').text().trim() ||
            $item.find('.novel-item-author').text().replace(/作者[:：]/, '').trim();
          const coverSrc = $item.find('.novel-item-thumbnail img').attr('src') || '';
          const isFinish =
            $item.text().includes('已完結') || $item.text().includes('【完結】');

          items.push({
            id,
            title: toSimplified(rawTitle),
            author: toSimplified(rawAuthor || '未知作者'),
            cover: this.formatCover(coverSrc),
            status: isFinish ? '已完结' : '连载中',
            rank: idx + 1,
          });
        });

        return {
          title: toSimplified(rawTitle),
          items,
        };
      };

      const rankLists: { title: string; items: HomeBookItem[] }[] = [];
      $('ul.novel-list').each((_, ul) => {
        rankLists.push(parseRankList($(ul)));
      });

      // Track displayed books across sections to prevent duplicate entries on the homepage
      const seenIds = new Set<string>();

      // 1. Rankings: 3-column Leaderboard (精选榜, 工口榜, 收藏榜) at the top
      if (rankLists.length > 0) {
        const columns = rankLists.map((list) => {
          let colTitle = list.title
            .replace(/小說\s*-\s*熱門排行|小说\s*-\s*热门排行/, '榜')
            .trim();
          if (!colTitle.endsWith('榜')) {
            colTitle += '榜';
          }
          const top10 = list.items.slice(0, 10);
          top10.forEach((b) => seenIds.add(b.id));
          return {
            title: colTitle,
            items: top10,
          };
        });

        sections.push({
          id: 'czbooks-rankings',
          title: '热度排行榜',
          type: 'ranking',
          columns,
        });
      }

      // 2. Featured Grid: Popular masterpieces with covers, avoiding books already in the leaderboard
      if (rankLists.length > 0) {
        const featuredItems = rankLists[0].items
          .filter((item) => !seenIds.has(item.id))
          .slice(0, 12);

        if (featuredItems.length > 0) {
          featuredItems.forEach((b) => seenIds.add(b.id));
          sections.push({
            id: 'czbooks-featured',
            title: '精选佳作',
            type: 'grid',
            items: featuredItems,
          });
        }
      }

      // 3. Reader Favorites: Hidden gems and favorite books, completely deduplicated
      if (rankLists.length > 2) {
        const favoriteItems = rankLists[2].items
          .filter((item) => !seenIds.has(item.id))
          .slice(0, 16);

        if (favoriteItems.length > 0) {
          sections.push({
            id: 'czbooks-favorites',
            title: '读者珍藏',
            type: 'list',
            items: favoriteItems,
          });
        }
      }

      return sections;
    } catch (err: any) {
      console.warn('[CzbooksSource] getHome failed:', err?.message || err);
      return [];
    }
  }
}

export default new CzbooksSource();
