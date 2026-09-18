import { RuleBasedSource, RuleBookSourceConfig } from './rule-engine';

export const BIQUGE_DEFAULT_MIRRORS = [
  'https://www.bqg.org',
  'https://www.bqgiu.cc',
  'https://www.biquge.in',
  'http://www.biquge.xin',
  'https://www.b520.cc',
];

export const BIQUGE_CONFIG: RuleBookSourceConfig = {
  meta: {
    id: 'biquge',
    name: '笔趣阁 (通用)',
    description: '通用笔趣阁规则引擎源，适配常见笔趣阁站点与排版',
    baseUrl: BIQUGE_DEFAULT_MIRRORS[0],
    mirrors: BIQUGE_DEFAULT_MIRRORS,
    version: '1.0.0',
    publishUrl: 'https://www.bqg.org',
  },
  search: {
    url: '/search.php?keyword={keyword}',
    method: 'GET',
    charset: 'utf-8',
    listSelector:
      '.result-list .result-item, .novelslist2 li, .rank .content dl, #newscontent .l li, tbody tr:has(td.odd), .librarylist li',
    titleSelector: '.result-game-item-title-link, .s2 a, dt a, .odd a, .title a, h3 a',
    authorSelector:
      '.result-game-item-info-tag:first-child span:last-child, .s4, dd a[href*="/author/"], .odd:nth-child(3), .author',
    coverSelector: '.result-game-item-pic img, .cover img, dt img, img.lazy, .pic img',
    latestChapterSelector: '.result-game-item-info-tag:last-child a, .s3 a, .last a, .update a',
    detailUrlSelector: '.result-game-item-title-link, .s2 a, dt a, .odd a, .title a, h3 a',
    idRegex: '/(?:book|biquge|info)/([a-zA-Z0-9_-]+)',
  },
  detail: {
    url: '/book/{id}/',
    titleSelector: '.info h1, #info h1, .book-cell h1, .book-info h1, h1',
    authorSelector:
      '.info .small span:first-child, #info p:contains("作"), .book-meta a[href*="/author/"], #info p:first-of-type',
    coverSelector: '.info .cover img, #fmimg img, .book-cover, .book-info .pic img',
    introSelector: '.intro dd, #intro, .bookintro, .book-intro, #intro p',
    categorySelector: '.path a:nth-child(2), meta[property="og:novel:category"]',
    statusSelector: '.info .small span:contains("状"), meta[property="og:novel:status"]',
    chapterListSelector: '.listmain dl dd a, #list dd a, .bookchapter ul li a, #chapters-list li a',
    chapterTitleSelector: '',
    chapterUrlSelector: '',
    chapterIdRegex: '/(?:book/[a-zA-Z0-9_-]+/)?(\\d+)\\.html',
  },
  chapter: {
    url: '/book/{bookId}/{chapterId}.html',
    titleSelector: '.content h1, h1.wap_none, .read h1, #title, h1',
    contentSelector: '#content, #booktxt, #htmlContent, .read-content, #chaptercontent',
    adFilters: [
      '笔趣阁',
      '请记住本书首发域名',
      '最新章节访问',
      '本章未完，点击下一页继续阅读',
      '天才一秒记住本站地址',
      '无错小说网',
      'http://',
      'https://',
      'www.',
      '章节错误,点此报送',
      'read3()',
      'style3()',
      'show_htm2()',
    ],
  },
};

export class BiqugeSource extends RuleBasedSource {
  constructor(customConfig?: Partial<RuleBookSourceConfig>) {
    super({
      ...BIQUGE_CONFIG,
      ...customConfig,
      meta: {
        ...BIQUGE_CONFIG.meta,
        ...(customConfig?.meta || {}),
      },
      search: {
        ...BIQUGE_CONFIG.search,
        ...(customConfig?.search || {}),
      },
      detail: {
        ...BIQUGE_CONFIG.detail,
        ...(customConfig?.detail || {}),
      },
      chapter: {
        ...BIQUGE_CONFIG.chapter,
        ...(customConfig?.chapter || {}),
      },
    });
  }
}
