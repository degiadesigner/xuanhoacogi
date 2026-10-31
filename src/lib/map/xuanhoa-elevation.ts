/**
 * XUAN HÒA DIGITAL TWIN — UNIFIED TERRAIN & ELEVATION ENGINE (GIAI ĐOẠN 1)
 * ============================================================================
 * Cung cấp hàm chuẩn duy nhất `getElevationAtLngLat(lng, lat)` và `getElevationAtLocal(x, y)`
 * cho toàn bộ hệ thống 2D & 3D:
 *   - Đế công trình (building base + foundation skirt)
 *   - Mạng lưới đường (roads / bridges)
 *   - Mặt nước phẳng (Hồ Đại Lải, Hồ Lập Đinh, Hồ Đồng Đò, Sông Cà Lồ...)
 *   - Cây xanh (InstancedMesh trees)
 *   - Ghim địa điểm (POI pins), User marker, Home marker, Route dẫn đường, Landmark, Camera target
 *
 * Nguồn dữ liệu:
 *   - `public/geo/xuanhoa-dem.bin` & `public/geo/xuanhoa-dem-meta.json`
 *   - AWS Open Data Terrain Tiles / Mapzen Terrarium Z13 (SRTM GL1 30m & Copernicus DEM GLO-30)
 */

export interface XuanHoaWaterBodyElevation {
  waterIndex: number;
  name: string;
  areaSqm: number;
  relativeElevationM: number;
  aslElevationM: number;
}

export interface XuanHoaDemMeta {
  version: number;
  source: string;
  license: string;
  zoom: number;
  fetchedAt: string;
  grid: {
    minLng: number;
    maxLng: number;
    minLat: number;
    maxLat: number;
    cols: number;
    rows: number;
    stepLngDeg: number;
    stepLatDeg: number;
    stepMetersApprox: number;
    unit: string;
  };
  origin: {
    lng: number;
    lat: number;
    kx: number;
    ky: number;
    datumElevationAslM: number;
  };
  stats: {
    minRelativeElevationM: number;
    maxRelativeElevationM: number;
    minAslElevationM: number;
    maxAslElevationM: number;
  };
  waterBodyElevations: XuanHoaWaterBodyElevation[];
}

export interface XuanHoaDemData {
  meta: XuanHoaDemMeta;
  gridDm: Int16Array;
}

const DEFAULT_ORIGIN = {
  lng: 105.7262,
  lat: 21.2818,
  kx: 111320 * Math.cos((21.2818 * Math.PI) / 180),
  ky: 110574,
  datumElevationAslM: 28.6,
};

const DEFAULT_GRID = {
  minLng: 105.68,
  maxLng: 105.792,
  minLat: 21.26,
  maxLat: 21.42,
  cols: 280,
  rows: 400,
};

let activeDem: XuanHoaDemData | null = null;
let loadingPromise: Promise<XuanHoaDemData | null> | null = null;

/**
 * Khởi tạo bộ dữ liệu DEM từ ArrayBuffer và Metadata (dùng được ở cả Main Thread và Web Worker)
 */
export function initXuanHoaDemFromBuffer(buffer: ArrayBuffer, meta: XuanHoaDemMeta): XuanHoaDemData {
  const gridDm = new Int16Array(buffer);
  activeDem = { meta, gridDm };
  return activeDem;
}

/**
 * Tải bất đồng bộ DEM thực của Phường Xuân Hòa (idempotent, có cache singleton)
 */
export async function loadXuanHoaDem(baseUrl = '/'): Promise<XuanHoaDemData | null> {
  if (activeDem) return activeDem;
  if (loadingPromise) return loadingPromise;

  const prefix = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  loadingPromise = Promise.all([
    fetch(`${prefix}geo/xuanhoa-dem.bin`).then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status} khi tải xuanhoa-dem.bin`);
      return r.arrayBuffer();
    }),
    fetch(`${prefix}geo/xuanhoa-dem-meta.json`).then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status} khi tải xuanhoa-dem-meta.json`);
      return r.json() as Promise<XuanHoaDemMeta>;
    }),
  ])
    .then(([buf, meta]) => initXuanHoaDemFromBuffer(buf, meta))
    .catch((err) => {
      console.warn('[XuanHoaDEM] Không thể tải DEM binary, dùng mô hình địa hình dự phòng:', err);
      loadingPromise = null;
      return null;
    });

  return loadingPromise;
}

export function getLoadedXuanHoaDem(): XuanHoaDemData | null {
  return activeDem;
}

/**
 * Bổ sung chi tiết sống lưng micro-relief độ phân giải cao (sub-meter) cho cụm Đồi/Núi Thằn Lằn
 * khớp tuyệt đối với mô hình Di tích Bốt Pháp 1950 (Đỉnh Bắc 32.0m, Đỉnh Nam 28.5m) và nền DEM thực.
 */
function nuiThanLanExactHeightAtLngLat(lng: number, lat: number): number {
  const rx = (lng - 105.724444) * 103728.707;
  const rz = -(lat - 21.293889) * 110574.0;
  if (rx < -195 || rx > 165 || rz < -395 || rz > 235) return -1;

  const neDist = (rx - 84) * 0.68 + (-rz - 325) * 0.73;
  if (neDist > 0) return 0;
  const neFade = Math.min(1, Math.max(0, -neDist / 32));

  const lobes = [
    { cx: -57.6, cz: -276.4, h: 32.0, rx: 145, rz: 112, flatR: 17 },
    { cx: -10.0, cz: -168.0, h: 25.5, rx: 148, rz: 142, flatR: 12 },
    { cx: 0.0, cz: 0.0, h: 28.5, rx: 135, rz: 140, flatR: 14.5 },
    { cx: 14.0, cz: 118.0, h: 15.0, rx: 98, rz: 105, flatR: 0 },
  ];
  let sumP = 0;
  let maxL = 0;
  for (let i = 0; i < lobes.length; i++) {
    const l = lobes[i];
    const rawD = Math.hypot((rx - l.cx) / l.rx, (rz - l.cz) / l.rz);
    const flatD = l.flatR / Math.min(l.rx, l.rz);
    let u = 0;
    if (rawD <= flatD) {
      u = 1;
    } else {
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

/**
 * Nội suy song tuyến tính (bilinear interpolation) từ lưới DEM thực `xuanhoa-dem.bin`
 */
function sampleGridRelativeElevation(lng: number, lat: number): number {
  const g = activeDem?.meta.grid || DEFAULT_GRID;
  const u = Math.min(1, Math.max(0, (lng - g.minLng) / (g.maxLng - g.minLng))) * (g.cols - 1);
  const v = Math.min(1, Math.max(0, (lat - g.minLat) / (g.maxLat - g.minLat))) * (g.rows - 1);

  if (!activeDem) return 0;

  const c0 = Math.floor(u);
  const r0 = Math.floor(v);
  const c1 = Math.min(g.cols - 1, c0 + 1);
  const r1 = Math.min(g.rows - 1, r0 + 1);
  const fu = u - c0;
  const fv = v - r0;

  const grid = activeDem.gridDm;
  const cols = g.cols;
  const e00 = grid[r0 * cols + c0] * 0.1;
  const e10 = grid[r0 * cols + c1] * 0.1;
  const e01 = grid[r1 * cols + c0] * 0.1;
  const e11 = grid[r1 * cols + c1] * 0.1;

  return e00 * (1 - fu) * (1 - fv) + e10 * fu * (1 - fv) + e01 * (1 - fu) * fv + e11 * fu * fv;
}

/**
 * HÀM CHUẨN DUY NHẤT (Section G):
 * Trả về độ cao địa hình tương đối (m) tại tọa độ địa lý `(lng, lat)` so với mốc chuẩn Phường Xuân Hòa.
 */
export function getElevationAtLngLat(lng: number, lat: number): number {
  const ntl = nuiThanLanExactHeightAtLngLat(lng, lat);
  if (ntl >= 0) return ntl;
  return sampleGridRelativeElevation(lng, lat);
}

/**
 * Trả về độ cao địa hình tương đối (m) tại tọa độ cục bộ `(x, y)` (mét tính từ tâm ĐHSP Hà Nội 2).
 */
export function getElevationAtLocal(x: number, y: number): number {
  const origin = activeDem?.meta.origin || DEFAULT_ORIGIN;
  const lng = origin.lng + x / origin.kx;
  const lat = origin.lat + y / origin.ky;
  return getElevationAtLngLat(lng, lat);
}

/**
 * Trả về độ cao tuyệt đối so với mực nước biển (ASL - mét) tại `(lng, lat)`
 */
export function getAslElevationAtLngLat(lng: number, lat: number): number {
  const datum = activeDem?.meta.origin.datumElevationAslM ?? DEFAULT_ORIGIN.datumElevationAslM;
  return Number((getElevationAtLngLat(lng, lat) + datum).toFixed(2));
}

/**
 * Tính cao độ mặt nước phẳng (Section G) cho một đa giác hồ/ao/sông để mặt hồ không bao giờ bị nghiêng theo sườn đồi.
 */
export function getFlatWaterElevationForRingLocal(ring: [number, number][]): number {
  if (!ring.length) return 0;
  const samples: number[] = [];
  const step = Math.max(1, Math.floor(ring.length / 24));
  for (let i = 0; i < ring.length; i += step) {
    samples.push(getElevationAtLocal(ring[i][0], ring[i][1]));
  }
  samples.sort((a, b) => a - b);
  return samples[Math.floor(samples.length * 0.25)];
}
