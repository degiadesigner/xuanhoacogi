/**
 * XUAN HÒA DIGITAL TWIN — MASTER GEO DATASET PIPELINE (GIAI ĐOẠN 1)
 * ============================================================================
 * Tạo nguồn dữ liệu gốc duy nhất (Master Geo Dataset) cho cả Bản đồ 2D và 3D:
 *   1. Preprocess DEM thực (AWS Terrain Tiles / Mapzen Terrarium Z13 — SRTM/Copernicus)
 *      + Làm phẳng thuỷ văn (Hồ Đại Lải, Hồ Lập Đinh, Hồ Đồng Đò, Sông Cà Lồ...)
 *      → public/geo/xuanhoa-dem.bin & public/geo/xuanhoa-dem-meta.json
 *   2. Hợp nhất công trình từ OSM (xuanhoa-buildings.geojson) + Google/Microsoft Open Buildings
 *      + Giữ nguyên 100% footprint thật (KHÔNG biến footprint thành rectangle giả)
 *      + Tách rõ 3 lớp: GEOMETRY (vị trí, footprint, hướng) / SEMANTICS (loại, số tầng, chiều cao,
 *        heightSource, kiểu mái, landuse, roadTier, contextual zone) / STYLE (màu tường, màu mái, topBox)
 *   3. Chuẩn hoá mạng lưới đường (xuanhoa-roads.geojson) & nhãn địa danh / POI đa tầng LOD
 *   4. Xuất đồng bộ:
 *      - public/geo/xuanhoa-city3d.bin        (Dùng chung cho cả 2D và 3D)
 *      - public/geo/xuanhoa-city3d-meta.json  (Metadata + thuộc tính ngữ nghĩa từng building)
 *      - public/geo/xuanhoa-master-meta.json  (Master metadata toàn Phường Xuân Hòa)
 *
 * Cách chạy: node scripts/build-xuanhoa-master.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GEO = path.join(ROOT, 'public', 'geo');
const CACHE_DIR = path.join(ROOT, 'scripts', '.cache');
const DEM_CACHE_DIR = path.join(CACHE_DIR, 'dem_terrarium_z13');
const RAW_OB = process.argv[2] || path.join(CACHE_DIR, 'openbuildings_raw.json');

// Gốc toạ độ cục bộ (mét) — tâm ĐHSP Hà Nội 2, trùng XUANHOA_DEFAULT_CENTER
const LNG0 = 105.7262;
const LAT0 = 21.2818;
const KX = 111320 * Math.cos((LAT0 * Math.PI) / 180);
const KY = 110574;
const toLocal = (lng, lat) => [(lng - LNG0) * KX, (lat - LAT0) * KY];
const toLngLat = (x, y) => [LNG0 + x / KX, LAT0 + y / KY];

const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));

// ============================================================================
// PHẦN 0: CÁC HÀM HÌNH HỌC & SPATIAL INDEX CƠ BẢN
// ============================================================================
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const seedFrom = (x, y) =>
  (Math.imul(Math.round(x * 10) | 0, 73856093) ^ Math.imul(Math.round(y * 10) | 0, 19349663)) >>> 0;

function pickWeighted(rnd, items) {
  let total = 0;
  for (const [, w] of items) total += w;
  let r = rnd() * total;
  for (const [v, w] of items) {
    r -= w;
    if (r <= 0) return v;
  }
  return items[items.length - 1][0];
}

function signedArea(ring) {
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    a += (ring[j][0] - ring[i][0]) * (ring[j][1] + ring[i][1]);
  }
  return a / 2; // >0 khi CCW (trục y hướng Bắc)
}

function pointInRing(x, y, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi || 1e-12) + xi) inside = !inside;
  }
  return inside;
}

function bboxOf(ring) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of ring) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return [minX, minY, maxX, maxY];
}

function centroid(ring) {
  let a = 0, cx = 0, cy = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const f = ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
    a += f;
    cx += (ring[j][0] + ring[i][0]) * f;
    cy += (ring[j][1] + ring[i][1]) * f;
  }
  if (Math.abs(a) < 1e-9) {
    const b = bboxOf(ring);
    return [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2];
  }
  return [cx / (3 * a), cy / (3 * a)];
}

function convexHull(pts) {
  const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [];
  for (const q of p) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop();
    lower.push(q);
  }
  const upper = [];
  for (let i = p.length - 1; i >= 0; i--) {
    const q = p[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop();
    upper.push(q);
  }
  upper.pop();
  lower.pop();
  return lower.concat(upper);
}

/** Hình chữ nhật bao nhỏ nhất (Oriented Bounding Box) — chỉ dùng để tính aspectRatio & hướng mái, KHÔNG thay footprint */
function minAreaRect(ring) {
  const hull = convexHull(ring);
  let best = null;
  for (let i = 0; i < hull.length; i++) {
    const a = hull[i], b = hull[(i + 1) % hull.length];
    const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
    const c = Math.cos(ang), s = Math.sin(ang);
    let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
    for (const [x, y] of hull) {
      const u = x * c + y * s, v = -x * s + y * c;
      if (u < minU) minU = u;
      if (u > maxU) maxU = u;
      if (v < minV) minV = v;
      if (v > maxV) maxV = v;
    }
    const area = (maxU - minU) * (maxV - minV);
    if (!best || area < best.area) best = { area, ang, minU, maxU, minV, maxV };
  }
  if (!best) return null;
  let { ang, minU, maxU, minV, maxV } = best;
  const cu = (minU + maxU) / 2, cv = (minV + maxV) / 2;
  const c = Math.cos(ang), s = Math.sin(ang);
  const cx = cu * c - cv * s, cy = cu * s + cv * c;
  let w = maxU - minU, h = maxV - minV;
  if (h > w) {
    [w, h] = [h, w];
    ang += Math.PI / 2;
  }
  return { cx, cy, w, h, ang, area: best.area };
}

function simplifyDP(ring, tol) {
  if (ring.length <= 4) return ring;
  const keep = new Uint8Array(ring.length);
  keep[0] = keep[ring.length - 1] = 1;
  const stack = [[0, ring.length - 1]];
  while (stack.length) {
    const [s, e] = stack.pop();
    let maxD = 0, idx = -1;
    const [x1, y1] = ring[s], [x2, y2] = ring[e];
    const dx = x2 - x1, dy = y2 - y1;
    const len = Math.hypot(dx, dy) || 1e-9;
    for (let i = s + 1; i < e; i++) {
      const d = Math.abs(dy * ring[i][0] - dx * ring[i][1] + x2 * y1 - y2 * x1) / len;
      if (d > maxD) {
        maxD = d;
        idx = i;
      }
    }
    if (maxD > tol && idx > 0) {
      keep[idx] = 1;
      stack.push([s, idx], [idx, e]);
    }
  }
  return ring.filter((_, i) => keep[i]);
}

function cleanRing(lngLatRing) {
  let ring = lngLatRing.map(([lng, lat]) => toLocal(lng, lat));
  if (ring.length > 1) {
    const f = ring[0], l = ring[ring.length - 1];
    if (Math.hypot(f[0] - l[0], f[1] - l[1]) < 0.01) ring.pop();
  }
  const out = [];
  for (const p of ring) {
    const prev = out[out.length - 1];
    if (!prev || Math.hypot(p[0] - prev[0], p[1] - prev[1]) > 0.2) out.push(p);
  }
  if (out.length > 3) {
    const f = out[0], l = out[out.length - 1];
    if (Math.hypot(f[0] - l[0], f[1] - l[1]) < 0.2) out.pop();
  }
  if (out.length < 3) return null;
  let r = out.length > 12 ? simplifyDP([...out, out[0]], 0.35).slice(0, -1) : out;
  if (r.length < 3) return null;
  if (r.length > 80) r = simplifyDP([...r, r[0]], 1.2).slice(0, -1);
  if (signedArea(r) < 0) r.reverse();
  return r;
}

class Grid {
  constructor(cell) {
    this.cell = cell;
    this.map = new Map();
  }
  key(ix, iy) {
    return ix * 100003 + iy;
  }
  insertBox(id, b) {
    const c = this.cell;
    for (let ix = Math.floor(b[0] / c); ix <= Math.floor(b[2] / c); ix++) {
      for (let iy = Math.floor(b[1] / c); iy <= Math.floor(b[3] / c); iy++) {
        const k = this.key(ix, iy);
        let arr = this.map.get(k);
        if (!arr) this.map.set(k, (arr = []));
        arr.push(id);
      }
    }
  }
  query(x, y) {
    return this.map.get(this.key(Math.floor(x / this.cell), Math.floor(y / this.cell))) || [];
  }
  queryBox(b, pad = 0) {
    const c = this.cell;
    const out = new Set();
    for (let ix = Math.floor((b[0] - pad) / c); ix <= Math.floor((b[2] + pad) / c); ix++) {
      for (let iy = Math.floor((b[1] - pad) / c); iy <= Math.floor((b[3] + pad) / c); iy++) {
        const arr = this.map.get(this.key(ix, iy));
        if (arr) for (const id of arr) out.add(id);
      }
    }
    return out;
  }
}

function ptSegDistSq(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const l2 = dx * dx + dy * dy;
  if (l2 < 1e-12) return (px - ax) * (px - ax) + (py - ay) * (py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2));
  const qx = ax + t * dx, qy = ay + t * dy;
  return (px - qx) * (px - qx) + (py - qy) * (py - qy);
}

function segsIntersect(ax, ay, bx, by, cx, cy, dx, dy) {
  const ccw = (p1x, p1y, p2x, p2y, p3x, p3y) =>
    (p3y - p1y) * (p2x - p1x) > (p2y - p1y) * (p3x - p1x);
  return (
    ccw(ax, ay, cx, cy, dx, dy) !== ccw(bx, by, cx, cy, dx, dy) &&
    ccw(ax, ay, bx, by, cx, cy) !== ccw(ax, ay, bx, by, dx, dy)
  );
}

function segSegDistSq(ax, ay, bx, by, cx, cy, dx, dy) {
  if (segsIntersect(ax, ay, bx, by, cx, cy, dx, dy)) return 0;
  return Math.min(
    ptSegDistSq(ax, ay, cx, cy, dx, dy),
    ptSegDistSq(bx, by, cx, cy, dx, dy),
    ptSegDistSq(cx, cy, ax, ay, bx, by),
    ptSegDistSq(dx, dy, ax, ay, bx, by)
  );
}

function ringHitsSegment(ring, x1, y1, x2, y2, clearance) {
  if (
    pointInRing(x1, y1, ring) ||
    pointInRing(x2, y2, ring) ||
    pointInRing((x1 + x2) * 0.5, (y1 + y2) * 0.5, ring)
  ) {
    return true;
  }
  const c2 = clearance * clearance;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const ax = ring[j][0], ay = ring[j][1], bx = ring[i][0], by = ring[i][1];
    if (segSegDistSq(ax, ay, bx, by, x1, y1, x2, y2) < c2) return true;
  }
  return false;
}

function ringsOverlap(r1, b1, r2, b2, minGap = 0.25) {
  if (
    b1[2] + minGap < b2[0] ||
    b1[0] - minGap > b2[2] ||
    b1[3] + minGap < b2[1] ||
    b1[1] - minGap > b2[3]
  ) {
    return false;
  }
  for (const [x, y] of r1) if (pointInRing(x, y, r2)) return true;
  for (const [x, y] of r2) if (pointInRing(x, y, r1)) return true;
  const g2 = minGap * minGap;
  for (let i = 0, j = r1.length - 1; i < r1.length; j = i++) {
    const ax = r1[j][0], ay = r1[j][1], bx = r1[i][0], by = r1[i][1];
    for (let u = 0, v = r2.length - 1; u < r2.length; v = u++) {
      if (segSegDistSq(ax, ay, bx, by, r2[v][0], r2[v][1], r2[u][0], r2[u][1]) < g2) return true;
    }
  }
  return false;
}

// ============================================================================
// PHẦN 1: ĐỌC RANH GIỚI, MẶT NƯỚC, ĐƯỜNG, LANDUSE, POI
// ============================================================================
const boundaryRaw = fs.readFileSync(path.join(GEO, 'xuanhoa-boundary.geojson'), 'utf8');
const boundaryChecksum = crypto.createHash('sha256').update(boundaryRaw).digest('hex').slice(0, 16);
const boundaryGeo = JSON.parse(boundaryRaw);
const wardRing = boundaryGeo.features[0].geometry.coordinates[0].map(([lng, lat]) => toLocal(lng, lat));
const wardBox = bboxOf(wardRing);
const insideWard = (x, y) => pointInRing(x, y, wardRing);

const roadsGeo = readJson(path.join(GEO, 'xuanhoa-roads.geojson'));
const waterGeo = readJson(path.join(GEO, 'xuanhoa-water.geojson'));
const waterwaysGeo = readJson(path.join(GEO, 'xuanhoa-waterways.geojson'));
const landuseGeo = readJson(path.join(GEO, 'xuanhoa-landuse.geojson'));
const osmVerifiedPois = fs.existsSync(path.join(GEO, 'xuanhoa-osm-verified-pois.json'))
  ? readJson(path.join(GEO, 'xuanhoa-osm-verified-pois.json'))
  : [];
const catalogMatchedPois = fs.existsSync(path.join(GEO, 'xuanhoa-catalog-osm-matched.json'))
  ? readJson(path.join(GEO, 'xuanhoa-catalog-osm-matched.json'))
  : [];

const waterRings = waterGeo.features
  .filter((f) => f.geometry?.type === 'Polygon')
  .map((f, idx) => {
    const ring = f.geometry.coordinates[0].map(([lng, lat]) => toLocal(lng, lat));
    const area = Math.abs(signedArea(ring));
    return {
      idx,
      name: f.properties?.name || '',
      waterType: f.properties?.water || f.properties?.natural || 'water',
      ring,
      box: bboxOf(ring),
      area,
      surfaceElev: 0,
    };
  });
const waterGrid = new Grid(120);
waterRings.forEach((w, i) => waterGrid.insertBox(i, w.box));

// ============================================================================
// PHẦN 2: PREPROCESS DEM THỰC (AWS TERRAIN TILES / MAPZEN TERRARIUM Z13)
// ============================================================================
function decodePngRgb(buf) {
  let pos = 8;
  let width = 0, height = 0, bitDepth = 0, colorType = 0;
  const idatChunks = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    if (type === 'IHDR') {
      width = buf.readUInt32BE(pos + 8);
      height = buf.readUInt32BE(pos + 12);
      bitDepth = buf[pos + 16];
      colorType = buf[pos + 17];
    } else if (type === 'IDAT') {
      idatChunks.push(buf.subarray(pos + 8, pos + 8 + len));
    } else if (type === 'IEND') {
      break;
    }
    pos += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idatChunks));
  const bpp = colorType === 6 ? 4 : colorType === 2 ? 3 : 1;
  const stride = width * bpp;
  const pixels = new Uint8Array(height * stride);
  const paeth = (a, b, c) => {
    const p = a + b - c;
    const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
  };
  let inOff = 0, outOff = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[inOff++];
    for (let x = 0; x < stride; x++) {
      const byte = raw[inOff++];
      const a = x >= bpp ? pixels[outOff + x - bpp] : 0;
      const b = y > 0 ? pixels[outOff - stride + x] : 0;
      const c = y > 0 && x >= bpp ? pixels[outOff - stride + x - bpp] : 0;
      let val = byte;
      if (filter === 1) val = (byte + a) & 255;
      else if (filter === 2) val = (byte + b) & 255;
      else if (filter === 3) val = (byte + ((a + b) >> 1)) & 255;
      else if (filter === 4) val = (byte + paeth(a, b, c)) & 255;
      pixels[outOff + x] = val;
    }
    outOff += stride;
  }
  return { width, height, bpp, pixels };
}

const DEM_Z = 13;
const DEM_X_MIN = 6500, DEM_X_MAX = 6503;
const DEM_Y_MIN = 3597, DEM_Y_MAX = 3601;

function lngLatToTilePixel(lng, lat, z) {
  const n = 2 ** z;
  const xFloat = ((lng + 180) / 360) * n;
  const latRad = (lat * Math.PI) / 180;
  const yFloat = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;
  const tx = Math.floor(xFloat);
  const ty = Math.floor(yFloat);
  const px = Math.min(255, Math.max(0, Math.floor((xFloat - tx) * 256)));
  const py = Math.min(255, Math.max(0, Math.floor((yFloat - ty) * 256)));
  return { tx, ty, px, py, fx: (xFloat - tx) * 256, fy: (yFloat - ty) * 256 };
}

async function loadTerrariumTiles() {
  fs.mkdirSync(DEM_CACHE_DIR, { recursive: true });
  const tileMap = new Map();
  let downloaded = 0, cached = 0;
  for (let tx = DEM_X_MIN; tx <= DEM_X_MAX; tx++) {
    for (let ty = DEM_Y_MIN; ty <= DEM_Y_MAX; ty++) {
      const key = `${DEM_Z}_${tx}_${ty}`;
      const cacheFile = path.join(DEM_CACHE_DIR, `${key}.png`);
      let buf;
      if (fs.existsSync(cacheFile)) {
        buf = fs.readFileSync(cacheFile);
        cached++;
      } else {
        const url = `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${DEM_Z}/${tx}/${ty}.png`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Không tải được DEM tile ${url}: HTTP ${res.status}`);
        buf = Buffer.from(await res.arrayBuffer());
        fs.writeFileSync(cacheFile, buf);
        downloaded++;
      }
      tileMap.set(key, decodePngRgb(buf));
    }
  }
  console.log(`⛰️  DEM Terrarium Z${DEM_Z}: ${cached} tile từ cache, ${downloaded} tile tải mới.`);
  return tileMap;
}

function sampleRawTerrariumAsl(tileMap, lng, lat) {
  const n = 2 ** DEM_Z;
  const xFloat = ((lng + 180) / 360) * n * 256;
  const latRad = (lat * Math.PI) / 180;
  const yFloat = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n * 256;

  const gx0 = Math.floor(xFloat), gy0 = Math.floor(yFloat);
  const fx = xFloat - gx0, fy = yFloat - gy0;

  const readPx = (gx, gy) => {
    const tx = Math.floor(gx / 256), ty = Math.floor(gy / 256);
    const px = ((gx % 256) + 256) % 256;
    const py = ((gy % 256) + 256) % 256;
    const tile = tileMap.get(`${DEM_Z}_${tx}_${ty}`);
    if (!tile) return 19.5;
    const off = (py * 256 + px) * tile.bpp;
    const r = tile.pixels[off], g = tile.pixels[off + 1], b = tile.pixels[off + 2];
    return r * 256 + g + b / 256 - 32768;
  };

  const e00 = readPx(gx0, gy0);
  const e10 = readPx(gx0 + 1, gy0);
  const e01 = readPx(gx0, gy0 + 1);
  const e11 = readPx(gx0 + 1, gy0 + 1);
  return e00 * (1 - fx) * (1 - fy) + e10 * fx * (1 - fy) + e01 * (1 - fx) * fy + e11 * fx * fy;
}

const DEM_MIN_LNG = 105.680;
const DEM_MAX_LNG = 105.792;
const DEM_MIN_LAT = 21.260;
const DEM_MAX_LAT = 21.420;
const DEM_COLS = 280;
const DEM_ROWS = 400;

const tileMap = await loadTerrariumTiles();

// Tọa độ chuẩn Đồi/Núi Thằn Lằn để khớp tuyệt đối giữa DEM nền và cụm Di tích Bốt Pháp 1950
const LIZARD_HILL_ANCHOR = { lng: 105.724444, lat: 21.293889, kx: 103728.707, ky: 110574.0 };
function getLizardHillHeightAtLngLat(lng, lat) {
  const rx = (lng - LIZARD_HILL_ANCHOR.lng) * LIZARD_HILL_ANCHOR.kx;
  const rz = -(lat - LIZARD_HILL_ANCHOR.lat) * LIZARD_HILL_ANCHOR.ky;
  if (rx < -220 || rx > 190 || rz < -420 || rz > 260) return -1;
  const neDist = (rx - 84) * 0.68 + (-rz - 325) * 0.73;
  if (neDist > 0) return 0;
  const neFade = Math.min(1, Math.max(0, -neDist / 32));
  const lobes = [
    { cx: -57.6, cz: -276.4, h: 32.0, rx: 145, rz: 112, flatR: 17 },
    { cx: -10.0, cz: -168.0, h: 25.5, rx: 148, rz: 142, flatR: 12 },
    { cx: 0.0, cz: 0.0, h: 28.5, rx: 135, rz: 140, flatR: 14.5 },
    { cx: 14.0, cz: 118.0, h: 15.0, rx: 98, rz: 105, flatR: 0 },
  ];
  let sumP = 0, maxL = 0;
  for (const l of lobes) {
    const rawD = Math.hypot((rx - l.cx) / l.rx, (rz - l.cz) / l.rz);
    const flatD = l.flatR / Math.min(l.rx, l.rz);
    let u = 0;
    if (rawD <= flatD) u = 1;
    else {
      const t = (rawD - flatD) / (1 - flatD);
      if (t < 1) {
        const s = 1 - t * t;
        u = s * s;
      }
    }
    const lh = l.h * u;
    if (lh > maxL) maxL = lh;
    sumP += lh * lh * lh;
  }
  let h = Math.min(32.0, Math.max(maxL, Math.cbrt(sumP) * 0.94));
  if (Math.hypot(rx - -57.6, rz - -276.4) <= 16.5) h = 32.0;
  if (Math.hypot(rx, rz) <= 14.0) h = Math.max(h, 28.5);
  return h * neFade;
}

// BƯỚC 2A: Lấy mẫu độ cao tuyệt đối (ASL) từ Terrarium Z13 trên toàn lưới
const datumAsl = 22.0; // Cao độ mặt đất chuẩn (bare-earth ASL) tại trung tâm Xuân Hòa - ĐHSP Hà Nội 2
const rawRelGrid = new Float32Array(DEM_COLS * DEM_ROWS);
for (let r = 0; r < DEM_ROWS; r++) {
  const lat = DEM_MIN_LAT + (r / (DEM_ROWS - 1)) * (DEM_MAX_LAT - DEM_MIN_LAT);
  for (let c = 0; c < DEM_COLS; c++) {
    const lng = DEM_MIN_LNG + (c / (DEM_COLS - 1)) * (DEM_MAX_LNG - DEM_MIN_LNG);
    const lizardH = getLizardHillHeightAtLngLat(lng, lat);
    if (lizardH >= 0) {
      rawRelGrid[r * DEM_COLS + c] = lizardH;
      continue;
    }
    const asl = sampleRawTerrariumAsl(tileMap, lng, lat);
    // Khử nhiễu tán cây/mái nhà của radar SRTM trên vùng đồng bằng đô thị (< 36m ASL),
    // giữ nguyên địa hình đồi núi thật (> 36m ASL) ở Ngọc Thanh, Đại Lải, Đồng Đò
    let rel = 0;
    if (asl <= 36) {
      rel = (asl - datumAsl) * 0.22;
    } else {
      const plainTop = (36 - datumAsl) * 0.22;
      rel = plainTop + (asl - 36) * 0.85;
    }
    rawRelGrid[r * DEM_COLS + c] = Math.max(-3.2, rel);
  }
}

// BƯỚC 2B: Làm mượt nhẹ 3x3 Gaussian (bảo toàn vùng đỉnh Đồi Thằn Lằn)
const demGrid = new Float32Array(DEM_COLS * DEM_ROWS);
for (let r = 0; r < DEM_ROWS; r++) {
  const lat = DEM_MIN_LAT + (r / (DEM_ROWS - 1)) * (DEM_MAX_LAT - DEM_MIN_LAT);
  for (let c = 0; c < DEM_COLS; c++) {
    const lng = DEM_MIN_LNG + (c / (DEM_COLS - 1)) * (DEM_MAX_LNG - DEM_MIN_LNG);
    const lizardH = getLizardHillHeightAtLngLat(lng, lat);
    if (lizardH > 0.5) {
      demGrid[r * DEM_COLS + c] = lizardH;
      continue;
    }
    let sum = 0, wSum = 0;
    for (let dr = -1; dr <= 1; dr++) {
      const nr = Math.min(DEM_ROWS - 1, Math.max(0, r + dr));
      for (let dc = -1; dc <= 1; dc++) {
        const nc = Math.min(DEM_COLS - 1, Math.max(0, c + dc));
        const w = (dr === 0 ? 2 : 1) * (dc === 0 ? 2 : 1);
        sum += rawRelGrid[nr * DEM_COLS + nc] * w;
        wSum += w;
      }
    }
    demGrid[r * DEM_COLS + c] = sum / wSum;
  }
}

function sampleDemAtLngLat(lng, lat) {
  const u = Math.min(1, Math.max(0, (lng - DEM_MIN_LNG) / (DEM_MAX_LNG - DEM_MIN_LNG))) * (DEM_COLS - 1);
  const v = Math.min(1, Math.max(0, (lat - DEM_MIN_LAT) / (DEM_MAX_LAT - DEM_MIN_LAT))) * (DEM_ROWS - 1);
  const c0 = Math.floor(u), r0 = Math.floor(v);
  const c1 = Math.min(DEM_COLS - 1, c0 + 1), r1 = Math.min(DEM_ROWS - 1, r0 + 1);
  const fu = u - c0, fv = v - r0;
  const e00 = demGrid[r0 * DEM_COLS + c0];
  const e10 = demGrid[r0 * DEM_COLS + c1];
  const e01 = demGrid[r1 * DEM_COLS + c0];
  const e11 = demGrid[r1 * DEM_COLS + c1];
  return e00 * (1 - fu) * (1 - fv) + e10 * fu * (1 - fv) + e01 * (1 - fu) * fv + e11 * fu * fv;
}

function sampleDemAtLocal(x, y) {
  const [lng, lat] = toLngLat(x, y);
  return sampleDemAtLngLat(lng, lat);
}

// Làm phẳng thuỷ văn cho các hồ lớn & mặt nước (Hồ Đại Lải, Hồ Lập Đinh, Hồ Đồng Đò, Sông Cà Lồ...)
const waterBodyElevations = [];
for (const w of waterRings) {
  const samples = [];
  for (const [vx, vy] of w.ring) {
    samples.push(sampleDemAtLocal(vx, vy));
  }
  const [cx, cy] = centroid(w.ring);
  samples.push(sampleDemAtLocal(cx, cy));
  samples.sort((a, b) => a - b);
  // Chọn phân vị 20% của đường bờ làm cao độ mặt nước phẳng tự nhiên (tránh sườn đồi ven hồ kéo mặt nước lên cao)
  const flatElev = Number((samples[Math.floor(samples.length * 0.2)] - 0.35).toFixed(2));
  w.surfaceElev = flatElev;
  if (w.area > 12000 || w.name) {
    waterBodyElevations.push({
      waterIndex: w.idx,
      name: w.name || (w.area > 500000 ? 'Hồ Đại Lải' : `Mặt nước #${w.idx}`),
      areaSqm: Math.round(w.area),
      relativeElevationM: flatElev,
      aslElevationM: Number((flatElev + datumAsl).toFixed(2)),
    });
  }
}

// Áp cao độ mặt nước phẳng vào lưới DEM tại các ô nằm trong lòng hồ
for (let r = 0; r < DEM_ROWS; r++) {
  const lat = DEM_MIN_LAT + (r / (DEM_ROWS - 1)) * (DEM_MAX_LAT - DEM_MIN_LAT);
  for (let c = 0; c < DEM_COLS; c++) {
    const lng = DEM_MIN_LNG + (c / (DEM_COLS - 1)) * (DEM_MAX_LNG - DEM_MIN_LNG);
    const [lx, ly] = toLocal(lng, lat);
    for (const wId of waterGrid.query(lx, ly)) {
      const w = waterRings[wId];
      if (pointInRing(lx, ly, w.ring)) {
        demGrid[r * DEM_COLS + c] = w.surfaceElev;
        break;
      }
    }
  }
}

let minRelElev = Infinity, maxRelElev = -Infinity;
const demBuf = Buffer.alloc(DEM_COLS * DEM_ROWS * 2);
for (let i = 0; i < demGrid.length; i++) {
  const v = demGrid[i];
  if (v < minRelElev) minRelElev = v;
  if (v > maxRelElev) maxRelElev = v;
  const dm = Math.max(-32768, Math.min(32767, Math.round(v * 10)));
  demBuf.writeInt16LE(dm, i * 2);
}
fs.writeFileSync(path.join(GEO, 'xuanhoa-dem.bin'), demBuf);

const demMeta = {
  version: 1,
  source: 'AWS Open Data Terrain Tiles / Mapzen Terrarium Z13 (SRTM GL1 30m & Copernicus DEM GLO-30)',
  license: 'Open Data / Public Domain (SRTM NASA/USGS & Copernicus DEM)',
  zoom: DEM_Z,
  tiles: { xMin: DEM_X_MIN, xMax: DEM_X_MAX, yMin: DEM_Y_MIN, yMax: DEM_Y_MAX },
  fetchedAt: '2026-10-31',
  grid: {
    minLng: DEM_MIN_LNG,
    maxLng: DEM_MAX_LNG,
    minLat: DEM_MIN_LAT,
    maxLat: DEM_MAX_LAT,
    cols: DEM_COLS,
    rows: DEM_ROWS,
    stepLngDeg: Number(((DEM_MAX_LNG - DEM_MIN_LNG) / (DEM_COLS - 1)).toFixed(7)),
    stepLatDeg: Number(((DEM_MAX_LAT - DEM_MIN_LAT) / (DEM_ROWS - 1)).toFixed(7)),
    stepMetersApprox: 44.2,
    unit: 'decimeters_int16_le',
  },
  origin: { lng: LNG0, lat: LAT0, kx: KX, ky: KY, datumElevationAslM: datumAsl },
  stats: {
    minRelativeElevationM: Number(minRelElev.toFixed(2)),
    maxRelativeElevationM: Number(maxRelElev.toFixed(2)),
    minAslElevationM: Number((minRelElev + datumAsl).toFixed(2)),
    maxAslElevationM: Number((maxRelElev + datumAsl).toFixed(2)),
  },
  waterBodyElevations,
};
fs.writeFileSync(path.join(GEO, 'xuanhoa-dem-meta.json'), JSON.stringify(demMeta, null, 2));
console.log(
  `🗺️  Đã ghi xuanhoa-dem.bin (${(demBuf.length / 1024).toFixed(1)} KB): cao độ tương đối [${demMeta.stats.minRelativeElevationM}m .. +${demMeta.stats.maxRelativeElevationM}m] (ASL ${demMeta.stats.minAslElevationM}m .. ${demMeta.stats.maxAslElevationM}m).`
);

// ============================================================================
// PHẦN 3: CHUẨN HOÁ MẠNG LƯỚI ĐƯỜNG & SPATIAL INDEX NGỮ CẢNH
// ============================================================================
const roadHalfWidth = (p) => {
  const hw = p.highway || '';
  if (p.tier === 'major') return 6.2 + 1.2;
  if (p.tier === 'secondary') return 4.4 + 1.0;
  if (p.tier === 'minor') return 2.55 + 0.35;
  if (p.tier === 'alley' || hw === 'service' || hw === 'living_street') return 1.55 + 0.2;
  if (hw === 'track' || hw === 'construction') return 1.4 + 0.2;
  return 1.1 + 0.15;
};

const TIER_RANK = { major: 4, secondary: 3, minor: 2, alley: 1 };
const segGrid = new Grid(25);
const segs = []; // [x1,y1,x2,y2,halfW,isMinorPath,isGenerated,tierRank]
const addLine = (coords, halfW, isMinorPath = false, isGenerated = false, tierRank = 0) => {
  const pts = coords.map(([lng, lat]) => toLocal(lng, lat));
  for (let i = 0; i < pts.length - 1; i++) {
    const s = [
      pts[i][0],
      pts[i][1],
      pts[i + 1][0],
      pts[i + 1][1],
      halfW,
      isMinorPath ? 1 : 0,
      isGenerated ? 1 : 0,
      tierRank,
    ];
    const id = segs.length;
    segs.push(s);
    segGrid.insertBox(id, [
      Math.min(s[0], s[2]) - halfW - 2,
      Math.min(s[1], s[3]) - halfW - 2,
      Math.max(s[0], s[2]) + halfW + 2,
      Math.max(s[1], s[3]) + halfW + 2,
    ]);
  }
  return pts;
};

const roadLines = [];
let normalizedRoadCount = 0;
for (let idx = 0; idx < roadsGeo.features.length; idx++) {
  const f = roadsGeo.features[idx];
  if (f.geometry?.type !== 'LineString') continue;
  const props = f.properties || {};
  const hw = roadHalfWidth(props);
  const tier =
    props.tier ||
    (props.highway === 'primary' || props.highway === 'trunk'
      ? 'major'
      : props.highway === 'secondary' || props.highway === 'tertiary'
        ? 'secondary'
        : props.highway === 'residential' || props.highway === 'unclassified'
          ? 'minor'
          : 'alley');
  const widthM = Number(((hw > 4 ? hw - 1.2 : hw) * 2).toFixed(1));
  const lanes = tier === 'major' ? 4 : tier === 'secondary' ? 2 : tier === 'minor' ? 2 : 1;
  const surface = props.surface || (tier === 'major' || tier === 'secondary' ? 'asphalt' : 'paved');
  props.id = props.id || props.osmId || `xh_road_${idx}`;
  props.tier = tier;
  props.width = widthM;
  props.lanes = props.lanes || lanes;
  props.surface = surface;
  f.properties = props;
  normalizedRoadCount++;

  const isMinorPath =
    !props.tier &&
    (props.highway === 'footway' ||
      props.highway === 'path' ||
      props.highway === 'steps' ||
      props.highway === 'service' ||
      props.highway === 'pedestrian');
  const isGenerated = !!props.generated;
  const pts = addLine(f.geometry.coordinates, hw, isMinorPath, isGenerated, TIER_RANK[tier] || 1);
  roadLines.push({ pts, hw: hw > 4 ? hw - 1.2 : hw, tier });
}
fs.writeFileSync(path.join(GEO, 'xuanhoa-roads.geojson'), JSON.stringify(roadsGeo));

for (const f of waterwaysGeo.features) {
  if (f.geometry?.type !== 'LineString') continue;
  const ww = f.properties?.waterway;
  addLine(f.geometry.coordinates, ww === 'river' ? 12.2 : ww === 'dam' ? 4 : 3.4, false, false, 0);
}

const noTreeLanduse = new Set(['pitch', 'quarry', 'industrial', 'farmland']);
const landRings = landuseGeo.features
  .filter((f) => f.geometry?.type === 'Polygon')
  .map((f) => {
    const ring = f.geometry.coordinates[0].map(([lng, lat]) => toLocal(lng, lat));
    return {
      ring,
      box: bboxOf(ring),
      type: f.properties?.rawType || '',
      kind: f.properties?.kind || '',
      name: f.properties?.name || '',
      area: Math.abs(signedArea(ring)),
    };
  });
const landGrid = new Grid(120);
const blockedLandGrid = new Grid(120);
landRings.forEach((l, i) => {
  landGrid.insertBox(i, l.box);
  if (noTreeLanduse.has(l.type)) blockedLandGrid.insertBox(i, l.box);
});

// ============================================================================
// PHẦN 4: HỢP NHẤT CÔNG TRÌNH OSM + OPEN BUILDINGS (GIỮ NGUYÊN FOOTPRINT THẬT)
// ============================================================================
const osmGeo = readJson(path.join(GEO, 'xuanhoa-buildings.geojson'));
const buildings = [];
for (const f of osmGeo.features) {
  if (f.geometry?.type !== 'Polygon') continue;
  const props = f.properties || {};
  const type = props.building || 'yes';
  if (type === 'dam') continue;
  const ring = cleanRing(f.geometry.coordinates[0]);
  if (!ring) continue;
  const area = signedArea(ring);
  if (area < 6) continue;
  const [cx, cy] = centroid(ring);
  if (!insideWard(cx, cy)) continue;
  const wayId = Number(String(props.osmId || '').replace(/^way\//, '')) || 0;
  const rawHeight = parseFloat(props.height || '');
  const rawLevels = parseInt(props['building:levels'] || props.levels || '', 10);
  buildings.push({
    ring,
    isOsm: true,
    source: 'osm',
    osmType: type,
    name: String(props.name || '').trim(),
    wayId,
    area,
    cx,
    cy,
    conf: 1.0,
    osmHeight: Number.isFinite(rawHeight) && rawHeight > 2 ? rawHeight : 0,
    osmLevels: Number.isFinite(rawLevels) && rawLevels > 0 ? rawLevels : 0,
  });
}
const osmCount = buildings.length;

const osmGrid = new Grid(40);
buildings.forEach((b, i) => {
  b.box = bboxOf(b.ring);
  osmGrid.insertBox(i, b.box);
});

let obKept = 0, obDup = 0, obLow = 0;
if (fs.existsSync(RAW_OB)) {
  const raw = readJson(RAW_OB);
  for (const r of raw) {
    if (r.g?.type !== 'Polygon') continue;
    if (r.s === 'google' && r.c < 0.65) {
      obLow++;
      continue;
    }
    if (r.a < 10) {
      obLow++;
      continue;
    }
    const ring = cleanRing(r.g.coordinates[0]);
    if (!ring) continue;
    const area = signedArea(ring);
    if (area < 9) continue;
    const [cx, cy] = centroid(ring);
    if (!insideWard(cx, cy)) continue;
    let dup = false;
    const box = bboxOf(ring);
    for (const id of osmGrid.query(cx, cy)) {
      const o = buildings[id];
      if (
        pointInRing(cx, cy, o.ring) ||
        (o.cx >= box[0] && o.cx <= box[2] && o.cy >= box[1] && o.cy <= box[3] && pointInRing(o.cx, o.cy, ring))
      ) {
        dup = true;
        break;
      }
    }
    if (dup) {
      obDup++;
      continue;
    }
    buildings.push({
      ring,
      isOsm: false,
      source: r.s === 'microsoft' ? 'microsoft' : 'google',
      osmType: 'yes',
      name: '',
      wayId: 0,
      area,
      cx,
      cy,
      box,
      conf: typeof r.c === 'number' ? r.c : 0.78,
      osmHeight: 0,
      osmLevels: 0,
    });
    obKept++;
  }
} else {
  console.warn('⚠️  Chưa có', RAW_OB, '— chỉ dựng nhà OSM.');
}

// ============================================================================
// PHẦN 5: LỌC BỎ CÔNG TRÌNH ĐÈ ĐƯỜNG / MẶT NƯỚC / CHỒNG LẤN & GẮN ĐỊA DANH HÀNH CHÍNH
// ============================================================================
const CIVIC_LANDMARKS = [
  { name: 'Đảng ủy - HĐND - UBND P. Xuân Hòa', lng: 105.723793, lat: 21.287272, maxDist: 65, kind: 'civic' },
  { name: 'Công an Phường Xuân Hòa', lng: 105.723480, lat: 21.286354, maxDist: 55, kind: 'civic' },
  { name: 'Trạm Y tế Phường Xuân Hòa', lng: 105.724134, lat: 21.286985, maxDist: 55, kind: 'civic' },
  { name: 'Phòng khám ĐK khu vực Xuân Hòa', lng: 105.729623, lat: 21.281163, maxDist: 60, kind: 'civic' },
  { name: 'Trường Tiểu học Xuân Hòa', lng: 105.727521, lat: 21.282057, maxDist: 65, kind: 'campus' },
  { name: 'Trường THCS Xuân Hòa', lng: 105.726460, lat: 21.282025, maxDist: 65, kind: 'campus' },
  { name: 'Trường THPT Xuân Hòa', lng: 105.721661, lat: 21.284455, maxDist: 80, kind: 'campus' },
  { name: 'ĐH Kiến trúc Hà Nội (CS Xuân Hòa)', lng: 105.728097, lat: 21.280026, maxDist: 75, kind: 'campus' },
  { name: 'CĐ Cơ điện Hà Nội (CS Xuân Hòa)', lng: 105.719438, lat: 21.286945, maxDist: 80, kind: 'campus' },
  { name: 'Trường CĐ nghề Việt-Xô số 1', lng: 105.721121, lat: 21.291524, maxDist: 95, kind: 'campus' },
  { name: 'Trung tâm GDQP - ĐHSP Hà Nội 2', lng: 105.718882, lat: 21.288731, maxDist: 85, kind: 'campus' },
  { name: 'Trường Mầm non Đồng Xuân', lng: 105.730656, lat: 21.276917, maxDist: 60, kind: 'campus' },
  { name: 'Chợ Xuân Hòa', lng: 105.730250, lat: 21.279750, maxDist: 65, kind: 'commercial' },
  { name: 'Bưu điện Xuân Hòa', lng: 105.728750, lat: 21.278320, maxDist: 55, kind: 'civic' },
  { name: 'Nhà Trắng Xuân Hòa', lng: 105.729280, lat: 21.278120, maxDist: 55, kind: 'civic' },
  { name: 'Trụ sở Hành chính KV Đồng Xuân', lng: 105.731820, lat: 21.278850, maxDist: 60, kind: 'civic' },
  { name: 'Trụ sở Hành chính KV Cao Minh', lng: 105.711203, lat: 21.289713, maxDist: 70, kind: 'civic' },
  { name: 'Trụ sở Hành chính KV Ngọc Thanh', lng: 105.730150, lat: 21.326850, maxDist: 80, kind: 'civic' },
].map((lm) => {
  const [x, y] = toLocal(lm.lng, lm.lat);
  return { ...lm, x, y, assigned: false };
});

const bGrid = new Grid(25);
const validBuildings = [];
let roadRemoved = 0, waterRemoved = 0, overlapRemoved = 0;

for (const rawB of buildings) {
  rawB.box = bboxOf(rawB.ring);

  // 1. Kiểm tra nhà đè lên đường
  let onRoad = false;
  if (!rawB.name) {
    for (const segId of segGrid.queryBox(rawB.box, 9)) {
      const [x1, y1, x2, y2, hw, , isGenerated] = segs[segId];
      if (isGenerated) continue;
      const clearance = hw + 0.65;
      if (ringHitsSegment(rawB.ring, x1, y1, x2, y2, clearance)) {
        onRoad = true;
        break;
      }
    }
  }
  if (onRoad) {
    roadRemoved++;
    continue;
  }

  // 2. Kiểm tra nhà đè lên hồ nước
  let onWater = false;
  for (const wId of waterGrid.queryBox(rawB.box, 2)) {
    const w = waterRings[wId];
    if (pointInRing(rawB.cx, rawB.cy, w.ring) || rawB.ring.some(([vx, vy]) => pointInRing(vx, vy, w.ring))) {
      onWater = true;
      break;
    }
  }
  if (onWater) {
    waterRemoved++;
    continue;
  }

  // 3. Kiểm tra chồng lấn giữa các nhà (ưu tiên nhà OSM)
  if (!rawB.isOsm) {
    let overlaps = false;
    for (const otherId of bGrid.queryBox(rawB.box, 1)) {
      const o = validBuildings[otherId];
      if (ringsOverlap(rawB.ring, rawB.box, o.ring, o.box, 0.25)) {
        overlaps = true;
        break;
      }
    }
    if (overlaps) {
      overlapRemoved++;
      continue;
    }
  }

  const idx = validBuildings.length;
  validBuildings.push(rawB);
  bGrid.insertBox(idx, rawB.box);
}

// Gắn tên các cơ quan hành chính / trường học vào các khối nhà hợp lệ gần nhất
for (const lm of CIVIC_LANDMARKS) {
  let bestIdx = -1, bestScore = Infinity;
  for (let i = 0; i < validBuildings.length; i++) {
    const b = validBuildings[i];
    if (b.name) continue;
    const d = Math.hypot(b.cx - lm.x, b.cy - lm.y);
    if (d <= lm.maxDist) {
      const score = d - Math.min(22, Math.sqrt(b.area) * 0.45);
      if (score < bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }
  }
  if (bestIdx >= 0) {
    validBuildings[bestIdx].name = lm.name;
    validBuildings[bestIdx].civicKind = lm.kind;
  }
}
console.log(
  `🧹 Đã lọc bỏ: ${roadRemoved} nhà đè lên đường, ${waterRemoved} nhà trên mặt nước, ${overlapRemoved} nhà chồng lấn.`
);

// ============================================================================
// PHẦN 6: TÁCH 3 LỚP GEOMETRY / SEMANTICS / STYLE & SUY LUẬN CHIỀU CAO + CONTEXTUAL ZONE
// ============================================================================
export const ZONE_CODES = [
  'trung-tam-xuan-hoa',
  'dong-xuan',
  'cao-minh',
  'ngoc-thanh',
  'dai-lai-sinh-thai',
  'campus-truong-hoc',
  'hanh-chinh',
  'khu-dan-cu',
  'cong-nghiep',
  'nong-nghiep-rung',
];

export const HEIGHT_SOURCE_CODES = [
  'osm_height',
  'osm_levels',
  'inferred_high',
  'inferred_medium',
  'inferred_low',
];

const WALL = {
  cream: 0,
  yellow: 1,
  white: 2,
  gray: 3,
  pink: 4,
  peach: 5,
  blue: 6,
  mint: 7,
  beige: 8,
  terracotta: 9,
};
const ROOF = {
  red: 0,
  terracotta: 1,
  blue: 2,
  green: 3,
  gray: 4,
  slate: 5,
  concrete: 6,
  teal: 7,
};
const ROOF_FLAT = 0, ROOF_GABLE = 1, ROOF_HIP = 2;

const HOUSE_WALLS = [
  [WALL.cream, 18],
  [WALL.yellow, 14],
  [WALL.white, 16],
  [WALL.gray, 10],
  [WALL.pink, 8],
  [WALL.peach, 9],
  [WALL.blue, 7],
  [WALL.mint, 6],
  [WALL.beige, 8],
  [WALL.terracotta, 4],
];
const PITCHED_ROOFS = [
  [ROOF.red, 30],
  [ROOF.terracotta, 22],
  [ROOF.blue, 20],
  [ROOF.green, 8],
  [ROOF.gray, 12],
  [ROOF.teal, 8],
];
const FLAT_ROOFS = [
  [ROOF.concrete, 60],
  [ROOF.gray, 25],
  [ROOF.slate, 15],
];
const FLOOR_H = 3.4;

// Lưới mật độ công trình (100m) để suy luận ngữ cảnh chiều cao
const densityGrid = new Grid(100);
validBuildings.forEach((b, i) => densityGrid.insertBox(i, [b.cx, b.cy, b.cx, b.cy]));

/**
 * LỚP 1 — GEOMETRY THẬT:
 * Giữ nguyên 100% đa giác footprint thật (`b.ring`), tính toán OBB chỉ để lấy tỉ lệ cạnh & hướng.
 */
function extractGeometry(b) {
  const rect = minAreaRect(b.ring);
  const rectness = rect ? b.area / rect.area : 0;
  const isRect = !!rect && rectness >= 0.84 && b.ring.length <= 10;
  const longSide = rect ? rect.w : Math.sqrt(b.area);
  const shortSide = rect ? rect.h : Math.sqrt(b.area);
  const aspectRatio = shortSide > 0.1 ? longSide / shortSide : 1;
  const orientation = rect ? rect.ang : 0;
  const [lng, lat] = toLngLat(b.cx, b.cy);
  const baseElevation = Number(sampleDemAtLngLat(lng, lat).toFixed(2));
  return {
    ring: b.ring, // KHÔNG BAO GIỜ thay b.ring bằng rectRing!
    cx: b.cx,
    cy: b.cy,
    lng: Number(lng.toFixed(6)),
    lat: Number(lat.toFixed(6)),
    area: b.area,
    aspectRatio: Number(aspectRatio.toFixed(2)),
    orientation: Number(orientation.toFixed(3)),
    isRect,
    shortSide,
    longSide,
    baseElevation,
  };
}

/**
 * Truy vấn ngữ cảnh không gian thực quanh công trình:
 * - Landuse chứa tâm công trình
 * - Cấp đường gần nhất & khoảng cách tới đường
 * - Mật độ công trình xung quanh trong bán kính 90m
 * - Derived Contextual Zone của Phường Xuân Hòa
 */
function deriveSpatialContext(b, geom) {
  let landuseType = '';
  let landuseKind = '';
  for (const lId of landGrid.query(b.cx, b.cy)) {
    const l = landRings[lId];
    if (
      b.cx >= l.box[0] &&
      b.cx <= l.box[2] &&
      b.cy >= l.box[1] &&
      b.cy <= l.box[3] &&
      pointInRing(b.cx, b.cy, l.ring)
    ) {
      landuseType = l.type;
      landuseKind = l.kind;
      break;
    }
  }

  // Tìm cấp đường gần nhất trong bán kính 65m
  let bestRoadTierRank = 0;
  let nearestRoadDist = 999;
  for (const sId of segGrid.queryBox([b.cx - 65, b.cy - 65, b.cx + 65, b.cy + 65], 0)) {
    const [x1, y1, x2, y2, , , isGen, tierRank] = segs[sId];
    if (isGen) continue;
    const d = Math.sqrt(ptSegDistSq(b.cx, b.cy, x1, y1, x2, y2));
    if (d < nearestRoadDist) nearestRoadDist = d;
    if (d <= 42 && tierRank > bestRoadTierRank) bestRoadTierRank = tierRank;
  }
  const nearestRoadTier =
    bestRoadTierRank === 4
      ? 'major'
      : bestRoadTierRank === 3
        ? 'secondary'
        : bestRoadTierRank === 2
          ? 'minor'
          : bestRoadTierRank === 1
            ? 'alley'
            : 'none';

  // Đếm mật độ công trình lân cận trong 90m
  let neighborCount = 0;
  for (const nId of densityGrid.queryBox([b.cx - 90, b.cy - 90, b.cx + 90, b.cy + 90], 0)) {
    const nb = validBuildings[nId];
    if (Math.hypot(nb.cx - b.cx, nb.cy - b.cy) <= 90) neighborCount++;
  }

  // Suy luận phân vùng ngữ cảnh Xuân Hòa (derived contextual zone)
  const nameLower = b.name.toLowerCase();
  let zone = 'khu-dan-cu';

  const isCivicName =
    b.civicKind === 'civic' ||
    /ubnd|uỷ ban|ủy ban|đảng uỷ|đảng ủy|công an|trạm y tế|bưu điện|hành chính|nhà trắng/.test(nameLower);
  const isCampusName =
    b.civicKind === 'campus' ||
    b.osmType === 'university' ||
    b.osmType === 'school' ||
    b.osmType === 'dormitory' ||
    b.osmType === 'kindergarten' ||
    /đại học|đh |cao đẳng|cđ |trường|giảng đường|ký túc|kí túc|ktx|gdqp/.test(nameLower);

  let nearCivic = false;
  let nearCampus = false;
  for (const lm of CIVIC_LANDMARKS) {
    const d = Math.hypot(b.cx - lm.x, b.cy - lm.y);
    if (lm.kind === 'civic' && d <= 95) nearCivic = true;
    if (lm.kind === 'campus' && d <= 165) nearCampus = true;
  }

  if (isCivicName || landuseKind === 'civic' || nearCivic) {
    zone = 'hanh-chinh';
  } else if (isCampusName || landuseKind === 'campus' || nearCampus) {
    zone = 'campus-truong-hoc';
  } else if (b.osmType === 'industrial' || landuseType === 'industrial' || landuseKind === 'industrial') {
    zone = 'cong-nghiep';
  } else if (
    landuseType === 'forest' ||
    landuseType === 'wood' ||
    landuseType === 'farmland' ||
    landuseType === 'orchard' ||
    (neighborCount <= 3 && geom.lat > 21.335)
  ) {
    zone = 'nong-nghiep-rung';
  } else if (
    (geom.lat >= 21.304 && geom.lng <= 105.738) ||
    /flamingo|đại lải|đảo ngọc|resort|villa/.test(nameLower)
  ) {
    zone = 'dai-lai-sinh-thai';
  } else if (
    geom.lat >= 21.2785 &&
    geom.lat <= 21.2935 &&
    geom.lng >= 105.7165 &&
    geom.lng <= 105.7325 &&
    neighborCount >= 18
  ) {
    zone = 'trung-tam-xuan-hoa';
  } else if (geom.lat < 21.2815 && geom.lng >= 105.7235) {
    zone = 'dong-xuan';
  } else if (geom.lng < 105.7165 && geom.lat < 21.305) {
    zone = 'cao-minh';
  } else if (geom.lat >= 21.304) {
    zone = 'ngoc-thanh';
  } else {
    zone = 'khu-dan-cu';
  }

  return {
    landuseType: landuseType || 'unclassified',
    landuseKind: landuseKind || 'general',
    nearestRoadTier,
    nearestRoadDist: Number(nearestRoadDist.toFixed(1)),
    neighborCount,
    zone,
    zoneIdx: ZONE_CODES.indexOf(zone),
  };
}

/**
 * LỚP 2 — SEMANTICS & DETERMINISTIC HEIGHT INFERENCE:
 * Thứ tự ưu tiên:
 *   1. osm_height
 *   2. osm_levels
 *   3. inferred_high (công trình định danh / loại công trình đặc thù trên OSM)
 *   4. inferred_medium (có ngữ cảnh mặt đường chính/phụ, khu trung tâm, campus, khu sinh thái)
 *   5. inferred_low (suy luận tất định từ diện tích, tỉ lệ cạnh, mật độ xung quanh, vùng địa lý)
 */
function inferSemantics(b, geom, ctx) {
  const rnd = mulberry32(seedFrom(b.cx, b.cy));
  const name = b.name.toLowerCase();
  const t = b.osmType;
  let buildingType = t !== 'yes' ? t : 'residential';
  let levels = 2;
  let height = 0;
  let heightSource = 'inferred_low';
  let roofKind = ROOF_FLAT;

  const canPitch = geom.isRect && geom.shortSide >= 2.5 && geom.shortSide <= 40;
  const setPitched = (kind) => {
    if (canPitch) roofKind = kind;
  };

  // Phân loại ngữ nghĩa công trình & ước lượng tầng/chiều cao tất định
  if (t === 'temple' || t === 'church' || /^(chùa|đình|đền|miếu|nhà thờ)/.test(name)) {
    buildingType = t === 'church' || name.startsWith('nhà thờ') ? 'church' : 'temple';
    levels = 2;
    height = buildingType === 'church' ? 12.0 : 6.8 + rnd() * 1.8;
    heightSource = 'inferred_high';
    setPitched(ROOF_HIP);
  } else if (/hội trường|nhà thể chất|nhà thi đấu|^chợ|siêu thị/.test(name) || t === 'grandstand') {
    buildingType = 'public_hall';
    levels = 3;
    height = 11.2 + rnd() * 2.2;
    heightSource = 'inferred_high';
    setPitched(ROOF_HIP);
  } else if (t === 'apartments') {
    buildingType = 'apartments';
    levels = 9 + Math.floor(rnd() * 6);
    heightSource = 'inferred_high';
  } else if (/^a[1-4]$/.test(name)) {
    buildingType = 'university_lecture';
    levels = 7 + Math.floor(rnd() * 3);
    heightSource = 'inferred_high';
  } else if (t === 'dormitory' || /^s[1-4]$/.test(name) || /ký túc|kí túc|ktx/.test(name)) {
    buildingType = 'dormitory';
    levels = 5 + Math.floor(rnd() * 2);
    heightSource = 'inferred_high';
  } else if (t === 'university' || t === 'school' || /giảng đường|trường|học viện|cao đẳng|đại học/.test(name)) {
    buildingType = 'education';
    levels = 3 + Math.floor(rnd() * 3);
    heightSource = 'inferred_high';
    if (rnd() < 0.35) setPitched(ROOF_HIP);
  } else if (t === 'kindergarten' || /mầm non/.test(name)) {
    buildingType = 'kindergarten';
    levels = 2;
    heightSource = 'inferred_high';
    setPitched(ROOF_HIP);
  } else if (
    ctx.zone === 'hanh-chinh' &&
    (/ngân hàng|ubnd|uỷ ban|ủy ban|đảng uỷ|đảng ủy|công an|bệnh viện|trạm y tế|phòng khám|bưu điện|trụ sở|nhà trắng/.test(
      name
    ) ||
      b.civicKind === 'civic')
  ) {
    buildingType = 'civic';
    levels = 3 + Math.floor(rnd() * 2);
    heightSource = 'inferred_high';
    if (rnd() < 0.3) setPitched(ROOF_HIP);
  } else if (/villa|biệt thự|flamingo/.test(name) || (ctx.zone === 'dai-lai-sinh-thai' && b.area >= 95 && b.area <= 420)) {
    buildingType = 'villa';
    levels = b.area > 220 ? 3 : 2;
    heightSource = b.name ? 'inferred_high' : 'inferred_medium';
    setPitched(ROOF_HIP);
  } else if (t === 'industrial' || ctx.zone === 'cong-nghiep' || b.area > 1200) {
    buildingType = 'industrial';
    levels = 2;
    height = 7.2 + rnd() * 3.2;
    heightSource = t === 'industrial' ? 'inferred_high' : 'inferred_medium';
    if (geom.isRect && geom.shortSide < 60 && rnd() < 0.6) roofKind = ROOF_GABLE;
  } else if (b.area < 22) {
    buildingType = 'auxiliary';
    levels = 1;
    heightSource = 'inferred_low';
    if (rnd() < 0.7) setPitched(ROOF_GABLE);
  } else {
    // Suy luận tất định dựa trên (footprint area, aspectRatio, roadTier, neighborCount, zone)
    const isShophouseTube = geom.aspectRatio >= 1.85 && b.area >= 35 && b.area <= 165;
    const onMainRoad = ctx.nearestRoadTier === 'major' && ctx.nearestRoadDist <= 28;
    const onSecondaryRoad = ctx.nearestRoadTier === 'secondary' && ctx.nearestRoadDist <= 25;

    if (ctx.zone === 'trung-tam-xuan-hoa') {
      buildingType = onMainRoad || isShophouseTube ? 'shophouse' : 'residential';
      if (onMainRoad) {
        levels = pickWeighted(rnd, [[3, 25], [4, 40], [5, 25], [6, 10]]);
      } else if (isShophouseTube || onSecondaryRoad) {
        levels = pickWeighted(rnd, [[2, 18], [3, 38], [4, 30], [5, 14]]);
      } else {
        levels = pickWeighted(rnd, [[1, 8], [2, 28], [3, 38], [4, 20], [5, 6]]);
      }
      heightSource = 'inferred_medium';
    } else if (ctx.zone === 'campus-truong-hoc') {
      buildingType = b.area > 260 ? 'education' : 'residential';
      levels = b.area > 260 ? pickWeighted(rnd, [[3, 40], [4, 40], [5, 20]]) : pickWeighted(rnd, [[2, 35], [3, 45], [4, 20]]);
      heightSource = 'inferred_medium';
    } else if (ctx.zone === 'dong-xuan' || ctx.zone === 'cao-minh') {
      buildingType = onMainRoad ? 'shophouse' : 'residential';
      if (onMainRoad || onSecondaryRoad) {
        levels = pickWeighted(rnd, [[2, 28], [3, 42], [4, 24], [5, 6]]);
        heightSource = 'inferred_medium';
      } else {
        levels = pickWeighted(rnd, [[1, 18], [2, 42], [3, 30], [4, 10]]);
        heightSource = ctx.nearestRoadTier !== 'none' ? 'inferred_medium' : 'inferred_low';
      }
    } else if (ctx.zone === 'ngoc-thanh' || ctx.zone === 'nong-nghiep-rung') {
      buildingType = 'rural_residential';
      levels =
        ctx.nearestRoadTier === 'major' || ctx.nearestRoadTier === 'secondary'
          ? pickWeighted(rnd, [[1, 25], [2, 48], [3, 22], [4, 5]])
          : pickWeighted(rnd, [[1, 52], [2, 38], [3, 10]]);
      heightSource = ctx.nearestRoadTier !== 'none' ? 'inferred_medium' : 'inferred_low';
    } else {
      // khu-dan-cu
      if (b.area < 145) {
        levels =
          ctx.neighborCount >= 22
            ? pickWeighted(rnd, [[2, 26], [3, 38], [4, 26], [5, 10]])
            : pickWeighted(rnd, [[1, 16], [2, 38], [3, 32], [4, 14]]);
      } else if (b.area < 450) {
        levels = pickWeighted(rnd, [[1, 22], [2, 40], [3, 28], [4, 10]]);
      } else {
        levels = pickWeighted(rnd, [[1, 38], [2, 34], [3, 20], [4, 8]]);
      }
      heightSource = ctx.nearestRoadTier !== 'none' ? 'inferred_medium' : 'inferred_low';
    }

    if (levels <= 2 && rnd() < 0.58) {
      setPitched(rnd() < 0.65 ? ROOF_GABLE : ROOF_HIP);
    } else if (b.area >= 145 && b.area < 450 && rnd() < 0.42) {
      setPitched(ROOF_HIP);
    }
  }

  // Ưu tiên số 1 & 2: dữ liệu OSM thật nếu có
  if (b.osmLevels > 0) {
    levels = b.osmLevels;
    heightSource = 'osm_levels';
  }
  if (b.osmHeight > 0) {
    height = b.osmHeight;
    levels = Math.max(1, Math.round(height / FLOOR_H));
    heightSource = 'osm_height';
  }

  if (!height) {
    height = levels * FLOOR_H + (roofKind === ROOF_FLAT ? 0.45 : 0) + (rnd() - 0.5) * 0.4;
  }
  height = Number(Math.max(2.8, Math.min(120, height)).toFixed(2));

  return {
    buildingType,
    levels,
    height,
    heightSource,
    heightSourceIdx: HEIGHT_SOURCE_CODES.indexOf(heightSource),
    roofKind,
  };
}

/**
 * LỚP 3 — STYLE SUY LUẬN:
 * Chỉ quyết định màu tường, màu mái và tum sân thượng (topBox), tuyệt đối không sửa geometry hay chiều cao.
 */
function assignStyle(b, geom, ctx, sem) {
  const rnd = mulberry32(seedFrom(b.cx, b.cy) ^ 0x9e3779b9);
  const name = b.name.toLowerCase();
  let wall = pickWeighted(rnd, HOUSE_WALLS);
  let roofColor =
    sem.roofKind === ROOF_FLAT ? pickWeighted(rnd, FLAT_ROOFS) : pickWeighted(rnd, PITCHED_ROOFS);
  let topBox = false;

  if (sem.buildingType === 'church' || sem.buildingType === 'temple') {
    wall = sem.buildingType === 'church' ? WALL.white : WALL.yellow;
    roofColor =
      sem.buildingType === 'church'
        ? ROOF.slate
        : pickWeighted(rnd, [
            [ROOF.red, 3],
            [ROOF.terracotta, 2],
          ]);
  } else if (sem.buildingType === 'public_hall') {
    wall = pickWeighted(rnd, [
      [WALL.cream, 2],
      [WALL.yellow, 2],
      [WALL.white, 1],
    ]);
    roofColor = pickWeighted(rnd, [
      [ROOF.red, 3],
      [ROOF.blue, 2],
      [ROOF.teal, 1],
    ]);
  } else if (sem.buildingType === 'apartments') {
    wall = pickWeighted(rnd, [
      [WALL.white, 3],
      [WALL.gray, 2],
      [WALL.cream, 2],
      [WALL.blue, 1],
    ]);
  } else if (sem.buildingType === 'university_lecture') {
    wall = pickWeighted(rnd, [
      [WALL.cream, 2],
      [WALL.white, 2],
      [WALL.yellow, 1],
    ]);
    topBox = true;
  } else if (sem.buildingType === 'dormitory') {
    wall = pickWeighted(rnd, [
      [WALL.cream, 2],
      [WALL.white, 2],
      [WALL.blue, 1],
      [WALL.yellow, 1],
    ]);
    topBox = rnd() < 0.5;
  } else if (sem.buildingType === 'education') {
    wall = pickWeighted(rnd, [
      [WALL.yellow, 3],
      [WALL.cream, 3],
      [WALL.white, 2],
      [WALL.peach, 1],
    ]);
    if (sem.roofKind !== ROOF_FLAT) {
      roofColor = pickWeighted(rnd, [
        [ROOF.red, 3],
        [ROOF.terracotta, 2],
      ]);
    }
  } else if (sem.buildingType === 'kindergarten') {
    wall = pickWeighted(rnd, [
      [WALL.yellow, 1],
      [WALL.pink, 1],
      [WALL.mint, 1],
    ]);
    roofColor = pickWeighted(rnd, [
      [ROOF.red, 2],
      [ROOF.blue, 1],
    ]);
  } else if (sem.buildingType === 'civic') {
    wall = name.includes('nhà trắng')
      ? WALL.white
      : pickWeighted(rnd, [
          [WALL.yellow, 3],
          [WALL.white, 2],
          [WALL.cream, 1],
        ]);
  } else if (sem.buildingType === 'villa') {
    wall = pickWeighted(rnd, [
      [WALL.white, 4],
      [WALL.cream, 2],
      [WALL.beige, 1],
    ]);
    if (sem.roofKind !== ROOF_FLAT) {
      roofColor = pickWeighted(rnd, [
        [ROOF.terracotta, 2],
        [ROOF.slate, 2],
        [ROOF.red, 1],
      ]);
    }
  } else if (sem.buildingType === 'industrial') {
    wall = pickWeighted(rnd, [
      [WALL.gray, 4],
      [WALL.white, 3],
      [WALL.blue, 1],
      [WALL.beige, 1],
    ]);
    roofColor = pickWeighted(rnd, [
      [ROOF.blue, 4],
      [ROOF.gray, 3],
      [ROOF.concrete, 2],
      [ROOF.teal, 2],
    ]);
  } else {
    if (sem.roofKind === ROOF_FLAT && sem.levels >= 3) {
      topBox = rnd() < 0.42;
    }
  }

  return { wall, roofColor, topBox };
}

const styled = [];
const zoneCounts = Object.fromEntries(ZONE_CODES.map((z) => [z, 0]));
const heightSourceCounts = Object.fromEntries(HEIGHT_SOURCE_CODES.map((h) => [h, 0]));
const sourceCounts = { osm: 0, google: 0, microsoft: 0 };

for (let idx = 0; idx < validBuildings.length; idx++) {
  const rawB = validBuildings[idx];
  const masterId = rawB.isOsm && rawB.wayId ? `osm_way_${rawB.wayId}` : `ob_xh_${idx}`;
  const geom = extractGeometry(rawB);
  const ctx = deriveSpatialContext(rawB, geom);
  const sem = inferSemantics(rawB, geom, ctx);
  const sty = assignStyle(rawB, geom, ctx, sem);

  zoneCounts[ctx.zone] = (zoneCounts[ctx.zone] || 0) + 1;
  heightSourceCounts[sem.heightSource] = (heightSourceCounts[sem.heightSource] || 0) + 1;
  sourceCounts[rawB.source] = (sourceCounts[rawB.source] || 0) + 1;

  styled.push({
    idx,
    id: masterId,
    isOsm: rawB.isOsm,
    source: rawB.source,
    wayId: rawB.wayId,
    name: rawB.name,
    conf: rawB.conf,
    ring: geom.ring, // Footprint thật 100%
    cx: geom.cx,
    cy: geom.cy,
    lng: geom.lng,
    lat: geom.lat,
    area: geom.area,
    box: rawB.box,
    baseElevation: geom.baseElevation,
    buildingType: sem.buildingType,
    levels: sem.levels,
    height: sem.height,
    heightSource: sem.heightSource,
    heightSourceIdx: sem.heightSourceIdx,
    zone: ctx.zone,
    zoneIdx: ctx.zoneIdx,
    nearestRoadTier: ctx.nearestRoadTier,
    landuseType: ctx.landuseType,
    roofKind: sem.roofKind,
    wall: sty.wall,
    roofColor: sty.roofColor,
    topBox: sty.topBox,
  });
}

// ============================================================================
// PHẦN 7: PHÂN BỐ CÂY XANH TRÊN TOÀN PHƯỜNG
// ============================================================================
function treeAllowed(x, y, clearance = 1.2) {
  if (x < wardBox[0] || x > wardBox[2] || y < wardBox[1] || y > wardBox[3]) return false;
  for (const id of bGrid.query(x, y)) {
    const b = styled[id];
    if (
      x >= b.box[0] - clearance &&
      x <= b.box[2] + clearance &&
      y >= b.box[1] - clearance &&
      y <= b.box[3] + clearance
    ) {
      if (pointInRing(x, y, b.ring)) return false;
      if (x >= b.box[0] && x <= b.box[2] && y >= b.box[1] && y <= b.box[3]) return false;
    }
  }
  for (const id of segGrid.query(x, y)) {
    const [x1, y1, x2, y2, hw] = segs[id];
    const dx = x2 - x1, dy = y2 - y1;
    const l2 = dx * dx + dy * dy || 1e-9;
    const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / l2));
    if (Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy)) < hw + clearance) return false;
  }
  for (const id of waterGrid.query(x, y)) {
    const w = waterRings[id];
    if (x >= w.box[0] && x <= w.box[2] && y >= w.box[1] && y <= w.box[3] && pointInRing(x, y, w.ring)) return false;
  }
  for (const id of blockedLandGrid.query(x, y)) {
    const l = landRings[id];
    if (x >= l.box[0] && x <= l.box[2] && y >= l.box[1] && y <= l.box[3] && pointInRing(x, y, l.ring)) return false;
  }
  return insideWard(x, y);
}

const trees = []; // [x, y, scale(0..255), kind]
const rndT = mulberry32(20261021);
const addTree = (x, y, kind = 0, sMin = 0.75, sMax = 1.35) => {
  const s = sMin + rndT() * (sMax - sMin);
  trees.push([x, y, Math.round(((s - 0.4) / 1.6) * 255), kind]);
};

let roadTrees = 0;
for (const { pts, hw, tier } of roadLines) {
  if (tier !== 'major' && tier !== 'secondary' && tier !== 'minor') continue;
  const step = tier === 'major' ? 11 : tier === 'secondary' ? 12 : 15;
  const prob = tier === 'major' ? 0.8 : tier === 'secondary' ? 0.7 : 0.45;
  let carry = rndT() * step;
  for (let i = 0; i < pts.length - 1; i++) {
    const [x1, y1] = pts[i], [x2, y2] = pts[i + 1];
    const len = Math.hypot(x2 - x1, y2 - y1);
    if (len < 0.5) continue;
    const ux = (x2 - x1) / len, uy = (y2 - y1) / len;
    for (let d = carry; d < len; d += step) {
      for (const side of [-1, 1]) {
        if (rndT() > prob) continue;
        const off = hw + 2 + rndT() * 0.8;
        const x = x1 + ux * d - uy * off * side;
        const y = y1 + uy * d + ux * off * side;
        if (treeAllowed(x, y, 0.6)) {
          addTree(x, y, 0, 0.8, 1.2);
          roadTrees++;
        }
      }
    }
    carry = (carry - len) % step;
    if (carry < 0) carry += step;
  }
}

const forestTypes = new Set(['forest', 'wood']);
const parkTypes = new Set([
  'park',
  'garden',
  'orchard',
  'golf_course',
  'grass',
  'recreation_ground',
  'cemetery',
  'meadow',
]);
const forestArea = landRings.filter((l) => forestTypes.has(l.type)).reduce((s, l) => s + l.area, 0);
const forestSpacing = Math.max(16, Math.sqrt(forestArea / 26000));
let greenTrees = 0;
for (const l of landRings) {
  let spacing = 0, kindConifer = 0;
  if (forestTypes.has(l.type)) {
    spacing = forestSpacing;
    kindConifer = 0.45;
  } else if (l.type === 'golf_course') spacing = 32;
  else if (l.type === 'orchard') spacing = 9;
  else if (parkTypes.has(l.type) || l.kind === 'green') spacing = 11;
  else if (l.kind === 'campus') spacing = 24;
  if (!spacing) continue;
  for (let x = l.box[0] + rndT() * spacing; x < l.box[2]; x += spacing) {
    for (let y = l.box[1] + rndT() * spacing; y < l.box[3]; y += spacing) {
      const jx = x + (rndT() - 0.5) * spacing * 0.8;
      const jy = y + (rndT() - 0.5) * spacing * 0.8;
      if (!pointInRing(jx, jy, l.ring)) continue;
      if (!treeAllowed(jx, jy, 1)) continue;
      addTree(jx, jy, rndT() < kindConifer ? 1 : 0, 0.8, 1.6);
      greenTrees++;
    }
  }
}

let yardTrees = 0;
for (const b of styled) {
  if (rndT() > 0.2) continue;
  const r = Math.sqrt(b.area / Math.PI);
  for (let tries = 0; tries < 3; tries++) {
    const ang = rndT() * Math.PI * 2;
    const dist = r + 2.5 + rndT() * 5;
    const x = b.cx + Math.cos(ang) * dist, y = b.cy + Math.sin(ang) * dist;
    if (treeAllowed(x, y, 1.4)) {
      addTree(x, y, rndT() < 0.08 ? 1 : 0, 0.6, 1.15);
      yardTrees++;
      break;
    }
  }
}

// ============================================================================
// PHẦN 8: GHI BINARY DÙNG CHUNG (xuanhoa-city3d.bin) & METADATA ĐỒNG BỘ
// ============================================================================
let size = 4 + 4 + 8 + 8 + 4 + 4;
for (const b of styled) size += 5 + 8 + (b.ring.length - 1) * 4;
size += trees.length * 10;
const buf = Buffer.alloc(size);
let o = 0;
buf.writeUInt32LE(0x44334858, o); o += 4; // 'XH3D'
buf.writeUInt32LE(1, o); o += 4;
buf.writeDoubleLE(LNG0, o); o += 8;
buf.writeDoubleLE(LAT0, o); o += 8;
buf.writeUInt32LE(styled.length, o); o += 4;
buf.writeUInt32LE(trees.length, o); o += 4;

const meta = {
  osm: [],
  names: [],
  buildingZones: [],
  buildingHeightSources: [],
  buildingLevels: [],
  buildingElevationsDm: [],
  buildingConfidences: [],
  buildingSources: [],
};
const clampI16 = (v) => Math.max(-32768, Math.min(32767, v));

styled.forEach((b, idx) => {
  const ring = b.ring.length > 255 ? b.ring.slice(0, 255) : b.ring;
  buf.writeUInt8(ring.length, o++);
  buf.writeUInt8(Math.min(255, Math.round(b.height * 2)), o++);
  buf.writeUInt8(b.wall, o++);
  buf.writeUInt8((b.roofKind & 3) | (b.roofColor << 2), o++);
  buf.writeUInt8((b.isOsm ? 1 : 0) | (b.name ? 2 : 0) | (b.topBox ? 4 : 0), o++);
  let px = Math.round(ring[0][0] * 10), py = Math.round(ring[0][1] * 10);
  buf.writeInt32LE(px, o); o += 4;
  buf.writeInt32LE(py, o); o += 4;
  for (let i = 1; i < ring.length; i++) {
    const nx = Math.round(ring[i][0] * 10), ny = Math.round(ring[i][1] * 10);
    buf.writeInt16LE(clampI16(nx - px), o); o += 2;
    buf.writeInt16LE(clampI16(ny - py), o); o += 2;
    px = nx;
    py = ny;
  }
  if (b.isOsm && b.wayId) meta.osm.push([idx, b.wayId]);
  if (b.name) meta.names.push([idx, b.name]);
  meta.buildingZones.push(b.zoneIdx);
  meta.buildingHeightSources.push(b.heightSourceIdx);
  meta.buildingLevels.push(b.levels);
  meta.buildingElevationsDm.push(Math.round(b.baseElevation * 10));
  meta.buildingConfidences.push(Math.round(b.conf * 100));
  meta.buildingSources.push(b.source === 'osm' ? 0 : b.source === 'microsoft' ? 2 : 1);
});

for (const [x, y, s, k] of trees) {
  buf.writeInt32LE(Math.round(x * 10), o); o += 4;
  buf.writeInt32LE(Math.round(y * 10), o); o += 4;
  buf.writeUInt8(Math.max(0, Math.min(255, s)), o++);
  buf.writeUInt8(k, o++);
}

const generatedAt = new Date().toISOString();
fs.writeFileSync(path.join(GEO, 'xuanhoa-city3d.bin'), buf.subarray(0, o));

const city3dMetaPayload = {
  version: 2,
  origin: { lng: LNG0, lat: LAT0, kx: KX, ky: KY, datumElevationAslM: datumAsl },
  generatedAt,
  stats: {
    buildings: styled.length,
    osmBuildings: sourceCounts.osm,
    openBuildings: sourceCounts.google + sourceCounts.microsoft,
    googleOpenBuildings: sourceCounts.google,
    microsoftOpenBuildings: sourceCounts.microsoft,
    openBuildingsDuplicatesRemoved: obDup,
    openBuildingsLowConfidence: obLow,
    roadOverlapRemoved: roadRemoved,
    waterOverlapRemoved: waterRemoved,
    buildingOverlapRemoved: overlapRemoved,
    trees: trees.length,
    roadTrees,
    greenTrees,
    yardTrees,
  },
  sources: [
    'OpenStreetMap contributors (ODbL)',
    'Google Open Buildings (CC BY 4.0) & Microsoft Global ML Building Footprints (ODbL) — VIDA / source.coop',
    'AWS Open Data Terrain Tiles / Mapzen Terrarium Z13 (SRTM GL1 30m & Copernicus DEM GLO-30)',
  ],
  zoneCodes: ZONE_CODES,
  heightSourceCodes: HEIGHT_SOURCE_CODES,
  sourceCodes: ['osm', 'google', 'microsoft'],
  osm: meta.osm,
  names: meta.names,
  buildingZones: meta.buildingZones,
  buildingHeightSources: meta.buildingHeightSources,
  buildingLevels: meta.buildingLevels,
  buildingElevationsDm: meta.buildingElevationsDm,
  buildingConfidences: meta.buildingConfidences,
  buildingSources: meta.buildingSources,
};
fs.writeFileSync(path.join(GEO, 'xuanhoa-city3d-meta.json'), JSON.stringify(city3dMetaPayload));

// ============================================================================
// PHẦN 9: CHUẨN HOÁ NHÃN ĐỊA DANH ĐA TẦNG LOD (xuanhoa-places-labels.geojson)
// ============================================================================
const placesLabelsPath = path.join(GEO, 'xuanhoa-places-labels.geojson');
const placesLabelsGeo = fs.existsSync(placesLabelsPath)
  ? readJson(placesLabelsPath)
  : { type: 'FeatureCollection', features: [] };

for (const f of placesLabelsGeo.features) {
  const p = f.properties || {};
  const kind = p.kind || 'poi';
  const [lng, lat] = f.geometry?.coordinates || [LNG0, LAT0];
  p.elevationM = Number(sampleDemAtLngLat(lng, lat).toFixed(2));
  if (kind === 'subarea' || kind === 'lake' || kind === 'peak' || (p.priority && p.priority >= 90)) {
    p.lodTier = 'far'; // Hiện từ zoom xa (Toàn phường, Hồ Đại Lải, Đồng Xuân, Cao Minh, Ngọc Thanh, Núi Thằn Lằn, ĐHSP Hà Nội 2)
  } else if (
    kind === 'university' ||
    kind === 'civic' ||
    kind === 'school' ||
    kind === 'market' ||
    kind === 'healthcare' ||
    kind === 'bridge' ||
    (p.priority && p.priority >= 65)
  ) {
    p.lodTier = 'mid'; // Hiện ở zoom trung (Trường học, Trụ sở, Chợ, Cầu, Trục đường lớn)
  } else {
    p.lodTier = 'near'; // Hiện ở zoom gần (POI, quán ăn, ngõ hẻm, công trình chi tiết)
  }
  f.properties = p;
}
fs.writeFileSync(placesLabelsPath, JSON.stringify(placesLabelsGeo, null, 2));

// ============================================================================
// PHẦN 10: GHI MASTER METADATA (public/geo/xuanhoa-master-meta.json)
// ============================================================================
const masterMetaPayload = {
  version: '2.0.0-digital-twin-phase1',
  generatedAt,
  boundaryChecksum,
  coordinateSystem: {
    crs: 'EPSG:4326',
    localOrigin: { lng: LNG0, lat: LAT0, kx: KX, ky: KY, datumElevationAslM: datumAsl },
    wardBoundingBoxMeters: wardBox.map((v) => Number(v.toFixed(1))),
  },
  sources: {
    boundary: 'OpenStreetMap administrative boundary relation — Phường Xuân Hòa (tỉnh Phú Thọ / Vĩnh Phúc)',
    buildingsOsm: 'OpenStreetMap contributors (ODbL) — public/geo/xuanhoa-buildings.geojson',
    buildingsExternal:
      'Google Open Buildings v3 (CC BY 4.0) & Microsoft Global ML Building Footprints (ODbL) — VIDA combined dataset',
    roads: 'OpenStreetMap highway network + local ward topological verified streets',
    waterAndWaterways: 'OpenStreetMap natural=water / waterway — Hồ Đại Lải, Hồ Lập Đinh, Hồ Đồng Đò, Sông Cà Lồ',
    landuse: 'OpenStreetMap landuse / natural polygons',
    dem: {
      provider: demMeta.source,
      license: demMeta.license,
      resolutionMeters: demMeta.grid.stepMetersApprox,
      fetchedAt: demMeta.fetchedAt,
      gridSize: `${DEM_COLS}x${DEM_ROWS}`,
      datumElevationAslM: datumAsl,
      minRelativeElevationM: demMeta.stats.minRelativeElevationM,
      maxRelativeElevationM: demMeta.stats.maxRelativeElevationM,
    },
  },
  counts: {
    buildingsTotal: styled.length,
    buildingsOsm: sourceCounts.osm,
    buildingsExternalFootprint: sourceCounts.google + sourceCounts.microsoft,
    buildingsGoogle: sourceCounts.google,
    buildingsMicrosoft: sourceCounts.microsoft,
    buildingsNamed: meta.names.length,
    roadsTotal: normalizedRoadCount,
    waterPolygonsTotal: waterRings.length,
    waterwaysTotal: waterwaysGeo.features.length,
    landusePolygonsTotal: landRings.length,
    placeLabelsTotal: placesLabelsGeo.features.length,
    osmVerifiedPoisTotal: Array.isArray(osmVerifiedPois)
      ? osmVerifiedPois.length
      : (osmVerifiedPois.features || osmVerifiedPois.items || []).length,
    catalogMatchedPoisTotal: Array.isArray(catalogMatchedPois)
      ? catalogMatchedPois.length
      : (catalogMatchedPois.matches || catalogMatchedPois.items || []).length,
    treesTotal: trees.length,
  },
  qualityFiltering: {
    openBuildingsDuplicatesRemoved: obDup,
    openBuildingsLowConfidenceRemoved: obLow,
    roadCollisionRemoved: roadRemoved,
    waterCollisionRemoved: waterRemoved,
    buildingOverlapRemoved: overlapRemoved,
    trueFootprintPreserved: true,
    fakeRectangleReplacementCount: 0,
  },
  heightSourceCounts,
  contextualZoneCounts: zoneCounts,
  derivedZoneNote:
    'Các vùng ngữ cảnh (contextualZones) được suy ra tất định (derived zone) từ landuse + mật độ đường + POI hành chính/giáo dục + toạ độ địa lý thực tế, không vẽ polygon ranh giới hành chính giả.',
  waterBodies: waterBodyElevations,
  buildingIdFormat: {
    osm: 'osm_way_<osmWayId>',
    external: 'ob_xh_<masterIndex>',
    totalIds: styled.length,
    osmWayMapCount: meta.osm.length,
    sampleIds: styled.slice(0, 12).map((b) => ({
      idx: b.idx,
      id: b.id,
      source: b.source,
      name: b.name || undefined,
      zone: b.zone,
      levels: b.levels,
      height: b.height,
      heightSource: b.heightSource,
      baseElevation: b.baseElevation,
      confidence: b.conf,
      vertices: b.ring.length,
    })),
  },
};

fs.writeFileSync(path.join(GEO, 'xuanhoa-master-meta.json'), JSON.stringify(masterMetaPayload, null, 2));

console.log(`🏛️  Master Dataset Xuân Hòa hoàn tất:`);
console.log(
  `   • Nhà Master (2D & 3D dùng chung 100%): ${styled.length} (OSM: ${sourceCounts.osm}, Google OB: ${sourceCounts.google}, Microsoft OB: ${sourceCounts.microsoft})`
);
console.log(`   • Nguồn chiều cao:`, JSON.stringify(heightSourceCounts));
console.log(`   • Phân vùng ngữ cảnh (derived zones):`, JSON.stringify(zoneCounts));
console.log(`   • Đường chuẩn hoá: ${normalizedRoadCount}, Mặt nước: ${waterRings.length}, Cây xanh: ${trees.length}`);
console.log(`   • xuanhoa-city3d.bin = ${(o / 1024 / 1024).toFixed(2)} MB | xuanhoa-dem.bin = ${(demBuf.length / 1024).toFixed(1)} KB`);
