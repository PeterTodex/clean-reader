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

### 书源与镜像线路是如何串联的

两者都以 URL 查询参数的形式传递，阅读页还额外增加了一层处理：

- `?source=<id>` 出现在所有书籍页/阅读页 URL 上（缺省时默认为 `diyibanzhu`），其优先级高于任何已存储的偏好。
- `?mirror=<url>` 由阅读页从 `storage.getSettings().selectedMirror` 拼接到请求上（`src/app/read/[id]/[chapterId]/page.tsx:28-29`），因此在 `/sources` 页选定的线路会一路传递到章节请求。
- 路由处理器把 `customMirror` 透传给适配器；每个适配器都通过 `getBaseUrl()` 解析它，并在缺省时回退到 `meta.defaultMirror`。

## BookSource 书源层

`src/sources/types.ts` 定义了契约：`search` / `getDetail` / `getChapter`，三者都接受一个可选的 `customMirror`。`SourceRegistry`（`src/sources/index.ts`）是在模块加载时实例化的单例；当传入的 id 不存在时，`getSource()` 会回退到 `diyibanzhu`。

目前存在两种适配器实现方式：

- **手写适配器** —— `src/sources/diyibanzhu.ts`。包含站点专属选择器，以及无法用配置表达的逻辑：遍历 `_2.html` / `_3.html` 子页并把它们拼接成完整的一章，以及通过 `CHAR_MAP` 还原源站用 `/zi/<code>.png` 图片替换掉的敏感字。
- **配置驱动** —— `src/sources/rule-engine.ts`（`RuleBasedSource`）。一个 `RuleBookSourceConfig` 承载 CSS 选择器、id 正则、字符集、POST body 与广告过滤词；引擎负责关键词编码、URL 解析、选择器降级回退以及翻页链接提取。`BiqugeSource`（`src/sources/biquge.ts`）本质上就是 `RuleBasedSource` 叠加 `BIQUGE_CONFIG` 与用户覆写 —— **它是新增任何配置驱动书源的模板。**

用户可以在运行时新增书源而无需重新部署：`registerCustomRule()` 会把一份 `RuleBookSourceConfig` 持久化到 localStorage 的 `clean_reader_custom_rules` 键下，并为它注册一个 `RuleBasedSource`。导入/导出辅助方法挂在注册表上。

**新增一个书源的步骤：** 编写适配器（或为配置驱动路径编写一份 `RuleBookSourceConfig`），在 `SourceRegistry` 构造函数中注册它，并在 `src/sources/index.ts` 中重新导出。界面会自动从 `GET /api/sources` 读取并展示它。

### 抓取本身就是在对抗性环境中工作 —— 代码看起来"防御性很强"是正常的

适配器的形态由目标站点的行为决定，这正是其中大量非直观代码的成因：

- **字符编码**：`fetchHtml` 一律以 `arraybuffer` 请求，对非 UTF-8 显式解码，并嗅探正文中是否声明了 `gbk` / `gb2312` 的 meta 字符集，因为这类站点编码并不统一。
- **章节是多页的**：一个逻辑章节常被拆成 `_2.html`、`_3.html`…… `getChapter` 会带安全上限地循环抓取，只有当"下一页"链接不再匹配子页模式时，才把它当作"下一章"。
- **广告是按关键词而非按标签过滤的**：`diyibanzhu.ts` 与 `rule-engine.ts` 中的 `cleanParagraph` 会丢弃任何命中黑名单词组的段落。`src/app/api/export/txt/route.ts` 为 TXT 导出**另带了一份独立的正则版本** —— 修改广告过滤逻辑时通常需要同时改这三处。
- **图片有防盗链**：所有正文与封面图片都经由 `buildProxiedImageUrl` → `/api/proxy/image`，由服务端携带 `Referer` 重新抓取，并缓存一天。

### 正文以"已清洗的 HTML"形式返回

适配器同时返回 `content`（用 `<p>` 拼接的 HTML 字符串）与 `paragraphs`（数组）。`ReaderView` 通过 `dangerouslySetInnerHTML` 逐段渲染的是 **`paragraphs`** —— 阅读器并不使用 `content`。适配器是唯一的净化层，因此在那里新增的任何处理都必须在返回前剥离 script/style/标签。

## 客户端状态

`src/lib/storage.ts` 是**应用状态 localStorage 的唯一归属者** —— 没有其他模块碰它，项目里也没有 `storage` 事件监听、Context 或 SWR。组件在挂载/打开时读取，并通过 prop 回调刷新，因此跨标签页与跨组件的更新不会自动传播。所有读取都用 `typeof window === 'undefined'` 做了 SSR 保护。

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

## 约定

- **没有 `cn()` 辅助函数。** `clsx` 与 `tailwind-merge` 虽在依赖中，但在任何地方都未被引入 —— 类名一律用模板字符串配合三元表达式拼接。
- 图标一律来自 `lucide-react` 的具名导入。
- Tailwind 工具类内联使用，没有 CSS Modules。强调色为 `amber-800`，配以 `stone` 中性色系，标题使用 `font-serif`。页面背景色 `#faf8f5` 是逐页硬编码的，并未参与主题化。
- **没有共享的弹窗基础组件** —— `ReaderSettingsModal`、`BookmarkModal`、`BookDownloaderModal` 与 `ChapterDrawer` 各自重复实现了同一套 `isOpen` prop + `fixed inset-0 z-50` 遮罩 + 移动端底部抽屉的写法。
- 错误提示与破坏性操作确认使用原生 `alert()` / `confirm()`，而非 toast。
- 图片一律使用原生 `<img>` 配 `onError` 处理，从不使用 `next/image`（`next.config.mjs` 中设置了 `images.unoptimized`）。

## TXT 导出

`POST /api/export/txt`（`src/app/api/export/txt/route.ts`）以每批 4 个并发章节请求配合重试的方式流式返回一个 `ReadableStream`，设置了 `maxDuration = 300`，并把标题重新格式化为 `第{index}章 {title}`、正文以全角空格缩进。它的广告过滤、段落清洗与章节编号逻辑是**从适配器复制而来、而非共享的** —— 修改任意一侧时请留意同步。
