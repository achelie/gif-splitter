# GIF Splitter：AdSense 申请准备复审

审计日期：2026-10-05（Asia/Hong_Kong）；生产复核完成时间：02:39（UTC 2026-10-04 18:39）。目标：[https://www.gifsplitter.com](https://www.gifsplitter.com/)。目标仓库：`E:\code\sy\git frame`。

**Decision：Ready after fixes（已知页面修复与生产发布完成；账号映射、实际流量来源及地区同意取证尚未关闭，非无条件申请就绪或 Google 投放批准）。** 当前无 Google 广告，申请准备的代码层工作已完成；完整证据仍须核验，本报告不建议立即提交，本轮也未提交审核。Google 审核与投放资格仍为 Unknown。

本轮完整覆盖技能要求正文中的 73 项，计 **53 Pass、0 Fail、4 Unknown、16 N/A**。Pass 按各行注明的代码、生产观察、后台配置或站长声明成立。四项 Unknown 分别是本站 Google 审核、实际流量来源、完整账号/站点资料及地区同意；它们保持独立风险与取证动作。N/A 按本站当前没有 Google 广告、Google 个性化广告或应用 WebView 等事实判断，不预先认可未来广告实施。

本站是浏览器内处理 GIF 的静态工具，有十语言、四种页面模板，共 40 条稳定路由。语言为英语、日语、西班牙语、法语、德语、意大利语、韩语、巴西葡萄牙语、俄语及繁体中文。公开联系地址为 `contact@gifsplitter.com`，Contact 是各语言 About 页上的实际联系区块，页脚可直达；没有另增重复 Contact 路由。

## 申请准备与 Google 审核状态

现有 ads.txt 已提供可用的所有权验证路径。Google 支持广告代码、ads.txt 或 meta tag 验证，因此当前没有 AdSense loader 不等于不能提交网站。Google 仍须在账号中验证、审核该域名，状态达到 Ready 后才允许投放。[网站管理说明](https://support.google.com/adsense/answer/12131223?hl=en)

本轮未提交审核，也未启用广告。现有 Chrome 会话的连接器 fetch 无法读取 AdSense 后台内容，本站审核状态未知；不能借用其他域名已经通过审核的事实。账号身份、支付及完整站点映射同样没有取得可确认的后台证据。

按用户本轮明确要求，生产域名上的 Clarity 继续默认加载；没有新增本站 consent banner、CMP 或 consentV2 接口，也没有把这一要求保存为所有新站的通用偏好。默认加载本身不能证明 EEA/UK/瑞士访客已经同意。已有本地浏览器观察到 Clarity Cookie 和 Clarity/Bing 请求，但观察出口地区不能证明这些地区发生违规；区域运行及后台同意设置仍为 Unknown。

Google 现行文档要求：向 EEA/UK/瑞士提供**个性化广告**须使用 Google 认证、集成 TCF 的 CMP；来自非认证 CMP 的流量可能适用非个性化或 limited ads。后者仍须满足实际适用的披露和同意要求，不能把“非个性化”理解为完全不需同意。当前不存在 Google 广告请求，本报告不虚构已配置或已验证未来 Google 广告同意链。[Google CMP 要求](https://support.google.com/adsense/answer/13554116?hl=en)、[EU 用户同意政策](https://www.google.com/about/company/user-consent-policy/)

## 修复与证据范围

- 增加真实运营品牌说明及十语言 Contact 区块，保留公开域名邮箱，不公开私人收件地址。
- 十语言隐私政策现已分别说明本地文件、Cloudflare 托管、Clarity 默认加载与 Cookie、Cloudflare Web Analytics/RUM、用户主动发来的邮件，以及当前没有 Google 广告、将来启用时可能出现的数据处理与控制。Google 数据用途、广告偏好及微软隐私说明均为实际链接。
- CSP 增加 Cloudflare Insights 脚本来源，同时保留本站及实际 Clarity/Bing 资源。没有提前加入 Google 广告 loader、广告位或 Google CMP。
- 原创 GIF 解码、完整帧合成、PNG/ZIP 导出逻辑及指南继续保留。`scripts/make-assets.py` 用几何绘图生成 24 帧 demo GIF 和 OG 图；SVG 图标为模板内几何路径，未发现复制第三方图片、影片或文章作为本站主要内容。
- 用户于 2026-10-05 确认本站及现有 AdSense 账号从未自点广告，也未用机器人或重复人工操作制造展示/点击。该证据是站长声明；已写入[审计技能](C:/Users/Dewttow/.codex/skills/adsense-site-auditor/SKILL.md:29)并通过技能校验，供后续自有站复用，不等于后台流量实证。原有未购买/激励流量声明继续保留，实际来源检查未因此自动通过。

证据索引：

| 证据 | 内容与边界 |
| --- | --- |
| E1 | 站长保存资料及本轮确认：年龄、同一账号、域名控制、自点/人工或机器人制造展示点击声明。未公开私人收件地址、账号 ID 或 token。 |
| E2 | [config.js](<E:/code/sy/git frame/src/site/config.js:1>) 第 1–11 行：正式域名、品牌、公开邮箱、十语言、四模板及 40 路由。 |
| E3 | [render.js](<E:/code/sy/git frame/src/site/render.js:5>) 第 5–10 行隐私外链；32–38 行导航；46 行提取区 masking；83 行 Contact；104–128 行静态 HTML、SEO 和默认 Clarity。 |
| E4 | [en.json](<E:/code/sy/git frame/src/locales/en.json:54>) 第 54–74 行指南、About、Contact 及七节隐私政策；其他九份 locale 对应结构和内容。 |
| E5 | [main.js](<E:/code/sy/git frame/src/main.js:125>) 第 125 行开始读取/展示本地文件、185 行下载、239 行本站样例请求；[gif-engine.js](<E:/code/sy/git frame/src/gif-engine.js:145>) 第 145 行开始解码与合成。 |
| E6 | [make-assets.py](<E:/code/sy/git frame/scripts/make-assets.py:9>) 第 9–24 行原创 24 帧几何 demo，第 26–45 行 OG 图；[favicon.svg](<E:/code/sy/git frame/public/favicon.svg:1>) 及模板图标为几何图形。 |
| E7 | 本轮 Cloudflare 后台读取与配置摘要：Email Routing/DNS 为 ready；contact 唯一 enabled 规则；catch-all 关闭；三个 MX、一个 SPF、一个 DKIM；原 DNS 与非 SPF TXT 保留。实际邮件送达尚未测试。 |
| E8 | 本轮生产 HTTP 复核：40/40 路由 200、自 canonical、index/follow、11 个 hreflang、同 locale Footer Contact；十 About 的联系方式经 Cloudflare 邮箱混淆解码正确，十 Privacy 均为七节及有效 Google 外链/Cloudflare 披露。robots、sitemap 40 URL、ads.txt 均 200。 |
| E9 | [seo-build.mjs](<E:/code/sy/git frame/scripts/seo-build.mjs:26>) 第 26–32 行静态页面、robots 和 sitemap；33–48 行 CSP、权限、生产/预览索引及缓存配置。 |
| E10 | [ads.txt](<E:/code/sy/git frame/public/ads.txt:1>) seller 行与保存的发布商配置一致，本轮正式域名 GET 为 200；不在报告重复公开账号标识。 |
| E11 | 本轮后台访问限制：Analytics 读取返回 403；AdSense 无法经已有 Chrome 会话的连接器 fetch 读取，未取得账号站点列表、政策中心或支付身份资料。403 不是“流量有问题”的证据。 |
| E12 | 本轮实际执行：80/80 单元测试通过；生产构建生成 40 页/10 语言；生产站点检查通过；代码提交 `d370eef` 已通过 Cloudflare Pages 发布。本报告在该代码提交后创建。 |
| E13 | 本轮生产浏览器验收：桌面 1280 宽与移动 390×844 导航/语言/Contact 无横向溢出；英/繁中最终 mailto 正确；样例 24 帧、480×300。拦截下载 Blob 验证 PNG 与两种 ZIP 的实际字节，不包含操作系统保存对话框验收。Clarity tag/SDK 200、collect 204；提取区 masking 覆盖文件名/预览/网格；Cloudflare beacon 200、同源 RUM POST 204；无 CSP/控制台错误及 Google 广告 loader。 |
| E14 | 本轮访问/索引复核：apex 的 `/zh-hant/about/?audit=contact` 为 301，Location 完整保留路径/查询至 www；项目及本次部署的 pages.dev 主机均 noindex/follow；两种 Google UA 共八次 GET 为 200、无 challenge。这是模拟 UA 访问证据，不冒充 Google 实际已抓取。 |

## 邮箱：已配置与已送达分开记录

公开地址 `contact@gifsplitter.com` 已在代码中设为唯一对外邮箱。邮件路由与 DNS 的后台状态为 ready，contact 规则 enabled，catch-all 关闭；三个 MX、一个 SPF、一个 DKIM 已配置，其他原 DNS 和非 SPF TXT 保留。这证明配置层已就绪，不证明邮件已进入目标收件箱。

**实际送达：Unknown。** 本轮没有发送测试邮件，没有把后台 ready、MX 存在或规则 enabled 写成“收信成功”。用户下一步应从不同于目标收件箱的外部邮箱发一封测试邮件至公开地址，再确认实际收件；本轮没有代用户发信。域名邮箱属于站长选择的联系方案，不是 Google 要求所有网站必须采用的固定邮箱格式。

## 剩余问题与行动

| 项目 | 风险 | 当前证据 | 后续动作 |
| --- | --- | --- | --- |
| Google 站点审核 | Blocker（投放前条件） | 本站 AdSense 状态未能读取；本轮未提交审核。 | 先核验账号映射及实际 Sites 状态，再记录待提交、待审核或其他实际状态；必要证据核验后按流程处理，Ready 前不投放。未知不等同于已拒审。 |
| 实际流量来源 | High | 保存的未购买/激励流量声明可复用，Analytics 403；缺本域完整来源记录。 | 获取可读取的来源统计、营销记录和异常流量信息；不靠声明冒充实证。 |
| 完整账号/站点资料 | High | 品牌、域名、公开 ads.txt 可核验，后台身份、支付及完整映射不可读取。 | 在账号内核对完整身份、站点和发布商映射，仅保存必要的脱敏确认。 |
| 地区同意与将来广告方式 | High | Clarity 默认加载；区域行为、后台同意设置未验证；当前无 Google 广告/CMP。 | 核验 EEA/UK/瑞士的实际存储、请求与设置；启用广告前按广告类型接入和验证适用 CMP/同意控制。用户保留默认加载不将 Unknown 改为 Pass。 |
| 联系邮件送达 | Medium | DNS/路由 ready，无真实投递测试。 | 用户从不同于目标收件箱的外部邮箱发测试邮件至 contact@gifsplitter.com，再确认实际收件；本轮不代发。该附加信任检查不新增 ADS 检查 ID。 |

## 验证记录

以下为本轮已完成的实际测试、发布和生产验收。验收完成于 2026-10-05 02:39（Asia/Hong_Kong）；邮箱送达、后台账号及地区同意仍按各自证据保留 Unknown。

| 验证 | 最终证据 |
| --- | --- |
| 单元测试 `npm test` | **Pass**：80/80 通过，2026-10-05 主执行流程确认。 |
| 生产构建 `npm run build:production` | **Pass**：生成 40 页/10 语言。 |
| 站点检查 `npm run check:site -- --production-domain` | **Pass**：全部检查通过。 |
| 生产发布与复核时间 | **2026-10-05 已发布**；生产验收完成于 02:39（Asia/Hong_Kong）。 |
| 部署地址与版本 | 代码提交 `d370eef`；[本次 Cloudflare Pages 部署](https://739d59b3.gifframeextractor.pages.dev)，正式域名 [www.gifsplitter.com](https://www.gifsplitter.com/)。仓库无 git remote，本轮本地提交后直接 Pages deploy，没有 push。 |
| 修复后 40 路由 GET、静态资源和锚点 | **Pass**：40/40 HTTP 200；自 canonical、index/follow、11 hreflang、同 locale Footer Contact；十 About 邮箱解码正确、解码脚本 200；十 Privacy 七节及 Google 外链/Cloudflare 披露一致；robots/sitemap 40 URL/ads.txt 200。对应源码见 E2–E4、E9、E10。 |
| 正式域名/apex、TLS 与预览索引 | **Pass**：生产 HTTPS 可达；apex About 路径/查询完整 301 至 www；项目和本次部署 pages.dev 均 noindex/follow。两种 Google UA 八次 GET 200、无 challenge。对应源码见 E2、E9。 |
| 桌面/移动导航 | **Pass**：桌面 1280 宽、移动 390×844 的导航、语言切换、联系锚点无横向溢出；英/繁中最终 href 为正确 mailto。对应源码见 E3 第 32–38、83 行。 |
| GIF 与导出字节 | **Pass（浏览器 Blob 范围）**：样例解码 24 帧/480×300；PNG 7,418 字节且签名/尺寸正确；全部 ZIP 178,730 字节/24 entries，选择 ZIP 15,038 字节/2 entries；ZIP 内 PNG 签名、尺寸、编号正确。拦截导出 Blob 检验字节，未验证操作系统保存对话框。对应源码见 E5、E6。 |
| Clarity 加载与 masking | **Pass（加载/配置范围）**：正式域名 tag/SDK 200、collect 204，提取区 masking 覆盖文件名、预览和网格；预览 origin gate 保留。对应 E3 第 46、114–122 行。区域及后台同意仍为 Unknown。 |
| Cloudflare Insights/CSP/RUM | **Pass**：beacon 200；同源 `POST https://www.gifsplitter.com/cdn-cgi/rum` 为 204；CSP 精确仅新增 Cloudflare script 来源，无 CSP/控制台错误。对应 E9 第 38 行、E4 第 70 行。 |
| Google 广告状态 | **N/A（未投放）**：复核无 Google 广告 loader、广告位、iframe 或 CMP，不将此写为未来广告布局或同意已通过。 |
| 联系邮件实际送达 | **Unknown，未发送测试邮件**。 |

## 完整检查表

此表为全部 ADS 检查项的唯一逐项状态表。当前没有广告对应的 N/A 均保留未来取证动作；未来加代码、改后台或更换内容后须复核，不把本表当永久投放许可。

| ID | Status | Evidence | Next action |
| --- | --- | --- | --- |
| ADS-ELIG-01 | Pass | E1：保存的站长已满 18 岁确认，按自有站复用。 | 无需重复询问；新矛盾出现时再核对。 |
| ADS-ELIG-02 | Pass | E1：沿用已有 AdSense 账号，没有重复开户的保存确认。 | 沿用现有账号，先核验本站映射。 |
| ADS-ELIG-03 | Pass | E2–E6、E8、E13：公开内容/行为无已确认的适用 Program/Publisher 违规，隐私及联系修复已通过生产复核。 | 后续账号和区域 Unknown 单独取证。 |
| ADS-ELIG-04 | N/A | E2：自有静态网站，并非 Blogger、YouTube 或 hosted-account 合作伙伴产品。 | 使用普通网站添加流程。 |
| ADS-OWN-01 | Pass | E2、E3：用户控制仓库与 HTML head 模板，具备放置验证信息的路径。 | 保留可维护的 head 配置。 |
| ADS-OWN-02 | Pass | E1、E7：本站为用户自有域名，可操作目标 DNS、邮件规则及站点配置。 | 仅将本站加入自己的账号。 |
| ADS-OWN-03 | Pass | E3、E5、E8、E13：静态 HTML 完整，生产桌面/移动 JS 工具正常，公开正文无需登录。 | 维护兼容性；接入广告后检查脚本/iframe。 |
| ADS-SITE-01 | Unknown | E11：AdSense Sites 状态无法读取，本轮没有提交审核，不能确认 Ready。 | 先核验映射与实际状态，记录待提交/待审核或其他状态；证据核验后处理，Ready 前不投放。 |
| ADS-SITE-02 | Pass | E10：正确 ads.txt 已公开可读，是官方允许的所有权验证方式。 | 添加网站时选择实际可用的验证流程。 |
| ADS-TXT-01 | Pass | E10：生产 ads.txt 200，Google seller 行与保存的对应发布商配置一致。 | 账号变化时维护，不误覆盖其他合法 seller。 |
| ADS-TXT-02 | Pass | E10：根路径已有公开 ads.txt。 | 保持文件可访问并随账号变更维护。 |
| ADS-CONTENT-01 | Pass | E4、E5：真实 GIF 解码、完整帧合成、PNG/ZIP 导出及有用指南，具独立工具价值。 | 保持工具可用与说明准确。 |
| ADS-CONTENT-02 | Pass | E4–E6：主要价值来自本站实现和解释；样例为程序生成，非复制文章、影片或 affiliate feed。 | 新素材按来源和用途审查。 |
| ADS-CONTENT-03 | Pass | E3、E4：主页有实际工具、步骤、能力说明及 FAQ；指南有帧合成、透明度、时序和资源限制正文。 | 不增空分类、占位或仅导航页面。 |
| ADS-CONTENT-04 | Pass | E3–E5、E8、E13：生产功能和正文完整，无 coming soon 或 lorem ipsum；无广告。 | 保持完整正文和可用功能。 |
| ADS-CONTENT-05 | Pass | E3、E4、E8：当前无广告、付费推广、赞助列表或 affiliate 块。 | 启用广告后重新检查首屏及全页占比。 |
| ADS-CONTENT-06 | Pass | E2、E4：十种主内容语言均在 Google 支持列表，地区/文字变体有真实对应内容。 | 新语言加入前核对支持列表。 |
| ADS-CONTENT-07 | N/A | E3、E5：无公开评论、论坛或共享 UGC；本地选择的 GIF 不发布至网站。 | 增加公开投稿/评论时建立审核机制。 |
| ADS-CONTENT-08 | Pass | E2–E4：四个明确用途模板的完整本地化，不是空 doorway 页；未发现正文堆砌关键词。 | 扩展内容时保留独立用途与实际价值。 |
| ADS-UX-01 | Pass | E3、E8、E13：生产导航、同类型语言切换和 Contact 锚点有效，桌面/移动无横向溢出。 | 后续新增链接或模板时复核。 |
| ADS-UX-02 | Pass | E3、E4：首页说明工具用途，指南和 About 解释能力/限制，可直接返回工具。 | 保持各语言导航与目的页一致。 |
| ADS-UX-03 | Pass | E3、E5、E8：选择、预览和下载按钮对应真实本地操作，无假下载广告或无关跳转。 | 后续广告不得伪装成操作按钮。 |
| ADS-UX-04 | Pass | E3、E5、E13：浏览器无强制下载、恶意外跳或控制台错误；实际导出由用户触发。 | 第三方脚本或导出行为变化时复核。 |
| ADS-UX-05 | Pass | E2–E4、E7、E8、E13：生产 About、Contact、隐私页可用，mailto 正确；域名邮箱已配置，送达未测试。 | 用户用外部邮箱测试并确认收件；送达继续 Unknown。 |
| ADS-UX-06 | Pass | E3、E8：无广告占位或仿广告块，正文和工具层次清楚。 | 投放后复核标签、间距及视觉区隔。 |
| ADS-CRAWL-01 | Pass | E8：生产 40/40 路由、robots、sitemap、ads.txt 为 200，联系解码脚本可达。 | URL 或部署变化后复核。 |
| ADS-CRAWL-02 | Pass | E8、E9、E14：公开页面/robots 不阻挡 GET，两种 Google UA 八次请求 200、无 challenge。 | 新增 WAF 后重审；不宣称 Google 实际已经抓取。 |
| ADS-CRAWL-03 | Pass | E2、E3、E9：页面和正文是静态 GET，不依赖 POST 载荷。 | 保持公开页面可直接访问。 |
| ADS-CRAWL-04 | Pass | E8、E14：www 40 页直接 200；apex About 的路径/查询完整 301 至 www，无 Cookie 会话依赖。 | 跳转规则变化时重新检查路径/查询。 |
| ADS-CRAWL-05 | Pass | E2、E3：固定语言/模板路径，自引用 canonical，无逐用户 session URL。 | 新 URL 保持稳定并维护 canonical。 |
| ADS-CRAWL-06 | Pass | E7、E8、E14：生产 DNS/HTTPS/托管可响应，40 路由复核成功，目标后台配置可访问。 | 这是当次可用性证据，不代表长期 uptime 保证。 |
| ADS-CRAWL-07 | Pass | E2、E3、E8、E9：生产公开导航、sitemap 40 URL 和 robots sitemap 引用一致。 | URL 增减时更新；不承诺已收录。 |
| ADS-PROG-01 | Pass | E1：用户 2026-10-05 明确确认本站及现有账号从未自点广告或用机器人/重复人工制造展示点击；站长声明，非后台实证。 | 继续遵守；将来有广告时测试不得自点。 |
| ADS-PROG-02 | Pass | E3、E4：无要求点击/观看广告、奖励或指向广告的文案；操作 CTA 对应真实工具。 | 投放后保持中性文案。 |
| ADS-PROG-03 | N/A | E3、E8：当前无广告位或广告标签。 | 投放后核查中性标签及与下载/导航的区分。 |
| ADS-PROG-04 | Unknown | E1、E11：未购买/激励流量的保存声明存在，本域实际来源及异常记录因 Analytics 403 未读取。 | 取得来源统计和营销记录；不将声明等同于本域流量实证。 |
| ADS-PROG-05 | N/A | E3、E8：当前没有 Google 广告代码或包装修改。 | 接入后检查代码与计量行为。 |
| ADS-PROG-06 | N/A | E3、E8：当前没有 Google 广告，亦无邮件/私聊/第三方 framed 页面投放。 | 未来排除无公开内容、纯进度/错误等不适当屏幕。 |
| ADS-PROG-07 | N/A | E2、E5：普通浏览器网站，没有应用 WebView 变现。 | 若封装应用，另核 WebView 集成。 |
| ADS-PUB-01 | Pass | E4、E5：合法通用图像处理及指南，未发现非法活动推广或侵害权利的服务用途。 | 内容或下载范围变化时复核。 |
| ADS-PUB-02 | Pass | E6：demo、OG 和图标由几何绘图代码生成；公开内容未见仿冒、复制媒体或品牌冒充。 | 新增外部素材时核验权利；本项仅覆盖当前素材。 |
| ADS-PUB-03 | Pass | E4、E6：技术工具正文和几何示例无仇恨、骚扰、威胁、自伤/暴力赞美或犯罪组织推广。 | 新内容沿用该检查。 |
| ADS-PUB-04 | Pass | E4、E6：无虐待动物主题或濒危物种产品推广。 | 新内容沿用该检查。 |
| ADS-PUB-05 | Pass | E2–E4：品牌、用途、功能限制与运营联系说明一致，无虚构团队或官方背书。 | 实际运营身份/能力变更后更新说明。 |
| ADS-PUB-06 | Pass | E3–E5：无诱骗个人信息、虚假获利承诺或误导服务；文件处理不要求注册或上传。 | 表单/服务范围变化时复核。 |
| ADS-PUB-07 | Pass | E4、E5：通用本地 GIF 工具，不提供伪造文件、作弊、破解或未经授权监控功能。 | 新增功能按真实用途复核。 |
| ADS-PUB-08 | Pass | E4、E6：无付费性行为、跨国婚介、成人家庭混杂或儿童性剥削公开内容。 | 新公开内容/UGC 出现时复核。 |
| ADS-PUB-09 | Unknown | E2、E10 公开品牌/域名/seller 一致；E11 账号身份、支付和完整站点映射没有后台确认。 | 读取并脱敏核对账号资料和本站映射。 |
| ADS-PUB-10 | N/A | E3、E8：没有 Google 广告，因此没有广告遮挡操作或必须点广告才能退出的布局。 | 投放后特别检查文件选择、预览、下载及移动导航。 |
| ADS-PUB-11 | N/A | E3–E5、E8：目前不在任何屏幕投放广告。 | 启用时限制广告范围，排除无内容/低价值/错误/纯行为屏幕。 |
| ADS-PUB-12 | N/A | E3、E8：没有背景、屏外或 lazy-loaded 广告库存。 | 后续检查视口、响应式及实际注意力上下文。 |
| ADS-PUB-13 | Pass | E4：无选举、医疗或气候主题的可证伪危害性主张；工具声明与能力对应。 | 新主题出现时按官方政策审查。 |
| ADS-PUB-14 | Pass | E4、E6：原创几何示例，不含误导政治、社会或公共议题的操纵媒体。 | 新媒体按语境与真实性审查。 |
| ADS-PUB-15 | Pass | E3、E4、E6：公开内容和素材未见儿童危害/剥削，无公开上传社区；本地文件不成为站点投稿。 | 出现任何具体信号立即处置，不按一般风险接受。 |
| ADS-PUB-16 | Pass | E4：无危机或敏感事件利用内容，也未部署相关变现。 | 涉及敏感事件的新内容应另核投放语境。 |
| ADS-REST-01 | Pass | E4、E6：无性内容、成人娱乐/用品或性健康推广。 | 新内容/分类沿用限制检查。 |
| ADS-REST-02 | Pass | E4、E6：无血腥、惊悚、恶心画面或显著粗俗语言。 | 新媒体沿用限制检查。 |
| ADS-REST-03 | Pass | E4：无武器、爆炸物、配件或制造/改进教程。 | 新产品/教程沿用限制检查。 |
| ADS-REST-04 | Pass | E4：无烟草、娱乐性药物、器具或使用/制造说明。 | 新内容沿用限制检查。 |
| ADS-REST-05 | Pass | E4：无酒类在线销售或不负责任饮酒推广。 | 新商业链接沿用限制检查。 |
| ADS-REST-06 | Pass | E4、E5：免费图像工具，无线上赌博或付费随机游戏。 | 新收费/随机机制出现时复核。 |
| ADS-REST-07 | Pass | E4：无处方药销售、在线药房、未获批补充剂或被下架应用推广。 | 新商业内容沿用限制检查。 |
| ADS-REST-08 | N/A | E3、E8：没有广告或视频广告库存，GIF 图片预览不是已部署的视频广告。 | 新增广告时检查遮挡；视频库存另核控制、可见度及自动播放。 |
| ADS-PRIV-01 | Pass | E3、E4、E8：十语言生产隐私披露实际 Clarity/Cloudflare/邮件流程及条件式 Google 数据用途；当前无 Google 广告。 | 实际启用广告前按实施更新控制。 |
| ADS-PRIV-02 | Pass | E4：Google 条件段明确第三方因广告读写 Cookie、web beacon、IP/浏览器设备标识及用途。 | 启用前保持文案与实际广告合作方一致。 |
| ADS-PRIV-03 | N/A | E3、E5、E8：当前没有 Google 广告请求或 Google 用户识别/合并服务。 | 接入后检查 URL、事件、ad request 不含 PII 或文件名。 |
| ADS-PRIV-04 | Unknown | E3、E11：Clarity 默认加载，没有本站 CMP/consentV2；区域及后台同意行为未验证；当前无 Google 广告。 | 核验区域数据/存储与后台；未来广告按类型验证 Google 同意链。 |
| ADS-PRIV-05 | N/A | E5、E9：未调用精确定位，Permissions-Policy 禁用 geolocation；常规 IP 日志不等于 GPS/Wi-Fi 精确位置。 | 若增加精确定位，再实施及时披露、opt-in 和安全传输。 |
| ADS-PRIV-06 | N/A | E3、E4：一般用途工具，未见儿童定向或 COPPA 特定功能，亦无 Google 广告。 | 实际受众/产品改为儿童定向时标记并禁兴趣定向。 |
| ADS-PRIV-07 | Pass | E3、E5：没有设置、修改、拦截或删除 Google 域 Cookie 的自定义逻辑。 | 新增 ad/proxy 逻辑后复核。 |
| ADS-PRIV-08 | N/A | E3、E5、E8：没有 Google 个性化广告、再营销、受众列表或敏感受众事件。 | 后续不得以儿童活动或敏感信息构建受众。 |
| ADS-PRIV-09 | N/A | E4、E5：不推广住房/就业/信用产品，也没有相应美加广告受众定向。 | 业务范围变化后重新判断适用性。 |
| ADS-PRIV-10 | N/A | E3、E8：当前没有 Google 个性化广告或 audience lists。 | 启用时核验受众权利、兴趣广告披露和适用控制。 |

## 官方依据

政策来源于 2026-10-05 刷新的官方页面；技能清单历史快照不覆盖现行官方规则。技能中的 Contact、布局与文案建议应与 Google 硬性要求区别处理。

- [申请资格](https://support.google.com/adsense/answer/9724?hl=en)、[网站所有权](https://support.google.com/adsense/answer/91205?hl=en)：年龄、原创内容、政策及源码控制要求。
- [页面准备](https://support.google.com/adsense/answer/7299563?hl=en)：质量、内容价值、导航和用户体验。
- [网站管理](https://support.google.com/adsense/answer/12131223?hl=en)：验证路径、独立域名审核及 Ready 后投放。
- [爬虫排查](https://support.google.com/adsense/answer/2381908?hl=en)：公开可访问内容及抓取问题。
- [AdSense Program policies](https://support.google.com/adsense/answer/48182?hl=en)：自点、无效流量、诱导、来源、实现及位置；页面注明 2026-08-04 更新。
- [Google Publisher Policies](https://support.google.com/adsense/answer/10502938?hl=en)、[Google Publisher Restrictions](https://support.google.com/adsense/answer/10437795?hl=en)：内容、行为、隐私与受限库存。
- [支持语言](https://support.google.com/adsense/answer/9727?hl=en)：十语言均在当前列表；语言支持不证明账号地区或实际广告需求。
- [EEA/UK/瑞士 CMP 要求](https://support.google.com/adsense/answer/13554116?hl=en)、[EU 用户同意政策](https://www.google.com/about/company/user-consent-policy/)：个性化广告的认证 TCF CMP 条件，合法同意、记录、撤回与主体披露。
- [Google 合作网站数据说明](https://policies.google.com/technologies/partner-sites)：广告数据用途及用户控制。
- [Microsoft Clarity Consent Mode](https://learn.microsoft.com/en-us/clarity/setup-and-installation/consent-mode)、[ConsentV2](https://learn.microsoft.com/en-us/clarity/setup-and-installation/clarity-consent-api-v2)：EEA/UK/瑞士默认 Consent Mode 与有效同意信号；无 Cookie 的有限采集与完全不加载脚本不同。
- [Cloudflare RUM](https://developers.cloudflare.com/speed/observatory/rum-beacon/)、[Cloudflare CSP FAQ](https://developers.cloudflare.com/web-analytics/faq/)：RUM 性能数据、非 Cookie 存储行为及实际 beacon 所需 CSP。

## 完整性检查

- 清单范围：`adsense-requirements.md` 的 A–I 要求表；排除 J 节输出示例。
- 清单要求数：**73**。
- 报告检查行数：**73**。
- 状态计数：**Pass 53 / Fail 0 / Unknown 4 / N/A 16**。
- 缺失 ID：**none**。
- 多余 ID：**none**。
- 重复 ID：**none**。
- 非法状态：**none**。
- 程序检查结果：**Pass**。使用 Python 提取 A–I 要求 ID 与报告状态表，验证 73 行、唯一 ID、合法状态及上述状态计数；缺失/多余/重复/非法状态均为空。

最终状态：本轮修复、测试、发布与生产验收已完成。73 项状态表及完整性校验通过，四项 ADS Unknown 和附加邮件送达 Unknown 均保留明确行动。邮箱配置、站长声明、Google 审核和未来投放条件分别取证，不用代码构建或后台 ready 替代它们。
