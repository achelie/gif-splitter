# GIF Splitter 页面与关键词规划

规划日期：2026-10-27。此文档是建设方案，候选 URL 不表示页面或功能已上线。没有取得本站 Search Console 数据，也没有重新核实关键词月搜索量、难度或指定地区的实时排名。

2026-10-28 实施进度：P0 首页与教程、P1 GIF Merger、P2 GIF to JPG 和 GIF to WebP、P3 Resize GIF 和 Crop GIF 均已在本地实现；五个新工具页扩展为 10 种语言，尚未部署。P2 输出为静态图片，不生成动画 WebP。本地化的地区用词研究及数据限制见 [多语言关键词研究](localized-keyword-research-2026-10-28.md)。以下表格保留制定时的优先级和验证假设。

## 一、规划原则

- 按用户要完成的任务分组，不按每个关键词的字面差异建页。一个页面可以覆盖多个自然表达。
- 每个独立工具页都应直接完成其承诺的任务；先实现和测试，再公开及加入 sitemap。
- 首页已支持单帧 PNG、选中帧和全部帧 ZIP；新页与首页功能重叠时，先核实不同用户需求和页面价值。
- 以下优先级是产品和内容决策，不是搜索排名或流量保证。用 Search Console 和目标地区搜索结果持续修正。

## 二、现有页面的分工

| 页面 | 主要用户任务 | 主要表达与相关词 | 动作 |
| --- | --- | --- | --- |
| `/` | 把 GIF 拆成完整 PNG 帧；下载一张、选中帧或全部帧 | gif splitter；gif frame extractor；extract frames from gif；split gif into frames；gif to png | 保留为拆帧主页面。自然覆盖近义词，继续完善真实工具和说明，不为同义词复制页面。 |
| `/how-to-extract-gif-frames/` | 学习如何拆帧、预览和下载 | how to split a gif into frames；how to extract gif frames；save one frame from a gif | 升级现有教程，使用真实步骤、截图或示例，与首页双向链接；避免同主题再建一篇。 |
| `/gif-transparency-and-disposal/` | 了解透明背景、局部帧叠加和图片异常 | transparent gif frames；extracted gif frames look broken | 保留专业问题解决定位，使用现有 disposal 示例说明结果；链接至首页和排错指南。 |
| `/gif-frame-timing/` | 理解帧延迟、播放时间与导出图片的限制 | gif frame timing；gif frame delay | 保留说明原始延迟与预览行为的定位，链接回工具和教程。 |
| `/large-gif-extraction-troubleshooting/` | 文件过大、帧数或内存限制时寻找解决办法 | gif splitter file too large；gif extraction memory | 明确当前限制和可执行的缩小、缩短及分批下载建议；链接首页。 |

以上关键词是页面覆盖建议，不代表已核实搜索量。搜索时如用户要把动画分成两个较短的 GIF，那是与提取静态帧不同的任务，应单独研究，不应在首页宣称已支持。

## 三、新工具页面优先级

| 顺序 | 建议 URL / 主词 | 用户任务与独立价值 | 上线前提 | 当前决定 |
| --- | --- | --- | --- | --- |
| 1 | `/gif-merger/` · gif merger / combine gifs | 多个 GIF 按顺序合为一个 GIF；与拆帧是不同的输入和输出 | 至少支持多个 GIF、排序、预览及可下载的合并结果；明确帧时长、尺寸、透明度、文件和内存限制 | 第一项候选，先验证需求和开发可行性，再实施。 |
| 2 | `/gif-to-jpg/` · gif to jpg | 从 GIF 获取一张或多张 JPG；用户可以指定非透明背景 | 实际支持 JPG 导出、背景颜色、单张和需要支持的批量方式；提示 JPG 不保留透明度 | 评估新格式需求与现有首页的差异；不能仅换标题。 |
| 3 | `/gif-to-webp/` · gif to webp | 从 GIF 获取 WebP；须明确单帧静态图还是保留动画 | 实际实现并标明支持范围，验证目标浏览器导出及兼容性；若只支持静态帧，不宣称生成动画 WebP | 与 JPG 对照需求、实现成本后排序。 |
| 4 | `/resize-gif/` · resize gif | 调整动画尺寸并保留动画 | 支持缩放后 GIF 导出，验证长宽比、帧顺序、时长和透明度 | 有独立意图，但编码、内存和性能成本更高，先研究后开发。 |
| 5 | `/crop-gif/` · crop gif | 裁掉动画画面的一部分并导出 GIF | 支持可视化裁剪，验证所有帧的裁剪区域、时长、透明度和结果 | 与 resize 一起验证用户需求，再排序。 |

`/gif-to-png/` 暂不列为立即新建页：当前首页已能下载单张或全部 PNG。先检查目标市场中该查询的结果，以及 GSC 中首页的相关展示和点击。只有在搜索结果与用户反馈显示有明显不同的转换需求，且页面能提供独立、有用的转换流程时，才考虑建立此页；普通静态 PNG、PNG 帧序列与 APNG 应清楚区分。

`side by side gif` 与顺序拼接是不同的合并方式，可以先作为合并工具内的候选模式研究。现有第一版不应暗示已经支持；需求和独立页面价值得到验证后，才考虑 `/side-by-side-gif/`。`/merge-gifs/` 不需要仅因是同义词而与 `/gif-merger/` 并存。不要将 `/extract-frames-from-gif/`、`/gif-frame-extractor/`、`/split-gif-into-frames/` 做成互相复制的工具页。

## 四、首个新页面：GIF Merger 页面规格

**建议 Title：** GIF Merger — Combine GIFs Online

**建议 H1：** Merge GIFs into One Animation

**页面目标：**让用户直接把多个 GIF 顺序合成一个可下载的 GIF；实际输入范围以最终实现为准。

建议内容顺序：

1. 首屏说明输入、输出、处理位置、限制，放置真实可用的文件选择区。
2. 多文件列表与排序、移除、预览、合并和下载；明确不同尺寸的处理规则。
3. 三步使用说明和具体例子。
4. 说明时长、透明度、尺寸、文件大小及浏览器内存可能产生的影响。
5. 回答“是否保留动画”“能否调整顺序”“不同尺寸如何处理”等问题，答案以真实功能为准。
6. 链接首页拆帧工具和相关教程；不承诺未来功能。

发布前，至少验证多 GIF 顺序、每帧时长、透明度、不同尺寸、损坏文件、错误提示、取消与重新开始、最终 GIF 在常见浏览器和移动设备上的打开与下载。涉及有损调色或尺寸处理时，应在页面明确说明。

## 五、内部链接结构

```text
首页：GIF Splitter（拆帧 / PNG）
├── 现有拆帧教程 → 首页工具
├── 透明叠加指南 → 首页工具 / 大文件排错
├── 帧时序指南 → 首页工具
├── 大文件排错 → 首页工具
└── GIF Merger（功能上线后）↔ 对应合并教程（有独立价值时）
    └── 后续 resize / crop / 格式工具（分别完成后）
```

导航上的链接应清楚标示真实可用的工具。文章中的链接只在任务相关时加入；同语言页面优先互链。新页面不应链接到尚不存在的功能。

## 六、多语言与 SEO 上线条件

保留现有 10 语种首页和指南。新工具先验证一个语言版本，再根据 GSC、使用数据和翻译质量选 2–3 种语言扩展；不需要机械地同步上线 10 种。

当前项目的路由、语言导航和 hreflang 按“每个页面都有 10 个版本”设计。因此，如果新工具先只上线部分语言，开发时必须先调整路由生成、语言切换、hreflang、sitemap、元数据和相关检查，确保只引用真实存在的版本。不要通过伪造尚未翻译的页面凑齐语言数。

每个正式工具页上线前检查：真实功能、可访问性和移动布局；唯一且准确的 title/H1/description；自引用 canonical；仅指向存在且内容对应的 hreflang；可抓取内链；正确 sitemap；生产构建和浏览器验证。结构化数据只描述实际功能，不保证富结果或排名。

## 七、复盘与决策

1. 在 Search Console 记录首页和现有指南的索引状态、查询、展示、点击、国家和设备；每周观察，数据不足时拉长时间窗口。
2. 为候选词比较目标国家和设备的搜索结果：结果中的主要任务、页面类型、与首页重叠程度及能提供的额外价值。一次搜索或第三方估算不能证明稳定需求。
3. 若首页针对相关词已经获得展示，先确认查询与页面是否匹配，再判断需要改善现有内容还是新增独立工作流。
4. 对上线后的工具，结合实际处理成功、下载、失败原因和用户反馈评估；不以页面数或单次排名作为唯一成功指标。

参考：[Google 对 doorway abuse 的说明](https://developers.google.com/search/docs/essentials/spam-policies#doorway-abuse)；[Google 有用内容指南](https://developers.google.com/search/docs/fundamentals/creating-helpful-content)；[ImageOnline GIF to PNG 示例](https://imageonline.io/gif-to-png/)；[EZGIF 合并方式说明](https://ezgif.com/help/merging-gifs)。示例说明工具形态，不能据此推断搜索量或排名。
