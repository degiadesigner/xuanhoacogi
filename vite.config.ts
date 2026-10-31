import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/postcss';
import { fileURLToPath } from 'node:url';
import https from 'node:https';

const ALLOWED_GMAPS_HOSTS = new Set([
  'maps.app.goo.gl',
  'goo.gl',
  'google.com',
  'www.google.com',
  'maps.google.com',
  ' google.com.vn',
  'www.google.com.vn',
]);

function isPrivateOrLocalHostname(hostname: string): boolean {
  const h = hostname.trim().toLowerCase();
  if (
    h === 'localhost' ||
    h === '::1' ||
    h === '[::1]' ||
    h === '0.0.0.0' ||
    h.endsWith('.local') ||
    h.endsWith('.internal')
  ) {
    return true;
  }
  if (/^(127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(h)) return true;
  const m172 = h.match(/^172\.(\d+)\./);
  if (m172) {
    const second = Number(m172[1]);
    if (second >= 16 && second <= 31) return true;
  }
  return false;
}

function isAllowedGoogleMapsUrl(rawUrl: string): { ok: boolean; parsed?: URL; reason?: string } {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    return { ok: false, reason: 'URL không hợp lệ' };
  }
  if (parsed.protocol !== 'https:') {
    return { ok: false, reason: 'Chỉ chấp nhận giao thức HTTPS' };
  }
  const host = parsed.hostname.toLowerCase();
  if (isPrivateOrLocalHostname(host)) {
    return { ok: false, reason: 'Từ chối kết nối tới IP nội bộ / localhost' };
  }
  const isAllowedHost =
    ALLOWED_GMAPS_HOSTS.has(host) ||
    host.endsWith('.google.com') ||
    host.endsWith('.goo.gl');
  if (!isAllowedHost) {
    return { ok: false, reason: 'Domain không nằm trong danh sách Google Maps cho phép' };
  }
  return { ok: true, parsed };
}

function isValidVietnamCoord(lat: number, lng: number): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (lat === 0 && lng === 0) return false;
  return lat >= 8.0 && lat <= 24.0 && lng >= 102.0 && lng <= 110.5;
}

function extractCoordsAndPlaceIdFromText(raw: string): {
  lat: number;
  lng: number;
  placeId?: string;
  pattern: string;
} | null {
  if (!raw) return null;
  let text = raw;
  try {
    text = decodeURIComponent(raw);
  } catch {
    // ignore decode error
  }

  const placeIdMatch =
    text.match(/!1s(0x[0-9a-fA-F]+:0x[0-9a-fA-F]+|ChIJ[A-Za-z0-9_-]{10,})/) ||
    text.match(/[?&]place_id=([A-Za-z0-9_-]{10,})/);
  const placeId = placeIdMatch?.[1];

  // 1. Ưu tiên cao nhất: !3d{lat}!4d{lng} (tọa độ ghim thực tế của địa điểm trên Google Maps)
  const bang3d4d = Array.from(text.matchAll(/!3d(-?\d{1,2}\.\d{4,})!4d(-?\d{1,3}\.\d{4,})/g));
  if (bang3d4d.length > 0) {
    const last = bang3d4d[bang3d4d.length - 1];
    const lat = Number(parseFloat(last[1]).toFixed(6));
    const lng = Number(parseFloat(last[2]).toFixed(6));
    if (isValidVietnamCoord(lat, lng)) {
      return { lat, lng, placeId, pattern: '!3d!4d' };
    }
  }

  // 2. !2d{lng}!3d{lat}
  const bang2d3d = Array.from(text.matchAll(/!2d(-?\d{1,3}\.\d{4,})!3d(-?\d{1,2}\.\d{4,})/g));
  if (bang2d3d.length > 0) {
    const last = bang2d3d[bang2d3d.length - 1];
    const lng = Number(parseFloat(last[1]).toFixed(6));
    const lat = Number(parseFloat(last[2]).toFixed(6));
    if (isValidVietnamCoord(lat, lng)) {
      return { lat, lng, placeId, pattern: '!2d!3d' };
    }
  }

  // 3. /place/.../@lat,lng
  const placeAtMatch = text.match(/\/place\/[^/]+\/@(-?\d{1,2}\.\d{4,})\s*,\s*(-?\d{1,3}\.\d{4,})/i);
  if (placeAtMatch) {
    const lat = Number(parseFloat(placeAtMatch[1]).toFixed(6));
    const lng = Number(parseFloat(placeAtMatch[2]).toFixed(6));
    if (isValidVietnamCoord(lat, lng)) {
      return { lat, lng, placeId, pattern: '/place/@lat,lng' };
    }
  }

  // 4. ?q=lat,lng | ?ll=lat,lng | query=lat,lng | center=lat,lng
  const queryMatch = text.match(
    /[?&](?:q|query|ll|center|daddr|saddr)=(-?\d{1,2}\.\d{4,})\s*[,\s+]\s*(-?\d{1,3}\.\d{4,})/i
  );
  if (queryMatch) {
    const lat = Number(parseFloat(queryMatch[1]).toFixed(6));
    const lng = Number(parseFloat(queryMatch[2]).toFixed(6));
    if (isValidVietnamCoord(lat, lng)) {
      return { lat, lng, placeId, pattern: 'query_param' };
    }
  }

  // 5. @lat,lng,zoom hoặc /search/lat,lng hoặc /dir/.../lat,lng
  const atMatch = text.match(
    /(?:@|\/search\/|\/dir\/[^/]*\/)(-?\d{1,2}\.\d{4,})\s*[,\s+]\s*(-?\d{1,3}\.\d{4,})/i
  );
  if (atMatch) {
    const lat = Number(parseFloat(atMatch[1]).toFixed(6));
    const lng = Number(parseFloat(atMatch[2]).toFixed(6));
    if (isValidVietnamCoord(lat, lng)) {
      return { lat, lng, placeId, pattern: '@lat,lng' };
    }
  }

  // 6. Cặp tọa độ nhúng trong HTML Google Maps: [null,null,lat,lng]
  const arrMatch = text.match(/\[null,null,(2[012]\.\d{4,}),(10[456]\.\d{4,})\]/);
  if (arrMatch) {
    const lat = Number(parseFloat(arrMatch[1]).toFixed(6));
    const lng = Number(parseFloat(arrMatch[2]).toFixed(6));
    if (isValidVietnamCoord(lat, lng)) {
      return { lat, lng, placeId, pattern: 'html_embedded' };
    }
  }

  return null;
}

const MAX_REDIRECTS = 6;
const REQUEST_TIMEOUT_MS = 5500;
const MAX_RESPONSE_BYTES = 180_000;

function followRedirectAndExtract(
  targetUrl: string,
  depth = 0
): Promise<{
  ok: boolean;
  finalUrl: string;
  lat: number | null;
  lng: number | null;
  placeId?: string;
  source: 'google_maps_resolved' | 'unresolved';
  error?: string;
}> {
  return new Promise((resolve) => {
    const check = isAllowedGoogleMapsUrl(targetUrl);
    if (!check.ok) {
      resolve({
        ok: false,
        finalUrl: targetUrl,
        lat: null,
        lng: null,
        source: 'unresolved',
        error: check.reason || 'URL không hợp lệ',
      });
      return;
    }

    // Nếu bản thân URL đã chứa tọa độ chuẩn thì trả về ngay lập tức (0ms network)
    const direct = extractCoordsAndPlaceIdFromText(targetUrl);
    if (direct && !targetUrl.includes('goo.gl')) {
      resolve({
        ok: true,
        finalUrl: targetUrl,
        lat: direct.lat,
        lng: direct.lng,
        placeId: direct.placeId,
        source: 'google_maps_resolved',
      });
      return;
    }

    if (depth > MAX_REDIRECTS) {
      const c = extractCoordsAndPlaceIdFromText(targetUrl);
      resolve({
        ok: Boolean(c),
        finalUrl: targetUrl,
        lat: c?.lat ?? null,
        lng: c?.lng ?? null,
        placeId: c?.placeId,
        source: c ? 'google_maps_resolved' : 'unresolved',
        error: c ? undefined : 'Vượt quá giới hạn chuyển hướng (redirect limit)',
      });
      return;
    }

    const req = https.get(
      targetUrl,
      {
        family: 4,
        timeout: REQUEST_TIMEOUT_MS,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'vi-VN,vi;q=0.9,en;q=0.8',
        },
      },
      (res) => {
        if (
          res.statusCode &&
          res.statusCode >= 300 &&
          res.statusCode < 400 &&
          res.headers.location
        ) {
          res.resume();
          let nextUrl: string;
          try {
            nextUrl = new URL(res.headers.location, targetUrl).toString();
          } catch {
            resolve({
              ok: false,
              finalUrl: targetUrl,
              lat: null,
              lng: null,
              source: 'unresolved',
              error: 'Redirect URL không hợp lệ',
            });
            return;
          }
          const nextCheck = isAllowedGoogleMapsUrl(nextUrl);
          if (!nextCheck.ok) {
            resolve({
              ok: false,
              finalUrl: nextUrl,
              lat: null,
              lng: null,
              source: 'unresolved',
              error: nextCheck.reason,
            });
            return;
          }
          const directCoords = extractCoordsAndPlaceIdFromText(nextUrl);
          if (directCoords) {
            resolve({
              ok: true,
              finalUrl: nextUrl,
              lat: directCoords.lat,
              lng: directCoords.lng,
              placeId: directCoords.placeId,
              source: 'google_maps_resolved',
            });
            return;
          }
          followRedirectAndExtract(nextUrl, depth + 1).then(resolve);
          return;
        }

        const urlCoords = extractCoordsAndPlaceIdFromText(targetUrl);
        if (urlCoords) {
          res.resume();
          resolve({
            ok: true,
            finalUrl: targetUrl,
            lat: urlCoords.lat,
            lng: urlCoords.lng,
            placeId: urlCoords.placeId,
            source: 'google_maps_resolved',
          });
          return;
        }

        let body = '';
        let byteLen = 0;
        res.setEncoding('utf8');
        res.on('data', (chunk: string) => {
          byteLen += Buffer.byteLength(chunk, 'utf8');
          if (byteLen <= MAX_RESPONSE_BYTES) {
            body += chunk;
          }
        });
        res.on('end', () => {
          const bodyCoords = extractCoordsAndPlaceIdFromText(body);
          resolve({
            ok: Boolean(bodyCoords),
            finalUrl: targetUrl,
            lat: bodyCoords?.lat ?? null,
            lng: bodyCoords?.lng ?? null,
            placeId: bodyCoords?.placeId,
            source: bodyCoords ? 'google_maps_resolved' : 'unresolved',
            error: bodyCoords
              ? undefined
              : 'Không thể đọc tọa độ chính xác từ Google Maps.',
          });
        });
      }
    );

    req.on('timeout', () => {
      req.destroy();
      const c = extractCoordsAndPlaceIdFromText(targetUrl);
      resolve({
        ok: Boolean(c),
        finalUrl: targetUrl,
        lat: c?.lat ?? null,
        lng: c?.lng ?? null,
        placeId: c?.placeId,
        source: c ? 'google_maps_resolved' : 'unresolved',
        error: c ? undefined : 'Hết thời gian chờ khi giải mã link Google Maps',
      });
    });

    req.on('error', () => {
      const c = extractCoordsAndPlaceIdFromText(targetUrl);
      resolve({
        ok: Boolean(c),
        finalUrl: targetUrl,
        lat: c?.lat ?? null,
        lng: c?.lng ?? null,
        placeId: c?.placeId,
        source: c ? 'google_maps_resolved' : 'unresolved',
        error: c ? undefined : 'Lỗi kết nối khi giải mã link Google Maps',
      });
    });
  });
}

function googleMapsShortUrlResolverPlugin(): Plugin {
  const handleMiddleware = (req: any, res: any, next: any) => {
    const urlPath = req.url || '';
    const isLegacyGet = urlPath.startsWith('/api/resolve-maps-url');
    const isStandardEndpoint = urlPath.startsWith('/api/resolve-google-maps-url');
    if (!isLegacyGet && !isStandardEndpoint) {
      next();
      return;
    }

    const processTargetUrl = (target: string) => {
      const clean = (target || '').trim();
      const allowed = isAllowedGoogleMapsUrl(clean);
      if (!allowed.ok) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(
          JSON.stringify({
            ok: false,
            finalUrl: clean,
            lat: null,
            lng: null,
            source: 'unresolved',
            error: allowed.reason || 'Invalid Google Maps URL',
          })
        );
        return;
      }

      followRedirectAndExtract(clean)
        .then((result) => {
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify(result));
        })
        .catch((err) => {
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(
            JSON.stringify({
              ok: false,
              finalUrl: clean,
              lat: null,
              lng: null,
              source: 'unresolved',
              error: String(err),
            })
          );
        });
    };

    try {
      if (req.method === 'POST') {
        let body = '';
        req.on('data', (chunk: Buffer | string) => {
          if (body.length < 8192) body += chunk.toString();
        });
        req.on('end', () => {
          try {
            const parsed = JSON.parse(body || '{}');
            processTargetUrl(String(parsed.url || ''));
          } catch {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ ok: false, error: 'Invalid JSON body' }));
          }
        });
        return;
      }

      const reqUrl = new URL(urlPath, 'http://127.0.0.1');
      const target = (reqUrl.searchParams.get('url') || '').trim();
      processTargetUrl(target);
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
