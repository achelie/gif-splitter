# GIF Splitter

GIF Splitter 是一个支持 10 种语言的在线 GIF 拆帧工具。GIF 解码、完整影格合成、PNG 导出和 ZIP 打包均在浏览器中完成，所选 GIF 文件不会上传到服务器。

**生产域名 / 在线工具：[https://www.gifsplitter.com/](https://www.gifsplitter.com/)**

| 入口 | 链接 |
| --- | --- |
| 生产网站 | [www.gifsplitter.com](https://www.gifsplitter.com/) |
| 繁体中文版本 | [www.gifsplitter.com/zh-hant/](https://www.gifsplitter.com/zh-hant/) |
| GitHub 仓库 | [achelie/gif-splitter](https://github.com/achelie/gif-splitter) |
| 使用指南 | [如何提取 GIF 影格](https://www.gifsplitter.com/zh-hant/how-to-extract-gif-frames/) |
| 联系邮箱 | [contact@gifsplitter.com](mailto:contact@gifsplitter.com) |

## 主要功能

- 本地解析 GIF，正确合成透明区域和 disposal 2/3 影格。
- 支持文件选择和拖拽、动画播放及逐帧预览。
- 下载单张 PNG，将选中影格或全部影格打包为 ZIP。
- 使用 Web Worker 逐帧解码，支持取消处理、分批生成缩略图和资源释放。
- 支持英语、日语、西班牙语、法语、德语、意大利语、韩语、巴西葡萄牙语、俄语和繁体中文，共 80 个页面。
- 提供拆帧、透明度、影格时长、大文件排错指南，以及 About、Privacy 和 Terms 页面。

## 技术栈与目录

项目使用原生 JavaScript（ES Modules）、Vite、Canvas、Web Worker 和 `fflate`，通过 Cloudflare Pages 部署。`gifuct-js` 仅用于测试中的独立解析对照，不参与生产解码。

```text
src/                      # 工具交互、GIF 解码及合成
  locales/                # 10 种语言的文案与元数据
  site/                   # 路由、页面模板、指南与广告策略
public/                   # 示例 GIF、图标、社交图片及 ads.txt
scripts/                  # 静态页面生成、站点检查及浏览器回归
tests/                    # 单元测试与 GIF 测试样本
docs/                     # 发布记录、关键词研究和广告配置说明
.github/workflows/        # GitHub Actions 验证流程
wrangler.jsonc            # Cloudflare Pages 配置
```

## 快速开始

需要 Node.js 22.12 或更高版本，项目已使用 Node.js 22.19 验证。

```sh
git clone https://github.com/achelie/gif-splitter.git
cd gif-splitter
npm ci
npm run dev
```

开发服务监听 `127.0.0.1`，具体地址以 Vite 的终端输出为准。生产部署使用 `npm run deploy`，该命令依次执行生产构建、站点检查和 Cloudflare Pages 上传，需要已有的 Pages 写入权限。

生产配置：域名 `https://www.gifsplitter.com`，Pages 项目 `gifframeextractor`，分支 `main`，构建目录 `dist/`。普通本地构建与 Pages 预览带有 `noindex`，生产发布须使用 `npm run build:production`。

## Technical maintenance reference

The English reference below preserves detailed testing, processing limits, advertising, analytics and deployment instructions.

The site declares a stable 256×256 PNG at `/favicon.png` for Google Search and supplies `/favicon.ico` with 16/32/48/64/128/256-pixel images for browser fallback. The original brand artwork remains in `public/favicon.svg`. To regenerate both raster assets after changing the artwork, install Chromium as described below and run `node scripts/make-favicons.mjs`; the committed assets need no extra generation step during deployment. The site check verifies the PNG/ICO dimensions and favicon declaration on all 80 pages and the 404 page. See [Google's favicon requirements](https://developers.google.com/search/docs/appearance/favicon-in-search).

A ten-language GIF tool at [www.gifsplitter.com](https://www.gifsplitter.com/). Decoding, full-frame compositing, PNG export and ZIP creation happen in the browser. Selected files are not uploaded. Advertising `off` builds run as static Cloudflare Pages with SHA-256 CSP and no Functions requests. Future `consent`/`live` builds use the prepared edge worker to supply a fresh CSP nonce to each HTML response.

## Development and verification

Requires Node.js 22.12+ (tested with 22.19).

```sh
npm ci
npm run dev
npm test
npm run build
npm run check:site
npx playwright install chromium
npm run test:browser
npx wrangler pages dev dist --ip 127.0.0.1 --port 8788
```

Wrangler Pages exercises the actual static headers, or the worker and HTMLRewriter in Google-enabled builds. Vite development and preview are useful for editing but do not exercise Cloudflare headers. Browser artifacts belong under ignored `output/playwright/`.

Tests cover real GIF bytes, bounded LZW decoding, damaged dictionaries and pixel data, interlacing, compositing pixels, timing, memory guards, Worker cancellation, translations, all templates, advertising consent transitions and edge responses. The built-site check covers images and social images, same-origin links and anchors, 404 resources, the complete Vite asset graph (including the decoder Worker), sitemap and indexing.

`npm run test:browser` starts and stops its own local Wrangler Pages server against the existing `dist`, exercises real CSP and decoder Workers, and verifies upload, playback, PNG/ZIP downloads, damaged input, cancellation/recovery and ten-language mobile layouts. It saves browser artifacts under `output/playwright/`. Install Chromium once as shown above, or set `BROWSER_EXECUTABLE_PATH` to an existing Chrome/Chromium executable. GitHub Actions runs unit tests, a production build, site checks and browser regression tests for pushes and pull requests.

## Languages and pages

English retains its original URLs. Japanese (`/ja/`), Spanish (`/es/`), French (`/fr/`), German (`/de/`), Italian (`/it/`), Korean (`/ko/`), Brazilian Portuguese (`/pt-br/`), Russian (`/ru/`) and Traditional Chinese (`/zh-hant/`) use prefixes. Each has eight page types, for 80 pages:

- `/` — extraction tool, steps, capabilities, FAQs and guide links
- `/how-to-extract-gif-frames/` — selecting a GIF and three download methods
- `/gif-transparency-and-disposal/` — transparent patches and disposal 2/3
- `/gif-frame-timing/` — stored delays, preview delays and duration
- `/large-gif-extraction-troubleshooting/` — limits and recovery steps
- `/about/` — processing, editorial corrections and Contact
- `/privacy/` — actual file, hosting, analytics and advertising data handling
- `/terms/` — usage, rights, limitations and copyright feedback

`/404.html` is a separate real error page. Language navigation links to the equivalent page without automatic regional redirects. Changing pages releases the current GIF; no language preference is stored.

`src/locales/*.json` contains complete plain-text metadata, content and controls. `src/site/content.js` rejects missing translations, mismatched keys/arrays/parameters and missing plural categories. Keep parameters such as `{count}` intact. The route config owns dates and the canonical origin; the shared template escapes content. Publication and material revision dates are distinct. English guide lengths are an editorial target, not a Google eligibility threshold.

Each page has one H1, a unique localized title, self canonical, ten reciprocal hreflang entries plus English `x-default`, Open Graph data and structured data. Four guide types include contents, reproducible examples, related guides and tool links. Historical keyword research remains in [docs/keyword-research.md](docs/keyword-research.md).

## Examples and processing limits

One GIF at a time, up to 30 MiB and 1,000 frames. Further guards: 8,192 pixels per side, 16 million pixels per frame, 128 million decoded patch pixels, 80 million output pixels and 128 MiB of PNG data per ZIP. Smaller devices can run out of practical memory earlier.

The decoder handles transparent patches and disposal 2/3. LZW dictionaries and expansion stacks have a fixed 4,096-entry limit; invalid dictionary references, missing/early end codes, extra pixels and palette indices outside the active table are rejected. The container scanner skips metadata without retaining per-extension objects and packs each frame's compressed bytes into one array, so tiny sub-blocks cannot amplify parser memory. Frames decode one at a time in a browser Worker, which is terminated on cancellation and after extraction; RGBA patches transfer back for canvas compositing and PNG export. Environments without Workers use the same bounded decoder with a yield before each frame. `gifuct-js` is a test-only parser for independent decoder fixtures.

Original delays, including zero, are retained as metadata; delays below 20 ms use 100 ms in the preview. PNG does not encode animation delays. ZIP names retain original frame numbers. The app releases object URLs, supports cancellation and batched thumbnails, and respects reduced motion.

`node scripts/make-guide-examples.mjs` regenerates committed deterministic GIFs and the comparison SVG in `public/examples/`. Timing stores 0/10/20/80 ms (110 ms raw, 300 ms preview). Disposal samples distinguish background restoration from previous-content restoration. The six-frame 4000×4000 sample triggers the output guard before canvas allocation. Decoder tests reproduce these outcomes. `scripts/make-assets.py` optionally regenerates the original 24-frame sample and social image; Python is not needed to build.

## Advertising and analytics

Advertising defaults to `off`. This site is under AdSense review; do not resubmit or activate live advertising before this domain is Ready. Preserve the existing publisher and `public/ads.txt`.

Build variables are listed in [.env.example](.env.example). The generator reads the process environment: export variables in the shell or configure the Pages build environment. Copying that file alone does not activate them.

| Mode | Behavior |
| --- | --- |
| `off` | Static Pages, SHA-256 CSP, no Function invocation, Google loader, CMP configuration, ad unit or placeholder. |
| `consent` | Official Google tag loads with requests paused; Google services can still use the network and identifiers. |
| `live` | Requires explicit Ready, published/verified CMP, disabled Auto Ads and a real numeric unit ID. Unknown/rejected consent or API failure stays closed. |

Only four guide types can show one responsive manual unit after section two. Home, About, Privacy, Terms and 404 have no ads. The official CMP runs on eligible production Home/guide routes in non-off modes. Privacy never loads Clarity, advertising or CMP tags; its settings link opens the same-language Home withdrawal flow. An unavailable CMP shows an explanation and hides the unusable button. Withdrawal pauses requests, hides an existing unit and does not refresh ads or clear the tool's GIF.

Follow [docs/adsense-console-setup.md](docs/adsense-console-setup.md) for Google Privacy & messaging, TCF v2.3, fallback languages and actual regional evidence. Code tests do not certify the CMP or establish Google approval.

Clarity project `ysiz2atokr` defaults on for the 70 production routes outside Privacy. An origin guard excludes localhost and Pages previews. Tool filenames and images are masked with `data-clarity-mask="true"`. No synthetic consent-granted signal is sent. Actual Clarity regional consent behavior requires independent verification.

Cloudflare Web Analytics explicitly loads the existing beacon and preserves its token. Its implemented `send.to` option targets the Cloudflare-managed `/cdn-cgi/rum` endpoint on the production domain; an isolated browser verified a 204 response there, while the default cross-origin endpoint rejected the existing zone beacon with CORS. This option is present in the official beacon implementation; the public setup guide describes the default manual endpoint instead. Do not add a Worker proxy or modify this reserved endpoint. Static off builds hash the Clarity/beacon bootstrap bytes and use `no-transform`; Google-enabled builds add a response nonce and use `no-store, no-transform`. Verify one beacon on production. Contact uses direct `mailto:` and `email_off` markers. Cloudflare measurement is separate from Clarity and ads.

## Deployment and indexing

Pages project: `gifframeextractor`; production branch: `main`.

```sh
npm run build:production
npm run check:site -- --production-domain
npx wrangler pages deploy dist --project-name gifframeextractor --branch main
```

`npm run deploy` runs those steps. The current `off` build emits neither `_worker.js` nor `_routes.json`: HTML and the tool use static Pages, independent of Workers Free request/CPU quotas. `_headers` supplies one static CSP with exact executable bootstrap hashes, explicit analytics script hosts and security headers. Hashed assets retain one-year immutable caching.

Before a future `consent`/`live` release, check Functions/Workers quota and use fail closed. In those modes each HTML request invokes `_worker.js`; `_routes.json` excludes static assets, examples, robots, sitemap and ads.txt. Google-enabled routes use Google's supported nonce/strict-dynamic policy. Do not enable Google tags in the static off build.

Wrangler needs existing Pages write access. If needed, configure the existing local proxy through `HTTP_PROXY` and `HTTPS_PROXY`; the deployed site needs no local proxy.

Canonical origin is `https://www.gifsplitter.com`. Production builds use `index, follow`; Pages previews and true 404 responses retain noindex. Local builds are noindex. The apex 301 is a separate zone rule preserving path and query. After release verify 80 routes, static CSP hashes (or fresh nonces for Google-enabled builds), CSP errors, real 404, sitemap, ads.txt, previews and redirects. Publishing does not establish indexing, ranking or AdSense approval.

Public contact is `contact@gifsplitter.com`. Existing Email Routing/DNS does not prove delivery: the owner must send a test from an external mailbox and confirm receipt. Private receiving addresses are not published.

The implementation audit and all 73 ADS IDs are in [docs/adsense-remediation-2026-10-05.md](docs/adsense-remediation-2026-10-05.md).
