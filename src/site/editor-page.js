// English source templates; localized content is supplied by tools-i18n.js.
export const EDITOR_SEO = {
  resize: {
    title: 'Resize GIF Online — Change Animated GIF Dimensions',
    description: 'Resize an animated GIF in your browser. Set its width and height, preview the result and download the resized animation.',
  },
  crop: {
    title: 'Crop GIF Online — Crop an Animated GIF',
    description: 'Crop an animated GIF in your browser. Select a region, preview the result and download a cropped animation.',
  },
};

export function editorPage(type) {
  if (!['resize', 'crop'].includes(type)) throw new Error('Unknown GIF editor');
  const resize = type === 'resize';
  const name = resize ? 'Resize' : 'Crop';
  const feature = resize
    ? `<article><h3>Choose the dimensions</h3><p>Enter a width and height in pixels. Keep the aspect ratio locked to change both together, or unlock it to set them independently.</p></article>
       <article><h3>Keep the animation</h3><p>The same resize applies to every frame. Frame order, recorded delays and loop settings are retained in the output.</p></article>
       <article><h3>Colors and transparency</h3><p>Resizing and re-encoding can change colors and edges. GIF pixels are either transparent or opaque; preview the result before downloading.</p></article>`
    : `<article><h3>Select a region</h3><p>Choose a rectangle on the preview or enter its position and size in pixels. The crop stays inside the original canvas.</p></article>
       <article><h3>Crop every frame</h3><p>The same rectangle is applied to the whole animation. Frame order, recorded delays and loop settings are retained in the output.</p></article>
       <article><h3>Colors and transparency</h3><p>GIF frames are re-encoded, so colors may change. Transparent areas can remain transparent; preview the result before downloading.</p></article>`;
  const faq = resize
    ? `<details><summary>Does resizing keep the animation?<span aria-hidden="true">+</span></summary><p>Yes. The resized file is a GIF animation, with its original frame order, recorded delays and loop setting.</p></details>
       <details><summary>How do I keep the original proportions?<span aria-hidden="true">+</span></summary><p>Keep the aspect-ratio control locked and change either dimension. The other dimension adjusts to match, rounded to a whole pixel.</p></details>
       <details><summary>Will resizing improve image quality?<span aria-hidden="true">+</span></summary><p>Increasing dimensions cannot restore detail absent from the original GIF. Resampling and GIF palette reduction may change colors or edges.</p></details>`
    : `<details><summary>Will cropping affect every frame?<span aria-hidden="true">+</span></summary><p>Yes. The selected rectangle is applied to every frame of the animation; it cannot change position between frames.</p></details>
       <details><summary>Can I choose exact crop coordinates?<span aria-hidden="true">+</span></summary><p>Yes. Enter the rectangle's position and dimensions in pixels; it must fit inside the original image.</p></details>
       <details><summary>Does the cropped file stay animated?<span aria-hidden="true">+</span></summary><p>Yes. The result is a GIF with the original frame order, recorded delays and loop setting.</p></details>`;
  return `<main class="wrap editor-page" id="content">
    <section class="intro" aria-labelledby="main-title">
      <p class="eyebrow"><span class="status-dot"></span>Free online GIF ${resize ? 'resizer' : 'cropper'}</p>
      <h1 id="main-title">${name} an Animated GIF</h1>
      <p class="lede">${resize ? 'Change the dimensions of every frame.' : 'Choose the part of the animation you want to keep.'}</p>
      <p class="intro-description">Your GIF is processed in your browser. The file is not uploaded for editing.</p>
    </section>
    <section id="editor" aria-label="GIF ${resize ? 'resizer' : 'cropper'}" data-clarity-mask="true">
      <div id="editor-app" data-mode="${type}"></div>
      <noscript><p class="status-message">Enable JavaScript to ${type} a GIF in your browser.</p></noscript>
    </section>
    <section class="how-section section-rule" id="how-it-works">
      <div><p class="section-label">Edit an animation</p><h2>How to ${type} a GIF</h2><p>Work with one GIF and check the result before saving it.</p></div>
      <ol class="steps">
        <li><span>01</span><div><h3>Choose a GIF</h3><p>Select a GIF from your device. The tool reconstructs complete frames before editing.</p></div></li>
        <li><span>02</span><div><h3>${resize ? 'Set the dimensions' : 'Select the crop'}</h3><p>${resize ? 'Enter the output size and choose whether to keep the original proportions.' : 'Select a rectangle or enter exact coordinates and dimensions.'}</p></div></li>
        <li><span>03</span><div><h3>Preview and download</h3><p>Create the edited animation, check its preview, then download the GIF.</p></div></li>
      </ol>
    </section>
    <section class="details-section section-rule"><div class="section-heading"><h2>What to expect from the result</h2></div><div class="feature-grid">${feature}</div></section>
    <section class="faq-section" id="faq"><div><p class="section-label">Good to know</p><h2>GIF ${name.toLowerCase()} FAQ</h2></div><div class="faqs">
      ${faq}
      <details><summary>Is my GIF uploaded?<span aria-hidden="true">+</span></summary><p>No. Editing happens on your device. Loading the website and its analytics still involves network requests; see the <a href="/privacy/">privacy policy</a>.</p></details>
      <details><summary>What are the limits?<span aria-hidden="true">+</span></summary><p>Choose one GIF up to 30 MiB. Editing supports up to 400 frames; output dimensions are limited to 4,096 pixels per side, 4 million pixels per frame and 20 million canvas pixels in total. Input size, decoded pixels and device memory have additional limits.</p></details>
    </div></section>
    <section class="knowledge-section section-rule"><h2>Related tools</h2><ul>
      <li><a href="/">GIF Splitter</a><p>Preview and save individual frames as PNG images.</p></li>
      <li><a href="${resize ? '/crop-gif/' : '/resize-gif/'}">${resize ? 'Crop GIF' : 'Resize GIF'}</a><p>${resize ? 'Keep a selected region across every frame.' : 'Change the dimensions of an animation.'}</p></li>
      <li><a href="/gif-merger/">GIF Merger</a><p>Combine GIFs in sequence into one animation.</p></li>
      <li><a href="/large-gif-extraction-troubleshooting/">Large GIF troubleshooting</a><p>Understand size and memory limits.</p></li>
    </ul></section>
  </main>`;
}
