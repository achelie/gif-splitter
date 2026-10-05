# GIF Splitter：AdSense 整改交付与复检记录

日期：2026-10-05（Asia/Hong_Kong）。目标：[www.gifsplitter.com](https://www.gifsplitter.com/)。本报告覆盖审计技能 A–I 的全部 73 个 ADS 检查项；ADS 编号是审计清单编号，并非 Google 官方政策编号。

**结论：页面与投放准备代码、静态生产发布及验收已完成，本站仍在 Google 审核中。** 正在审核来自用户确认，不等于 Ready、拒审或投放许可。本轮保持 `ADSENSE_MODE=off`；不重复提交审核、不启用广告。站长确认 Cloudflare Free 并授权 GitHub 推送及部署后，off 改为纯静态 Pages，不依赖 Functions 配额。最新 **154/154** 测试、80 页静态生产构建与生产模式站点检查通过；源码 `c5f1a88` 已发布，80 条正式路由、静态 CSP、十语言实际拆帧及下载、生产 beacon 均完成本轮验收，证据范围见 E14。账号、实际流量和地区同意等待验项仍独立保留。

## 1. 新版交付与证据边界

新版包含十语言、八种页面，共 **80 条路由**：首页、拆帧指南、透明度与 disposal、影格时间、问题排解、About/Contact、Privacy、Terms。旧报告记录的是已发布的四模板、**40 条生产路由**；旧版的 HTTP、浏览器或部署证据不能代替新版 80 页验收。

四篇指南每篇八节、每节两段，英文约 1,000 词；其他九语言内容完整，遵循相同信息结构。新指南提供真实受控文件和操作入口，并明确哪些数字是规则计算，不把它们写成性能实测。Terms 六节各两段，十语言版权反馈说明及直接联系邮箱均已补齐；About 保留原有说明及联系区块，增加技术流程与更正方法。所有 Privacy 保留七节两段，并按 off、consent、live 模式选用准确的广告说明。

广告准备采用三模式：off 不创建 Google 标签、CMP 队列或广告请求；consent 在加载官方代码前暂停广告请求，不注册广告位；live 必须有本站 Ready、CMP 已发布和实测、Auto Ads 已关闭及真实单元 ID 的部署声明。声明不是后台自动验证。运行时还需有效 TCF 结果，未知、失败、拒绝、撤回均关闭；没有自动非个性化绕行。未来仅四种指南第二节后放一个手动位，首页、信任页、错误及工具交互屏幕不放广告。十个 Privacy 不加载 Clarity、Google 广告或 CMP 消息标签，其设置入口转至同语言首页。

最终 CMP 守卫在健康的 `cmpuishown` 响应后清除加载 watchdog，不给用户慢阅读或做选择设置 15 秒截止时间；只有 API 未给出有效响应时才超时关闭。撤回 API 缺失直接关闭，初始稳定的 `tcloaded` 清除加载状态；新增慢阅读场景测试通过。健康界面允许继续选择，不表示未知选择可以请求广告。

证据索引：

| 编号 | 证据与适用范围 |
| --- | --- |
| E1 | [历史准备复审](<E:/code/sy/git frame/docs/adsense-readiness-audit-2026-10-05.md>)保存的年龄、单账号、自有域名与无自点/刷量声明，以及 Cloudflare DNS/邮件规则操作证据。声明只证明站长确认，不能替代实际流量或账号映射。用户本轮另确认本站正在审核。 |
| E2 | [路由与日期配置](<E:/code/sy/git frame/src/site/config.js>)：十语言、八模板、80 条稳定路径；既有内容初发 2026-10-04，新内容初发及本轮修订 2026-10-05。 |
| E3 | [英文内容](<E:/code/sy/git frame/src/locales/en.json>)及另外九份 locale：四篇指南、Terms、About/Contact、隐私三模式；结构通过各 locale 的校验。该项是源码与内容证据，生产页面可访问性另由 E14 证明。 |
| E4 | [构建广告守卫](<E:/code/sy/git frame/src/site/ad-policy.js>)、[广告运行逻辑](<E:/code/sy/git frame/src/advertising.js>)：off 默认；缺必要声明不能构建 live；暂停、TCF、拒绝、撤回、失败与一次性广告注册控制。 |
| E5 | [页面渲染](<E:/code/sy/git frame/src/site/render.js>)：Privacy 排除 Clarity/ad/CMP；手动 beacon；广告只在指南；本地化设置和真实 mailto；标签/布局/SEO。实际区域同意与邮箱送达不由模板证明。 |
| E6 | [原创示例定义](<E:/code/sy/git frame/src/site/examples.js>)、[生成器](<E:/code/sy/git frame/scripts/make-guide-examples.mjs>)与 [GIF 测试](<E:/code/sy/git frame/tests/gif-engine.test.js>)：**gif-engine 12 项、edge-worker 3 项，共 15 项通过**，不把全部 15 项称作原创 fixture 测试；时间、disposal、内存保护另有真实浏览器验证见 E12。 |
| E7 | [广告测试](<E:/code/sy/git frame/tests/advertising.test.js>)：主执行流程已确认 **24/24 项测试通过**，包括健康 CMP 中用户慢阅读、已请求广告后撤回 API 消失时关闭；属于模拟 API 与应用状态验证，不证明 Google CMP 真实发布、认证、地区行为或批准。 |
| E8 | E1 历史生产记录：40/40 路由、旧 sitemap、旧版浏览器与部署通过；这些结果仅属于旧 40 页版本。新版 80 页的生产发布与公开 HTTP 证据见 E14，不用旧版结果代替。 |
| E9 | [后台配置与验收步骤](<E:/code/sy/git frame/docs/adsense-console-setup.md>)：待站长核验的实际账号、CMP、Auto Ads、地区、广告单元、Clarity 与邮件流程；是操作说明，不是完成证据。 |
| E10 | 本报告末尾列出的 Google、Microsoft、Cloudflare 官方来源；现行官方要求优先于旧清单快照或外部预检的 AI 点评。 |
| E11 | **改为纯静态 off 前的历史 nonce/Worker 阶段**：所有 Terms 与 CMP 补强后 **152/152 测试通过**，当时生产构建 80 页与生产模式 check:site 通过；本地 Wrangler worker 编译成功。80 路由本地 HTTP 200，80 个不同 nonce 与标签/CSP 一致；真实 PNG/ZIP 下载解包通过。这不是本次静态生产发布配置；最终静态证据见 E13、E14。 |
| E12 | 主执行流程真实浏览器：桌面 1280 检视通过；十语言 transparency 在 390×844 无溢出、八 TOC 链接、SVG 可解码；禁用 JS 的 timing/繁中 Terms/Privacy 可读无溢出；原创 timing/disposal/内存保护、繁中样例及状态通过，所验场景无 console/page errors。 |
| E13 | Free 静态发布前实际验证：**154/154**；consent nonce 构建/check 后直接切 off，确认无 Worker/routes 遗留；80 页静态 HTTP/CSP/SHA-256/404/缓存通过；十语言 390×844 样例均 24 帧、桌面三下载正常，PNG/ZIP 解包与 480×300 尺寸正确；三页无 JS 可读；所验本地场景无 CSP/console/page errors、无 Google 网络请求。 |
| E14 | **最终源码与生产验收**：主体整改提交 `5219f6b`，最终源码 `c5f1a880d6428ffc58868e2a195f350d7b90679e`；Cloudflare 部署 `71a66249-0579-424b-b8fe-77c1add80ed7` 于 2026-10-05 20:31:15（香港；UTC 12:31:15）成功，[部署地址](https://71a66249.gifframeextractor.pages.dev/)。正式 www **80/80 路由 HTTP 200**、自 canonical/对应 hreflang、80 URL sitemap、robots 与原 seller 的 ads.txt 200；80 页静态 CSP 的 SHA-256 与实际脚本精确匹配，十 Privacy 无 Google；真实 404、资源 immutable、主/版本 pages.dev noindex、apex 301 保留路径与查询均复核通过。最终真实浏览器重跑：十语言首页 390×844 各 24 帧、各一个 Clarity 与一个 Cloudflare beacon；PNG、24 项全 ZIP、2 项选取 ZIP 三下载成功，三页无 JS 正文可读，独立新会话 Privacy 无 Clarity/Google；所验场景 `errors=[]`、`consoleErrors=[]`、Google 请求 0，实际同源 RUM POST **12 次 204**。beacon 使用原 token 及 SDK 的 `send.to` 指向本站 `/cdn-cgi/rum`，没有新 token 或新增代理。以上不证明 EEA/UK/瑞士实际同意、CMP 发布或 Google Ready。 |

### 已交付的准确示例

- 原有示例：24 影格、480 × 300，完整输出共 3,456,000 画素；PNG 保留原画布尺寸。
- 时间示例：3 × 1、四影格，延迟 0/10/20/80 ms，原始合计 110 ms；小于 20 ms 按 100 ms 的预览请求合计 300 ms。两者是数据及规则计算，不是实测播放性能。
- disposal 2/3：3 × 1、三影格；先红/红/红，再红/绿/红，最终方法 2 为红/透明/蓝、方法 3 为红/红/蓝。
- 内存保护：小于 1 KB 的受控 GIF，4000 × 4000 画布、六个单画素 patch，完整输出 96,000,000 画素超过 80,000,000 上限，预期 `MEMORY_LIMIT`；不是损坏 GIF 或大文件下载测试。

### 阶段结果记录

| 验证 | 当前已取得结果 | 不可推断 |
| --- | --- | --- |
| Locale 内容与结构 | 本地十语言结构按共同 schema 校验；指南 8×2、Terms 6×2，新增字段完整。 | 专业母语审校认证、Google 内容批准。 |
| GIF 与 edge-worker 测试 | gif-engine 12 项、edge-worker 3 项，共 15 项通过；包含原有引擎/新例子与 worker 验证。 | 不是 15 项全部原创 fixture，也不是设备 benchmark。 |
| 广告应用测试 | **24/24 通过**，包含慢阅读及撤回 API 消失场景。 | CMP 发布、真实地区同意或实际广告投放。 |
| 全量测试、生产构建、站点检查 | **Pass：154/154；off 纯静态生产构建 80 页；生产模式 check:site 通过。** 主执行流程确认。 | 构建不能证明 Google 批准或生产部署。 |
| 历史本地 worker HTTP/CSP/缓存 | **Pass（改为纯静态前，本地）：80 路由 200，80 个不同 nonce，标签/CSP 一致，无遗留 placeholder；HTML no-store/no-transform，资源 immutable，ads.txt 200，真实 404/noindex。** | 属于 E11 历史阶段；当前生产 off 使用静态 SHA-256 CSP，不执行该 Worker。 |
| 真实 GIF/PNG/ZIP | **Pass（本地真实下载）：24 帧/480×300；PNG 7,418 B；全 ZIP 178,730 B/24 entries；选择第 1/3 帧 ZIP 14,960 B/2 entries；解包签名、尺寸与编号正确。** | 不将局部下载验收泛化为地区同意或广告。 |
| 桌面/移动十语言 | **Pass（本地）：桌面 1280 检视通过；十语言 transparency 在 390×844 均无溢出、八 TOC 链接、SVG 可解码。** | 不泛化为所有设备或所有页面均有截图。 |
| 无 JavaScript 正文 | **Pass（本地选定页面）：timing、繁中 Terms、Privacy 分别有 8,497/1,427/5,384 字符可读，无溢出。** | 不代表无 JS 可使用拆帧工具；工具仍需 JS。 |
| 原创例子与本地化 | **Pass（真实浏览器）：timing 四帧延迟 0/10/20/80 ms，原始总 0.11 s；disposal 2 为红/透明/蓝、3 为红/红/蓝；memory-limit 报错且无帧；繁中样例 24 帧及本地化状态正确。所验场景无 console/page errors。** | 不证明 CMP 实际同意、生产第三方加载或计时性能。 |
| 十 Privacy/off 与模式准备 | **Pass（本地 HTTP/模板/模拟）：80 HTTP 检查确认 off 无 Google，十 Privacy 无 Clarity/ad/CMP；consent/live 模板与状态测试通过。** | 不证明后台发布、真实地区 CMP 或实际广告投放。 |
| 新版提交、部署、80 路由生产复核 | **Pass（E14）：源码 c5f1a88、最终部署 71a66249 成功；www 80/80 HTTP 200、canonical/hreflang、80 sitemap、robots/ads.txt、静态 CSP/immutable、404、预览 noindex 与 apex 301 均通过。** | 不代表 Google 已收录、Ready 或批准投放；不触发重新审核。 |
| 最终生产浏览器与 beacon | **Pass（E14 所验场景）：十语言首页各 24 帧及一个 Clarity/CF beacon，三下载和三页无 JS 正文通过；新会话 Privacy 无 Clarity/Google，errors/consoleErrors 为空、Google 请求 0，RUM POST 12 次 204。最终下载复核：全 ZIP 178,730 B/24 entries、所选 ZIP 14,960 B/第 1、3 帧，全部 PNG 签名正确且为 480×300；详见[发布记录](<E:/code/sy/git frame/docs/release-2026-10-05.md>)。** | 不泛化为所有设备、实际地区同意或 CMP 已发布。 |

## 2. 按严重程度复检与后台待验

**Blocker：没有新发现的已确认内容违规。** 但本站 Ready 未确认是正式投放的必要条件；不能因为本地代码能运行就开启 live。审核中不等于拒审，不重复提交。

**High：** 原报告缺少第三方广告 Cookie 的说明已在本地十语言补齐；当前 off 文案明确未加载广告，consent 文案说明暂停请求但可能发送连接/识别信息，live 文案使用实际教程页投放的现在时。Google links 是实际可点击外链。CMP 发布、认证和地区实测、Auto Ads、真实 unit、账号与 seller 映射、实际来源流量及 Clarity 区域同意仍未关闭。

**Medium：** 四篇成型指南、Terms、技术说明、更正说明、页脚知识入口已交付；新版静态生产发布、80 路由 HTTP/CSP/缓存、十语言样例、下载与生产 beacon 检查通过，范围见 E14。真实区域同意仍需独立核验。域名邮件规则配置不证明实际收件，送达继续待站长测试。

| 独立后台/运营事项 | 状态 | 核验方法与证据边界 |
| --- | --- | --- |
| 本站 Ready | Unknown | 当前只有用户“正在审核”的确认；在现有账号 Sites 查看本站精确域名及实际状态，保存脱敏记录。Ready 前不开广告，不重新提交。 |
| CMP 已发布、当前版本与供应商 | Unknown | 在对应账号 Privacy & messaging 确认消息绑定本站、隐私 URL、Google 及实际伙伴、TCF v2.3、消息已发布；代码测试不替代。 |
| 真实 EEA/UK/瑞士同意链 | Unknown | 新会话、实际地区出口验证未知/接受/拒绝/细粒度/返回/撤回/超时与请求。`?fc=alwaysshow` 只作 UI 调试，不能替代地区证据。 |
| 真实手动广告单元 | Unknown | 从正确账号取得可用响应式单元 ID；不能使用占位、测试 ID 或把 publisher 当 slot。 |
| 本站 Auto Ads 已关闭 | Unknown | 账号内核对本站设置并保存脱敏结果；本地无手动位不证明 Auto Ads 已关闭。 |
| Clarity 区域同意 | Unknown | 独立查看 Consent Mode/监听设置及 EEA/UK/瑞士 Cookie、请求、有效同意。Privacy 不加载已由本地代码控制，但一般页面地区行为仍需实测。 |
| 实际流量来源 | Unknown | 读取本域来源、营销记录、异常/referral/bot 与无效流量通知；历史 Analytics 403 是读取限制，不是违规证据。 |
| 账号/域名/seller 完整映射 | Unknown | 账号身份、付款资料、本站域名和公开 seller 行逐项核对。当前本地标识一致不等于后台已确认。 |
| 联系邮箱送达 | Unknown | 站长从非目标收件箱的外部邮箱发送测试至 `contact@gifsplitter.com`，确认实际收件；MX 和 Email Routing Active 不等于送达。助手本轮不代发。 |
| Cloudflare Free 与 Functions 额度 | 本次 N/A | 站长确认 Free；本次 off 不生成 `_worker.js` 或 `_routes.json`，纯静态 Pages 不执行 Functions，功能不依赖每日请求/CPU 配额。未来 consent/live 才重新核对余量并将当前 fail_open:true 改为 fail closed。详见[配额核验记录](cloudflare-quota-check-2026-10-05.md)。 |

## 3. 外部报告的纠正与原 16 项 Unknown 确认方法

2026-10-04 早于报告日 2026-10-05，并非未来日期。页面日期须与实际修订一致，不能用自动批量“变新”代替内容改动。Google 未公布固定的 800/1,200 词、20–25 篇或 40–60 URL 过审门槛；800–1500 词是本轮用户要求的写作目标。工具功能本身也是价值的一部分。翻译自有原创内容并不自动成为重复或规模化违规，应保留真实本地化与双向 hreflang，不仅因逐句对应删除语言。完整翻译的主体与未翻译的模板页应区分。[页面准备](https://support.google.com/adsense/answer/7299563?hl=en)、[内容与词数](https://developers.google.com/search/docs/fundamentals/creating-helpful-content)、[本地化页面](https://developers.google.com/search/docs/specialty/international/localized-versions)

Google 已要求于 2026-03-01 前迁移 TCF v2.3，原报告 v2.2 建议过时。认证 CMP 明确适用于 EEA/英国/瑞士个性化广告；非个性化广告仍可能用 Cookie，不能免除依法需要的同意。广告标签使用 “Advertisements” 或 “Sponsored Links” 及适当翻译；网页工具并非全部禁止投放，但不可在无内容、纯错误/导航/行为屏幕或易混淆下载操作处投放。[TCF 更新](https://support.google.com/adsense/answer/16942036?hl=en)、[CMP 要求](https://support.google.com/adsense/answer/13554116?hl=en)、[非个性化广告](https://support.google.com/adsense/answer/9007336?hl=en)、[版位政策](https://support.google.com/adsense/answer/1346295?hl=en)

原报告上方自查列表只有 15 条，完整表包含第 16 条同意管理。下表按完整表逐项说明；代码或已保存声明可以关闭部分旧 Unknown，但需要账号与真实请求的项目继续保留。

| 原待确认项 | 具体确认方法 | 本轮处理 |
| --- | --- | --- |
| 申请年龄 | 核对实际申请人年满 18 岁；未成年由父母/监护人用自身账号申请。 | 已有保存的成年声明，当前无矛盾，不重复询问。 |
| 单一账号 | 使用已有账号核对 publisher；不要为本站另建同一发布商账号。 | 已有单账号声明；后台本站映射仍待核验。 |
| 可编辑 head | 检查静态模板、构建及广告配置，确认能按后台指引部署验证信息。 | 本地源码控制及 head 模板可证明能力，不证明 Google 已验证。 |
| 自有域名 | 核对 DNS/托管控制及真实网站权限。 | 历史 Cloudflare DNS 与规则操作、站长声明证明本站控制。 |
| 站点已审核 | 查看现有账号 Sites 本站状态，不用别的站点 Ready 代替。 | 用户确认正在审核；Ready 保持 Unknown，不重提交。 |
| 所有权验证方式 | 按后台支持选择 ads.txt、代码或 meta；确认公开可读且标识正确。 | 现有 ads.txt 和源码路径可用；后台实际核验仍按 Sites。 |
| 不自点/刷量 | 核对站长行为、无效流量通知及团队测试方式。 | 已保存用户无自点/制造点击展示声明；未来测试不点击实际广告。 |
| 流量来源 | 获取本域来源、投放/营销账单、异常访问及机器人证据；禁 PTC、互点、垃圾推广。 | 实际统计读取未关闭，Unknown；合法付费推广不自动等于禁止。 |
| 广告合适版位 | off/consent 无广告；将来逐页核对真实版位，不在错误/弹窗/邮件/私聊或无内容屏幕投放。 | 本地仅指南单一手动位准备；未来真实投放需重验。 |
| 广告请求无 PII | 广告启用验收时检查 URL、请求、数据层不含邮箱、手机号、GIF 文件名或帧数据。 | 当前无广告请求 N/A；不能用原报告“无代码”忽略将来需查的脚本。 |
| 同意管理 | 账号核对 Google 认证 TCF v2.3 CMP，实际区域新会话覆盖所有选择和撤回。 | 原 15 条列表漏项；本地守卫已交付，后台/区域仍 Unknown。 |
| 精确定位 | 搜索定位 API、权限和数据流；若新增定位先做用途提示、明确同意与安全传输。 | 当前无精确定位且权限禁用，N/A；常规 IP 记录不等于 GPS 精确位置。 |
| Google 域 Cookie | 查看自定义代理/标签/脚本，没有设置、修改、拦截或删除 Google 域 Cookie 的代码。 | 当前代码未发现该逻辑；新增广告/代理后复核。 |
| 敏感受众 | 账号和事件核对是否建受众、再营销或传送儿童/健康/宗教等敏感信息。 | 当前无相关 Google 定向 N/A，未来上线仍禁止。 |
| 美加住房/就业/信用定向 | 若业务进入这些类别，核对是否按被限制属性定向；不要仅凭“内容站”永久豁免。 | 当前工具与业务无该类别定向 N/A；变更时重验。 |
| 个性化数据权利 | 启用后确认 audience 数据权利、广告通知、同意与退出，按实际伙伴披露。 | 当前没有 Google 个性化广告 N/A；Ready/CMP 均未证明。 |

## 4. 完整检查表：73 项唯一状态

Pass 仅在写明的证据范围成立；本地通过不自动成为生产通过。N/A 仅描述当前 off 无实际广告或功能不适用，未来开启广告/UGC/应用时重新判断。Unknown 不等同于拒审或违规。

| ID | Status | Evidence | Next action |
| --- | --- | --- | --- |
| ADS-ELIG-01 | Pass | E1：保存的成年申请人声明，当前无矛盾。 | 申请人变化时重新核对。 |
| ADS-ELIG-02 | Pass | E1：沿用现有单一发布商账号声明。 | 不另建重复账号；本站后台映射单独核验。 |
| ADS-ELIG-03 | Pass | E2–E7、E14：当前公开内容、代码及所验生产行为未发现已确认适用违规；非 Google 批准。 | 保留账号及地区 Unknown，后续变更重新复核。 |
| ADS-ELIG-04 | N/A | E2：独立静态域名站，非 Blogger/YouTube hosted 流程。 | 沿用普通网站流程。 |
| ADS-OWN-01 | Pass | E2、E4、E5：可编辑 head 与构建，具部署验证路径。 | 按后台实际验证方式维护。 |
| ADS-OWN-02 | Pass | E1：自有域名声明及 Cloudflare DNS/邮件规则操作证据。 | 域名控制不替代 Google 审核。 |
| ADS-OWN-03 | Pass | E2、E5、E12–E14：静态 HTML/JS、真实 GIF/PNG/ZIP、十语言生产样例及选定无 JS 正文正常。 | 后续脚本/发布变更重新复核，地区同意单独取证。 |
| ADS-SITE-01 | Unknown | 用户确认本站正在审核；未取得 Ready 后台证据。 | 现有 Sites 看精确域名状态，不重提交、不投放。 |
| ADS-SITE-02 | Pass | E1、E4：已有公开 ads.txt，模板也支持代码；仅验证能力。 | 后台按实际方式确认验证成功。 |
| ADS-TXT-01 | Pass | E1、E4、E14：Google seller 行保留现有公开配置，最终生产 GET 200。 | 实际账号映射在独立待验及 PUB-09，不用公开一致代替后台核验。 |
| ADS-TXT-02 | Pass | E1、E14：根路径 ads.txt 保留，最终生产可访问。 | 保持可访问，账号变化时维护。 |
| ADS-CONTENT-01 | Pass | E2、E3、E6：真实工具、扩展指南及可验证原创示例。 | 核对新版渲染和真实功能，不承诺审核结果。 |
| ADS-CONTENT-02 | Pass | E3、E6：内容来自本站解释与生成例子，非外部 feed/复制媒体。 | 新外部素材核权利与增值。 |
| ADS-CONTENT-03 | Pass | E3：工具说明、四完整指南、信任页，无新增空分类。 | 新版静态与浏览器正文复检。 |
| ADS-CONTENT-04 | Pass | E2、E3、E6、E14：页面有完整用途与功能，80 页已公开，无占位建设文案。 | 内容变更后复核，不用路线数量代替内容。 |
| ADS-CONTENT-05 | Pass | E4、E5：off 无广告/付费推广；live 只准备一个指南位。 | 真实投放重新看全页/首屏占比。 |
| ADS-CONTENT-06 | Pass | E2、E3：十种既有支持语言均有正文。 | 新语言核官方列表，CMP 语言另查。 |
| ADS-CONTENT-07 | N/A | E5：没有公开评论或 UGC，用户 GIF 仅本地处理。 | 新增公开投稿前建立审核。 |
| ADS-CONTENT-08 | Pass | E2、E3：独立教程用途及完整翻译，未发现关键词堆砌/doorway。 | 不为凑页数增加无价值文章。 |
| ADS-UX-01 | Pass | E5、E12–E14：导航/知识/页脚与站点检查通过；本地十语言移动八 TOC/SVG，生产十语言首页样例通过。 | 后续导航与布局变化复核；各阶段覆盖范围见 E12–E14。 |
| ADS-UX-02 | Pass | E3、E5：用途、能力、限制与相关文章入口清楚。 | 复核实际显示与返回工具。 |
| ADS-UX-03 | Pass | E4、E5：真实选檔/预览/下载；广告与操作区隔。 | 未来 live 检查真实广告无假下载混淆。 |
| ADS-UX-04 | Pass | E4、E5、E12、E14：下载由用户触发，无强制外跳/恶意设置逻辑；最终所验生产场景 errors/consoleErrors 为空。 | 第三方或脚本变化后复核，地区同意保持独立待验。 |
| ADS-UX-05 | Pass | E3、E5、E14：About/Contact、Privacy、Terms 完整且新版路径公开；直接 mailto，邮件规则历史就绪。 | 邮箱实际送达继续 Unknown。 |
| ADS-UX-06 | Pass | E4、E5：off 无广告，未来指南位有标签和独立区域。 | 真实填充后复核布局与误点。 |
| ADS-CRAWL-01 | Pass | E14：最终新版 www 80/80 正式路由 HTTP 200，真实不存在路径返回 404，无公开访问阻断。 | URL、托管或发布变化后重验；本次可达不保证长期 uptime。 |
| ADS-CRAWL-02 | Pass | E8、E14：robots 可达，保留公开抓取路径与 sitemap，无登录墙。 | WAF/robots 变化时复核；可访问不等于 Google 已抓取。 |
| ADS-CRAWL-03 | Pass | E2、E5、E14：80 页及正文通过静态 GET 公开访问，不依赖 POST。 | URL 或发布变化后重新检查。 |
| ADS-CRAWL-04 | Pass | E14：www 直接 200，apex 301 保留路径与查询，无会话依赖。 | 重定向规则变化后重验。 |
| ADS-CRAWL-05 | Pass | E2、E5、E14：稳定 locale/type 路径、自 canonical/对应 hreflang 与生产 sitemap，无个人会话 URL。 | 路由/域名变化后复核。 |
| ADS-CRAWL-06 | Pass | E14：最终生产 DNS/TLS/托管可响应，80 路由 HTTP 复核通过；当前 off 为不执行 Functions 的静态发布。 | 非长期 uptime 保证；未来 Worker 另核额度。 |
| ADS-CRAWL-07 | Pass | E13、E14：80 页构建检查及公开 sitemap 80 URL、robots 引用一致。 | 不承诺 Google 已收录；路由增减后更新并重验。 |
| ADS-PROG-01 | Pass | E1：用户确认无自点或机器人/重复人工制造展示点击。 | 声明非后台实证；未来测试不点击广告。 |
| ADS-PROG-02 | Pass | E3、E5：无鼓励广告点击、奖励或诱导箭头文案。 | 投放后继续保持中性。 |
| ADS-PROG-03 | N/A | E4：off 无实际广告；E5 为将来标签与独立区域。 | live 检查 Advertisements/对应译文及误点。 |
| ADS-PROG-04 | Unknown | E1：有历史声明，实际本域流量与营销来源未读取。 | 获取来源/异常/无效流量证据。 |
| ADS-PROG-05 | N/A | E4、E7：off 无 Google 请求；未来仅标准标签与暂停/一次注册。 | 实际接入后核代码与计量，不因代码存在称已投放。 |
| ADS-PROG-06 | N/A | E4、E5：off 无投放，未来只四种指南一个手动位。 | 排除工具/错误/无内容屏幕，核 Auto Ads 关闭。 |
| ADS-PROG-07 | N/A | E2：普通浏览器站，没有应用 WebView 变现。 | 封装应用时另核官方集成。 |
| ADS-PUB-01 | Pass | E3、E6：通用图像处理与技术指南，无非法推广内容。 | 新功能/素材按实际用途审查。 |
| ADS-PUB-02 | Pass | E3、E6：示例/图形由本地代码生成，无已发现侵权/仿冒。 | 新外部素材核权利。 |
| ADS-PUB-03 | Pass | E3、E6：技术说明及几何例子无仇恨、威胁、暴力或自伤推广。 | 内容变更时复检。 |
| ADS-PUB-04 | Pass | E3：无虐待动物或濒危产品推广。 | 新题材复检。 |
| ADS-PUB-05 | Pass | E2、E3：真实品牌、能力、联系、日期与更正说明，无虚构背书。 | 运营身份/能力变化同步说明。 |
| ADS-PUB-06 | Pass | E3、E5：无钓鱼、假获利承诺；本地处理不索要账户。 | 新表单/商业功能复检。 |
| ADS-PUB-07 | Pass | E3：不提供造假、作弊、破解或未授权监控。 | 新工具功能复检。 |
| ADS-PUB-08 | Pass | E3、E6：公开内容无相关性服务/剥削主题。 | 新公开素材或社区重新审查。 |
| ADS-PUB-09 | Unknown | 本地品牌、domain、seller 一致；后台身份/支付/完整映射未确认。 | 正确账号脱敏核对本站及 publisher。 |
| ADS-PUB-10 | N/A | E4：off 无广告；E5 将来位置不覆盖工具操作。 | 实际广告填充后核移动、覆盖和退出。 |
| ADS-PUB-11 | N/A | E4：当前无实际广告；E3 不以字数门槛冒充质量。 | 启用时只合适指南，排除低价值/行为屏幕。 |
| ADS-PUB-12 | N/A | E4、E5：off 无背景/屏外广告；未来仅正文位。 | 真实投放核视口与使用上下文。 |
| ADS-PUB-13 | Pass | E3：无危害性选举、健康或气候错误主张。 | 新主题核官方政策。 |
| ADS-PUB-14 | Pass | E6：几何例子不冒充公共议题的真实媒体。 | 新媒体核真实性与语境。 |
| ADS-PUB-15 | Pass | E3、E5、E6：公开内容未见儿童危害，无公开上传社区。 | 任何具体危害信号立即处理。 |
| ADS-PUB-16 | Pass | E3：无利用敏感事件的内容或变现。 | 新事件内容核语境。 |
| ADS-REST-01 | Pass | E3、E6：无成人/性主题及用品推广。 | 新题材/媒体复检。 |
| ADS-REST-02 | Pass | E3、E6：无惊悚、血腥或显著粗俗语言。 | 新媒体复检。 |
| ADS-REST-03 | Pass | E3：无武器/爆炸物产品或制作教程。 | 新商业内容复检。 |
| ADS-REST-04 | Pass | E3：无烟草、娱乐性药物及器具/制作。 | 新商业内容复检。 |
| ADS-REST-05 | Pass | E3：无酒类销售或不负责任饮酒推广。 | 新商业链接复检。 |
| ADS-REST-06 | Pass | E3：免费工具，无赌博或付费随机玩法。 | 新收费机制复检。 |
| ADS-REST-07 | Pass | E3：无处方药、非法药房/补充剂或被下架应用推广。 | 新内容复检。 |
| ADS-REST-08 | N/A | E4：无实际广告或视频广告库存；GIF 预览不等于广告视频。 | 投放后核遮挡、视频控件与自动播放。 |
| ADS-PRIV-01 | Pass | E3、E5、E12、E14：十语言披露与模式模板通过；生产十 Privacy 无 Google，独立新会话 Privacy 无 Clarity/Google，选定无 JS 政策可读；RUM 实际 POST 204。 | 实际地区同意与第三方设置仍需独立验证，变化时更新披露。 |
| ADS-PRIV-02 | Pass | E3：第三方/Google Cookie、web beacon、IP/标识与退出披露齐备。 | live 与实际伙伴保持一致，区域控制仍 Unknown。 |
| ADS-PRIV-03 | N/A | E4：off 无 Google 广告请求；GIF/文件名不加入广告流程。 | 真实接入查 URL/事件/请求 PII 和文件数据。 |
| ADS-PRIV-04 | Unknown | E4、E7 本地守卫已测；官方 CMP 发布与区域、Clarity 同意未确认。 | 按 E9 实测 EEA/UK/瑞士全部选择、存储、请求与撤回。 |
| ADS-PRIV-05 | N/A | 当前无精确定位功能且权限禁用，IP 记录非 GPS。 | 新增定位先提示、opt-in、安全传输与披露。 |
| ADS-PRIV-06 | N/A | E3：一般用途工具，无已发现儿童定向，当前无 Google 广告。 | 受众/产品变化后做儿童标记及禁兴趣广告。 |
| ADS-PRIV-07 | Pass | E4：无设置/修改/拦截/删除 Google 域 Cookie 的自定义逻辑。 | 广告代理或代码变更复检。 |
| ADS-PRIV-08 | N/A | E4：无已启用敏感受众、Google 再营销或 audience lists。 | 未来账号和事件核儿童及敏感信息。 |
| ADS-PRIV-09 | N/A | E3：不推广住房/就业/信用，也无对应美加定向。 | 业务与广告范围变化再判断。 |
| ADS-PRIV-10 | N/A | E4：无实际 Google 个性化广告或受众列表。 | 启用时核数据权利、披露与同意；不可用构建声明替代。 |

## 5. 复检清单、官方依据与完整性

以下验收按顺序进行，未取得证据的方框保持未勾选：

- [x] 最终全量测试 154/154、off 80 页纯静态生产构建及生产模式站点检查实际通过；由主执行流程记录输出。
- [x] E14：80 个正式 URL 200，自 canonical、对应 hreflang、robots/sitemap 80 URL、ads.txt 200；主/版本预览 noindex、真实 404、apex 路径/查询正确。
- [x] 本地站点检查与桌面 1280、十语言 transparency 的 390×844/八 TOC/SVG 检查通过；选定无 JS 正文可读无溢出。范围见 E12，不代替生产全站复核。
- [x] 原创 fixture 测试通过；本地真实 PNG/所选 ZIP/全 ZIP 下载、解包、字节、尺寸、编号通过；最终生产十语言样例各 24 帧及三下载成功（E14），最后一轮下载字节、PNG 签名/480×300 与 ZIP 项数/第 1、3 帧复核通过，详见[发布记录](<E:/code/sy/git frame/docs/release-2026-10-05.md>)。
- [x] 本地 80 HTTP 及模式模板确认十 Privacy 无 Clarity、广告或 CMP，off 无 Google；nonce/CSP/缓存检查通过。
- [x] 本地模板/模拟测试：consent 暂停且无广告位；接受/拒绝/撤回/失败/重复回调不绕过或重复请求。官方 CMP 实际地区验收仍未完成。
- [x] E14 最终生产重跑：十语言首页各一个 Clarity 与一个 Cloudflare beacon；errors/consoleErrors 为空、Google 请求 0，同源 RUM POST 12 次 204。此取证不替代实际地区同意验证。
- [x] 站长确认 Free 后采用不执行 Functions 的静态 off 方案，本地及 E14 正式生产验收完成；本次发布不依赖 Functions 余量。地区证据仍独立待验。
- [ ] 账号映射、本站 Ready、CMP 发布/认证、真实 slot、Auto Ads 关闭及实际地区验收有独立证据；此前保持 off。
- [ ] 流量与 Clarity 区域行为、联系邮箱实际送达由站长核验，不将声明/代码/配置 ready 当作全部完成。
- [ ] 未来 Google-enabled Worker 的实际 Functions 余量及 fail-closed 设置另行核实；本次静态 off 不适用。

官方来源：

- [AdSense 资格](https://support.google.com/adsense/answer/9724?hl=en)、[网站管理](https://support.google.com/adsense/answer/12131223?hl=en)、[页面准备](https://support.google.com/adsense/answer/7299563?hl=en)：资格、独立网站状态、验证与内容价值。
- [Program policies](https://support.google.com/adsense/answer/48182?hl=en)、[Publisher Policies](https://support.google.com/adsense/answer/10502938?hl=en)、[Publisher Restrictions](https://support.google.com/adsense/answer/10437795?hl=en)：行为、内容、隐私及受限库存。
- [Required content](https://support.google.com/adsense/answer/1348695?hl=en)、[隐私 URL 页面要求](https://support.google.com/adsense/answer/10961370?hl=en)：广告 Cookie 与数据披露；政策页不加载需同意标签。
- [TCF v2.3](https://support.google.com/adsense/answer/16942036?hl=en)、[CMP](https://support.google.com/adsense/answer/13554116?hl=en)、[EU 用户同意政策](https://www.google.com/about/company/user-consent-policy/)、[NPA](https://support.google.com/adsense/answer/9007336?hl=en)：地区同意、记录与撤回，非个性化仍可能需 Cookie 同意。
- [广告位置](https://support.google.com/adsense/answer/1346295?hl=en)、[无内容屏幕](https://support.google.com/publisherpolicies/answer/11112688?hl=en)、[暂停请求](https://support.google.com/adsense/answer/7670312?hl=en)、[撤回 API](https://developers.google.com/funding-choices/fc-api-docs)：位置、误点与官方运行接口。
- [Google 内容与词数](https://developers.google.com/search/docs/fundamentals/creating-helpful-content)、[本地化版本](https://developers.google.com/search/docs/specialty/international/localized-versions)：不把词数、翻译或页数当作审核硬门槛。
- [Clarity 同意模式](https://learn.microsoft.com/en-us/clarity/setup-and-installation/consent-mode)、[Cloudflare Web Analytics](https://developers.cloudflare.com/web-analytics/)：分析与广告是独立数据流程；手动 beacon 不限定为同源端点。

完整性统计（以技能 `adsense-requirements.md` A–I 的要求表为源，排除 J 节示例）：

- 要求 ID：73；本报告唯一状态行：73。
- Pass：53；Fail：0；Unknown：4；N/A：16。
- 缺失、多余、重复 ID：none；非法状态：none。
- 程序核对：Pass。更新后重新提取技能 A–I 的 73 个要求及报告唯一状态表；自动计数为 53/0/4/16，缺失、多余、重复、非法状态均为空，UTF-8 无替换字符。状态按证据调整，不沿用历史计数。

剩余四个 ADS Unknown（本站审核、实际流量、账号完整映射、同意管理）与后台独立待验项均保留行动；N/A 的未来实施不预认可。Free 纯静态 off 已完成授权发布及 E14 的生产 HTTP/浏览器验收。不改变本站审核中的事实，也不替用户重新提交审核或启用广告。
