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
- **🌐 多书源与防屏蔽多镜像架构**：
  - 首发内置 **第一版主 (diyibanzhu)** 适配器，集成官方发布页多条备用镜像线路（如 `m.37mx.com`, `m.zt51.com`, `m.917q.com`, `m.ct4k.com` 等）。
  - **一键全线路延迟测速**：可视监控各镜像 ping 延迟（毫秒级别展示），支持实时切换首选线路与手动填入新域名。
  - **标准化插件式书源接口**：易于扩展接入其它主流小说站（如 69书吧、笔趣阁等）。
- **💾 本地化隐私书架与进度记录**：无需注册账号或上传云端，书籍收藏、阅读章节与精确进度均保存在本地浏览器中。

---

## 🛠️ 技术栈

- **框架**：Next.js 14 (App Router) + React 18 + TypeScript
- **样式**：Tailwind CSS + Lucide Icons + 针对中文长篇排版优化的 CSS
- **数据抓取与解析**：Cheerio + Axios + Iconv-lite (支持 GBK / UTF-8 双编码兼容)
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

### 3. 生产打包与运行

```bash
pnpm build
pnpm start -p 3000
```

---

## 🔌 扩展新书源 (BookSource)

项目将书源抽象为标准化的接口（`src/sources/types.ts`），只需几行代码即可接入新小说源：

```typescript
import { BookSource, SearchResult, BookDetail, ChapterContent } from './types';

export class MyCustomSource implements BookSource {
  public meta = {
    id: 'my_source',
    name: '我的自定义源',
    description: '站点说明',
    version: '1.0.0',
    defaultMirror: 'https://example.com',
    mirrors: ['https://example.com'],
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
```

随后在 `src/sources/index.ts` 中注册：
```typescript
sourceRegistry.register(new MyCustomSource());
```
前端界面将自动识别并展示新书源，供用户随意切换！

---

## ⚖️ 免责与使用声明

本项目为个人学习交流与自用研究工具，不保存、不存储、不发布任何书籍文本版权数据。小说内容全部来源于互联网公开站点，请勿将解析服务公开发布或用于任何商业盈利用途。
