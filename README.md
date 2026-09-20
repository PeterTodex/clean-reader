# 清阅 (CleanReader) 📖

一款专注于**纯粹、优雅、免费且零广告**的现代网页小说阅读器。专为个人打造，主要解决源站点广告泛滥、加载缓慢、移动端弹窗横行、排版审美陈旧等痛点。

---

## ✨ 核心亮点

- **🚫 零广告无干扰**：智能过滤源站各类诱导点击、横幅广告、漂浮弹窗、反盗版防刷干扰与邮箱推广。
- **🧩 智能章节无缝拼接**：自动识别并将小说源站单章节的多页分段（例如 `_2.html`、`_3.html`）合并为单一完整章节，杜绝频繁翻页中断阅读沉浸感。
- **🔤 敏感字图像自动还原**：源站为防屏蔽常将敏感文字替换为图标（如 `/zi/*.png`），清阅内置智能文字映射与高保真行内流式自适应渲染，保持字符排版完全自然。
- **🎨 6 种精心调校的阅读美学主题**：
  - 📜 **雅致羊皮纸**（温润护眼，久看不累）
  - 🍃 **护眼豆沙绿**（清新柔和，舒缓疲劳）
  - ⚪ **纯净象牙白**（极简现代，明亮通透）
  - 📄 **水墨电子纸**（模拟墨水屏质感）
  - 🌙 **深邃暗夜模式**（夜间舒适微光）
  - 🖤 **OLED 极致纯黑**（省电且纯粹深邃）
- **📐 自由排版系统**：支持自由调节字号大小（14px~32px）、行间距、字体类型（衬线宋体 / 典雅楷体 / 现代黑体）、版心最大宽度（640px~1100px）以及滚动 / 分页阅读模式。
- **⚡ 零延迟翻页（智能预加载）**：阅读当前章节时，后台静默预先加载下一章节并在内存中高速缓存，点击“下一章”瞬间完成切换。
- **🌐 多书源插件架构**：
  - 内置 **搬山人小说网** 与 **第一版主** 两个适配器，分别处理各自的站点特性（句子级分段还原 / 章节多页拼接与敏感字图像还原）。
  - **标准化插件式书源接口**：新增书源只需在 `src/sources/plugins/` 放一个文件，无需改动其他代码；内置规则驱动引擎，也可在运行时导入自定义规则。
- **🔄 本地书库与章节缓存**：服务端把抓取过的章节正文以标准 TXT 与 JSON 文件存储在本地磁盘，同一章被任何人读过之后再读就直接命中缓存，不再重复请求源站——既降低被限流/封禁的风险，翻页也更快。同时可方便地在本地文件系统或 NAS 中直观管理。
- **💾 本地化隐私书架与进度记录**：无需注册账号或上传云端，书籍收藏、阅读章节与精确进度均保存在本地浏览器中。

---

## 🛠️ 技术栈

- **框架**：Next.js 14 (App Router) + React 18 + TypeScript
- **样式**：Tailwind CSS + Lucide Icons + 针对中文长篇排版优化的 CSS
- **数据抓取与解析**：Cheerio + Axios + Iconv-lite (支持 GBK / UTF-8 双编码兼容)
- **本地书库与文件存储**：纯文件系统存储（TXT + JSON），原子写入保证一致性
- **反盗链与图像中继**：内置流式 Image Proxy 路由，绕过防盗链机制

---

## 🚀 快速开始

### 1. 安装依赖

```bash
# 进入项目目录
cd clean-reader

# 安装依赖
pnpm install
```

### 2. 本地开发启动

```bash
pnpm dev
```
打开浏览器访问：`http://localhost:3000`

### 3. 生产一键部署（推荐）

在服务器拉取代码后，直接运行一键部署脚本即可（默认端口 `9527`，自动配置 1C1G Swap、构建并使用 PM2 守护）：

```bash
chmod +x deploy.sh
./deploy.sh
```

如需手动构建与运行：

```bash
pnpm build
pnpm start -p 9527
```

---

## 🔄 本地书库与章节缓存

服务端在 `/api/chapter` 与 TXT 导出两条路径上都做了本地文件存储：某章节第一次被请求时从源站抓取并以纯文本标准文件落盘，之后任何请求都直接命中本地文件，不再打源站。

- 目录默认在 `.cache/books/`（已 gitignore），按 `书源/书名_书ID/chapters/序号_章节名.txt` 结构组织
- 配套包含 `meta.json`（书籍元数据）与 `toc.json`（章节索引与映射）
- 离线书库模式：已下载与阅读过的书籍章节永久保留在磁盘，无需担心缓存被自动淘汰
- 抓取失败或正文异常的响应**不会**落盘，避免污染本地书库

可用环境变量自定义存储路径：

| 变量 | 默认值 | 说明 |
|---|---|---|
| `CLEAN_READER_STORAGE_DIR` | `.cache/books` | 本地书库与缓存根路径 |

---

## 🔌 扩展新书源 (BookSource)

项目将书源抽象为标准化的接口（`src/sources/types.ts`），并且是**插件式**的：`src/sources/plugins/` 下每个文件就是一个书源，新增或删除都**不需要改动其他任何代码**。

只需在 `src/sources/plugins/my-source.ts` 里写入实现并 `export default` 一个实例即可：

```typescript
import { BookSource, SearchResult, BookDetail, ChapterContent } from '../types';

class MyCustomSource implements BookSource {
  public meta = {
    id: 'my_source',
    name: '我的自定义源',
    description: '站点说明',
    version: '1.0.0',
    baseUrl: 'https://example.com',
  };

  async search(keyword: string): Promise<SearchResult[]> {
    // 1. 发起搜索请求
    // 2. 使用 cheerio 解析列表并返回统一格式
  }

  async getDetail(bookId: string): Promise<BookDetail> {
    // 解析书籍基本信息与章节列表目录
  }

  async getChapter(bookId: string, chapterId: string): Promise<ChapterContent> {
    // 解析章节正文内容，清洗广告
  }
}

export default new MyCustomSource();
```

如果目标站点的结构能用 CSS 选择器描述，还可以更省事——直接复用规则引擎，一个文件就是一行配置：

```typescript
import { RuleBasedSource } from '../rule-engine';

export default new RuleBasedSource({
  meta: { id: 'my_source', name: '我的自定义源', baseUrl: 'https://example.com' },
  search: { url: '/search.php?keyword={keyword}', listSelector: '.result-item', /* … */ },
  detail: { url: '/book/{id}/', /* … */ },
  chapter: { url: '/book/{bookId}/{chapterId}.html', contentSelector: '#content', /* … */ },
});
```

前端界面会自动识别并展示新书源，供用户随意切换！删除书源同样只需删掉对应文件，应用不会因此出错。

默认书源由插件**显式声明**，不受文件名排序影响——想让它成为无 `?source=` 参数时的回退目标，再加一行即可：

```typescript
export default new MyCustomSource();
export const isDefault = true;   // 可选；不写就不会成为默认
```

同一时刻只应有一个插件声明 `isDefault`；若多个同时声明，注册表取先注册的那个并打英文警告。没有任何插件声明时，回退到首个注册的书源。

> 自动发现基于 webpack 的 `require.context`，因此新增书源后需要重新构建才生效；该机制在 Turbopack 下不可用。

---

## ⚖️ 免责与使用声明

本项目为个人学习交流与自用研究工具，小说内容全部来源于互联网公开站点，请勿将解析服务公开发布或用于任何商业盈利用途。

**关于服务端缓存**：为避免对源站的重复请求，服务端会把已抓取的章节正文持久化到本机（默认 `.cache/clean-reader.db`，见下文「章节中转缓存」）。该缓存仅存在于你自己部署的实例上，本项目不附带、也不提供任何公共的内容分发服务。若将该实例公开对外提供服务，由此产生的责任由部署者自行承担。
