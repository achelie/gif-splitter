import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { ROUTES } from './src/site/config.js';
import { loadLocales } from './src/site/content.js';
import { renderPage } from './src/site/render.js';

export default defineConfig({
  html: { cspNonce: '__CSP_NONCE__' },
  build: {
    manifest: true,
    rollupOptions: { input: { app: resolve('src/main.js'), site: resolve('src/site.js') } },
  },
  plugins: [{
    name: 'static-locale-pages',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const pathname = new URL(req.url, 'http://localhost').pathname;
        const route = ROUTES.find(item => item.path === pathname);
        if (!route) return next();
        try {
          const locales = await loadLocales();
          const html = renderPage(locales, route, { scripts: [route.type === 'home' ? '/src/main.js' : '/src/site.js'], styles: ['/src/style.css'] });
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.end(await server.transformIndexHtml(pathname, html));
        } catch (error) {
          next(error);
        }
      });
    },
  }],
});
