import { readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

// Preserve the SVG brand artwork; raster assets are committed, not built on deploy.
const svg = await readFile(new URL('../public/favicon.svg', import.meta.url), 'utf8');
const sizes = [16, 32, 48, 64, 128, 256];
const browser = await chromium.launch({
  headless: true,
  ...(process.env.BROWSER_EXECUTABLE_PATH ? { executablePath: process.env.BROWSER_EXECUTABLE_PATH } : {}),
});
try {
  const page = await browser.newPage();
  const encoded = await page.evaluate(async ({ svg, sizes }) => {
    const artwork = new DOMParser().parseFromString(svg, 'image/svg+xml');
    artwork.documentElement.setAttribute('width', '1024');
    artwork.documentElement.setAttribute('height', '1024');
    const image = new Image();
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(artwork))}`;
    await image.decode();
    return sizes.map(size => {
      const large = document.createElement('canvas');
      large.width = large.height = size * 4;
      large.getContext('2d').drawImage(image, 0, 0, large.width, large.height);
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = size;
      const context = canvas.getContext('2d');
      context.imageSmoothingQuality = 'high';
      context.drawImage(large, 0, 0, size, size);
      return canvas.toDataURL('image/png').split(',')[1];
    });
  }, { svg, sizes });
  const images = encoded.map(data => Buffer.from(data, 'base64'));
  await writeFile(new URL('../public/favicon.png', import.meta.url), images.at(-1));

  // An ICO directory followed by one PNG image for each declared size.
  const directory = Buffer.alloc(6 + sizes.length * 16);
  directory.writeUInt16LE(1, 2);
  directory.writeUInt16LE(sizes.length, 4);
  let offset = directory.length;
  sizes.forEach((size, index) => {
    const entry = 6 + index * 16;
    directory[entry] = directory[entry + 1] = size === 256 ? 0 : size;
    directory.writeUInt16LE(1, entry + 4);
    directory.writeUInt16LE(32, entry + 6);
    directory.writeUInt32LE(images[index].length, entry + 8);
    directory.writeUInt32LE(offset, entry + 12);
    offset += images[index].length;
  });
  await writeFile(new URL('../public/favicon.ico', import.meta.url), Buffer.concat([directory, ...images]));
  console.log('Generated favicon.png (256×256) and favicon.ico (16/32/48/64/128/256) from favicon.svg.');
} finally {
  await browser.close();
}
