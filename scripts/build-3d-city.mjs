/**
 * DỰNG DỮ LIỆU THÀNH PHỐ 3D CHO PHƯỜNG XUÂN HÒA
 * ------------------------------------------------------------------
 * Gộp 2 nguồn đường viền nhà:
 *   1. OpenStreetMap (public/geo/xuanhoa-buildings.geojson — nhà vẽ tay, có tên/loại nhà)
 *   2. Open Buildings Google + Microsoft (bản gộp VIDA, dò từ ảnh vệ tinh)
 *      → chạy trước: python scripts/fetch-open-buildings.py
 *
 * Kết quả (đọc bởi src/components/map/city3d/*):
 *   public/geo/xuanhoa-city3d.bin        — nhà (đường viền + chiều cao + màu + kiểu mái) & cây xanh
 *   public/geo/xuanhoa-city3d-meta.json  — gốc toạ độ, thống kê, OSM way id & tên công trình
 *
 * Cách chạy: node scripts/build-3d-city.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GEO = path.join(ROOT, 'public', 'geo');
const RAW_OB = process.argv[2] || path.join(ROOT, 'scripts', '.cache', 'openbuildings_raw.json');

// Gốc toạ độ cục bộ (mét) — tâm ĐHSP Hà Nội 2, trùng XUANHOA_DEFAULT_CENTER
const LNG0 = 105.7262;
const LAT0 = 21.2818;
const KX = 111320 * Math.cos((LAT0 * Math.PI) / 180);
const KY = 110574;
const toLocal = (lng, lat) => [(lng - LNG0) * KX, (lat - LAT0) * KY];

const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));

// ---------------------------------------------------------------- helpers
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
const seedFrom = (x, y) => (Math.imul(Math.round(x * 10) | 0, 73856093) ^ Math.imul(Math.round(y * 10) | 0, 19349663)) >>> 0;

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

/** Hình chữ nhật bao nhỏ nhất (Oriented Bounding Box) — trục u luôn là cạnh dài */
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

function rectRing(r) {
  const c = Math.cos(r.ang), s = Math.sin(r.ang);
  const hw = r.w / 2, hh = r.h / 2;
  const pts = [
    [-hw, -hh],
    [hw, -hh],
    [hw, hh],
    [-hw, hh],
  ];
  return pts.map(([u, v]) => [r.cx + u * c - v * s, r.cy + u * s + v * c]);
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
  if (pointInRing(x1, y1, ring) || pointInRing(x2, y2, ring) || pointInRing((x1 + x2) * 0.5, (y1 + y2) * 0.5, ring)) {
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
  if (b1[2] + minGap < b2[0] || b1[0] - minGap > b2[2] || b1[3] + minGap < b2[1] || b1[1] - minGap > b2[3]) {
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

// ---------------------------------------------------------------- 1. ranh giới phường
const boundaryGeo = readJson(path.join(GEO, 'xuanhoa-boundary.geojson'));
const wardRing = boundaryGeo.features[0].geometry.coordinates[0].map(([lng, lat]) => toLocal(lng, lat));
const wardBox = bboxOf(wardRing);
const insideWard = (x, y) => pointInRing(x, y, wardRing);

// ---------------------------------------------------------------- 2. nhà OSM
const osmGeo = readJson(path.join(GEO, 'xuanhoa-buildings.geojson'));
const buildings = []; // { ring, isOsm, osmType, name, wayId, area }
for (const f of osmGeo.features) {
  if (f.geometry?.type !== 'Polygon') continue;
  const type = f.properties?.building || 'yes';
  if (type === 'dam') continue;
  const ring = cleanRing(f.geometry.coordinates[0]);
  if (!ring) continue;
  const area = signedArea(ring);
  if (area < 6) continue;
  const [cx, cy] = centroid(ring);
  if (!insideWard(cx, cy)) continue;
  const wayId = Number(String(f.properties?.osmId || '').replace(/^way\//, '')) || 0;
  buildings.push({
    ring,
    isOsm: true,
    osmType: type,
    name: String(f.properties?.name || '').trim(),
    wayId,
    area,
    cx,
    cy,
  });
}
const osmCount = buildings.length;

const osmGrid = new Grid(40);
buildings.forEach((b, i) => {
  b.box = bboxOf(b.ring);
  osmGrid.insertBox(i, b.box);
});

// ---------------------------------------------------------------- 3. Open Buildings (Google + Microsoft)
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
    // Bỏ trùng với nhà OSM (ưu tiên OSM vì có tên/loại nhà)
    let dup = false;
    const box = bboxOf(ring);
    for (const id of osmGrid.query(cx, cy)) {
      const o = buildings[id];
      if (pointInRing(cx, cy, o.ring) || (o.cx >= box[0] && o.cx <= box[2] && o.cy >= box[1] && o.cy <= box[3] && pointInRing(o.cx, o.cy, ring))) {
        dup = true;
        break;
      }
    }
    if (dup) {
      obDup++;
      continue;
    }
    buildings.push({ ring, isOsm: false, osmType: 'yes', name: '', wayId: 0, area, cx, cy, box, conf: r.c });
    obKept++;
  }
} else {
  console.warn('⚠️  Chưa có', RAW_OB, '— chỉ dựng nhà OSM. Chạy: python scripts/fetch-open-buildings.py');
}

// ---------------------------------------------------------------- 4. chiều cao, màu tường, kiểu mái
const WALL = { cream: 0, yellow: 1, white: 2, gray: 3, pink: 4, peach: 5, blue: 6, mint: 7, beige: 8, terracotta: 9 };
const ROOF = { red: 0, terracotta: 1, blue: 2, green: 3, gray: 4, slate: 5, concrete: 6, teal: 7 };
const ROOF_FLAT = 0, ROOF_GABLE = 1, ROOF_HIP = 2;

const HOUSE_WALLS = [
  [WALL.cream, 18], [WALL.yellow, 14], [WALL.white, 16], [WALL.gray, 10], [WALL.pink, 8],
  [WALL.peach, 9], [WALL.blue, 7], [WALL.mint, 6], [WALL.beige, 8], [WALL.terracotta, 4],
];
const PITCHED_ROOFS = [
  [ROOF.red, 30], [ROOF.terracotta, 22], [ROOF.blue, 20], [ROOF.green, 8], [ROOF.gray, 12], [ROOF.teal, 8],
];
const FLAT_ROOFS = [[ROOF.concrete, 60], [ROOF.gray, 25], [ROOF.slate, 15]];
const FLOOR_H = 3.4;

function styleBuilding(b) {
  const rnd = mulberry32(seedFrom(b.cx, b.cy));
  const rect = minAreaRect(b.ring);
  const rectness = rect ? b.area / rect.area : 0;
  const isRect = !!rect && rectness >= 0.86 && b.ring.length <= 8;
  const shortSide = rect ? rect.h : 6;
  const name = b.name.toLowerCase();
  const t = b.osmType;
  let floors = 2, height = 0, wall = pickWeighted(rnd, HOUSE_WALLS), roofKind = ROOF_FLAT;
  let roofColor = pickWeighted(rnd, FLAT_ROOFS), topBox = false;

  const pitched = (kind = ROOF_GABLE, palette = PITCHED_ROOFS) => {
    if (!isRect || shortSide < 2.5 || shortSide > 40) return;
    roofKind = kind;
    roofColor = pickWeighted(rnd, palette);
  };

  if (t === 'temple' || t === 'church' || /^(chùa|đình|đền|miếu|nhà thờ)/.test(name)) {
    height = t === 'church' || name.startsWith('nhà thờ') ? 12 : 6.5 + rnd() * 2;
    wall = name.startsWith('nhà thờ') ? WALL.white : WALL.yellow;
    pitched(ROOF_HIP, name.startsWith('nhà thờ') ? [[ROOF.slate, 1]] : [[ROOF.red, 3], [ROOF.terracotta, 2]]);
  } else if (/hội trường|nhà thể chất|nhà thi đấu|^chợ|siêu thị/.test(name) || t === 'grandstand') {
    height = 11 + rnd() * 2.5;
    wall = pickWeighted(rnd, [[WALL.cream, 2], [WALL.yellow, 2], [WALL.white, 1]]);
    pitched(ROOF_HIP, [[ROOF.red, 3], [ROOF.blue, 2], [ROOF.teal, 1]]);
  } else if (t === 'apartments') {
    floors = 9 + Math.floor(rnd() * 7);
    wall = pickWeighted(rnd, [[WALL.white, 3], [WALL.gray, 2], [WALL.cream, 2], [WALL.blue, 1]]);
  } else if (/^a[1-4]$/.test(name)) {
    floors = 7 + Math.floor(rnd() * 3);
    wall = pickWeighted(rnd, [[WALL.cream, 2], [WALL.white, 2], [WALL.yellow, 1]]);
    topBox = true;
  } else if (t === 'dormitory' || /^s[1-4]$/.test(name) || /ký túc|kí túc|ktx/.test(name)) {
    floors = 5 + Math.floor(rnd() * 2);
    wall = pickWeighted(rnd, [[WALL.cream, 2], [WALL.white, 2], [WALL.blue, 1], [WALL.yellow, 1]]);
    topBox = rnd() < 0.5;
  } else if (t === 'university' || t === 'school' || /giảng đường|trường|học viện/.test(name)) {
    floors = 3 + Math.floor(rnd() * 3);
    wall = pickWeighted(rnd, [[WALL.yellow, 3], [WALL.cream, 3], [WALL.white, 2], [WALL.peach, 1]]);
    if (rnd() < 0.35) pitched(ROOF_HIP, [[ROOF.red, 3], [ROOF.terracotta, 2]]);
  } else if (t === 'kindergarten') {
    floors = 2;
    wall = pickWeighted(rnd, [[WALL.yellow, 1], [WALL.pink, 1], [WALL.mint, 1]]);
    pitched(ROOF_HIP, [[ROOF.red, 2], [ROOF.blue, 1]]);
  } else if (/ngân hàng|ubnd|uỷ ban|ủy ban|đảng uỷ|đảng ủy|công an|bệnh viện|trạm y tế/.test(name)) {
    floors = 3 + Math.floor(rnd() * 2);
    wall = pickWeighted(rnd, [[WALL.yellow, 3], [WALL.white, 2], [WALL.cream, 1]]);
  } else if (/villa/.test(name)) {
    floors = 3;
    wall = WALL.white;
    pitched(ROOF_HIP, [[ROOF.red, 1], [ROOF.terracotta, 1]]);
  } else if (t === 'industrial' || b.area > 1200) {
    height = 7 + rnd() * 3.5;
    wall = pickWeighted(rnd, [[WALL.gray, 4], [WALL.white, 3], [WALL.blue, 1], [WALL.beige, 1]]);
    roofColor = pickWeighted(rnd, [[ROOF.blue, 4], [ROOF.gray, 3], [ROOF.concrete, 2], [ROOF.teal, 2]]);
    if (isRect && rect.h < 60 && rnd() < 0.6) {
      roofKind = ROOF_GABLE;
    }
  } else if (b.area < 22) {
    floors = 1;
    if (rnd() < 0.7) pitched(ROOF_GABLE);
  } else if (b.area < 140) {
    // Nhà ống / nhà phố điển hình Việt Nam
    floors = pickWeighted(rnd, [[1, 10], [2, 22], [3, 30], [4, 24], [5, 10], [6, 4]]);
    if (floors <= 2 && rnd() < 0.6) pitched(rnd() < 0.7 ? ROOF_GABLE : ROOF_HIP);
    else topBox = floors >= 3 && rnd() < 0.45;
  } else if (b.area < 450) {
    floors = pickWeighted(rnd, [[1, 25], [2, 35], [3, 25], [4, 12], [5, 3]]);
    if (rnd() < 0.45) pitched(ROOF_HIP);
    else topBox = floors >= 3 && rnd() < 0.3;
  } else {
    floors = pickWeighted(rnd, [[1, 40], [2, 30], [3, 20], [4, 10]]);
    if (rnd() < 0.4) pitched(ROOF_GABLE, [[ROOF.blue, 3], [ROOF.gray, 2], [ROOF.red, 2], [ROOF.teal, 1]]);
  }

  if (!height) height = floors * FLOOR_H + (roofKind === ROOF_FLAT ? 0.5 : 0) + (rnd() - 0.5) * 0.6;
  height = Math.max(2.8, Math.min(120, height));
  const ring = isRect && (roofKind !== ROOF_FLAT || b.ring.length > 4) ? rectRing(rect) : b.ring;
  // Mái dốc: đỉnh đầu tiên phải nằm trên cạnh dài để runtime biết hướng nóc
  return { ring, height, wall, roofKind, roofColor, topBox };
}

// ---------------------------------------------------------------- 5. cây xanh
const roadsGeo = readJson(path.join(GEO, 'xuanhoa-roads.geojson'));
const waterGeo = readJson(path.join(GEO, 'xuanhoa-water.geojson'));
const waterwaysGeo = readJson(path.join(GEO, 'xuanhoa-waterways.geojson'));
const landuseGeo = readJson(path.join(GEO, 'xuanhoa-landuse.geojson'));

const roadHalfWidth = (p) => {
  const hw = p.highway || '';
  if (p.tier === 'major') return 6.2 + 1.2;
  if (p.tier === 'secondary') return 4.4 + 1.0;
  if (p.tier === 'minor') return 2.55 + 0.35;
  if (p.tier === 'alley' || hw === 'service' || hw === 'living_street') return 1.55 + 0.2;
  if (hw === 'track' || hw === 'construction') return 1.4 + 0.2;
  return 1.1 + 0.15;
};

const segGrid = new Grid(25);
const segs = []; // [x1,y1,x2,y2,halfW,isMinorPath,isGenerated]
const addLine = (coords, halfW, isMinorPath = false, isGenerated = false) => {
  const pts = coords.map(([lng, lat]) => toLocal(lng, lat));
  for (let i = 0; i < pts.length - 1; i++) {
    const s = [pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], halfW, isMinorPath ? 1 : 0, isGenerated ? 1 : 0];
    const id = segs.length;
    segs.push(s);
    segGrid.insertBox(id, [Math.min(s[0], s[2]) - halfW - 2, Math.min(s[1], s[3]) - halfW - 2, Math.max(s[0], s[2]) + halfW + 2, Math.max(s[1], s[3]) + halfW + 2]);
  }
  return pts;
};
const roadLines = [];
for (const f of roadsGeo.features) {
  if (f.geometry?.type !== 'LineString') continue;
  const props = f.properties || {};
  const hw = roadHalfWidth(props);
  const isMinorPath = !props.tier && (props.highway === 'footway' || props.highway === 'path' || props.highway === 'steps' || props.highway === 'service' || props.highway === 'pedestrian');
  const isGenerated = !!props.generated;
  const pts = addLine(f.geometry.coordinates, hw, isMinorPath, isGenerated);
  roadLines.push({ pts, hw: hw > 4 ? hw - 1.2 : hw, tier: props.tier });
}
for (const f of waterwaysGeo.features) {
  if (f.geometry?.type !== 'LineString') continue;
  const ww = f.properties?.waterway;
  addLine(f.geometry.coordinates, ww === 'river' ? 12.2 : ww === 'dam' ? 4 : 3.4, false);
}

const waterRings = waterGeo.features
  .filter((f) => f.geometry?.type === 'Polygon')
  .map((f) => {
    const ring = f.geometry.coordinates[0].map(([lng, lat]) => toLocal(lng, lat));
    return { ring, box: bboxOf(ring) };
  });
const waterGrid = new Grid(120);
waterRings.forEach((w, i) => waterGrid.insertBox(i, w.box));

const noTreeLanduse = new Set(['pitch', 'quarry', 'industrial', 'farmland']);
const landRings = landuseGeo.features
  .filter((f) => f.geometry?.type === 'Polygon')
  .map((f) => {
    const ring = f.geometry.coordinates[0].map(([lng, lat]) => toLocal(lng, lat));
    return { ring, box: bboxOf(ring), type: f.properties?.rawType || '', kind: f.properties?.kind || '', area: Math.abs(signedArea(ring)) };
  });
const blockedLandGrid = new Grid(120);
landRings.forEach((l, i) => {
  if (noTreeLanduse.has(l.type)) blockedLandGrid.insertBox(i, l.box);
});

// Gắn tên các cơ quan hành chính, trường học, y tế, địa danh chuẩn của Phường Xuân Hòa cho khối nhà 3D tương ứng
const CIVIC_LANDMARKS = [
  { name: 'Đảng ủy - HĐND - UBND P. Xuân Hòa', lng: 105.723793, lat: 21.287272, maxDist: 65 },
  { name: 'Công an Phường Xuân Hòa', lng: 105.723480, lat: 21.286354, maxDist: 55 },
  { name: 'Trạm Y tế Phường Xuân Hòa', lng: 105.724134, lat: 21.286985, maxDist: 55 },
  { name: 'Phòng khám ĐK khu vực Xuân Hòa', lng: 105.729623, lat: 21.281163, maxDist: 60 },
  { name: 'Trường Tiểu học Xuân Hòa', lng: 105.727521, lat: 21.282057, maxDist: 65 },
  { name: 'Trường THCS Xuân Hòa', lng: 105.726460, lat: 21.282025, maxDist: 65 },
  { name: 'Trường THPT Xuân Hòa', lng: 105.721661, lat: 21.284455, maxDist: 80 },
  { name: 'ĐH Kiến trúc Hà Nội (CS Xuân Hòa)', lng: 105.728097, lat: 21.280026, maxDist: 75 },
  { name: 'CĐ Cơ điện Hà Nội (CS Xuân Hòa)', lng: 105.719438, lat: 21.286945, maxDist: 80 },
  { name: 'Trường CĐ nghề Việt-Xô số 1', lng: 105.721121, lat: 21.291524, maxDist: 95 },
  { name: 'Trung tâm GDQP - ĐHSP Hà Nội 2', lng: 105.718882, lat: 21.288731, maxDist: 85 },
  { name: 'Trường Mầm non Đồng Xuân', lng: 105.730656, lat: 21.276917, maxDist: 60 },
  { name: 'Chợ Xuân Hòa', lng: 105.730250, lat: 21.279750, maxDist: 65 },
  { name: 'Bưu điện Xuân Hòa', lng: 105.728750, lat: 21.278320, maxDist: 55 },
  { name: 'Nhà Trắng Xuân Hòa', lng: 105.729280, lat: 21.278120, maxDist: 55 },
  { name: 'Trụ sở Hành chính KV Đồng Xuân', lng: 105.731820, lat: 21.278850, maxDist: 60 },
  { name: 'Trụ sở Hành chính KV Cao Minh', lng: 105.711203, lat: 21.289713, maxDist: 70 },
  { name: 'Trụ sở Hành chính KV Ngọc Thanh', lng: 105.730150, lat: 21.326850, maxDist: 80 },
].map((lm) => {
  const [x, y] = toLocal(lm.lng, lm.lat);
  return { ...lm, x, y, assigned: false };
});

// Lọc bỏ triệt để nhà nằm đè lên đường, nằm trên mặt nước hoặc chồng lấn lên nhau
const bGrid = new Grid(25);
const styled = [];
let roadRemoved = 0, waterRemoved = 0, overlapRemoved = 0;

for (const rawB of buildings) {
  const b = { ...rawB, ...styleBuilding(rawB) };
  b.box = bboxOf(b.ring);

  // 1. Kiểm tra nhà đè lên đường (cả đường chính, đường nhánh, ngõ hẻm) — giữ nguyên 100% các tòa nhà chính thức đã có tên trên OSM
  let onRoad = false;
  if (!rawB.name) {
    for (const segId of segGrid.queryBox(b.box, 9)) {
      const [x1, y1, x2, y2, hw, , isGenerated] = segs[segId];
      if (isGenerated) continue;
      const clearance = hw + 0.35;
      if (ringHitsSegment(b.ring, x1, y1, x2, y2, clearance) || ringHitsSegment(rawB.ring, x1, y1, x2, y2, clearance)) {
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
  for (const wId of waterGrid.queryBox(b.box, 2)) {
    const w = waterRings[wId];
    if (pointInRing(b.cx, b.cy, w.ring) || b.ring.some(([vx, vy]) => pointInRing(vx, vy, w.ring))) {
      onWater = true;
      break;
    }
  }
  if (onWater) {
    waterRemoved++;
    continue;
  }

  // 3. Kiểm tra chồng lấn giữa các nhà (ưu tiên nhà OSM và nhà đã đặt trước)
  if (!b.isOsm) {
    let overlaps = false;
    for (const otherId of bGrid.queryBox(b.box, 1)) {
      const o = styled[otherId];
      if (ringsOverlap(b.ring, b.box, o.ring, o.box, 0.25)) {
        overlaps = true;
        break;
      }
    }
    if (overlaps) {
      overlapRemoved++;
      continue;
    }
  }

  const idx = styled.length;
  styled.push(b);
  bGrid.insertBox(idx, b.box);
}

// Gắn tên các cơ quan hành chính / trường học vào các khối nhà hợp lệ (không đè đường) gần nhất
for (const lm of CIVIC_LANDMARKS) {
  let bestIdx = -1, bestScore = Infinity;
  for (let i = 0; i < styled.length; i++) {
    const b = styled[i];
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
    styled[bestIdx].name = lm.name;
    Object.assign(styled[bestIdx], styleBuilding(styled[bestIdx]));
    styled[bestIdx].box = bboxOf(styled[bestIdx].ring);
  }
}
console.log(`🧹 Đã lọc bỏ: ${roadRemoved} nhà đè lên đường, ${waterRemoved} nhà trên mặt nước, ${overlapRemoved} nhà chồng lấn.`);

function treeAllowed(x, y, clearance = 1.2) {
  if (x < wardBox[0] || x > wardBox[2] || y < wardBox[1] || y > wardBox[3]) return false;
  for (const id of bGrid.query(x, y)) {
    const b = styled[id];
    if (x >= b.box[0] - clearance && x <= b.box[2] + clearance && y >= b.box[1] - clearance && y <= b.box[3] + clearance) {
      if (pointInRing(x, y, b.ring)) return false;
      if (x >= b.box[0] && x <= b.box[2] && y >= b.box[1] && y <= b.box[3]) {
        // sát mép tường
        return false;
      }
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

// 5a. Hàng cây ven đường
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

// 5b. Cây trong công viên, rừng, vườn
const forestTypes = new Set(['forest', 'wood']);
const parkTypes = new Set(['park', 'garden', 'orchard', 'golf_course', 'grass', 'recreation_ground', 'cemetery', 'meadow']);
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

// 5c. Cây lẻ xen giữa khu dân cư (sân trong, vườn nhà)
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

// ---------------------------------------------------------------- 6. ghi file nhị phân
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

const meta = { osm: [], names: [] };
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
});
for (const [x, y, s, k] of trees) {
  buf.writeInt32LE(Math.round(x * 10), o); o += 4;
  buf.writeInt32LE(Math.round(y * 10), o); o += 4;
  buf.writeUInt8(Math.max(0, Math.min(255, s)), o++);
  buf.writeUInt8(k, o++);
}

fs.writeFileSync(path.join(GEO, 'xuanhoa-city3d.bin'), buf.subarray(0, o));
fs.writeFileSync(
  path.join(GEO, 'xuanhoa-city3d-meta.json'),
  JSON.stringify({
    version: 1,
    origin: { lng: LNG0, lat: LAT0, kx: KX, ky: KY },
    generatedAt: new Date().toISOString(),
    stats: {
      buildings: styled.length,
      osmBuildings: osmCount,
      openBuildings: obKept,
      openBuildingsDuplicatesRemoved: obDup,
      openBuildingsLowConfidence: obLow,
      trees: trees.length,
      roadTrees,
      greenTrees,
      yardTrees,
    },
    sources: [
      'OpenStreetMap contributors (ODbL)',
      'Google Open Buildings (CC BY 4.0) & Microsoft Global ML Building Footprints (ODbL) — bản gộp VIDA / source.coop',
    ],
    osm: meta.osm,
    names: meta.names,
  })
);

console.log(`🏙️  Nhà: ${styled.length} (OSM ${osmCount} + Open Buildings ${obKept}; bỏ trùng ${obDup}, bỏ độ tin cậy thấp ${obLow})`);
console.log(`🌳 Cây: ${trees.length} (ven đường ${roadTrees}, công viên/rừng ${greenTrees}, sân vườn ${yardTrees})`);
console.log(`💾 xuanhoa-city3d.bin = ${(o / 1024 / 1024).toFixed(2)} MB`);
