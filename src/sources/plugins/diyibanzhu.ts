import * as cheerio from 'cheerio';
import { BookSource, SourceMeta, SearchResult, BookDetail, ChapterItem, ChapterContent, HomeSection, HomeBookItem } from '../types';
import { fetchHtml, buildProxiedImageUrl } from '@/lib/request';

// Known sensitive character map used by the source site
const CHAR_MAP: Record<string, string> = {
  'a1': '爱',
  'r1': '肉',
  'r3': '人',
  'g3': '净',
  'j3': '交',
  'q1': '情',
  'n2': '女',
  'b2': '逼',
  's1': '射',
  'm2': '妈',
  'c1': '操',
  'x1': '性',
  'x2': '穴',
  'y1': '欲',
  'y2': '阴',
  'r2': '乳',
  't1': '舔',
  'k1': '狂',
  'j1': '精',
  'd1': '屌',
  'p1': '炮',
  'f1': '妇',
  's2': '骚',
  'b1': '波',
  'g1': '高',
};

/**
 * The only address this source reads from.
 *
 * The sibling domains advertised on the publish page (`m.zt51.com`, `m.680t.com`, …) are NOT
 * mirrors: they run the same CMS but each uses its own URL path prefix derived from its own
 * domain (`/zt51/…`, `/680t/…`) and keeps a **separate book-id space** — an id resolves on
 * exactly one of them. Treating them as interchangeable produced URLs like
 * `https://m.zt51.com/37mx/1094730.html`, which cannot exist.
 */
const BASE_URL = 'https://m.37mx.com';

export class DiyibanzhuSource implements BookSource {
  public meta: SourceMeta = {
    id: 'diyibanzhu',
    name: '第一版主',
    description: '第一版主站点适配，支持章节多页自动拼接与敏感字图像还原',
    version: '1.3.0',
    baseUrl: BASE_URL,
    publishUrl: 'https://dybzwz.us',
  };

  private getBaseUrl(): string {
    return this.meta.baseUrl.replace(/\/$/, '');
  }

  public async search(keyword: string): Promise<SearchResult[]> {
    const baseUrl = this.getBaseUrl();
    const searchUrl = `${baseUrl}/search/?searchkey=${encodeURIComponent(keyword)}`;

    try {
      const html = await fetchHtml(searchUrl, {
        headers: { Referer: baseUrl },
      });
      const $ = cheerio.load(html);
      const results: SearchResult[] = [];

      $('.rank .content dl').each((_, el) => {
        const item = $(el);
        const titleLink = item.find('dt a');
        const href = titleLink.attr('href') || '';
        // href is like /37mx/1216670.html or /book/1216670.html
        const idMatch = href.match(/(\d+)\.html/);
        if (!idMatch) return;

        const id = idMatch[1];
        const title = titleLink.text().trim();
        const coverImg = item.find('a.cover img');
        let cover = coverImg.attr('data-original') || coverImg.attr('src') || '';
        if (cover && !cover.startsWith('http')) {
          cover = `${baseUrl}${cover}`;
        }

        const dds = item.find('dd');
        const intro = dds.first().text().trim();
        const author = item.find('a[href*="/author/"]').text().trim() || '佚名';
        const latestChapter = item.find('.last a').text().trim() || '';

        results.push({
          id,
          title,
          author,
          cover: buildProxiedImageUrl(cover, baseUrl),
          intro,
          latestChapter,
          sourceId: this.meta.id,
        });
      });

      return results;
    } catch (err: any) {
      console.error(`[diyibanzhu] search failed on ${baseUrl}:`, err.message);
      throw new Error(`搜索失败: ${err.message}`);
    }
  }

  public async getDetail(bookId: string): Promise<BookDetail> {
    const baseUrl = this.getBaseUrl();
    const detailUrl = `${baseUrl}/37mx/${bookId}.html`;
    const catalogUrl = `${baseUrl}/book/${bookId}.html`;

    try {
      const [detailHtml, catalogHtml] = await Promise.all([
        fetchHtml(detailUrl, { headers: { Referer: baseUrl } }),
        fetchHtml(catalogUrl, { headers: { Referer: baseUrl } }).catch(() => ''),
      ]);

      const $ = cheerio.load(detailHtml);
      const title = $('.book-cell h1.book-title').text().trim() || $('meta[property="og:novel:book_name"]').attr('content') || '未知书籍';
      const author = $('.book-cell p.book-meta a[href*="/author/"]').text().trim() || $('meta[property="og:novel:author"]').attr('content') || '未知作者';
      
      let cover = $('.book-cover').attr('src') || $('meta[property="og:image"]').attr('content') || '';
      if (cover && !cover.startsWith('http')) {
        cover = `${baseUrl}${cover}`;
      }

      const category = $('meta[property="og:novel:category"]').attr('content') || $('.book-cell p.book-meta a[href*="/list/"]').text().trim();
      const status = $('meta[property="og:novel:status"]').attr('content') || '连载';
      const updateTime = $('meta[property="og:novel:update_time"]').attr('content') || $('.last').text().trim();
      const latestChapter = $('meta[property="og:novel:latest_chapter_name"]').attr('content') || $('.last a').text().trim();
      const intro = $('.bookintro').text().replace(/[\r\n\t]+/g, '\n').trim() || $('meta[property="og:description"]').attr('content') || '';

      // Parse chapters from catalog page (or fallback to detail page if catalog is empty)
      const chapters: ChapterItem[] = [];
      const cat$ = catalogHtml ? cheerio.load(catalogHtml) : $;
      
      cat$('.bookchapter ul li a').each((i, el) => {
        const link = cat$(el);
        const href = link.attr('href') || '';
        const chapterIdMatch = href.match(/\/(\d+)\.html/);
        if (chapterIdMatch) {
          chapters.push({
            id: chapterIdMatch[1],
            title: link.text().trim(),
            index: i + 1,
          });
        }
      });

      // Check if catalog has multi-page index select dropdown
      if (catalogHtml) {
        const selectOptions = cat$('#indexselect option');
        if (selectOptions.length > 1) {
          const additionalPageUrls: string[] = [];
          selectOptions.each((_, opt) => {
            const val = cat$(opt).attr('value');
            if (val && val !== `/book/${bookId}.html` && !additionalPageUrls.includes(val)) {
              additionalPageUrls.push(val);
            }
          });

          // Fetch next catalog pages in parallel (limit up to 8 pages)
          const pagesToFetch = additionalPageUrls.slice(0, 8);
          const additionalHtmls = await Promise.all(
            pagesToFetch.map((pUrl) =>
              fetchHtml(`${baseUrl}${pUrl}`, { headers: { Referer: baseUrl } }).catch(() => '')
            )
          );

          for (const extraHtml of additionalHtmls) {
            if (!extraHtml) continue;
            const extra$ = cheerio.load(extraHtml);
            extra$('.bookchapter ul li a').each((_, el) => {
              const link = extra$(el);
              const href = link.attr('href') || '';
              const m = href.match(/\/(\d+)\.html/);
              if (m && !chapters.some((c) => c.id === m[1])) {
                chapters.push({
                  id: m[1],
                  title: link.text().trim(),
                  index: chapters.length + 1,
                });
              }
            });
          }
        }
      }

      return {
        id: bookId,
        title,
        author,
        cover: buildProxiedImageUrl(cover, baseUrl),
        category,
        status,
        updateTime,
        latestChapter,
        intro,
        chapters,
        sourceId: this.meta.id,
      };
    } catch (err: any) {
      console.error(`[diyibanzhu] getDetail failed for ${bookId}:`, err.message);
      throw new Error(`获取详情失败: ${err.message}`);
    }
  }

  public async getChapter(bookId: string, chapterId: string): Promise<ChapterContent> {
    const baseUrl = this.getBaseUrl();
    let currentChapterUrl = `${baseUrl}/37mx/${bookId}/${chapterId}.html`;
    let title = '';
    const paragraphs: string[] = [];
    let prevChapterId: string | null = null;
    let nextChapterId: string | null = null;

    // Track subpages for automatic stitching
    let subPageCount = 0;
    const maxSubPages = 15; // safety limit to prevent infinite loops

    while (currentChapterUrl && subPageCount < maxSubPages) {
      subPageCount++;
      const html = await fetchHtml(currentChapterUrl, {
        headers: { Referer: baseUrl },
      });
      const $ = cheerio.load(html);

      if (!title) {
        title = $('.read h1').first().text().trim() || '章节正文';
      }

      // Extract navigation links from the first subpage
      if (subPageCount === 1) {
        const prevHref = $('#prev_url').attr('href') || '';
        const prevMatch = prevHref.match(/\/(\d+)\.html$/);
        if (prevMatch && prevMatch[1] !== chapterId) {
          prevChapterId = prevMatch[1];
        }
      }

      // Extract next chapter link
      const nextHref = $('#next_url').attr('href') || '';

      // Extract and clean booktxt content
      const booktxt = $('#booktxt');

      // Replace sensitive character images with either plain character or proxied image tag
      booktxt.find('img').each((_, imgEl) => {
        const img = $(imgEl);
        const src = img.attr('src') || '';
        // e.g. /zi/a1.png
        const ziMatch = src.match(/\/zi\/([a-zA-Z0-9]+)\.png/);
        if (ziMatch && CHAR_MAP[ziMatch[1]]) {
          img.replaceWith(CHAR_MAP[ziMatch[1]]);
        } else if (src) {
          const fullImgUrl = src.startsWith('http') ? src : `${baseUrl}${src}`;
          const proxiedUrl = buildProxiedImageUrl(fullImgUrl, baseUrl);
          img.replaceWith(`<img src="${proxiedUrl}" class="inline-char-img" alt="" />`);
        }
      });

      // Split paragraphs
      const pElements = booktxt.find('p');
      if (pElements.length > 0) {
        pElements.each((_, p) => {
          const pText = $(p).html() || '';
          const cleaned = this.cleanParagraph(pText);
          if (cleaned) {
            paragraphs.push(cleaned);
          }
        });
      } else {
        // Handle plain <br> line breaks
        const rawContent = booktxt.html() || '';
        const lines = rawContent.split(/<br\s*\/?>/i);
        for (const line of lines) {
          const cleaned = this.cleanParagraph(line);
          if (cleaned) {
            paragraphs.push(cleaned);
          }
        }
      }

      // Check if there is a next subpage (e.g. 15339194_2.html)
      const subpagePattern = new RegExp(`${chapterId}_(\\d+)\\.html`);
      if (nextHref && subpagePattern.test(nextHref)) {
        currentChapterUrl = nextHref.startsWith('http') ? nextHref : `${baseUrl}${nextHref}`;
      } else {
        // Finished all subpages, check if nextHref points to the next real chapter
        const nextMatch = nextHref.match(/\/(\d+)\.html$/);
        if (nextMatch && nextMatch[1] !== chapterId) {
          nextChapterId = nextMatch[1];
        }
        break;
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
  }

  private cleanParagraph(html: string): string {
    let text = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .trim();

    // Filter ad and navigation notices
    const adKeywords = [
      '怕找不到回家的路',
      '请截图保存本站发布地址',
      '本章未完，点击下一页继续阅读',
      '本站会被大陆网络屏蔽',
      '点我自动发送邮件',
      '截屏或拍照记录当前页面',
      '百合小说网',
      'dybzwz.com',
      '本站域名並非永久域名',
    ];

    for (const kw of adKeywords) {
      if (text.includes(kw)) return '';
    }

    // Clean whitespace
    text = text.replace(/^&nbsp;|\u3000/g, '').trim();
    return text;
  }

  public async getHome(): Promise<HomeSection[]> {
    const baseUrl = this.getBaseUrl();
    try {
      const html = await fetchHtml(baseUrl, {
        headers: { Referer: baseUrl },
        timeout: 10000,
      });
      const $ = cheerio.load(html);
      const sections: HomeSection[] = [];
      const rankDivs = $('.rank');

      // 1. 热门推荐
      if (rankDivs.length > 0) {
        const hotDiv = rankDivs.eq(0);
        const hotBooks: HomeBookItem[] = [];
        hotDiv.find('dl').each((_, dl) => {
          const dt = $(dl).find('dt a');
          const href = dt.attr('href') || '';
          const idMatch = href.match(/(\d+)\.html/);
          if (!idMatch) return;
          const id = idMatch[1];
          const title = dt.text().trim();
          const intro = $(dl).find('dd').text().trim();
          const coverImg = $(dl).find('a.cover img, img');
          let cover = coverImg.attr('data-original') || coverImg.attr('src') || '';
          if (cover && !cover.startsWith('http')) cover = `${baseUrl}${cover}`;
          hotBooks.push({
            id,
            title,
            intro,
            cover: buildProxiedImageUrl(cover, baseUrl),
          });
        });
        if (hotBooks.length > 0) {
          sections.push({
            id: 'hot',
            title: '热门推荐',
            type: 'grid',
            items: hotBooks,
          });
        }
      }

      // 2. 排行榜: 本周人气榜 & 书友收藏榜
      const columns: { title: string; items: HomeBookItem[] }[] = [];
      const parseRankCol = (div: cheerio.Cheerio<any>, colTitle: string) => {
        const items: HomeBookItem[] = [];
        div.find('dl').first().each((_, dl) => {
          const dt = $(dl).find('dt a');
          const href = dt.attr('href') || '';
          const idMatch = href.match(/(\d+)\.html/);
          if (idMatch) {
            const title = dt.text().trim();
            const intro = $(dl).find('dd').text().trim();
            items.push({
              id: idMatch[1],
              title,
              intro: intro.slice(0, 50),
              rank: 1,
            });
          }
        });
        div.find('li').each((_, li) => {
          const a = $(li).find('a').first();
          const href = a.attr('href') || '';
          const idMatch = href.match(/(\d+)\.html/);
          if (idMatch) {
            const title = a.text().trim();
            const author = $(li).find('a[href*="/author/"]').text().trim();
            items.push({
              id: idMatch[1],
              title,
              author,
              rank: items.length + 1,
            });
          }
        });
        if (items.length > 0) {
          columns.push({ title: colTitle, items });
        }
      };

      if (rankDivs.length > 1) parseRankCol(rankDivs.eq(1), '本周人气榜');
      if (rankDivs.length > 2) parseRankCol(rankDivs.eq(2), '书友收藏榜');

      if (columns.length > 0) {
        sections.push({
          id: 'rankings',
          title: '排行榜',
          type: 'ranking',
          columns,
        });
      }

      // 3. 最新小说
      if (rankDivs.length > 3) {
        const newDiv = rankDivs.eq(3);
        const newBooks: HomeBookItem[] = [];
        newDiv.find('dl').each((_, dl) => {
          const dt = $(dl).find('dt a');
          const href = dt.attr('href') || '';
          const idMatch = href.match(/(\d+)\.html/);
          if (idMatch) {
            newBooks.push({
              id: idMatch[1],
              title: dt.text().trim(),
              intro: $(dl).find('dd').text().trim(),
            });
          }
        });
        newDiv.find('li').each((_, li) => {
          const a = $(li).find('a').first();
          const href = a.attr('href') || '';
          const idMatch = href.match(/(\d+)\.html/);
          if (idMatch) {
            const title = a.text().trim();
            const author = $(li).find('a[href*="/author/"]').text().trim();
            newBooks.push({
              id: idMatch[1],
              title,
              author,
            });
          }
        });
        if (newBooks.length > 0) {
          sections.push({
            id: 'new',
            title: '最新小说',
            type: 'grid',
            items: newBooks.slice(0, 10),
          });
        }
      }

      // 4. 最近更新
      if (rankDivs.length > 4) {
        const updateDiv = rankDivs.eq(4);
        const updates: HomeBookItem[] = [];
        updateDiv.find('dl').each((_, dl) => {
          const dt = $(dl).find('dt a');
          const href = dt.attr('href') || '';
          const idMatch = href.match(/(\d+)\.html/);
          if (idMatch) {
            const title = dt.text().trim();
            const info = $(dl).find('dd').text().trim().replace(title, '').trim();
            updates.push({
              id: idMatch[1],
              title,
              status: info,
            });
          }
        });
        if (updates.length > 0) {
          sections.push({
            id: 'updates',
            title: '最近更新',
            type: 'list',
            items: updates.slice(0, 15),
          });
        }
      }

      return sections;
    } catch (err: any) {
      console.error(`[diyibanzhu] getHome failed:`, err.message);
      return [];
    }
  }
}

// Plugin entry point \u2014 the registry auto-discovers the default export of every file in this directory.
export default new DiyibanzhuSource();
