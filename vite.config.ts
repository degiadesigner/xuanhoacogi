import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/postcss';
import { fileURLToPath } from 'node:url';
import https from 'node:https';
import http from 'node:http';

function extractCoordsFromTextOrUrl(raw: string): { lat: number; lng: number } | null {
  if (!raw) return null;
  let text = raw;
  try {
    text = decodeURIComponent(raw);
  } catch {
    // ignore
  }
  const bang = Array.from(text.matchAll(/!3d(2[012]\.\d+)!4d(10[456]\.\d+)/g));
  if (bang.length > 0) {
    const last = bang[bang.length - 1];
    return { lat: Number(parseFloat(last[1]).toFixed(6)), lng: Number(parseFloat(last[2]).toFixed(6)) };
  }
  const embed = Array.from(text.matchAll(/!2d(10[456]\.\d+)!3d(2[012]\.\d+)/g));
  if (embed.length > 0) {
    const last = embed[embed.length - 1];
    return { lat: Number(parseFloat(last[2]).toFixed(6)), lng: Number(parseFloat(last[1]).toFixed(6)) };
  }
  const atMatch = text.match(/(?:@|\/place\/|\/search\/|\/dir\/[^/]*\/|[?&](?:q|query|ll|center)=)(2[012]\.\d+)\s*[,\s+]\s*(10[456]\.\d+)/i);
  if (atMatch) {
    return { lat: Number(parseFloat(atMatch[1]).toFixed(6)), lng: Number(parseFloat(atMatch[2]).toFixed(6)) };
  }
  const arrMatch = text.match(/\[null,null,(2[012]\.\d+),(10[456]\.\d+)\]/);
  if (arrMatch) {
    return { lat: Number(parseFloat(arrMatch[1]).toFixed(6)), lng: Number(parseFloat(arrMatch[2]).toFixed(6)) };
  }
  return null;
}

function followRedirectAndExtract(
  targetUrl: string,
  depth = 0
): Promise<{ finalUrl: string; lat: number | null; lng: number | null }> {
  return new Promise((resolve) => {
    if (depth > 6) {
      const c = extractCoordsFromTextOrUrl(targetUrl);
      resolve({ finalUrl: targetUrl, lat: c?.lat ?? null, lng: c?.lng ?? null });
      return;
    }
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(targetUrl);
    } catch {
      resolve({ finalUrl: targetUrl, lat: null, lng: null });
      return;
    }
    const client = parsedUrl.protocol === 'https:' ? https : http;
    const req = client.get(
      targetUrl,
      {
        family: 4,
        timeout: 6500,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'vi-VN,vi;q=0.9,en;q=0.8',
        },
      },
      (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          const nextUrl = new URL(res.headers.location, targetUrl).toString();
          const directCoords = extractCoordsFromTextOrUrl(nextUrl);
          if (directCoords) {
            resolve({ finalUrl: nextUrl, lat: directCoords.lat, lng: directCoords.lng });
            return;
          }
          followRedirectAndExtract(nextUrl, depth + 1).then(resolve);
          return;
        }

        const urlCoords = extractCoordsFromTextOrUrl(targetUrl);
        if (urlCoords) {
          res.resume();
          resolve({ finalUrl: targetUrl, lat: urlCoords.lat, lng: urlCoords.lng });
          return;
        }

        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          if (body.length < 180000) {
            body += chunk;
          }
        });
        res.on('end', () => {
          const bodyCoords = extractCoordsFromTextOrUrl(body);
          resolve({
            finalUrl: targetUrl,
            lat: bodyCoords?.lat ?? null,
            lng: bodyCoords?.lng ?? null,
          });
        });
      }
    );
    req.on('timeout', () => {
      req.destroy();
      const c = extractCoordsFromTextOrUrl(targetUrl);
      resolve({ finalUrl: targetUrl, lat: c?.lat ?? null, lng: c?.lng ?? null });
    });
    req.on('error', () => {
      const c = extractCoordsFromTextOrUrl(targetUrl);
      resolve({ finalUrl: targetUrl, lat: c?.lat ?? null, lng: c?.lng ?? null });
    });
  });
}

function googleMapsShortUrlResolverPlugin(): Plugin {
  const handleMiddleware = (req: any, res: any, next: any) => {
    if (!req.url || !req.url.startsWith('/api/resolve-maps-url')) {
      next();
      return;
    }
    try {
      const reqUrl = new URL(req.url, 'http://127.0.0.1');
      const target = (reqUrl.searchParams.get('url') || '').trim();
      if (!target || !/^https?:\/\//i.test(target)) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ ok: false, error: 'Invalid URL' }));
        return;
      }
      followRedirectAndExtract(target)
        .then((result) => {
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ ok: true, ...result }));
        })
        .catch((err) => {
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ ok: false, error: String(err) }));
        });
    } catch (err) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ ok: false, error: String(err) }));
    }
  };

  return {
    name: 'xuanhoa-resolve-maps-url',
    configureServer(server) {
      server.middlewares.use(handleMiddleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(handleMiddleware);
    },
  };
}

export default defineConfig({
  plugins: [react(), googleMapsShortUrlResolverPlugin()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    watch: { ignored: ['**/*.zip'] },
  },
  preview: {
    host: '127.0.0.1',
    port: 4173,
    strictPort: true,
  },
  base: process.env.PUBLIC_BASE_PATH || '/',
  css: {
    postcss: {
      plugins: [tailwindcss()],
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  define: {
    'process.env.NEXT_PUBLIC_BASE_PATH': JSON.stringify(
      (process.env.PUBLIC_BASE_PATH || '/').replace(/\/$/, '')
    ),
  },
});
