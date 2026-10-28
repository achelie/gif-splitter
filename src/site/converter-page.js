// English source templates; localized versions must describe static-frame output.
export const CONVERTER_SEO = {
  jpg: {
    title: 'GIF to JPG Converter — Save GIF Frames as JPEG',
    description: 'Convert a GIF to JPG images in your browser. Choose a background, save one frame, or download selected frames as a ZIP.',
  },
  webp: {
    title: 'GIF to WebP Converter — Save GIF Frames as WebP',
    description: 'Convert GIF frames to static WebP images in your browser. Save one image or a ZIP of frames, with transparency where supported.',
  },
};

export function converterPage(type) {
  const jpg = type === 'jpg';
  if (!jpg && type !== 'webp') throw new Error('Unknown converter format');
  const format = jpg ? 'JPG' : 'WebP';
  const intro = jpg
    ? 'Save a single frame or a set of JPEG images. Choose a background for transparent areas.'
    : 'Save a single frame or a set of static WebP images, with transparency in supported browsers.';
  const feature = jpg
    ? `<article><h3>Choose a background</h3><p>JPEG does not support transparency. Transparent parts of each frame are placed over the background color you choose; the default is white.</p></article>
       <article><h3>JPEG quality</h3><p>Choose an output quality before saving. JPEG is lossy, so compression can change fine details and colors; it cannot restore detail absent from the original GIF.</p></article>
       <article><h3>Original frame size</h3><p>Each JPG uses the GIF's canvas dimensions. The downloaded images are still pictures and do not include animation timing.</p></article>`
    : `<article><h3>Transparency</h3><p>WebP can preserve transparent pixels from the reconstructed GIF frame. The checkerboard shown in the preview is not part of the output.</p></article>
       <article><h3>Browser support</h3><p>Your browser must support WebP encoding. If it cannot create a WebP image, the tool displays an error instead of offering another format as WebP.</p></article>
       <article><h3>Still images, not animation</h3><p>Each downloaded WebP is a static image at the original GIF canvas dimensions. A ZIP contains separate images, not an animated WebP file.</p></article>`;
  const faq = jpg
    ? `<details><summary>Can I convert an animated GIF to one JPG?<span aria-hidden="true">+</span></summary><p>Yes. Preview the frame you want and download it as a single JPEG. The JPG is a still image and will not play the source animation.</p></details>
       <details><summary>What happens to transparent areas?<span aria-hidden="true">+</span></summary><p>JPEG cannot store transparency. Choose a background color, then save the frame; transparent areas are rendered over that color.</p></details>
       <details><summary>Can I save every frame as JPG?<span aria-hidden="true">+</span></summary><p>Yes. Download all frames as a ZIP of numbered JPG images, or select only the frames you need. The ZIP does not preserve animation timing.</p></details>
       <details><summary>What if I need transparency?<span aria-hidden="true">+</span></summary><p>Use the <a href="/">GIF splitter</a> to export PNG frames, or try <a href="/gif-to-webp/">GIF to WebP</a> in a browser that supports WebP encoding.</p></details>`
    : `<details><summary>Does this create an animated WebP?<span aria-hidden="true">+</span></summary><p>No. This converter saves static WebP images. Choose one GIF frame, or download several frames as separate files in a ZIP.</p></details>
       <details><summary>Will transparent backgrounds remain transparent?<span aria-hidden="true">+</span></summary><p>WebP supports transparency. Where your browser can encode WebP, transparent pixels in the reconstructed frame can be retained.</p></details>
       <details><summary>Why does my browser report that WebP is unavailable?<span aria-hidden="true">+</span></summary><p>WebP export depends on the browser's image encoder. Try a current browser, or use the <a href="/">GIF splitter</a> to save PNG images instead.</p></details>
       <details><summary>Can I save all GIF frames as WebP?<span aria-hidden="true">+</span></summary><p>Yes. Download a ZIP with numbered static WebP images, or select only the frames you need. The files do not contain the GIF's animation timing.</p></details>`;
  return `<main class="wrap converter-page" id="content">
    <section class="intro" aria-labelledby="main-title">
      <p class="eyebrow"><span class="status-dot"></span>Free online GIF to ${format} converter</p>
      <h1 id="main-title">Convert GIF to ${format}</h1>
      <p class="lede">${intro}</p>
      <p class="intro-description">Your GIF is processed in your browser. The conversion does not upload your file.</p>
    </section>
    <section id="converter" aria-label="GIF to ${format} converter" data-clarity-mask="true">
      <div id="converter-app" data-format="${jpg ? 'jpg' : 'webp'}"></div>
      <noscript><p class="status-message">Enable JavaScript to convert GIF frames in your browser.</p></noscript>
    </section>
    <section class="how-section section-rule" id="how-it-works">
      <div><p class="section-label">From animation to still images</p><h2>How to convert a GIF to ${format}</h2><p>Choose the image or frames you need and save them without uploading your GIF for conversion.</p></div>
      <ol class="steps">
        <li><span>01</span><div><h3>Choose a GIF</h3><p>Select one GIF from your device. The browser reconstructs its complete frames, including updates stored as partial images.</p></div></li>
        <li><span>02</span><div><h3>Preview and select frames</h3><p>Find a frame in the preview. Check individual frames if you want a selection; you can also save the whole sequence.</p></div></li>
        <li><span>03</span><div><h3>Download ${format}</h3><p>Set the output quality${jpg ? ' and background color' : ''}, then download one image or a numbered ZIP of selected or all frames.</p></div></li>
      </ol>
    </section>
    <section class="details-section section-rule"><div class="section-heading"><h2>What to expect from ${format} output</h2></div><div class="feature-grid">${feature}</div></section>
    <section class="faq-section" id="faq"><div><p class="section-label">Good to know</p><h2>GIF to ${format} FAQ</h2><p>About frames, output and file handling.</p></div><div class="faqs">
      ${faq}
      <details><summary>Are my GIFs uploaded?<span aria-hidden="true">+</span></summary><p>No. Your chosen GIF and converted images are processed on your device. Loading the website and its analytics still involves network requests; see the <a href="/privacy/">privacy policy</a>.</p></details>
      <details><summary>What are the limits?<span aria-hidden="true">+</span></summary><p>One GIF can be up to 30 MiB and 1,000 frames. Dimension, pixel and memory safeguards can reject a smaller file, and each ZIP is limited to 128 MiB of image data. See the <a href="/large-gif-extraction-troubleshooting/">large GIF troubleshooting guide</a>.</p></details>
    </div></section>
    <section class="knowledge-section section-rule"><h2>Related tools</h2><ul>
      <li><a href="/">GIF Splitter</a><p>Preview and save frames as PNG images.</p></li>
      <li><a href="${jpg ? '/gif-to-webp/' : '/gif-to-jpg/'}">GIF to ${jpg ? 'WebP' : 'JPG'}</a><p>Save static frames in ${jpg ? 'WebP' : 'JPEG'} format.</p></li>
      <li><a href="/gif-merger/">GIF Merger</a><p>Combine multiple GIFs into one animation.</p></li>
      <li><a href="/resize-gif/">Resize GIF</a><p>Change the dimensions of an animation.</p></li>
      <li><a href="/crop-gif/">Crop GIF</a><p>Keep a selected area across every frame.</p></li>
      <li><a href="/how-to-extract-gif-frames/">How to extract GIF frames</a><p>Learn about frame selection, transparency and timing.</p></li>
    </ul></section>
  </main>`;
}
