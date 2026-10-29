/**
 * Gọi trực tiếp các nguồn dữ liệu miễn phí từ trình duyệt (không qua máy chủ riêng):
 *  - Overpass API (OpenStreetMap): nhà có số tầng / chiều cao / màu / kiểu mái + cây đơn lẻ
 *    Hỏi overpass-api.de trước; nếu sau 7 giây chưa trả lời thì hỏi thêm 2 máy chủ dự phòng,
 *    máy nào trả trước thì dùng.
 *  - Nominatim: tên khu vực đang xem.
 */
import type { LiveBuildingInput } from './city3d-shared';

const OVERPASS_PRIMARY = 'https://overpass-api.de/api/interpreter';
const OVERPASS_FALLBACKS = [
  'https://overpass.private.coffee/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];

export interface OverpassAreaResult {
  buildings: LiveBuildingInput[];
  trees: [number, number][];
  server: string;
}

async function queryServer(url: string, body: string, signal: AbortSignal) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
    body: `data=${encodeURIComponent(body)}`,
    signal,
  });
  if (!res.ok) throw new Error(`Overpass ${res.status}`);
  const json = await res.json();
  return { json, server: new URL(url).host };
}

export async function fetchOverpassArea(
  lat: number,
  lng: number,
  radiusM: number,
  outerSignal?: AbortSignal
): Promise<OverpassAreaResult> {
  const r = Math.round(radiusM);
  const q = `[out:json][timeout:25];
(
  way["building"](around:${r},${lat},${lng});
  node["natural"="tree"](around:${r},${lat},${lng});
);
out tags geom;`;

  const controllers: AbortController[] = [];
  const launch = (url: string) => {
    const c = new AbortController();
    controllers.push(c);
    outerSignal?.addEventListener('abort', () => c.abort(), { once: true });
    return queryServer(url, q, c.signal);
  };

  const result = await new Promise<{ json: any; server: string }>((resolve, reject) => {
    let settled = false;
    let failures = 0;
    let total = 1;
    let fallbackTimer: number | undefined;
    const onOk = (v: { json: any; server: string }) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(fallbackTimer);
      resolve(v);
    };
    const onFail = (err: unknown) => {
      failures++;
      if (!settled && failures >= total) {
        if (total === 1) startFallbacks();
        else {
          settled = true;
          reject(err);
        }
      }
    };
    const startFallbacks = () => {
      if (total > 1) return;
      window.clearTimeout(fallbackTimer);
      total += OVERPASS_FALLBACKS.length;
      for (const u of OVERPASS_FALLBACKS) launch(u).then(onOk, onFail);
    };
    launch(OVERPASS_PRIMARY).then(onOk, onFail);
    fallbackTimer = window.setTimeout(startFallbacks, 7000);
  });
  controllers.forEach((c) => c.abort());

  const buildings: LiveBuildingInput[] = [];
  const trees: [number, number][] = [];
  for (const el of result.json?.elements || []) {
    if (el.type === 'way' && Array.isArray(el.geometry) && el.tags?.building) {
      if (el.tags.building === 'no' || el.tags.building === 'dam') continue;
      buildings.push({
        wayId: el.id,
        ring: el.geometry.map((p: { lon: number; lat: number }) => [p.lon, p.lat]),
        tags: el.tags,
      });
    } else if (el.type === 'node' && el.tags?.natural === 'tree') {
      trees.push([el.lon, el.lat]);
    }
  }
  return { buildings, trees, server: result.server };
}

export async function reverseAreaName(lat: number, lng: number, signal?: AbortSignal) {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=16&accept-language=vi&lat=${lat}&lon=${lng}`;
  const res = await fetch(url, { signal, headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error('Nominatim lỗi');
  const j = await res.json();
  const a = j.address || {};
  const parts = [
    a.neighbourhood || a.hamlet || a.quarter || a.village || a.road,
    a.suburb || a.city_district || a.town || a.city,
  ].filter(Boolean);
  return parts.length ? parts.join(', ') : j.display_name?.split(',').slice(0, 2).join(',') || '';
}
