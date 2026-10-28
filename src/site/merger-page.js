// English source template; localized content is supplied by tools-i18n.js.
export const MERGER_SEO = {
  title: 'GIF Merger — Combine GIFs Online',
  description: 'Combine GIFs in order into one animation. Arrange files, preview the result, and download it from your browser.',
};

export function mergerPage() {
  return `<main class="wrap merger-page" id="content">
    <section class="intro" aria-labelledby="main-title">
      <p class="eyebrow"><span class="status-dot"></span>Free online GIF merger</p>
      <h1 id="main-title">Merge GIFs into One Animation</h1>
      <p class="lede">Put GIFs in order and download one animation.</p>
      <p class="intro-description">Your browser processes the files on your device. Nothing is uploaded for conversion.</p>
    </section>
    <section id="merger" aria-label="GIF merger" data-clarity-mask="true">
      <div id="merger-app"></div>
      <noscript><p class="status-message">Enable JavaScript to merge GIFs in your browser.</p></noscript>
    </section>
    <section class="how-section section-rule" id="how-it-works">
      <div><p class="section-label">Combine animations</p><h2>How to merge GIFs</h2><p>Join the animations in sequence. Arrange the files before creating the result.</p></div>
      <ol class="steps">
        <li><span>01</span><div><h3>Choose your GIFs</h3><p>Select between 2 and 10 GIF files from your device. The total input size can be up to 30 MiB.</p></div></li>
        <li><span>02</span><div><h3>Arrange the order</h3><p>Move files up or down, or remove one. The GIFs will play one after another in the order shown.</p></div></li>
        <li><span>03</span><div><h3>Merge and download</h3><p>Create the animation, review the result and download the GIF. Processing happens in your browser.</p></div></li>
      </ol>
    </section>
    <section class="details-section section-rule"><div class="section-heading"><h2>What to expect from the result</h2></div>
      <div class="feature-grid">
        <article><h3>Different dimensions</h3><p>The output canvas uses the largest width and height among the inputs. Frames stay at their original size, centered, with transparent space around smaller images.</p></article>
        <article><h3>Timing and looping</h3><p>Each frame retains its recorded delay. The combined animation loops indefinitely; original per-file loop counts are not retained.</p></article>
        <article><h3>Colors and transparency</h3><p>Frames are re-encoded and colors may change during palette reduction. GIF transparency is either fully transparent or opaque.</p></article>
      </div>
    </section>
    <section class="faq-section" id="faq"><div><p class="section-label">Good to know</p><h2>GIF merger FAQ</h2></div><div class="faqs">
      <details><summary>Are my GIF files uploaded?<span aria-hidden="true">+</span></summary><p>No. Your chosen GIFs and the merged result are processed on your device. Loading the website and its analytics still involves network requests; see the <a href="/privacy/">privacy policy</a>.</p></details>
      <details><summary>What are the limits?<span aria-hidden="true">+</span></summary><p>Choose 2–10 GIFs with a combined size of at most 30 MiB and no more than 400 frames. The output canvas can be at most 4,096 pixels on either side and 4 million pixels per frame; the complete output may contain at most 20 million canvas pixels. Device memory can impose a lower practical limit.</p></details>
      <details><summary>Can I put GIFs side by side?<span aria-hidden="true">+</span></summary><p>This tool joins GIFs sequentially, so one animation plays after the other. It does not combine them side by side.</p></details>
      <details><summary>Can I split the merged GIF into images?<span aria-hidden="true">+</span></summary><p>Yes. Open the result in the <a href="/">GIF splitter</a> to preview its frames and download PNG images, subject to the splitter’s limits.</p></details>
    </div></section>
  </main>`;
}
