# GIF Splitter

A purely static, ten-language SEO tool live at **[www.gifsplitter.com](https://www.gifsplitter.com/)**. The canonical production origin is **https://www.gifsplitter.com**. GIF decoding, compositing, PNG export and ZIP generation happen locally in the browser. No backend, accounts, file uploads, tracking scripts, or API keys are needed.

The current brand is **GIF Splitter**. The primary keyword is **gif splitter**, the secondary keyword is **gif frame extractor**, and supporting phrases are **split GIF into frames** and **GIF to PNG**. The English homepage title is **GIF Splitter — Free GIF Frame Extractor Online**. Other languages retain their localized conversion and frame-extraction wording, followed by the GIF Splitter brand.

## Local development

Requires Node.js 22.12+ (tested with 22.19).

```sh
npm ci
npm run dev
npm test
npm run build
npm run check:site
npm run preview
```

Built with Vite, vanilla JavaScript/CSS, gifuct-js and fflate. `dist/` is the complete deployable site. All 40 content pages contain static, crawlable HTML; JavaScript powers extraction and enhances the language menu, not page translation.

## Languages and content

English retains the original URLs. Japanese (`/ja/`), Spanish (`/es/`), French (`/fr/`), German (`/de/`), Italian (`/it/`), Korean (`/ko/`), Brazilian Portuguese (`/pt-br/`), Russian (`/ru/`) and Traditional Chinese for Taiwan (`/zh-hant/`) use language prefixes. Each has the same four page types below. The language menu links to the equivalent page type and never redirects by IP or browser language. Changing language navigates to a new page and does not retain a selected GIF or store a language preference.

`src/locales/*.json` contains complete plain-text content: metadata, static pages, controls, accessibility labels, status and errors. `src/site/render.js` is the shared HTML template; `src/site/config.js` owns routes and the canonical origin. The Vite development middleware renders these templates locally. During builds, `scripts/seo-build.mjs` uses Vite's manifest to reference the hashed JavaScript/CSS and writes all 40 HTML files, the sitemap, robots.txt and Cloudflare headers.

To edit wording, update the relevant locale JSON. Keep placeholders such as `{count}` and `{current}` unchanged. `src/site/content.js` rejects missing/empty translations, mismatched keys, arrays or placeholders, and missing plural categories during every build. Dynamic messages use `Intl.NumberFormat` and `Intl.PluralRules`; decoder errors expose stable codes while the interface selects local wording. Do not add user-visible English fallbacks to the app.

Every page has a self-referencing production canonical, localized title/description/H1, Open Graph metadata, structured data and ten reciprocal hreflang links plus English `x-default`. The HTML language tags are `pt-BR` and `zh-Hant` for the corresponding regional/script editions. Research evidence and its limits are recorded in [docs/keyword-research.md](docs/keyword-research.md). Localized headings follow both GIF-to-PNG and frame-extraction intent. The historical research does not establish stable traffic for every phrase, and its `split gif` observations are not search-volume evidence for `gif splitter`.

## Deployment

Cloudflare Pages project: `gifframeextractor`, production branch: `main`.

```sh
npm run deploy
```

The default deployment command runs a production build, validates production indexing and URLs, then uploads only `dist/`:

```sh
npm run build:production
npm run check:site -- --production-domain
npx wrangler pages deploy dist --project-name gifframeextractor --branch main
```

Wrangler needs a Cloudflare account with Pages write permissions. If the environment requires its existing local proxy, set `HTTP_PROXY` and `HTTPS_PROXY` for the command; no proxy is needed by the deployed site.

### Production domain, previews and SEO

The production site is served at [www.gifsplitter.com](https://www.gifsplitter.com/), using the existing `gifframeextractor` Cloudflare Pages project. Canonicals, hreflang URLs, sitemap entries, structured data and social URLs use `https://www.gifsplitter.com`.

- A production build marks all 40 content pages `index, follow`. Responses from the production hostname contain no `noindex` directive.
- `npm run build` remains the local preview build and emits `noindex, follow`. Use `npm run deploy` for a checked production deployment.
- [gifframeextractor.pages.dev](https://gifframeextractor.pages.dev/) and deployment preview hosts matching `:version.gifframeextractor.pages.dev` remain accessible without redirecting. Host-specific `X-Robots-Tag: noindex, follow` headers keep these copies out of the indexing target even when they serve a production build.
- Requests to `gifsplitter.com` redirect to `www.gifsplitter.com` with HTTP 301. The complete path and query string are preserved, including file paths without an added trailing slash. For example, `https://gifsplitter.com/robots.txt?check=1` redirects to `https://www.gifsplitter.com/robots.txt?check=1`.

After deployments, verify canonical URLs, response headers, robots.txt, sitemap.xml and apex redirects on the live hostnames. An indexable production release does not guarantee search-engine indexing or ranking.

## Included page types (each in all ten languages)

- `/` — interactive extraction tool, use cases, how-to steps and FAQs
- `/how-to-extract-gif-frames/` — practical extraction guide
- `/about/` — tool description and limits
- `/privacy/` — local processing and hosting disclosure
- `/404.html` — real not-found page for Cloudflare Pages

## Processing and limits

One GIF at a time, up to 30 MiB and 1,000 frames. Additional safeguards: 8,192 pixels per side, 16 million pixels per frame, 128 million decoded patch pixels, and 80 million output pixels across all frames. Decoding applies transparent patches and disposal methods 2/3 and exports each full composited image as PNG. Frame timing metadata is preserved, including zero-delay frames; playback delays below 20 ms are displayed at 100 ms for a usable preview. ZIP filenames preserve original frame numbers. Original files are never modified.

The UI creates and releases object URLs, supports cancellation, renders thumbnail batches, uses native accessible controls, and respects reduced-motion preferences. A single ZIP export is limited to 128 MiB of PNG data; larger results can be downloaded in smaller selections. Resource limits reduce browser memory risk; actual capacity still depends on the device. There is no service worker or offline-install feature.

## Verification

`npm test` uses small, real GIF byte sequences and a pixel-aware canvas double to verify transparency, frame patches, disposal modes, delays, invalid files, limits and cancellation. It also checks language schemas, plural rules, every static template, reciprocal language links, metadata, structured data and escaping. `npm run check:site` audits the actual built output, including all routes, bundled assets, internal links and sitemap/header indexing mode.

Browser QA verifies each language's sample extraction, frame counts, progress, error messages and equivalent-page navigation; it also covers PNG and ZIP downloads, real canvas pixels, cancellation, disabled JavaScript and mobile layouts. Local screenshots and download artifacts belong under the ignored `output/playwright/` directory.

`scripts/make-assets.py` optionally regenerates the original sample animation and social image with Pillow and Windows Segoe UI fonts. Generated assets are committed; Python is not needed to build or run the site.
