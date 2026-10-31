/**
 * XUAN HÒA DIGITAL TWIN — UNIFIED MASTER GEO DATASET RUNTIME (GIAI ĐOẠN 1)
 * ============================================================================
 * Đọc và chia sẻ CÙNG MỘT NGUỒN DỮ LIỆU GỐC (Master Buildings + Spatial Chunks +
 * Contextual Zones + Height Source + POI/Label LOD) cho cả Bản đồ 2D (`DigitalMapView`)
 * và Bản đồ 3D (`City3DView`).
 *
 * Tuyệt đối không để 2D chỉ đọc `xuanhoa-buildings.geojson` (2.6k nhà) trong khi 3D đọc
 * `xuanhoa-city3d.bin` (21.4k nhà). Cả 2D và 3D đều dùng chung bộ 21.436 công trình Master này.
 */

import { getElevationAtLngLat, loadXuanHoaDem } from './xuanhoa-elevation';

export type MasterHeightSource =
  | 'osm_height'
  | 'osm_levels'
  | 'inferred_high'
  | 'inferred_medium'
  | 'inferred_low';

export type MasterContextualZone =
  | 'trung-tam-xuan-hoa'
  | 'dong-xuan'
  | 'cao-minh'
  | 'ngoc-thanh'
  | 'dai-lai-sinh-thai'
  | 'campus-truong-hoc'
  | 'hanh-chinh'
  | 'khu-dan-cu'
  | 'cong-nghiep'
  | 'nong-nghiep-rung';

export type BuildingLodTier = 'far' | 'mid' | 'near';

export interface MasterBuildingRecord {
  idx: number;
  id: string;
  source: 'osm' | 'google' | 'microsoft';
  osmWayId?: number;
  name?: string;
  buildingType: string;
  levels: number;
  height: number;
  heightSource: MasterHeightSource;
  zone: MasterContextualZone;
  derivedZone: true;
  roofShape: 'flat' | 'gable' | 'hip';
  wallColorIdx: number;
  roofColorIdx: number;
  topBox: boolean;
  confidence: number;
  baseElevationM: number;
  areaSqm: number;
  centroidLngLat: [number, number];
  centroidLocal: [number, number];
  bboxLngLat: [number, number, number, number];
  bboxLocal: [number, number, number, number];
  ringLocal: [number, number][];
  ringLngLat: [number, number][];
  lodTier: BuildingLodTier;
}

export interface MasterBuildingChunk {
  key: string;
  cx: number;
  cy: number;
  bboxLngLat: [number, number, number, number];
  farBuildings: MasterBuildingRecord[];
  midBuildings: MasterBuildingRecord[];
  nearBuildings: MasterBuildingRecord[];
  allBuildings: MasterBuildingRecord[];
}

export interface XuanHoaMasterDataset {
  version: string;
  generatedAt: string;
  origin: { lng: number; lat: number; kx: number; ky: number; datumElevationAslM: number };
  buildings: MasterBuildingRecord[];
  buildingById: Map<string, MasterBuildingRecord>;
  chunks: Map<string, MasterBuildingChunk>;
  chunkSizeMeters: number;
  rawCityBin: ArrayBuffer;
  rawCityMeta: Record<string, unknown>;
}

export const CONTEXTUAL_ZONE_LABELS: Record<MasterContextualZone, string> = {
  'trung-tam-xuan-hoa': 'Trung tâm Xuân Hòa (Đô thị lõi)',
  'dong-xuan': 'Khu vực Đồng Xuân',
  'cao-minh': 'Khu vực Cao Minh',
  'ngoc-thanh': 'Khu vực Ngọc Thanh',
  'dai-lai-sinh-thai': 'Hồ Đại Lải & Khu sinh thái',
  'campus-truong-hoc': 'Cụm Đại học / Trường học (Campus)',
  'hanh-chinh': 'Trung tâm Hành chính - Công cộng',
  'khu-dan-cu': 'Khu dân cư hiện hữu',
  'cong-nghiep': 'Cụm sản xuất / Công nghiệp',
  'nong-nghiep-rung': 'Nông nghiệp & Lâm nghiệp / Đồi rừng',
};

export const HEIGHT_SOURCE_LABELS: Record<MasterHeightSource, string> = {
  osm_height: 'Chiều cao thực từ OSM (osm_height)',
  osm_levels: 'Số tầng thực từ OSM (osm_levels)',
  inferred_high: 'Độ tin cậy cao — Công trình định danh / Cơ quan / Trường học (inferred_high)',
  inferred_medium: 'Độ tin cậy trung bình — Suy luận theo trục đường & phân vùng (inferred_medium)',
  inferred_low: 'Suy luận hình học tất định từ diện tích & mật độ (inferred_low)',
};

// Bảng màu 2D đồng bộ với bảng màu 3D (`city3d-materials.ts`)
export const MASTER_WALL_HEX_2D = [
  '#f2e5cf', // cream
  '#f0dc9c', // yellow
  '#f3f1ec', // white
  '#d7dce0', // gray
  '#efd4d4', // pink
  '#f1d8c2', // peach
  '#d3e2ef', // blue
  '#d3e8dc', // mint
  '#e7dcc8', // beige
  '#e3b89c', // terracotta
];

export const MASTER_ROOF_HEX_2D = [
  '#c96a56', // red
  '#cb7b55', // terracotta
  '#5d84a6', // blue
  '#5e8f72', // green
  '#8c949b', // gray
  '#6f7882', // slate
  '#b8b4aa', // concrete
  '#588c8d', // teal
];

let cachedMasterDataset: XuanHoaMasterDataset | null = null;
let loadingMasterPromise: Promise<XuanHoaMasterDataset> | null = null;

function signedAreaLocal(ring: [number, number][]): number {
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    a += (ring[j][0] - ring[i][0]) * (ring[j][1] + ring[i][1]);
  }
  return Math.abs(a * 0.5);
}

function pointInRingLngLat(lng: number, lat: number, ring: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1];
    const xj = ring[j][0], yj = ring[j][1];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi || 1e-12) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/**
 * Tải và giải mã bộ dữ liệu Master (`xuanhoa-city3d.bin` + `xuanhoa-city3d-meta.json`)
 * dùng chung cho cả 2D và 3D.
 */
export async function loadXuanHoaMasterDataset(baseUrl = '/'): Promise<XuanHoaMasterDataset> {
  if (cachedMasterDataset) return cachedMasterDataset;
  if (loadingMasterPromise) return loadingMasterPromise;

  const prefix = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  loadingMasterPromise = Promise.all([
    fetch(`${prefix}geo/xuanhoa-city3d.bin`).then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status} khi tải xuanhoa-city3d.bin`);
      return r.arrayBuffer();
    }),
    fetch(`${prefix}geo/xuanhoa-city3d-meta.json`).then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status} khi tải xuanhoa-city3d-meta.json`);
      return r.json();
    }),
    loadXuanHoaDem(baseUrl),
  ]).then(([bin, meta]) => {
    const dv = new DataView(bin);
    let o = 0;
    const magic = dv.getUint32(o, true);
    o += 4;
    if (magic !== 0x44334858) {
      throw new Error('Định dạng xuanhoa-city3d.bin không hợp lệ');
    }
    o += 4; // version
    const lng0 = dv.getFloat64(o, true);
    o += 8;
    const lat0 = dv.getFloat64(o, true);
    o += 8;
    const kx = 111320 * Math.cos((lat0 * Math.PI) / 180);
    const ky = 110574;
    const nB = dv.getUint32(o, true);
    o += 4;
    o += 4; // nT

    const osmWayByIdx = new Map<number, number>(meta.osm || []);
    const nameByIdx = new Map<number, string>(meta.names || []);
    const zoneCodes: MasterContextualZone[] = meta.zoneCodes || [
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
    const heightSourceCodes: MasterHeightSource[] = meta.heightSourceCodes || [
      'osm_height',
      'osm_levels',
      'inferred_high',
      'inferred_medium',
      'inferred_low',
    ];
    const sourceCodes: ('osm' | 'google' | 'microsoft')[] = meta.sourceCodes || ['osm', 'google', 'microsoft'];

    const buildingZones: number[] = meta.buildingZones || [];
    const buildingHeightSources: number[] = meta.buildingHeightSources || [];
    const buildingLevels: number[] = meta.buildingLevels || [];
    const buildingElevationsDm: number[] = meta.buildingElevationsDm || [];
    const buildingConfidences: number[] = meta.buildingConfidences || [];
    const buildingSources: number[] = meta.buildingSources || [];

    const chunkSizeMeters = 350;
    const chunks = new Map<string, MasterBuildingChunk>();
    const buildings: MasterBuildingRecord[] = new Array(nB);
    const buildingById = new Map<string, MasterBuildingRecord>();

    for (let idx = 0; idx < nB; idx++) {
      const nPts = dv.getUint8(o++);
      const height = dv.getUint8(o++) * 0.5;
      const wallColorIdx = dv.getUint8(o++);
      const roofByte = dv.getUint8(o++);
      const flags = dv.getUint8(o++);
      const roofKindNum = roofByte & 3;
      const roofColorIdx = roofByte >> 2;
      const isOsm = (flags & 1) !== 0;
      const topBox = (flags & 4) !== 0;

      let px = dv.getInt32(o, true);
      o += 4;
      let py = dv.getInt32(o, true);
      o += 4;

      const ringLocal: [number, number][] = [[px * 0.1, py * 0.1]];
      const ringLngLat: [number, number][] = [[lng0 + (px * 0.1) / kx, lat0 + (py * 0.1) / ky]];

      let minX = px * 0.1, maxX = px * 0.1, minY = py * 0.1, maxY = py * 0.1;
      let sumX = px * 0.1, sumY = py * 0.1;

      for (let j = 1; j < nPts; j++) {
        px += dv.getInt16(o, true);
        o += 2;
        py += dv.getInt16(o, true);
        o += 2;
        const lx = px * 0.1;
        const ly = py * 0.1;
        ringLocal.push([lx, ly]);
        ringLngLat.push([lng0 + lx / kx, lat0 + ly / ky]);
        if (lx < minX) minX = lx;
        if (lx > maxX) maxX = lx;
        if (ly < minY) minY = ly;
        if (ly > maxY) maxY = ly;
        sumX += lx;
        sumY += ly;
      }

      const cx = sumX / nPts;
      const cy = sumY / nPts;
      const cLng = lng0 + cx / kx;
      const cLat = lat0 + cy / ky;
      const minLng = lng0 + minX / kx;
      const maxLng = lng0 + maxX / kx;
      const minLat = lat0 + minY / ky;
      const maxLat = lat0 + maxY / ky;

      const wayId = osmWayByIdx.get(idx);
      const name = nameByIdx.get(idx);
      const id = isOsm && wayId ? `osm_way_${wayId}` : `ob_xh_${idx}`;
      const source = sourceCodes[buildingSources[idx] ?? (isOsm ? 0 : 1)] || (isOsm ? 'osm' : 'google');
      const zone = zoneCodes[buildingZones[idx] ?? 7] || 'khu-dan-cu';
      const heightSource = heightSourceCodes[buildingHeightSources[idx] ?? 3] || 'inferred_medium';
      const levels = buildingLevels[idx] || Math.max(1, Math.round(height / 3.4));
      const baseElevationM =
        buildingElevationsDm[idx] !== undefined
          ? Number((buildingElevationsDm[idx] * 0.1).toFixed(2))
          : Number(getElevationAtLngLat(cLng, cLat).toFixed(2));
      const confidence =
        buildingConfidences[idx] !== undefined ? Number((buildingConfidences[idx] * 0.01).toFixed(2)) : isOsm ? 1 : 0.8;
      const areaSqm = Number(signedAreaLocal(ringLocal).toFixed(1));

      const buildingType =
        zone === 'hanh-chinh' && name
          ? 'civic'
          : zone === 'campus-truong-hoc' && (name || areaSqm > 260)
            ? 'education'
            : zone === 'cong-nghiep' || areaSqm > 1200
              ? 'industrial'
              : zone === 'dai-lai-sinh-thai' && areaSqm >= 95
                ? 'villa'
                : levels >= 5
                  ? 'highrise'
                  : 'residential';

      const lodTier: BuildingLodTier =
        name || areaSqm >= 420 || levels >= 5
          ? 'far'
          : isOsm || areaSqm >= 75 || levels >= 3
            ? 'mid'
            : 'near';

      const record: MasterBuildingRecord = {
        idx,
        id,
        source,
        osmWayId: wayId,
        name,
        buildingType,
        levels,
        height,
        heightSource,
        zone,
        derivedZone: true,
        roofShape: roofKindNum === 1 ? 'gable' : roofKindNum === 2 ? 'hip' : 'flat',
        wallColorIdx,
        roofColorIdx,
        topBox,
        confidence,
        baseElevationM,
        areaSqm,
        centroidLngLat: [cLng, cLat],
        centroidLocal: [cx, cy],
        bboxLngLat: [minLng, minLat, maxLng, maxLat],
        bboxLocal: [minX, minY, maxX, maxY],
        ringLocal,
        ringLngLat,
        lodTier,
      };

      buildings[idx] = record;
      buildingById.set(id, record);

      const ix = Math.floor(cx / chunkSizeMeters);
      const iy = Math.floor(cy / chunkSizeMeters);
      const cKey = `${ix}_${iy}`;
      let chunk = chunks.get(cKey);
      if (!chunk) {
        chunk = {
          key: cKey,
          cx: ix,
          cy: iy,
          bboxLngLat: [minLng, minLat, maxLng, maxLat],
          farBuildings: [],
          midBuildings: [],
          nearBuildings: [],
          allBuildings: [],
        };
        chunks.set(cKey, chunk);
      } else {
        if (minLng < chunk.bboxLngLat[0]) chunk.bboxLngLat[0] = minLng;
        if (minLat < chunk.bboxLngLat[1]) chunk.bboxLngLat[1] = minLat;
        if (maxLng > chunk.bboxLngLat[2]) chunk.bboxLngLat[2] = maxLng;
        if (maxLat > chunk.bboxLngLat[3]) chunk.bboxLngLat[3] = maxLat;
      }
      chunk.allBuildings.push(record);
      if (lodTier === 'far') chunk.farBuildings.push(record);
      else if (lodTier === 'mid') chunk.midBuildings.push(record);
      else chunk.nearBuildings.push(record);
    }

    cachedMasterDataset = {
      version: '2.0.0-digital-twin-phase1',
      generatedAt: meta.generatedAt || new Date().toISOString(),
      origin: {
        lng: lng0,
        lat: lat0,
        kx,
        ky,
        datumElevationAslM: meta.origin?.datumElevationAslM ?? 28.6,
      },
      buildings,
      buildingById,
      chunks,
      chunkSizeMeters,
      rawCityBin: bin,
      rawCityMeta: meta,
    };

    return cachedMasterDataset;
  });

  return loadingMasterPromise;
}

export function getLoadedMasterDataset(): XuanHoaMasterDataset | null {
  return cachedMasterDataset;
}

/**
 * Truy vấn nhanh danh sách công trình Master nằm trong Viewport 2D theo 3 tầng LOD (Section C.4 & C.5):
 * - Zoom xa (< 13.7): chỉ hiển thị các công trình tiêu biểu / khối lớn (`lodTier === 'far'`)
 * - Zoom trung (13.7 .. 15.05): hiển thị công trình `far` + `mid` (OSM / tòa nhà lớn / trục chính)
 * - Zoom gần (>= 15.05): hiển thị đầy đủ 100% footprint thật trong viewport (`far` + `mid` + `near`)
 */
export function queryMasterBuildingsInViewport(
  dataset: XuanHoaMasterDataset,
  bounds: { west: number; south: number; east: number; north: number },
  zoom: number
): MasterBuildingRecord[] {
  if (zoom < 12.6) return [];

  const { origin, chunkSizeMeters, chunks } = dataset;
  const minX = (bounds.west - origin.lng) * origin.kx;
  const maxX = (bounds.east - origin.lng) * origin.kx;
  const minY = (bounds.south - origin.lat) * origin.ky;
  const maxY = (bounds.north - origin.lat) * origin.ky;

  const ix0 = Math.floor(minX / chunkSizeMeters) - 1;
  const ix1 = Math.floor(maxX / chunkSizeMeters) + 1;
  const iy0 = Math.floor(minY / chunkSizeMeters) - 1;
  const iy1 = Math.floor(maxY / chunkSizeMeters) + 1;

  const result: MasterBuildingRecord[] = [];
  const includeMid = zoom >= 13.75;
  const includeNear = zoom >= 15.0;

  for (let ix = ix0; ix <= ix1; ix++) {
    for (let iy = iy0; iy <= iy1; iy++) {
      const chunk = chunks.get(`${ix}_${iy}`);
      if (!chunk) continue;
      const cb = chunk.bboxLngLat;
      if (cb[2] < bounds.west || cb[0] > bounds.east || cb[3] < bounds.south || cb[1] > bounds.north) {
        continue;
      }

      if (includeNear) {
        for (let i = 0; i < chunk.allBuildings.length; i++) {
          const b = chunk.allBuildings[i];
          const bb = b.bboxLngLat;
          if (bb[2] >= bounds.west && bb[0] <= bounds.east && bb[3] >= bounds.south && bb[1] <= bounds.north) {
            result.push(b);
          }
        }
      } else {
        for (let i = 0; i < chunk.farBuildings.length; i++) {
          const b = chunk.farBuildings[i];
          const bb = b.bboxLngLat;
          if (bb[2] >= bounds.west && bb[0] <= bounds.east && bb[3] >= bounds.south && bb[1] <= bounds.north) {
            result.push(b);
          }
        }
        if (includeMid) {
          for (let i = 0; i < chunk.midBuildings.length; i++) {
            const b = chunk.midBuildings[i];
            const bb = b.bboxLngLat;
            if (bb[2] >= bounds.west && bb[0] <= bounds.east && bb[3] >= bounds.south && bb[1] <= bounds.north) {
              result.push(b);
            }
          }
        }
      }
    }
  }

  return result;
}

/**
 * Tìm công trình Master tại tọa độ click `(lng, lat)` trên cả 2D và 3D (Section L):
 * Kiểm tra chính xác point-in-polygon trên footprint thật, hoặc công trình có tâm gần nhất trong bán kính `maxFallbackMeters`.
 */
export function findMasterBuildingAtLngLat(
  dataset: XuanHoaMasterDataset | null,
  lng: number,
  lat: number,
  maxFallbackMeters = 14
): MasterBuildingRecord | null {
  if (!dataset) return null;
  const { origin, chunkSizeMeters, chunks } = dataset;
  const lx = (lng - origin.lng) * origin.kx;
  const ly = (lat - origin.lat) * origin.ky;
  const ix0 = Math.floor(lx / chunkSizeMeters);
  const iy0 = Math.floor(ly / chunkSizeMeters);

  let bestFallback: MasterBuildingRecord | null = null;
  let bestDistSq = maxFallbackMeters * maxFallbackMeters;

  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      const chunk = chunks.get(`${ix0 + dx}_${iy0 + dy}`);
      if (!chunk) continue;
      for (let i = 0; i < chunk.allBuildings.length; i++) {
        const b = chunk.allBuildings[i];
        const bb = b.bboxLngLat;
        if (lng >= bb[0] && lng <= bb[2] && lat >= bb[1] && lat <= bb[3]) {
          if (pointInRingLngLat(lng, lat, b.ringLngLat)) {
            return b;
          }
        }
        const dSq = (b.centroidLocal[0] - lx) ** 2 + (b.centroidLocal[1] - ly) ** 2;
        if (dSq < bestDistSq) {
          bestDistSq = dSq;
          bestFallback = b;
        }
      }
    }
  }

  return bestFallback;
}
