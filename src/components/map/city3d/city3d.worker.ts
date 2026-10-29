/**
 * WEB WORKER DỰNG HÌNH HỌC BẢN ĐỒ 3D XUÂN HÒA
 * Toàn bộ việc tam giác hoá (nhà, mái, đường, sông hồ, cây) chạy ngoài luồng giao diện
 * → kéo/xoay bản đồ không bao giờ bị khựng khi đang dựng.
 */
import earcut from 'earcut';
import {
  CHUNK_SIZE,
  CITY3D_COLORS,
  CITY3D_DATA_URL,
  CITY3D_META_URL,
  LANDUSE_COLORS,
  ROOF_PALETTE,
  TREE_PALETTE,
  WALL_PALETTE,
  hexToRgb,
  type BuildingChunk,
  type BuildingLabel,
  type City3DOrigin,
  type LiveBuildingInput,
  type MeshBuffers,
  type RoadLabel3D,
  type TreeChunk,
  type WorkerInMessage,
  type WorkerOutMessage,
} from './city3d-shared';

type RGB = [number, number, number];

interface Bld {
  ring: number[]; // x0,y0,x1,y1... (mét, CCW, y hướng Bắc)
  h: number;
  wall: RGB;
  roof: RGB;
  roofKind: number; // 0 bằng, 1 hai mái, 2 bốn mái
  isOsm: boolean;
  topBox: boolean;
  cx: number;
  cy: number;
  area: number;
  key: string;
  removed?: boolean;
  wayId?: number;
  name?: string;
}

interface TreeRec {
  x: number;
  y: number;
  s: number;
  kind: number;
}

const post = (msg: WorkerOutMessage, transfer: Transferable[] = []) =>
  (self as any).postMessage(msg, transfer);

const WALL_RGB = WALL_PALETTE.map(hexToRgb);
const ROOF_RGB = ROOF_PALETTE.map(hexToRgb);

let origin: City3DOrigin = { lng: 105.7262, lat: 21.2818, kx: 0, ky: 110574 };
const buildings: Bld[] = [];
const chunkBuildings = new Map<string, number[]>();
const chunkTrees = new Map<string, TreeRec[]>();
const wayIndex = new Map<number, number>();

/* ------------------------------------------------------------------ tiện ích */

const chunkKeyOf = (x: number, y: number) =>
  `${Math.floor(x / CHUNK_SIZE)},${Math.floor(y / CHUNK_SIZE)}`;

function hash2(x: number, y: number) {
  let h = Math.imul(Math.round(x * 10) | 0, 73856093) ^ Math.imul(Math.round(y * 10) | 0, 19349663);
  h = Math.imul(h ^ (h >>> 13), 0x5bd1e995);
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function signedArea(r: number[]) {
  let a = 0;
  const n = r.length / 2;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    a += (r[j * 2] - r[i * 2]) * (r[j * 2 + 1] + r[i * 2 + 1]);
  }
  return a / 2;
}

function centroidOf(r: number[]): [number, number] {
  let a = 0, cx = 0, cy = 0;
  const n = r.length / 2;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const f = r[j * 2] * r[i * 2 + 1] - r[i * 2] * r[j * 2 + 1];
    a += f;
    cx += (r[j * 2] + r[i * 2]) * f;
    cy += (r[j * 2 + 1] + r[i * 2 + 1]) * f;
  }
  if (Math.abs(a) < 1e-9) return [r[0], r[1]];
  return [cx / (3 * a), cy / (3 * a)];
}

function pointInRing(x: number, y: number, r: number[]) {
  let inside = false;
  const n = r.length / 2;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = r[i * 2], yi = r[i * 2 + 1], xj = r[j * 2], yj = r[j * 2 + 1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi || 1e-12) + xi) inside = !inside;
  }
  return inside;
}

function tint(c: RGB, f: number): RGB {
  return [
    Math.max(0, Math.min(255, Math.round(c[0] * f))),
    Math.max(0, Math.min(255, Math.round(c[1] * f))),
    Math.max(0, Math.min(255, Math.round(c[2] * f))),
  ];
}

function minAreaRect(r: number[]) {
  const pts: [number, number][] = [];
  for (let i = 0; i < r.length; i += 2) pts.push([r[i], r[i + 1]]);
  pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: number[], a: number[], b: number[]) =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: [number, number][] = [];
  for (const q of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop();
    lower.push(q);
  }
  const upper: [number, number][] = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const q = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop();
    upper.push(q);
  }
  upper.pop();
  lower.pop();
  const hull = lower.concat(upper);
  let best: { area: number; ang: number; minU: number; maxU: number; minV: number; maxV: number } | null = null;
  for (let i = 0; i < hull.length; i++) {
    const a = hull[i], b = hull[(i + 1) % hull.length];
    const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
    const c = Math.cos(ang), s = Math.sin(ang);
    let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
    for (const [x, y] of hull) {
      const u = x * c + y * s, v = -x * s + y * c;
      minU = Math.min(minU, u);
      maxU = Math.max(maxU, u);
      minV = Math.min(minV, v);
      maxV = Math.max(maxV, v);
    }
    const area = (maxU - minU) * (maxV - minV);
    if (!best || area < best.area) best = { area, ang, minU, maxU, minV, maxV };
  }
  if (!best) return null;
  let { ang } = best;
  const cu = (best.minU + best.maxU) / 2, cv = (best.minV + best.maxV) / 2;
  const c = Math.cos(ang), s = Math.sin(ang);
  const cx = cu * c - cv * s, cy = cu * s + cv * c;
  let w = best.maxU - best.minU, h = best.maxV - best.minV;
  if (h > w) {
    [w, h] = [h, w];
    ang += Math.PI / 2;
  }
  const ca = Math.cos(ang), sa = Math.sin(ang);
  const ring: number[] = [];
  for (const [u, v] of [
    [-w / 2, -h / 2],
    [w / 2, -h / 2],
    [w / 2, h / 2],
    [-w / 2, h / 2],
  ]) {
    ring.push(cx + u * ca - v * sa, cy + u * sa + v * ca);
  }
  return { ring, area: best.area, w, h };
}

/* ------------------------------------------------------------------ bộ đệm hình học */

class GeoBuilder {
  pos: number[] = [];
  col: number[] = [];
  idx: number[] = [];
  get count() {
    return this.pos.length / 3;
  }
  v(x: number, y: number, z: number, c: RGB) {
    this.pos.push(x, y, z);
    this.col.push(c[0], c[1], c[2]);
    return this.pos.length / 3 - 1;
  }
  tri(a: number, b: number, c: number) {
    this.idx.push(a, b, c);
  }
  quad(a: number, b: number, c: number, d: number) {
    this.idx.push(a, b, c, a, c, d);
  }
  /** Đa giác phẳng nằm ngang (nhìn từ trên xuống), ring tính theo (x, yBắc) */
  flatPolygon(ring: number[], y: number, c: RGB) {
    const n = ring.length / 2;
    if (n < 3) return;
    const base = this.count;
    for (let i = 0; i < n; i++) this.v(ring[i * 2], y, -ring[i * 2 + 1], c);
    const tris = earcut(ring);
    for (let t = 0; t < tris.length; t += 3) {
      const a = tris[t], b = tris[t + 1], d = tris[t + 2];
      const area =
        (ring[b * 2] - ring[a * 2]) * (ring[d * 2 + 1] - ring[a * 2 + 1]) -
        (ring[d * 2] - ring[a * 2]) * (ring[b * 2 + 1] - ring[a * 2 + 1]);
      if (area >= 0) this.tri(base + a, base + b, base + d);
      else this.tri(base + a, base + d, base + b);
    }
  }
  /** Dải băng theo đường (đường phố, sông suối) */
  ribbon(pts: number[], hw: number, y: number, c: RGB, caps = false) {
    const n = pts.length / 2;
    if (n < 2) return;
    const base = this.count;
    for (let i = 0; i < n; i++) {
      const x = pts[i * 2], z = pts[i * 2 + 1];
      let dx0 = 0, dy0 = 0, dx1 = 0, dy1 = 0;
      if (i > 0) {
        dx0 = x - pts[i * 2 - 2];
        dy0 = z - pts[i * 2 - 1];
        const l = Math.hypot(dx0, dy0) || 1;
        dx0 /= l;
        dy0 /= l;
      }
      if (i < n - 1) {
        dx1 = pts[i * 2 + 2] - x;
        dy1 = pts[i * 2 + 3] - z;
        const l = Math.hypot(dx1, dy1) || 1;
        dx1 /= l;
        dy1 /= l;
      }
      if (i === 0) {
        dx0 = dx1;
        dy0 = dy1;
      }
      if (i === n - 1) {
        dx1 = dx0;
        dy1 = dy0;
      }
      let mx = -(dy0 + dy1), my = dx0 + dx1;
      const ml = Math.hypot(mx, my);
      if (ml < 1e-6) {
        mx = -dy1;
        my = dx1;
      } else {
        mx /= ml;
        my /= ml;
      }
      const dot = Math.max(0.4, mx * -dy1 + my * dx1);
      const len = hw / dot;
      this.v(x - mx * len, y, -(z - my * len), c); // phải
      this.v(x + mx * len, y, -(z + my * len), c); // trái
    }
    for (let i = 0; i < n - 1; i++) {
      const r0 = base + i * 2, l0 = r0 + 1, r1 = r0 + 2, l1 = r0 + 3;
      this.quad(r0, r1, l1, l0);
    }
    if (caps) {
      this.disc(pts[0], pts[1], hw, y, c);
      this.disc(pts[(n - 1) * 2], pts[(n - 1) * 2 + 1], hw, y, c);
    }
  }
  disc(x: number, yN: number, r: number, y: number, c: RGB, seg = 8) {
    const center = this.v(x, y, -yN, c);
    const first = this.count;
    for (let i = 0; i < seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      this.v(x + Math.cos(a) * r, y, -(yN + Math.sin(a) * r), c);
    }
    for (let i = 0; i < seg; i++) this.tri(center, first + i, first + ((i + 1) % seg));
  }
  /** Khối lăng trụ đứng (tường): mỗi mặt tường 4 đỉnh riêng để pháp tuyến phẳng tuyệt đối trên GPU */
  prismWalls(ring: number[], y0: number, y1: number, cBottom: RGB, cTop: RGB) {
    const n = ring.length / 2;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const x0 = ring[i * 2], z0 = -ring[i * 2 + 1];
      const x1 = ring[j * 2], z1 = -ring[j * 2 + 1];
      const b = this.count;
      this.v(x0, y0, z0, cBottom);
      this.v(x1, y0, z1, cBottom);
      this.v(x1, y1, z1, cTop);
      this.v(x0, y1, z0, cTop);
      this.quad(b, b + 1, b + 2, b + 3);
    }
  }
  take(): MeshBuffers {
    return {
      positions: new Float32Array(this.pos),
      colors: new Uint8Array(this.col),
      indices: new Uint32Array(this.idx),
    };
  }
}

/* ------------------------------------------------------------------ dựng 1 ngôi nhà */

function addBuilding(g: GeoBuilder, b: Bld) {
  const r = b.ring;
  const n = r.length / 2;
  const h = b.h;
  const wallTop = b.wall;
  const wallBottom = tint(b.wall, 0.8);
  g.prismWalls(r, 0, h, wallBottom, wallTop);

  if (b.roofKind !== 0 && n === 4) {
    const p = (i: number) => [r[i * 2], r[i * 2 + 1]];
    const [p0, p1, p2, p3] = [p(0), p(1), p(2), p(3)];
    const w = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
    const d = Math.hypot(p3[0] - p0[0], p3[1] - p0[1]);
    if (w > 0.5 && d > 0.5) {
      const ux = (p1[0] - p0[0]) / w, uy = (p1[1] - p0[1]) / w;
      const vx = (p3[0] - p0[0]) / d, vy = (p3[1] - p0[1]) / d;
      const cx = (p0[0] + p1[0] + p2[0] + p3[0]) / 4;
      const cy = (p0[1] + p1[1] + p2[1] + p3[1]) / 4;
      const rise = Math.max(0.8, Math.min(4.2, d * 0.34));
      const ov = Math.min(0.45, d * 0.08);
      const eaveY = h - (ov * rise) / (d / 2);
      const roofC = b.roof;
      const roofDark = tint(b.roof, 0.92);
      const corner = (q: number[], su: number, sv: number): [number, number] => [
        q[0] + ux * su * ov + vx * sv * ov,
        q[1] + uy * su * ov + vy * sv * ov,
      ];
      const q0 = corner(p0, -1, -1), q1 = corner(p1, 1, -1), q2 = corner(p2, 1, 1), q3 = corner(p3, -1, 1);
      const half = b.roofKind === 1 ? w / 2 + ov : Math.max(0, w / 2 - d / 2);
      const r0: [number, number] = [cx - ux * half, cy - uy * half];
      const r1: [number, number] = [cx + ux * half, cy + uy * half];
      const ry = h + rise;
      const iq0 = g.v(q0[0], eaveY, -q0[1], roofC);
      const iq1 = g.v(q1[0], eaveY, -q1[1], roofC);
      const iq2 = g.v(q2[0], eaveY, -q2[1], roofDark);
      const iq3 = g.v(q3[0], eaveY, -q3[1], roofDark);
      const ir0 = g.v(r0[0], ry, -r0[1], roofC);
      const ir1 = g.v(r1[0], ry, -r1[1], roofC);
      const ir0b = g.v(r0[0], ry, -r0[1], roofDark);
      const ir1b = g.v(r1[0], ry, -r1[1], roofDark);
      g.quad(iq0, iq1, ir1, ir0);
      g.quad(iq2, iq3, ir0b, ir1b);
      if (b.roofKind === 1) {
        // đầu hồi (tam giác tường)
        const a1 = g.v(cx + (ux * w) / 2, ry, -(cy + (uy * w) / 2), wallTop);
        const a0 = g.v(cx - (ux * w) / 2, ry, -(cy - (uy * w) / 2), wallTop);
        const t1 = g.v(p1[0], h, -p1[1], wallTop);
        const t2 = g.v(p2[0], h, -p2[1], wallTop);
        const t3 = g.v(p3[0], h, -p3[1], wallTop);
        const t0 = g.v(p0[0], h, -p0[1], wallTop);
        g.tri(t1, t2, a1);
        g.tri(t3, t0, a0);
      } else {
        const e1 = g.v(q1[0], eaveY, -q1[1], roofC);
        const e2 = g.v(q2[0], eaveY, -q2[1], roofC);
        const e3 = g.v(q3[0], eaveY, -q3[1], roofC);
        const e0 = g.v(q0[0], eaveY, -q0[1], roofC);
        const h1 = g.v(r1[0], ry, -r1[1], roofC);
        const h0 = g.v(r0[0], ry, -r0[1], roofC);
        g.tri(e1, e2, h1);
        g.tri(e3, e0, h0);
      }
      return;
    }
  }

  // Mái bằng (sân thượng)
  g.flatPolygon(r, h, b.roof);

  if (b.topBox && b.area > 25) {
    // Tum cầu thang / bồn nước trên sân thượng
    const s = Math.min(3.4, Math.sqrt(b.area) * 0.42);
    if (pointInRing(b.cx, b.cy, r)) {
      const ex = r[2] - r[0], ey = r[3] - r[1];
      const el = Math.hypot(ex, ey) || 1;
      const ux = ex / el, uy = ey / el;
      const hs = s / 2;
      const box = [
        b.cx - ux * hs + uy * hs, b.cy - uy * hs - ux * hs,
        b.cx + ux * hs + uy * hs, b.cy + uy * hs - ux * hs,
        b.cx + ux * hs - uy * hs, b.cy + uy * hs + ux * hs,
        b.cx - ux * hs - uy * hs, b.cy - uy * hs + ux * hs,
      ];
      if (signedArea(box) < 0) {
        for (let i = 0, j = box.length - 2; i < j; i += 2, j -= 2) {
          [box[i], box[j]] = [box[j], box[i]];
          [box[i + 1], box[j + 1]] = [box[j + 1], box[i + 1]];
        }
      }
      g.prismWalls(box, h, h + 2.6, tint(b.wall, 0.9), b.wall);
      g.flatPolygon(box, h + 2.6, b.roof);
    }
  }
}

/* ------------------------------------------------------------------ chunk */

function buildBuildingChunk(key: string): BuildingChunk | null {
  const ids = chunkBuildings.get(key);
  if (!ids) return null;
  const g = new GeoBuilder();
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity, maxH = 0;
  for (const id of ids) {
    const b = buildings[id];
    if (b.removed) continue;
    addBuilding(g, b);
    minX = Math.min(minX, b.cx);
    maxX = Math.max(maxX, b.cx);
    minZ = Math.min(minZ, -b.cy);
    maxZ = Math.max(maxZ, -b.cy);
    maxH = Math.max(maxH, b.h + 5);
  }
  const m = g.take();
  const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;
  const radius = Math.hypot(maxX - minX, maxZ - minZ) / 2 + 60 + maxH;
  return { key, ...m, center: [cx, maxH / 2, cz], radius: Number.isFinite(radius) ? radius : CHUNK_SIZE };
}

function buildTreeChunk(key: string): TreeChunk {
  const list = chunkTrees.get(key) || [];
  const broad: number[] = [];
  const conifer: number[] = [];
  for (const t of list) {
    const r = hash2(t.x, t.y);
    const arr = t.kind === 1 ? conifer : broad;
    arr.push(t.x, -t.y, t.s, r * Math.PI * 2, Math.floor(r * 997) % TREE_PALETTE.length);
  }
  return { key, broadleaf: new Float32Array(broad), conifer: new Float32Array(conifer) };
}

function postBuildingChunks(keys: string[], replace = false) {
  const chunks: BuildingChunk[] = [];
  const transfer: Transferable[] = [];
  for (const k of keys) {
    const c = buildBuildingChunk(k);
    if (!c) continue;
    chunks.push(c);
    transfer.push(c.positions.buffer, c.colors.buffer, c.indices.buffer);
  }
  if (chunks.length) post({ type: 'buildings', chunks, replace }, transfer);
}

function postTreeChunks(keys: string[]) {
  const chunks = keys.map(buildTreeChunk);
  post(
    { type: 'trees', chunks },
    chunks.flatMap((c) => [c.broadleaf.buffer, c.conifer.buffer])
  );
}

function registerBuilding(b: Bld) {
  const id = buildings.length;
  b.key = chunkKeyOf(b.cx, b.cy);
  buildings.push(b);
  let arr = chunkBuildings.get(b.key);
  if (!arr) chunkBuildings.set(b.key, (arr = []));
  arr.push(id);
  if (b.wayId) wayIndex.set(b.wayId, id);
  return id;
}

/* ------------------------------------------------------------------ tải dữ liệu nền */

function lineToLocal(coords: number[][]): number[] {
  const out: number[] = [];
  for (const [lng, lat] of coords) {
    out.push((lng - origin.lng) * origin.kx, (lat - origin.lat) * origin.ky);
  }
  return out;
}

function ringToLocalCCW(coords: number[][]): number[] {
  const r = lineToLocal(coords);
  if (r.length >= 4 && Math.abs(r[0] - r[r.length - 2]) < 0.01 && Math.abs(r[1] - r[r.length - 1]) < 0.01) {
    r.length -= 2;
  }
  if (signedArea(r) < 0) {
    const out: number[] = [];
    for (let i = r.length / 2 - 1; i >= 0; i--) out.push(r[i * 2], r[i * 2 + 1]);
    return out;
  }
  return r;
}

const ROAD_STYLE: Record<string, { hw: number; color: RGB; casing: number; order: number }> = {
  major: { hw: 6.5, color: hexToRgb(CITY3D_COLORS.roadMajor), casing: 1.6, order: 5 },
  secondary: { hw: 4.5, color: hexToRgb(CITY3D_COLORS.roadSecondary), casing: 1.2, order: 4 },
  minor: { hw: 3.1, color: hexToRgb(CITY3D_COLORS.roadMinor), casing: 0.7, order: 3 },
  service: { hw: 2.1, color: hexToRgb(CITY3D_COLORS.roadService), casing: 0.4, order: 2 },
  track: { hw: 1.8, color: hexToRgb(CITY3D_COLORS.roadTrack), casing: 0.3, order: 1 },
  path: { hw: 1.4, color: hexToRgb(CITY3D_COLORS.roadPath), casing: 0.25, order: 0 },
};

function roadStyleOf(p: any) {
  if (p?.tier === 'major') return ROAD_STYLE.major;
  if (p?.tier === 'secondary') return ROAD_STYLE.secondary;
  if (p?.tier === 'minor') return ROAD_STYLE.minor;
  const hw = p?.highway || '';
  if (hw === 'residential' || hw === 'unclassified' || hw === 'service' || hw === 'living_street') return ROAD_STYLE.service;
  if (hw === 'track' || hw === 'construction') return ROAD_STYLE.track;
  return ROAD_STYLE.path;
}

async function fetchJson(url: string) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status} ${url}`);
  return r.json();
}

async function init(baseUrl: string) {
  const u = (p: string) => `${baseUrl}/${p}`;
  post({ type: 'progress', label: 'Đang tải dữ liệu nhà & cây xanh…', pct: 5 });

  const [binBuf, meta, boundary, landuse, water, waterways, roads] = await Promise.all([
    fetch(u(CITY3D_DATA_URL)).then((r) => {
      if (!r.ok) throw new Error('Không tải được dữ liệu 3D');
      return r.arrayBuffer();
    }),
    fetchJson(u(CITY3D_META_URL)),
    fetchJson(u('geo/xuanhoa-boundary.geojson')),
    fetchJson(u('geo/xuanhoa-landuse.geojson')),
    fetchJson(u('geo/xuanhoa-water.geojson')),
    fetchJson(u('geo/xuanhoa-waterways.geojson')),
    fetchJson(u('geo/xuanhoa-roads.geojson')),
  ]);

  origin = meta.origin as City3DOrigin;

  // --- Ranh giới phường: mặt đất + vách đất kiểu sa bàn
  const wardRing = ringToLocalCCW(boundary.features[0].geometry.coordinates[0]);
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let i = 0; i < wardRing.length; i += 2) {
    minX = Math.min(minX, wardRing[i]);
    maxX = Math.max(maxX, wardRing[i]);
    minY = Math.min(minY, wardRing[i + 1]);
    maxY = Math.max(maxY, wardRing[i + 1]);
  }
  post({ type: 'origin', origin, wardBox: [minX, minY, maxX, maxY] });
  post({ type: 'progress', label: 'Đang dựng mặt đất, sông hồ & đường phố…', pct: 20 });

  const ground = new GeoBuilder();
  ground.flatPolygon(wardRing, 0, hexToRgb(CITY3D_COLORS.ground));
  const skirt = new GeoBuilder();
  skirt.prismWalls(wardRing, -38, 0, hexToRgb(CITY3D_COLORS.skirtBottom), hexToRgb(CITY3D_COLORS.skirtTop));

  // --- Phủ đất (công viên, rừng, sân bóng, trường học…)
  const land = new GeoBuilder();
  const landFeatures = (landuse.features || []).slice().sort((a: any, b: any) => {
    // vùng lớn vẽ trước, vùng nhỏ (sân bóng) vẽ sau để nổi lên trên
    const ra = a.geometry?.coordinates?.[0]?.length || 0;
    const rb = b.geometry?.coordinates?.[0]?.length || 0;
    return rb - ra;
  });
  for (const f of landFeatures) {
    if (f.geometry?.type !== 'Polygon') continue;
    const type = f.properties?.rawType || '';
    let color = LANDUSE_COLORS[type];
    if (color === undefined) color = f.properties?.kind === 'green' ? LANDUSE_COLORS.park : f.properties?.kind === 'campus' ? LANDUSE_COLORS.school : '';
    if (!color) continue;
    land.flatPolygon(ringToLocalCCW(f.geometry.coordinates[0]), 0, hexToRgb(color));
  }

  // --- Mặt nước & sông suối
  const wat = new GeoBuilder();
  const waterC = hexToRgb(CITY3D_COLORS.water);
  const waterEdge = hexToRgb(CITY3D_COLORS.waterEdge);
  for (const f of waterways.features || []) {
    if (f.geometry?.type !== 'LineString') continue;
    const ww = f.properties?.waterway;
    if (ww === 'dam') continue;
    const pts = lineToLocal(f.geometry.coordinates);
    const hw = ww === 'river' ? 11 : 2.2;
    wat.ribbon(pts, hw + 1.2, 0, waterEdge, true);
    wat.ribbon(pts, hw, 0, waterC, true);
  }
  for (const f of water.features || []) {
    if (f.geometry?.type !== 'Polygon') continue;
    const ring = ringToLocalCCW(f.geometry.coordinates[0]);
    const closed = ring.concat([ring[0], ring[1]]);
    wat.ribbon(closed, 1.4, 0, waterEdge);
    wat.flatPolygon(ring, 0, waterC);
  }

  // --- Đường phố: viền vỉa hè trước, lòng đường sau (đường lớn vẽ đè lên đường nhỏ)
  const roadG = new GeoBuilder();
  const marks = new GeoBuilder();
  const lines = (roads.features || [])
    .filter((f: any) => f.geometry?.type === 'LineString')
    .map((f: any) => ({ pts: lineToLocal(f.geometry.coordinates), st: roadStyleOf(f.properties) }))
    .sort((a: any, b: any) => a.st.order - b.st.order);
  const casingC = hexToRgb(CITY3D_COLORS.roadCasing);
  for (const l of lines) {
    if (l.st.casing > 0) roadG.ribbon(l.pts, l.st.hw + l.st.casing, 0, casingC, true);
  }
  for (const l of lines) roadG.ribbon(l.pts, l.st.hw, 0, l.st.color, l.st.order >= 2);
  // vạch kẻ đứt giữa đường lớn
  const markC = hexToRgb(CITY3D_COLORS.roadMarking);
  for (const l of lines) {
    if (l.st.order < 4) continue;
    const p = l.pts;
    let acc = 0;
    for (let i = 0; i < p.length / 2 - 1; i++) {
      const x1 = p[i * 2], y1 = p[i * 2 + 1], x2 = p[i * 2 + 2], y2 = p[i * 2 + 3];
      const len = Math.hypot(x2 - x1, y2 - y1);
      if (len < 0.1) continue;
      const ux = (x2 - x1) / len, uy = (y2 - y1) / len;
      for (let d = (6 - (acc % 6)) % 6; d < len; d += 6) {
        const e = Math.min(len, d + 2.6);
        marks.ribbon([x1 + ux * d, y1 + uy * d, x1 + ux * e, y1 + uy * e], 0.14, 0, markC);
      }
      acc += len;
    }
  }

  const base = {
    type: 'base' as const,
    ground: ground.take(),
    skirt: skirt.take(),
    landuse: land.take(),
    water: wat.take(),
    roads: roadG.take(),
    markings: marks.take(),
  };
  const baseTransfer: Transferable[] = [];
  for (const k of ['ground', 'skirt', 'landuse', 'water', 'roads', 'markings'] as const) {
    baseTransfer.push(base[k].positions.buffer, base[k].colors.buffer, base[k].indices.buffer);
  }
  post(base, baseTransfer);

  // --- Nhà
  post({ type: 'progress', label: 'Đang dựng nhà cửa…', pct: 45 });
  const dv = new DataView(binBuf);
  let o = 0;
  if (dv.getUint32(o, true) !== 0x44334858) throw new Error('Sai định dạng dữ liệu 3D');
  o += 8;
  o += 16; // lng0, lat0 (đã có trong meta)
  const nB = dv.getUint32(o, true);
  o += 4;
  const nT = dv.getUint32(o, true);
  o += 4;
  const osmIds = new Map<number, number>((meta.osm || []) as [number, number][]);
  const names = new Map<number, string>((meta.names || []) as [number, string][]);
  for (let i = 0; i < nB; i++) {
    const n = dv.getUint8(o++);
    const hh = dv.getUint8(o++);
    const wallIdx = dv.getUint8(o++);
    const rk = dv.getUint8(o++);
    const flags = dv.getUint8(o++);
    let x = dv.getInt32(o, true);
    o += 4;
    let y = dv.getInt32(o, true);
    o += 4;
    const ring = [x / 10, y / 10];
    for (let k = 1; k < n; k++) {
      x += dv.getInt16(o, true);
      o += 2;
      y += dv.getInt16(o, true);
      o += 2;
      ring.push(x / 10, y / 10);
    }
    const [cx, cy] = centroidOf(ring);
    const t = 0.94 + hash2(cx, cy) * 0.1;
    registerBuilding({
      ring,
      h: hh / 2,
      wall: tint(WALL_RGB[wallIdx % WALL_RGB.length], t),
      roof: tint(ROOF_RGB[(rk >> 2) % ROOF_RGB.length], 0.96 + hash2(cy, cx) * 0.08),
      roofKind: rk & 3,
      isOsm: !!(flags & 1),
      topBox: !!(flags & 4),
      cx,
      cy,
      area: Math.abs(signedArea(ring)),
      key: '',
      wayId: osmIds.get(i),
      name: names.get(i),
    });
  }
  const trees: TreeRec[] = [];
  for (let i = 0; i < nT; i++) {
    const x = dv.getInt32(o, true) / 10;
    o += 4;
    const y = dv.getInt32(o, true) / 10;
    o += 4;
    const s = 0.4 + (dv.getUint8(o++) / 255) * 1.6;
    const kind = dv.getUint8(o++);
    trees.push({ x, y, s, kind });
  }
  for (const t of trees) {
    const k = chunkKeyOf(t.x, t.y);
    let arr = chunkTrees.get(k);
    if (!arr) chunkTrees.set(k, (arr = []));
    arr.push(t);
  }

  // Gửi chunk gần tâm trước để người dùng thấy nhà ngay lập tức
  const keys = Array.from(chunkBuildings.keys()).sort((a, b) => {
    const [ax, ay] = a.split(',').map(Number);
    const [bx, by] = b.split(',').map(Number);
    return ax * ax + ay * ay - (bx * bx + by * by);
  });
  const batch = 6;
  for (let i = 0; i < keys.length; i += batch) {
    postBuildingChunks(keys.slice(i, i + batch));
    post({
      type: 'progress',
      label: `Đang dựng ${buildings.length.toLocaleString('vi-VN')} ngôi nhà…`,
      pct: 45 + Math.round((i / keys.length) * 40),
    });
  }

  post({ type: 'progress', label: 'Đang trồng cây xanh…', pct: 90 });
  postTreeChunks(Array.from(chunkTrees.keys()));

  const labels: BuildingLabel[] = [];
  for (const b of buildings) {
    if (b.name && !b.removed) labels.push({ x: b.cx, z: -b.cy, y: b.h + (b.roofKind ? 3 : 1.5), name: b.name });
  }

  // --- Điểm neo Tên Đường 3D chuẩn Maps (trích xuất từ các đoạn thẳng của xuanhoa-roads.geojson)
  const rawRoadByName = new Map<string, RoadLabel3D[]>();
  const tierOrder: Record<string, number> = { major: 1, secondary: 2, minor: 3, alley: 4 };
  for (const f of roads.features || []) {
    if (f.geometry?.type !== 'LineString') continue;
    const name = String(f.properties?.name || '').trim();
    if (!name || /^(Đường mòn|Dốc |Hai Con|Thiên Phú Lâm Loop|Dong Do)/i.test(name)) continue;
    const pts = lineToLocal(f.geometry.coordinates);
    if (pts.length < 4) continue;
    let totalLen = 0;
    const segLens: number[] = [];
    for (let i = 0; i < pts.length / 2 - 1; i++) {
      const l = Math.hypot(pts[i * 2 + 2] - pts[i * 2], pts[i * 2 + 3] - pts[i * 2 + 1]);
      segLens.push(l);
      totalLen += l;
    }
    if (totalLen < 32) continue;
    const rawTier = f.properties?.tier;
    const tier: RoadLabel3D['tier'] =
      rawTier === 'major' || rawTier === 'secondary' || rawTier === 'minor' ? rawTier : 'alley';
    const step = tier === 'major' ? 320 : tier === 'secondary' ? 240 : tier === 'minor' ? 185 : 160;
    const targets: number[] = [];
    if (totalLen < step * 1.3) {
      targets.push(totalLen * 0.5);
    } else {
      for (let d = step * 0.55; d <= totalLen - step * 0.35; d += step) targets.push(d);
    }
    let list = rawRoadByName.get(name);
    if (!list) rawRoadByName.set(name, (list = []));
    for (const td of targets) {
      let acc = 0;
      for (let i = 0; i < segLens.length; i++) {
        const sl = segLens[i];
        if (acc + sl >= td || i === segLens.length - 1) {
          const t = sl > 0 ? Math.max(0, Math.min(1, (td - acc) / sl)) : 0.5;
          const x1 = pts[i * 2], y1 = pts[i * 2 + 1], x2 = pts[i * 2 + 2], y2 = pts[i * 2 + 3];
          const px = x1 + (x2 - x1) * t;
          const py = y1 + (y2 - y1) * t;
          if (!pointInRing(px, py, wardRing)) break;
          const l = Math.hypot(x2 - x1, y2 - y1) || 1;
          list.push({
            name,
            x: px,
            z: -py,
            dx: (x2 - x1) / l,
            dz: -(y2 - y1) / l,
            tier,
          });
          break;
        }
        acc += sl;
      }
    }
  }
  const roadLabels: RoadLabel3D[] = [];
  for (const [, cands] of rawRoadByName) {
    const kept: RoadLabel3D[] = [];
    for (const c of cands) {
      if (!kept.some((k) => Math.hypot(c.x - k.x, c.z - k.z) < 135)) {
        kept.push(c);
        roadLabels.push(c);
      }
    }
  }
  roadLabels.sort((a, b) => (tierOrder[a.tier] || 3) - (tierOrder[b.tier] || 3));

  post({ type: 'labels', labels, roadLabels });
  post({
    type: 'ready',
    stats: {
      buildings: buildings.length,
      trees: trees.length,
      osmBuildings: meta.stats?.osmBuildings || 0,
      openBuildings: meta.stats?.openBuildings || 0,
    },
  });
}

/* ------------------------------------------------------------------ cập nhật trực tiếp (Overpass) */

const NAMED_COLORS: Record<string, string> = {
  white: '#F4F1EA', yellow: '#EAC872', red: '#C2463A', blue: '#6E9CCB', grey: '#B5B3AE', gray: '#B5B3AE',
  brown: '#9C6B4A', beige: '#DCCBAA', orange: '#E59A57', pink: '#E8B9AE', green: '#7FAE6E', black: '#4A4D52',
  cream: '#EFE3C4', silver: '#C9CBCF', maroon: '#8C3B33', darkred: '#8C3B33', lightgrey: '#D3D0C9',
  lightgray: '#D3D0C9', darkgrey: '#6B6E73', darkgray: '#6B6E73', tan: '#D2B48C', purple: '#8C6BA8',
};

function parseColour(v?: string): RGB | null {
  if (!v) return null;
  const s = v.trim().toLowerCase().replace(/\s+/g, '');
  if (/^#?[0-9a-f]{6}$/.test(s) || /^#?[0-9a-f]{3}$/.test(s)) return hexToRgb(s.startsWith('#') ? s : `#${s}`);
  const named = NAMED_COLORS[s];
  return named ? hexToRgb(named) : null;
}

function parseNum(v?: string) {
  if (!v) return NaN;
  const n = parseFloat(v.replace(',', '.'));
  return Number.isFinite(n) ? n : NaN;
}

function heightFromTags(tags: Record<string, string>) {
  const h = parseNum(tags.height);
  if (h > 1 && h < 400) return h;
  const lv = parseNum(tags['building:levels']);
  if (lv > 0 && lv < 100) return lv * 3.4 + (parseNum(tags['roof:levels']) > 0 ? 0 : 0.5);
  return NaN;
}

function roofKindFromTags(tags: Record<string, string>): number | null {
  const s = tags['roof:shape'];
  if (!s) return null;
  if (s === 'gabled' || s === 'saltbox' || s === 'gambrel') return 1;
  if (s === 'hipped' || s === 'pyramidal' || s === 'half-hipped') return 2;
  return 0;
}

function heuristicStyle(area: number, cx: number, cy: number) {
  const rnd = mulberry32(Math.floor(hash2(cx, cy) * 4294967295));
  let floors = 2;
  if (area < 22) floors = 1;
  else if (area < 140) floors = [1, 2, 2, 3, 3, 3, 4, 4, 5][Math.floor(rnd() * 9)];
  else if (area < 450) floors = [1, 2, 2, 3, 3, 4][Math.floor(rnd() * 6)];
  else floors = [1, 1, 2, 2, 3][Math.floor(rnd() * 5)];
  const wall = WALL_RGB[Math.floor(rnd() * WALL_RGB.length)];
  const pitched = floors <= 2 && rnd() < 0.55;
  const roof = pitched ? ROOF_RGB[[0, 1, 2, 3, 4, 7][Math.floor(rnd() * 6)]] : ROOF_RGB[[6, 6, 4, 5][Math.floor(rnd() * 4)]];
  return { h: floors * 3.4 + (pitched ? 0 : 0.5), wall, roof, roofKind: pitched ? 1 : 0, topBox: floors >= 3 && rnd() < 0.4 };
}

function applyLive(requestId: number, list: LiveBuildingInput[], liveTrees: [number, number][]) {
  const dirtyB = new Set<string>();
  const dirtyT = new Set<string>();
  let updated = 0, added = 0, withRealHeight = 0, treeCount = 0;

  for (const lb of list) {
    if (!lb.ring || lb.ring.length < 4) continue;
    let ring = ringToLocalCCW(lb.ring);
    if (ring.length < 6) continue;
    const area = Math.abs(signedArea(ring));
    if (area < 6) continue;
    const tags = lb.tags || {};
    const realH = heightFromTags(tags);
    const wallC = parseColour(tags['building:colour']);
    const roofC = parseColour(tags['roof:colour']);
    let rk = roofKindFromTags(tags);
    if (Number.isFinite(realH)) withRealHeight++;

    const existingId = lb.wayId ? wayIndex.get(lb.wayId) : undefined;
    if (existingId !== undefined) {
      const b = buildings[existingId];
      let changed = false;
      if (Number.isFinite(realH)) {
        b.h = realH;
        changed = true;
      }
      if (wallC) {
        b.wall = wallC;
        changed = true;
      }
      if (roofC) {
        b.roof = roofC;
        changed = true;
      }
      if (rk !== null) {
        if (rk > 0 && b.ring.length !== 8) {
          const rect = minAreaRect(b.ring);
          if (rect && b.area / rect.area > 0.8) b.ring = rect.ring;
          else rk = 0;
        }
        b.roofKind = rk;
        changed = true;
      }
      if (tags.name && !b.name) b.name = tags.name;
      if (changed) {
        dirtyB.add(b.key);
        updated++;
      }
      continue;
    }

    // Nhà mới trên OSM chưa có trong dữ liệu dựng sẵn
    const [cx, cy] = centroidOf(ring);
    const key = chunkKeyOf(cx, cy);
    const [kx, ky] = key.split(',').map(Number);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (const id of chunkBuildings.get(`${kx + dx},${ky + dy}`) || []) {
          const o = buildings[id];
          if (o.removed || o.isOsm) continue;
          if (pointInRing(o.cx, o.cy, ring) || pointInRing(cx, cy, o.ring)) {
            o.removed = true;
            dirtyB.add(o.key);
          }
        }
      }
    }
    const style = heuristicStyle(area, cx, cy);
    if (rk !== null) style.roofKind = rk;
    if (style.roofKind > 0) {
      const rect = minAreaRect(ring);
      if (rect && area / rect.area > 0.8) ring = rect.ring;
      else style.roofKind = 0;
    }
    registerBuilding({
      ring,
      h: Number.isFinite(realH) ? realH : style.h,
      wall: wallC || style.wall,
      roof: roofC || style.roof,
      roofKind: style.roofKind,
      isOsm: true,
      topBox: style.topBox && !Number.isFinite(realH),
      cx,
      cy,
      area,
      key: '',
      wayId: lb.wayId,
      name: tags.name,
    });
    dirtyB.add(key);
    added++;
  }

  for (const [lng, lat] of liveTrees) {
    const x = (lng - origin.lng) * origin.kx;
    const y = (lat - origin.lat) * origin.ky;
    const k = chunkKeyOf(x, y);
    let arr = chunkTrees.get(k);
    if (!arr) chunkTrees.set(k, (arr = []));
    if (arr.some((t) => Math.abs(t.x - x) < 2.5 && Math.abs(t.y - y) < 2.5)) continue;
    arr.push({ x, y, s: 0.9 + hash2(x, y) * 0.5, kind: 0 });
    dirtyT.add(k);
    treeCount++;
  }

  postBuildingChunks(Array.from(dirtyB), true);
  if (dirtyT.size) postTreeChunks(Array.from(dirtyT));
  post({ type: 'liveDone', requestId, updated, added, withRealHeight, trees: treeCount });
}

self.onmessage = (e: MessageEvent<WorkerInMessage>) => {
  const msg = e.data;
  if (msg.type === 'init') {
    init(msg.baseUrl).catch((err) => post({ type: 'error', message: String(err?.message || err) }));
  } else if (msg.type === 'live') {
    try {
      applyLive(msg.requestId, msg.buildings, msg.trees);
    } catch (err: any) {
      post({ type: 'error', message: String(err?.message || err) });
    }
  }
};
