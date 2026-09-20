# AGENTS.md

本文件为在本仓库中工作的编码助手提供指导。

## 常用命令

包管理器使用 **pnpm** —— 仓库中只提交了 `pnpm-lock.yaml`。

```bash
pnpm install
pnpm dev              # http://localhost:3000
pnpm build
pnpm start
npx tsc --noEmit      # 类型检查；package.json 中没有 typecheck 脚本
```

本仓库**没有测试框架，也没有任何测试用例** —— 未配置测试运行器，因此不存在“运行单个测试”的命令，请勿臆造。

`pnpm lint` 绑定的是 `next lint`，但仓库中未提交任何 ESLint 配置（`.eslintrc*` / `eslint.config.*`），首次运行时会提示创建配置，而不是直接执行检查。

### 严禁在日常修改后执行 pnpm build（防止破坏 dev 热重载）

- **开发态热重载机制**：用户在本地终端通常长期运行 `pnpm dev`。Next.js 的 `pnpm dev` 与 `pnpm build` **共享同一个 `.next/` 目录**。
- **冲突影响**：助手在修改前端组件、页面或样式后若在后台执行 `pnpm build`（或清除 `.next/` 目录），会直接覆盖改写开发环境的内存映射和 HMR（Hot Module Replacement）热更新缓存，导致用户浏览器端失去样式与组件的自动热重载能力、甚至抛出 chunk 404，迫使用户每次都必须重启 `pnpm dev`。
- **严格验证准则**：
  - **日常开发、UI 组件、页面与样式修改**：验证代码语法与类型安全**仅允许使用 `npx tsc --noEmit`**，严禁在后台执行 `pnpm build`！
  - **何时才可执行 `pnpm build`**：仅在用户明确要求全量打包验证、部署发布前终验、或者新增/删除了书源插件（验证 `GET /api/sources` 静态预渲染固化）且用户知晓需重启 dev server 时，才可执行。

## 项目定位

清阅 / CleanReader —— 一个 Next.js 14 App Router 应用，抓取中文网络小说站点，剥除其广告与反爬干扰，再以无广告的阅读界面重新渲染章节。所有面向用户的文案均为中文（`<html lang="zh-CN">`，见 `src/app/layout.tsx`）；所有代码注释、`console` 输出以及适配器抛出的错误信息均为英文。项目未引入任何 i18n 框架，界面文案直接内联。

## 请求链路

```
页面（客户端） → /api/* 路由处理器 → sourceRegistry.getSource(sourceId) → BookSource 适配器 → axios/cheerio
```

每个路由处理器都是同样的三行逻辑：解析 `searchParams` → `sourceRegistry.getSource(...)` → 返回 `NextResponse.json({ success, data })` 或 `{ success: false, error }`。该响应结构在全项目统一，且所有客户端 fetch 都依赖它。

- `src/app/layout.tsx` 是全应用**唯一的服务端组件**。它导出 `metadata`/`viewport` 并渲染一个空的 `<body>` —— 没有 Provider、没有全局状态。
- 四个页面与所有组件均为 `'use client'`，在 `useEffect` 中请求 JSON 接口。项目没有 RSC 数据获取、没有服务端 props、也没有流式渲染。

### 抓取类依赖只能在服务端使用

`axios`、`cheerio`、`iconv-lite` 仅在 `src/sources/**` 与 `src/lib/request.ts` 中被引入，这些代码运行在路由处理器内。API 路由就是客户端/服务端的分界线 —— 把上述任一依赖引入 `'use client'` 文件会导致构建失败。项目未引入 `server-only` 守卫包，这一约束仅靠约定维持。

### 书源是如何串联的

`?source=<id>` 出现在所有书籍页/阅读页 URL 上，其优先级高于任何已存储的偏好。缺省（或为空串）时由 `getSource()` 回退到**被标记为默认的书源**，见下文。

**一个书源只有一个地址。** 没有 mirror / 线路切换机制——`SourceMeta.baseUrl` 就是站点根地址，适配器通过 `getBaseUrl()` 读取它并去掉尾斜杠。历史上曾有过"多镜像备用"，但那是建立在错误前提上的，已被移除，详见下面 `diyibanzhu` 插件里的注释。

> 具体教训：发布页上并列的兄弟域名（`m.37mx.com`、`m.zt51.com`、`m.680t.com` …）跑的是同一套 CMS，但**每站用自己的域名作 URL 路径前缀**（`/37mx/`、`/zt51/`、`/680t/`）且**书 id 空间彼此独立**——一个 id 只在其中一站存在。把它们当镜像会导致 `https://m.zt51.com/37mx/1094730.html` 这种不可能存在的 URL。**新增书源时应把每个站点做成独立插件，而不是把它们塞进同一个书源的地址列表。**

## BookSource 书源层

`src/sources/types.ts` 定义了契约：`search(keyword)` / `getDetail(bookId)` / `getChapter(bookId, chapterId)`。`SourceRegistry`（`src/sources/index.ts`）是在模块加载时实例化的单例。

**默认书源由插件显式声明**，不靠文件名排序。想成为默认的插件模块导出：

```ts
export default new MySource();
export const isDefault = true;
```

`SourceRegistry` 在发现阶段读取该标记并记下 `explicitDefaultId`；`getSource()` 在未指定 id 时回退到它。没有任何插件标记时回退到**首个注册的书源**，因此单插件场景（或标记写错时）仍然可用，且任何一个书源被单独删除都不会让应用崩。

这样设计是因为**按字典序取首个太脆弱**：新增一个文件名排序靠前的插件会无声改变全站默认书源，对已存在的 `?source=` 书签而言是行为变化。`isDefault` 让"谁是默认"成为一处显式声明。（代价：新增默认书源要改两个文件——新插件加标记、旧插件删标记。这是刻意换取的明确性。）

多个插件同时标记时只取先注册的那个并打英文 `console.warn`。`listSources()` 会把默认书源排到首位，这样 UI 的"第一项"与服务端回退目标始终一致。

传入未知 id 时 `getSource()` 会先 `console.warn` 再回退，不会静默返回另一个书源的内容。

### 书源是插件

`src/sources/plugins/` 下的每个 `.ts` 文件就是一个书源。

**插件契约：模块 `export default` 一个满足 `BookSource` 的实例**，可选再导出 `isDefault = true` 声明它是全站默认书源（见上一节）。注册表在构造函数中通过 `require.context('./plugins', false, /\.ts$/)` 自动发现，按 key 排序后依次注册——排序只为保证注册顺序确定，默认书源不依赖它。单个插件在加载时抛错、或 default 导出缺少合法 `meta.id` 时，只打印英文 `console.warn` 并跳过，不会拖垮整个注册表。

两种实现方式都落在这个契约上：

- **手写适配器** —— `src/sources/plugins/diyibanzhu.ts`（`第一版主`）与 `src/sources/plugins/banshanren.ts`（`搬山人小说网`，全站默认）。包含站点专属选择器，以及无法用配置表达的逻辑：第一版主要遍历 `_2.html` / `_3.html` 子页拼接成完整一章，并通过 `CHAR_MAP` 还原源站用 `/zi/<code>.png` 图片替换掉的敏感字；搬山人则要把站点按句切分的 `<p>` 还原成段落、剥离内联的评论徽章 `<span class="z">`、并识别截断正文的付费墙遮罩。文件末尾的 `export default new XxxSource()` 就是插件入口。
- **配置驱动** —— `src/sources/rule-engine.ts`（`RuleBasedSource`）。一个 `RuleBookSourceConfig` 承载 CSS 选择器、id 正则、字符集、POST body 与广告过滤词；引擎负责关键词编码、URL 解析、选择器降级回退以及翻页链接提取。`RuleBasedSource` 的构造函数只接受一个 config 并自行派生 meta，所以**配置型插件就是一行**：`export default new RuleBasedSource({ meta, search, detail, chapter })`。

**新增书源 = 往 `src/sources/plugins/` 放一个文件；删除书源 = 删掉那个文件。** 不需要改 `index.ts`，也不需要改任何其他代码。界面会自动从 `GET /api/sources` 读取并展示。

注意 `GET /api/sources` 是全项目**唯一被静态预渲染的 API 路由**（构建产物里是 `○ (Static)`），`sourceRegistry` 在 `next build` 期间求值并固化。因此新增或删除插件后**必须重新构建**才生效，这是预期行为而非缺陷。`next dev` 会监听目录、新文件立即生效，与 `next build` 的答案不同——验证插件是否真的被发现，要固定用 `pnpm build` 后查 `.next/server/app/api/sources.body`，而不是 `curl` dev server。

上面那条 `try/catch` 只能隔离**运行时**错误（模块顶层抛错、`meta.id` 非法、重复 id）。插件里的**语法或类型错误会让整个构建失败**——context module 编译不过会沿着 `index.ts` 波及全部 5 个 API 路由。这是构建期发现机制的固有代价，靠部署前必跑 `npx tsc --noEmit` 与 `pnpm build` 兜住，不要误以为漏写了 try/catch。

运行时（浏览器端）还能通过 localStorage 新增书源而无需重新部署：`registerCustomRule()` 把一份 `RuleBookSourceConfig` 存到 `clean_reader_custom_rules` 键下并注册对应的 `RuleBasedSource`，导入/导出辅助方法挂在注册表上。这条路径只在前端生效，服务端不受影响。

### 自动发现依赖 webpack，不兼容 Turbopack

`require.context` 是 webpack 专有 API，类型声明见 `src/types/webpack-require-context.d.ts`（项目未安装 `@types/webpack-env`，该文件把 `context` 合并进全局 `NodeJS.Require`）。

项目当前用 webpack 构建，但 **`require.context` 在 Turbopack 下不工作**：若启用 `next dev --turbo`，或将来升级到默认使用 Turbopack 的 Next 版本，插件目录会静默变成空列表（`getSource()` 随后抛 `No book sources registered`）。届时需要改用 `import.meta.webpackContext`，或退回显式的插件清单。

### 抓取本身就是在对抗性环境中工作 —— 代码看起来"防御性很强"是正常的

适配器的形态由目标站点的行为决定，这正是其中大量非直观代码的成因：

- **字符编码**：`fetchHtml` 一律以 `arraybuffer` 请求，对非 UTF-8 显式解码，并嗅探正文中是否声明了 `gbk` / `gb2312` 的 meta 字符集，因为这类站点编码并不统一。
- **章节是多页的**：一个逻辑章节常被拆成 `_2.html`、`_3.html`…… `getChapter` 会带安全上限地循环抓取，只有当"下一页"链接不再匹配子页模式时，才把它当作"下一章"。
- **广告是按关键词而非按标签过滤的**：`diyibanzhu.ts` 与 `rule-engine.ts` 中的 `cleanParagraph` 会丢弃任何命中黑名单词组的段落。`src/app/api/export/txt/route.ts` 为 TXT 导出**另带了一份独立的正则版本** —— 修改广告过滤逻辑时通常需要同时改这三处。
- **图片有防盗链**：所有正文与封面图片都经由 `buildProxiedImageUrl` → `/api/proxy/image`，由服务端携带 `Referer` 重新抓取，并缓存一天。

### 正文以"已清洗的 HTML"形式返回

适配器同时返回 `content`（用 `<p>` 拼接的 HTML 字符串）与 `paragraphs`（数组）。`ReaderView` 通过 `dangerouslySetInnerHTML` 逐段渲染的是 **`paragraphs`** —— 阅读器并不使用 `content`。适配器是唯一的净化层，因此在那里新增的任何处理都必须在返回前剥离 script/style/标签。

## 本地书库与章节文件缓存

`src/lib/chapter-cache.ts` 把服务端变成**本地书库与中转缓存**：某章节第一次被请求时抓取第三方并以标准文本文件落盘，之后所有请求（无论来自哪个浏览器）都直接由本地文件系统返回，不再打源站。

- **存储结构**：纯文件系统存储，位于 `.cache/books/`（已被 gitignore，可用 `CLEAN_READER_STORAGE_DIR` 覆盖路径）。
  - `[sourceId]/[safeTitle]_[bookId]/meta.json`：书籍元数据（作者、简介、状态、封面地址等）。
  - `[sourceId]/[safeTitle]_[bookId]/toc.json`：完整章节目录与物理文件名映射索引表。
  - `[sourceId]/[safeTitle]_[bookId]/chapters/0001_第一章.txt`：4位前导零序号与清洗后的章节名，第一行为标题，后续行为自然段落。
  - `_home/[sourceId].json`：书源首页推荐分区缓存。
- **并发与原子写入**：使用写入 `.tmp` 临时文件再 `fs.renameSync` 的原子替换方案，杜绝高并发或进程中断导致的半写坏文件；内存中维持 `inFlight` Map 进行并发请求去重。
- **持久保留**：本地书库模式，已下载与阅读过的书籍章节永久保留在磁盘，不自动删除，便于通过文件系统/NAS/Samba 直观管理与阅读。
- **质量闸门**：`paragraphs` 为空或正文短于 100 字符时拒绝写入，避免源站拦截或报错内容污染本地书库。

**接入点**：`src/app/api/chapter/route.ts`（响应头带 `X-Cache: HIT|MISS`）、`src/app/api/book/route.ts` 与 `src/app/api/export/txt/route.ts`。

**服务端专属**：`chapter-cache.ts` 使用 Node.js `node:fs` / `node:path`，绝不能出现在 `'use client'` 文件中。项目未装 `server-only` 包，这条约束与 `axios`/`cheerio` 一样仅靠约定维持。

## 客户端状态

`src/lib/storage.ts` 是**应用状态 localStorage 的唯一归属者** —— 没有其他模块碰它，项目里也没有 `storage` 事件监听、Context 或 SWR。组件在挂载/打开时读取，并通过 prop 回调刷新，因此跨标签页与跨组件的更新不会自动传播。所有读取都用 `typeof window === 'undefined'` 做了 SSR 保护。

（章节正文的服务端缓存不属于这一层，见上一节。`ReaderView` 里还有一个**纯内存**的 `chapterCacheRef`，只服务于单次会话内的即时翻页，刷新即失效——它不持久化，与服务端缓存互不冲突。）

键名：`clean_reader_bookshelf`、`clean_reader_settings`、`clean_reader_bookmarks`，外加 `src/sources/index.ts` 中的 `clean_reader_custom_rules`。书籍在全项目范围内都由 **`(id, sourceId)` 二元组**标识 —— 同一本书 id 出现在两个书源上即为两本书。

`clean_reader_source` 在 `STORAGE_KEYS` 中有声明，但从未被读写；当前生效的书源改由 URL 上的 `?source=` 参数承载。

## 阅读界面

`ReaderView`（`src/components/ReaderView.tsx`）承载了整套阅读体验，并自行持有设置状态，经由 `storage.saveSettings()` 写回。

- **主题与排版是两套独立系统。** 主题是一个 CSS **类名** —— `theme-${settings.theme}`，同时应用于阅读器根节点以及固定的页头/页脚。排版（字号、行高、字体、版心宽度）则是内容元素上的**内联样式**。
- **主题写在 `globals.css` 里，而非 Tailwind 中。** 六种主题各是一段手写的 `.theme-*` 样式块，负责设置背景/文字色并为其后代重新着色。`tailwind.config.ts` 设置了 `darkMode: "class"`，但没有任何地方设置 `.dark` —— 因此 `ReaderView` 与 `TtsPlayer` 中的 `dark:` 变体是失效的。
- **预加载**：当 `autoPreloadNext` 开启时，一个内存中的 `Map` ref 会缓存预取的章节。它能避免重复的网络请求，但 URL 变更仍会重新触发阅读页的 `useEffect`（它依赖 `chapterId`）并显示全屏加载态。
- **阅读进度**来自 `window` 滚动监听，并在变化时写入书架。

**新增一个主题的步骤：** 在 `src/lib/storage.ts` 的 `ReaderSettings['theme']` 联合类型中加入新 id，并在 `globals.css` 中加入对应的 `.theme-*` 样式块。可选地，在 `ReaderSettingsModal` 中补上该主题的色板选项 —— 主题/设置的界面就在那里。

### 已知的失效 / 空实现代码

不要基于以下内容开发，也不要假设它们可用：`readingMode: 'page'` 可在设置弹窗中选择，但除该弹窗外无人读取 —— 没有任何逻辑消费它来改变渲染，因此实际只存在纵向滚动；`animate-fade-in` 被各弹窗使用，但项目中并未定义任何关键帧；上文提到的 `dark:` 变体；以及 `STORAGE_KEYS.ACTIVE_SOURCE`。

## 约定与基础组件

- **类名合并工具 `cn()`**：位于 `src/lib/utils.ts`，基于已安装的 `clsx` 与 `tailwind-merge` 实现。推荐在组件条件样式与变体拼接中优先使用 `cn()`。
- **共享弹窗与抽屉基础组件**：
  - `Modal`（`src/components/Modal.tsx`）：全站统一的居中/响应式底部弹窗，内置了统一遮罩、Escape 键退出、Body 滚动锁定、点击背景关闭、主题适配与标题/关闭按钮封装。已接入 `ReaderSettingsModal`、`BookDownloaderModal`、`SearchModal`。
  - `Drawer`（`src/components/Drawer.tsx`）：全站统一的侧边抽屉（支持 `left` / `right` / `bottom`），内置遮罩、滚动锁定与动画。已接入 `ChapterDrawer`（左侧目录/书签）、`BookContentSearchModal`（右侧正文检索）。
- 图标一律来自 `lucide-react` 的具名导入。
- Tailwind 工具类内联使用，没有 CSS Modules。标题使用 `font-serif`。
- 错误提示与破坏性操作确认使用原生 `alert()` / `confirm()`，而非 toast。
- 图片一律使用原生 `<img>` 配 `onError` 处理，从不使用 `next/image`（`next.config.mjs` 中设置了 `images.unoptimized`）。

## TXT 导出

`POST /api/export/txt`（`src/app/api/export/txt/route.ts`）以每批 4 个并发章节请求配合重试的方式流式返回一个 `ReadableStream`，设置了 `maxDuration = 300`，并把标题重新格式化为 `第{index}章 {title}`、正文以全角空格缩进。它的广告过滤、段落清洗与章节编号逻辑是**从适配器复制而来、而非共享的** —— 修改任意一侧时请留意同步。
