# GIF Frame Extractor

A purely static, English SEO tool for **gifframeextractor.com**. GIF decoding, compositing, PNG export and ZIP generation happen locally in the browser. No backend, accounts, file uploads, tracking scripts, or API keys are needed.

## Local development

Requires Node.js 22.12+ (tested with 22.19).

```sh
npm ci
npm run dev
npm test
npm run build
npm run preview
```

Built with Vite, vanilla JavaScript/CSS, gifuct-js and fflate. `dist/` is the complete deployable site. All supporting pages contain static, crawlable HTML.

## Deployment

Cloudflare Pages project: `gifframeextractor`, production branch: `main`.

```sh
npm run deploy
```

This runs a fresh build and uploads only `dist/`. Wrangler needs a Cloudflare account with Pages write permissions. If the environment requires its existing local proxy, set `HTTP_PROXY` and `HTTPS_PROXY` for the command; no proxy is needed by the deployed site.

### Temporary domain and SEO

The initial deployment intentionally uses a Cloudflare `pages.dev` address, with no custom domain attached. Default `npm run build` emits `noindex, follow` in HTML and the `X-Robots-Tag` response header so the temporary hostname is not indexed as the final site. Canonicals, sitemap entries and social URLs use the planned `https://gifframeextractor.com` domain.

When the production domain is ready:

1. Attach the domain in Cloudflare Pages and finish its DNS and HTTPS setup.
2. Run `npm run build:production` to enable indexing.
3. Deploy that output directly: `npx wrangler pages deploy dist --project-name gifframeextractor --branch main` (do not use `npm run deploy` for this step; it rebuilds temporary mode).
4. Redirect the default Pages hostname to the production domain using Cloudflare's supported routing, then verify canonical URLs, headers, robots.txt and sitemap.xml on the custom domain.
5. Submit the production sitemap to Search Console when appropriate. Deployment does not guarantee search-engine indexing or ranking.

## Included pages

- `/` — interactive extraction tool, use cases, how-to steps and FAQs
- `/how-to-extract-gif-frames/` — practical extraction guide
- `/about/` — tool description and limits
- `/privacy/` — local processing and hosting disclosure
- `/404.html` — real not-found page for Cloudflare Pages

## Processing and limits

One GIF at a time, up to 30 MiB and 1,000 frames. Additional safeguards: 8,192 pixels per side, 16 million pixels per frame, 128 million decoded patch pixels, and 80 million output pixels across all frames. Decoding applies transparent patches and disposal methods 2/3 and exports each full composited image as PNG. Frame timing metadata is preserved, including zero-delay frames; playback delays below 20 ms are displayed at 100 ms for a usable preview. ZIP filenames preserve original frame numbers. Original files are never modified.

The UI creates and releases object URLs, supports cancellation, renders thumbnail batches, uses native accessible controls, and respects reduced-motion preferences. A single ZIP export is limited to 128 MiB of PNG data; larger results can be downloaded in smaller selections. Resource limits reduce browser memory risk; actual capacity still depends on the device. There is no service worker or offline-install feature.

## Verification

`npm test` uses small, real GIF byte sequences and a pixel-aware canvas double to verify transparency, frame patches, disposal modes, delays, invalid files, limits and cancellation. Browser QA additionally verifies real canvas PNG encoding, sample extraction, selection, ZIP contents, file errors and mobile layout.

`scripts/make-assets.py` optionally regenerates the original sample animation and social image with Pillow and Windows Segoe UI fonts. Generated assets are committed; Python is not needed to build or run the site.
