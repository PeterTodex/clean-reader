import * as cheerio from 'cheerio';
import { BookSource, SourceMeta, SearchResult, BookDetail, ChapterItem, ChapterContent, HomeSection, HomeBookItem, HomeColumn } from '../types';
import { fetchHtml } from '@/lib/request';

/**
 * 搬山人小说网 (banshanren.com)
 *
 * Noteworthy differences from the diyibanzhu adapter:
 * - Book ids are **slugs** (`/novel/lvguangdouluo`), not numbers, and chapter ids come in two
 *   shapes (timestamp-like `17757591690001` and snowflake-like `1248203611599536898`), so both
 *   are treated as opaque strings.
 * - The site splits every sentence into its own `<p>` and appends a comment-count badge
 *   (`<span class="z count_N">`) to each. Those badges are visible on the site, so they must be
 *   stripped or every sentence ends up with a stray digit.
 * - Some chapters sit behind the site's membership paywall, which truncates the body and covers
 *   it with a `.limit_box` overlay. Truncated text must never reach the relay cache — see
 *   `assertNotPaywalled`.
 */

const BASE_URL = 'https://www.banshanren.com';

/** Detail pages carry the entire catalog inline (700+ chapters ≈ 400KB), so they need room. */
const DETAIL_TIMEOUT = 15000;
const DEFAULT_TIMEOUT = 10000;

/**
 * Sentences are merged back into paragraphs of roughly this length.
 *
 * The source has no real paragraph structure to recover — it is sentence-per-`<p>` by design
 * (each sentence is individually commentable). Rendering that verbatim gives the reader one
 * short line per sentence, so consecutive fragments are joined until they reach a normal
 * paragraph size. Any grouping is an approximation; this one at least reads naturally.
 */
const TARGET_PARAGRAPH_LENGTH = 100;

export class BanshanrenSource implements BookSource {
  public meta: SourceMeta = {
    id: 'banshanren',
    name: '搬山人小说网',
    description: '搬山人站点适配，支持句子级分段还原与付费章节识别',
    version: '1.0.0',
    baseUrl: BASE_URL,
    publishUrl: BASE_URL,
  };

  private getBaseUrl(): string {
    return this.meta.baseUrl.replace(/\/$/, '');
  }

  /**
   * Covers are reported as empty on purpose.
   *
   * The CDN serves AES-grade **encrypted** bytes (measured entropy 7.98 bits/byte, no image
   * signature), which the site decrypts in the browser via an obfuscated `decrypt.worker.js`.
   * Fetching them through `/api/proxy/image` only relays ciphertext that no browser can render,
   * so it costs a request per cover and still shows nothing. There is no unencrypted variant on
   * the CDN, so the UI falls back to `BookCoverPlaceholder` instead.
   */
  private cover(): string {
    return '';
  }

  private extractSlug(href: string): string {
    const m = href.match(/\/novel\/([^/?#]+)/);
    return m ? m[1] : '';
  }

  /**
   * Pull the author out of the `.info_box` cells.
   *
   * Layouts vary across the page: real results read `作者 · 状态 · N章 · N万字` in one box, the
   * hot-search sidebar reads `状态 · N章 · N万字` with the author in a separate box, and a rating
   * box (`推荐度 76%`) sits alongside. Each box is split on its own so unrelated cells don't get
   * concatenated, then the recognisable non-author parts are dropped.
   */
  private parseAuthor(infoTexts: string[]): string {
    const parts = infoTexts
      .flatMap((text) => text.split('·'))
      .map((p) => p.trim())
      .filter(Boolean);

    const author = parts.find(
      (p) =>
        !/推荐度/.test(p) &&
        !/^(完结|连载中?)$/.test(p) &&
        !/^\d+章$/.test(p) &&
        !/字$/.test(p)
    );
    return author || '未知作者';
  }

  public async search(keyword: string): Promise<SearchResult[]> {
    const baseUrl = this.getBaseUrl();
    const searchUrl = `${baseUrl}/search/index?keyword=${encodeURIComponent(keyword)}`;

    try {
      const html = await fetchHtml(searchUrl, {
        headers: { Referer: baseUrl },
        timeout: DEFAULT_TIMEOUT,
      });
      const $ = cheerio.load(html);
      const results: SearchResult[] = [];

      // The page carries two `ul.novel_list` blocks: a `search_hot_box` sidebar of hot searches
      // (author in its own box, covers classed `sm`) and the actual result list. Matching both
      // would prepend unrelated books and misparse their authors.
      $('ul.novel_list:not(.search_hot_box) li.novel_li').each((_, el) => {
        const item = $(el);
        const titleLink = item.find('a.title').first();
        const href = titleLink.attr('href') || item.find('a.cover_box').attr('href') || '';
        const id = this.extractSlug(href);
        if (!id) return;

        const title = titleLink.text().trim() || item.find('a.cover_box').attr('title') || '';
        if (!title) return;

        const author = this.parseAuthor(
          item
            .find('div.info_box')
            .map((_, el) => $(el).text())
            .get()
        );

        results.push({
          id,
          title,
          author,
          cover: this.cover(),
          intro: item.find('div.novel_intro_box p').first().text().trim(),
          sourceId: this.meta.id,
        });
      });

      return results;
    } catch (err: any) {
      console.error(`[banshanren] search failed for "${keyword}":`, err.message);
      throw new Error(`搜索失败: ${err.message}`);
    }
  }

  public async getDetail(bookId: string): Promise<BookDetail> {
    const baseUrl = this.getBaseUrl();
    const detailUrl = `${baseUrl}/novel/${bookId}`;

    try {
      const html = await fetchHtml(detailUrl, {
        headers: { Referer: baseUrl },
        timeout: DETAIL_TIMEOUT,
      });
      const $ = cheerio.load(html);

      const title = $('h1').first().text().trim() || $('meta[property="og:title"]').attr('content') || '未知书籍';
      const author = $('span.hl[title="作者"]').first().text().trim() || '未知作者';
      const intro = $('div.novel_intro_box p').first().text().trim();
      const category = $('ul.category_list li a').first().attr('title') || '';
      const latestChapter = $('div.catalog_top_box span.hl').first().text().trim();
      const updateTime = $('div.catalog_top_box p').last().text().trim();

      // Status and word count only appear in the meta description, not in the rendered DOM.
      const metaDesc = $('meta[name="description"]').attr('content') || '';
      const status = metaDesc.includes('已完结') ? '完结' : '连载';
      const wordCount = metaDesc.match(/约?([\d.]+万字)/)?.[1] || '';

      // The catalog comes in two shapes: books with volumes wrap chapters in
      // `li.volume_chapter` and add `li.volume_title_box` headers, while books without volumes
      // use bare `<li>`. Matching on the link rather than the list-item class covers both — and
      // volume headers contain no `<a>` at all, so they fall out on their own.
      const chapters: ChapterItem[] = [];
      $('ul.chapter_list li a[href*="/novel/"]').each((_, el) => {
        const a = $(el);
        const href = a.attr('href') || '';
        const chapterId = href.split('/').filter(Boolean).pop() || '';
        const chapterTitle = (a.attr('title') || a.text()).trim();
        if (!chapterId || !chapterTitle) return;
        // A book's own detail link can appear inside the list; it has no chapter id segment.
        if (chapters.some((c) => c.id === chapterId)) return;
        chapters.push({ id: chapterId, title: chapterTitle, index: chapters.length + 1 });
      });

      if (chapters.length === 0) {
        throw new Error('目录为空，站点结构可能已变化');
      }

      return {
        id: bookId,
        title,
        author,
        cover: this.cover(),
        category,
        status,
        wordCount,
        latestChapter,
        updateTime,
        intro,
        chapters,
        sourceId: this.meta.id,
      };
    } catch (err: any) {
      console.error(`[banshanren] getDetail failed for ${bookId}:`, err.message);
      throw new Error(`获取详情失败: ${err.message}`);
    }
  }

  /**
   * Reject paywalled chapters instead of returning a truncated body.
   *
   * A partial chapter still clears the cache's length-based quality gate, so letting one through
   * would serve the same truncated text to every reader for the whole TTL.
   */
  private assertNotPaywalled($: cheerio.CheerioAPI, bookId: string, chapterId: string): void {
    if ($('div.chapter_content_box div.limit_box').length > 0) {
      throw new Error('该章节为会员章节，站点未提供完整正文');
    }
  }

  /** Strip the inline comment badges, then join sentence fragments into real paragraphs. */
  private extractParagraphs($: cheerio.CheerioAPI): string[] {
    const fragments: string[] = [];

    $('div.chapter_content_box p').each((_, el) => {
      const p = $(el);
      p.find('span.z, span.nz').remove();
      const text = p.text().replace(/\s+/g, ' ').trim();
      if (text) fragments.push(text);
    });

    const paragraphs: string[] = [];
    let buffer = '';

    for (const fragment of fragments) {
      buffer = buffer ? `${buffer}${fragment}` : fragment;
      if (buffer.length >= TARGET_PARAGRAPH_LENGTH) {
        paragraphs.push(buffer);
        buffer = '';
      }
    }
    if (buffer) paragraphs.push(buffer);

    return paragraphs;
  }

  public async getChapter(bookId: string, chapterId: string): Promise<ChapterContent> {
    const baseUrl = this.getBaseUrl();
    const chapterUrl = `${baseUrl}/novel/${bookId}/${chapterId}`;

    try {
      const html = await fetchHtml(chapterUrl, {
        headers: { Referer: `${baseUrl}/novel/${bookId}` },
        timeout: DEFAULT_TIMEOUT,
      });
      const $ = cheerio.load(html);

      const rawTitle = $('div.chapter_content_box h2').first().text().trim();
      // The heading carries the volume prefix ("第1卷 第1章 义父唐昊"); the catalog does not.
      const title = rawTitle.replace(/^第[0-9一二三四五六七八九十百千万]+卷\s*/, '') || '未知章节';

      this.assertNotPaywalled($, bookId, chapterId);

      const paragraphs = this.extractParagraphs($);

      const prevHref = $('div.chapter_navigation_box a[title="上一章"]').attr('href') || '';
      const nextHref = $('div.chapter_navigation_box a[title="下一章"]').attr('href') || '';
      const prevChapterId = prevHref ? prevHref.split('/').filter(Boolean).pop() || null : null;
      const nextChapterId = nextHref ? nextHref.split('/').filter(Boolean).pop() || null : null;

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
      console.error(`[banshanren] getChapter failed for ${bookId}/${chapterId}:`, err.message);
      throw new Error(`获取章节失败: ${err.message}`);
    }
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

      // 1. 精选推荐 (from .banner_box .swiper-slide)
      const bannerBooks: HomeBookItem[] = [];
      $('.banner_box .swiper-slide').each((idx, el) => {
        const a = $(el).find('a');
        const href = a.attr('href') || '';
        const idMatch = href.match(/\/novel\/([^/?#]+)/);
        if (!idMatch) return;
        const id = idMatch[1];

        let title = $(el).find('p.title').text().trim();
        if (!title) {
          const aTitle = a.attr('title') || '';
          if (aTitle !== '标题') title = aTitle;
        }
        if (!title) return;

        const brief = $(el).find('p.brief').text().trim();
        const infoText = $(el).find('.info').text().trim();
        let status: string | undefined;
        if (infoText.includes('已完结')) {
          status = '已完结';
        } else if (infoText.includes('连载中')) {
          status = '连载中';
        }

        bannerBooks.push({
          id,
          title,
          cover: '',
          intro: brief || undefined,
          status,
          rank: idx + 1,
        });
      });

      // 2. 热门小说
      const hotBooks: HomeBookItem[] = [];
      $('.main_box > div').each((_, el) => {
        const caption = $(el).find('.caption_box span').text().trim();
        if (caption === '热门小说') {
          $(el).find('li.novel_li').each((idx, li) => {
            const a = $(li).find('a.cover_box');
            const href = a.attr('href') || '';
            const idMatch = href.match(/\/novel\/([^/]+)/);
            if (!idMatch) return;
            const id = idMatch[1];
            const title = a.attr('title') || $(li).find('p').text().trim();
            hotBooks.push({
              id,
              title,
              rank: idx + 1,
              cover: '',
            });
          });
        }
      });

      // 3. 新书上架
      const newBooks: HomeBookItem[] = [];
      $('.main_box > div').each((_, el) => {
        const caption = $(el).find('.caption_box span').text().trim();
        if (caption === '新书上架') {
          $(el).find('li.novel_li').each((idx, li) => {
            const a = $(li).find('a.cover_box');
            const href = a.attr('href') || '';
            const idMatch = href.match(/\/novel\/([^/]+)/);
            if (!idMatch) return;
            const id = idMatch[1];
            const title = a.attr('title') || $(li).find('p').text().trim();
            newBooks.push({
              id,
              title,
              rank: idx + 1,
              cover: '',
            });
          });
        }
      });

      // Combined 3-column leaderboard for recommendations (no images needed)
      const recommendColumns: HomeColumn[] = [];
      if (bannerBooks.length > 0) {
        recommendColumns.push({
          title: '精选推荐',
          items: bannerBooks,
        });
      }
      if (hotBooks.length > 0) {
        recommendColumns.push({
          title: '热门小说',
          items: hotBooks,
        });
      }
      if (newBooks.length > 0) {
        recommendColumns.push({
          title: '新书上架',
          items: newBooks,
        });
      }
      if (recommendColumns.length > 0) {
        sections.push({
          id: 'recommendations',
          title: '精选力荐',
          type: 'ranking',
          columns: recommendColumns,
        });
      }

      // 4. 排行榜 (3 columns: 新作榜, 收藏榜, 热评榜)
      const columns: { title: string; items: HomeBookItem[] }[] = [];
      $('.top_box .top_list_box > ul').each((_, ul) => {
        const colTitle = $(ul).find('.top_title').text().trim();
        const items: HomeBookItem[] = [];
        $(ul).find('li.novel_li').each((idx, li) => {
          const a = $(li).find('a.cover_box');
          const href = a.attr('href') || '';
          const idMatch = href.match(/\/novel\/([^/]+)/);
          if (!idMatch) return;
          const id = idMatch[1];
          const title = a.attr('title') || '';
          const infoBox = $(li).find('.info_box');
          const author = infoBox.eq(0).text().trim();
          const statusText = infoBox.eq(1).text().trim().replace(/\s+/g, ' ');
          items.push({
            id,
            title,
            author,
            status: statusText,
            rank: idx + 1,
            cover: '',
          });
        });
        if (colTitle && items.length > 0) {
          columns.push({ title: colTitle, items });
        }
      });
      if (columns.length > 0) {
        sections.push({
          id: 'rankings',
          title: '热度排行',
          type: 'ranking',
          columns,
        });
      }

      // 5. 热门类型 (Tabs: 奇幻玄幻, BG言情, BL耽美, GL百合, 现代都市, 穿越重生, 武侠仙侠)
      const categoryTabs: { key: string; label: string; items: HomeBookItem[] }[] = [];
      $('.main_box > div').each((_, el) => {
        const caption = $(el).find('.caption_box span').text().trim();
        if (caption === '热门类型') {
          const tabLabels: string[] = [];
          $(el).find('ul.category_tab li').each((_, li) => {
            tabLabels.push($(li).text().trim());
          });

          $(el).find('ul.category_tab_list').each((idx, ul) => {
            const label = tabLabels[idx] || `分类 ${idx + 1}`;
            const items: HomeBookItem[] = [];
            $(ul).find('li.novel_li').each((bIdx, li) => {
              const a = $(li).find('a.cover_box');
              const href = a.attr('href') || '';
              const idMatch = href.match(/\/novel\/([^/]+)/);
              if (!idMatch) return;
              const id = idMatch[1];
              const title = a.attr('title') || $(li).find('p').text().trim();
              items.push({
                id,
                title,
                rank: bIdx + 1,
                cover: '',
              });
            });
            if (items.length > 0) {
              categoryTabs.push({
                key: `cat-${idx}`,
                label,
                items,
              });
            }
          });
        }
      });
      if (categoryTabs.length > 0) {
        sections.push({
          id: 'categories',
          title: '热门类型',
          type: 'tabs',
          tabs: categoryTabs,
        });
      }

      // 6. 最新更新 (List)
      const updates: HomeBookItem[] = [];
      $('.main_box > div').each((_, el) => {
        const caption = $(el).find('.caption_box span').text().trim();
        if (caption === '最新更新') {
          $(el).find('li.novel_li').each((_, li) => {
            const a = $(li).find('a.cover_box');
            const href = a.attr('href') || '';
            const idMatch = href.match(/\/novel\/([^/]+)/);
            if (!idMatch) return;
            const id = idMatch[1];
            const title = a.attr('title') || $(li).find('a.title').text().trim();
            const author = $(li).find('.author, .info_box').first().text().trim();
            const latestChapter = $(li).find('.last_chapter, a.chapter').text().trim();
            const updateTime = $(li).find('.time, .update_time').text().trim();
            updates.push({
              id,
              title,
              author,
              latestChapter,
              updateTime,
              cover: '',
            });
          });
        }
      });
      if (updates.length > 0) {
        sections.push({
          id: 'updates',
          title: '最新更新',
          type: 'list',
          items: updates.slice(0, 20),
        });
      }

      return sections;
    } catch (err: any) {
      console.error(`[banshanren] getHome failed:`, err.message);
      return [];
    }
  }
}

export default new BanshanrenSource();

/** Application default: used when a request carries no `?source=`. */
export const isDefault = true;
