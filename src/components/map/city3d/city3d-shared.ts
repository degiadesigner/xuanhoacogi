/**
 * Bảng màu & hằng số dùng chung cho Bản đồ 3D Xuân Hòa (worker + giao diện).
 * Thứ tự màu PHẢI khớp với scripts/build-3d-city.mjs (WALL / ROOF).
 */

export const CITY3D_DATA_URL = 'geo/xuanhoa-city3d.bin';
export const CITY3D_META_URL = 'geo/xuanhoa-city3d-meta.json';
export const DEM_DATA_URL = 'geo/xuanhoa-dem.bin';
export const DEM_META_URL = 'geo/xuanhoa-dem-meta.json';

export {
  getAslElevationAtLngLat,
  getElevationAtLngLat,
  getElevationAtLocal,
  getFlatWaterElevationForRingLocal,
  initXuanHoaDemFromBuffer,
  loadXuanHoaDem,
  type XuanHoaDemData,
  type XuanHoaDemMeta,
} from '@/lib/map/xuanhoa-elevation';

/** Kích thước 1 ô (chunk) hình học — càng lớn càng ít draw call, càng nhỏ cắt bỏ ngoài khung hình càng hiệu quả */
export const CHUNK_SIZE = 700;

export const WALL_PALETTE = [
  '#E6DCC4', // 0 kem
  '#E2C47E', // 1 vàng
  '#EEEBE4', // 2 trắng
  '#C9C7C1', // 3 xám nhạt
  '#DDB8AC', // 4 hồng
  '#E5C29F', // 5 cam đào
  '#B9CCD8', // 6 xanh da trời
  '#C4D6BC', // 7 xanh bạc hà
  '#D5C6A8', // 8 be
  '#CD9E80', // 9 đất nung
];

export const ROOF_PALETTE = [
  '#A84632', // 0 ngói đỏ
  '#9C5B3E', // 1 ngói nâu cam
  '#46699A', // 2 tôn xanh dương
  '#4D7856', // 3 tôn xanh lá
  '#7F838A', // 4 xám
  '#4F535A', // 5 xám đen
  '#BDB9AF', // 6 sân thượng bê tông
  '#3D7775', // 7 xanh ngọc
];

export const TREE_PALETTE = ['#4C7C35', '#58843B', '#3F6C30', '#628D42', '#6B9447', '#4D7742', '#5C8234'];

export const LANDUSE_COLORS: Record<string, string> = {
  forest: '#6F8F55',
  wood: '#6F8F55',
  park: '#8DAA6A',
  garden: '#8DAA6A',
  grass: '#97B176',
  recreation_ground: '#8DAA6A',
  golf_course: '#88B46A',
  pitch: '#6FA55A',
  orchard: '#9DB273',
  farmland: '#B3B887',
  meadow: '#A2B97E',
  cemetery: '#A9B496',
  school: '#D2C8B2',
  university: '#D2C8B2',
  college: '#D2C8B2',
  kindergarten: '#D2C8B2',
  industrial: '#BFBAB0',
  quarry: '#B9AC92',
  residential: '',
};

export const CITY3D_COLORS = {
  sky: '#E4E9E8',
  ground: '#B5B39A',
  skirtTop: '#7C6A55',
  skirtBottom: '#463A2E',
  water: '#3F7F8C',
  waterEdge: '#2F6676',
  roadMajor: '#34373E',
  roadSecondary: '#3E424B',
  roadMinor: '#646A75',
  roadService: '#4A4E58',
  roadTrack: '#6B707A',
  roadPath: '#767B85',
  roadCasing: '#C8C3B6',
  roadMarking: '#ECE8DC',
  trunk: '#5E4630',
};

export interface City3DOrigin {
  lng: number;
  lat: number;
  kx: number;
  ky: number;
}

export const lngLatToLocal = (o: City3DOrigin, lng: number, lat: number): [number, number] => [
  (lng - o.lng) * o.kx,
  (lat - o.lat) * o.ky,
];

export const localToLngLat = (o: City3DOrigin, x: number, y: number): [number, number] => [
  o.lng + x / o.kx,
  o.lat + y / o.ky,
];

/**
 * Tọa độ tâm chuẩn của Đỉnh Nam Đồi Thằn Lằn (Núi Thằn Lằn: 21.293889, 105.724444)
 * Hệ quy chiếu nội bộ (rx, rz) tính bằng mét so với tâm này:
 * - Đỉnh Nam (Đài Vọng Cảnh Núi Thằn Lằn): rx = 0, rz = 0 (cao 28.5m)
 * - Đỉnh Bắc (Di tích Lịch sử Bốt Pháp 1950): rx = -57.6, rz = -276.4 (cao 32.0m)
 * - Ngã ba sống đồi (cuối đường nhựa gmaps/way_2528): rx = -12.4, rz = -153.9 (cao ~25.5m)
 */
export const LIZARD_HILL_ANCHOR = {
  lng: 105.724444,
  lat: 21.293889,
  kx: 103728.707,
  ky: 110574.0,
};

/**
 * Tính chiều cao địa hình 3D (mét) của Đồi Thằn Lằn tại tọa độ mét cục bộ (rx, rz) so với LIZARD_HILL_ANCHOR.
 * Thiết kế chuẩn theo bản đồ thực tế:
 * - Dáng đồi thon dài hướng Bắc Tây Bắc – Nam Đông Nam như hình con thằn lằn.
 * - Cắt vát tự nhiên ở ranh giới Đông Bắc để đường dân sinh (way_2276) và nhà dân xung quanh nằm phẳng ở y = 0.
 * - Đường lên đồi (way_2528) bắt đầu từ chân đồi (y = 0) tại [79.7, -323.3] và leo dốc mượt lên sống đồi [-12.4, -153.9].
 */
export function getLizardHillLocalHeight(rx: number, rz: number): number {
  if (rx < -195 || rx > 165 || rz < -395 || rz > 235) return 0;

  // Mặt cắt chéo phía Đông Bắc bảo vệ đường dân sinh way_2276 và khu dân cư lân cận ở độ cao 0m
  const neDist = (rx - 84) * 0.68 + (-rz - 325) * 0.73;
  if (neDist > 0) return 0;
  const neFade = Math.min(1, Math.max(0, -neDist / 32));

  const lobes = [
    // 1. Đỉnh Bắc (Đầu Thằn Lằn — Khu Di tích Bốt Pháp): mặt bằng đỉnh phẳng r = 17m ở độ cao 32.0m
    { cx: -57.6, cz: -276.4, h: 32.0, rx: 145, rz: 112, flatR: 17 },
    // 2. Sống lưng giữa đồi (Nơi đường nhựa way_2528 leo tới yên ngựa chia nhánh): cao 25.5m
    { cx: -10.0, cz: -168.0, h: 25.5, rx: 148, rz: 142, flatR: 12 },
    // 3. Đỉnh Nam (Lưng Thằn Lằn — Điểm ngắm toàn cảnh Xuân Hòa): mặt bằng phẳng r = 14.5m ở độ cao 28.5m
    { cx: 0.0, cz: 0.0, h: 28.5, rx: 135, rz: 140, flatR: 14.5 },
    // 4. Đuôi Thằn Lằn thoải dần về phía Nam (hướng về ĐHSP Hà Nội 2 & CĐ Việt-Xô): cao 15.0m
    { cx: 14.0, cz: 118.0, h: 15.0, rx: 98, rz: 105, flatR: 0 },
  ];

  let sumP = 0;
  let maxL = 0;
  for (let i = 0; i < lobes.length; i++) {
    const l = lobes[i];
    const dx = rx - l.cx;
    const dz = rz - l.cz;
    const rawD = Math.hypot(dx / l.rx, dz / l.rz);
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
 * Tính chiều cao mặt Đồi Thằn Lằn (mét) trực tiếp từ tọa độ (lng, lat)
 */
export function getLizardHillElevationAtLngLat(lng: number, lat: number): number {
  const rx = (lng - LIZARD_HILL_ANCHOR.lng) * LIZARD_HILL_ANCHOR.kx;
  const rz = -(lat - LIZARD_HILL_ANCHOR.lat) * LIZARD_HILL_ANCHOR.ky;
  return getLizardHillLocalHeight(rx, rz);
}

/**
 * Kiểm tra xem một tọa độ (lng, lat) có nằm trong vùng dọn mặt bằng của Đồi Thằn Lằn
 * (để loại bỏ các khối hộp nhà giả lập bị nhận diện nhầm từ bóng cây trên đồi)
 */
export function isInsideLizardHillClearZone(lng: number, lat: number): boolean {
  if (getLizardHillElevationAtLngLat(lng, lat) > 0.25) return true;
  // Quét sạch thêm 3 khối hộp nhiễu vệ tinh ở chân đồi phía Nam (21.2915..21.2920)
  const rx = (lng - LIZARD_HILL_ANCHOR.lng) * LIZARD_HILL_ANCHOR.kx;
  const rz = -(lat - LIZARD_HILL_ANCHOR.lat) * LIZARD_HILL_ANCHOR.ky;
  if (rx >= -95 && rx <= 195 && rz >= 180 && rz <= 270) return true;
  return false;
}

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const v = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

/* ---------------- Thông điệp giữa Worker <-> giao diện ---------------- */

export interface MeshBuffers {
  positions: Float32Array;
  colors: Uint8Array;
  indices: Uint32Array;
}

export interface BuildingChunk extends MeshBuffers {
  key: string;
  /** tâm & bán kính bao để camera cắt bỏ nhanh */
  center: [number, number, number];
  radius: number;
}

export interface TreeChunk {
  key: string;
  /** mỗi cây 6 số: x, y, z, scale, rotY, colorIdx */
  broadleaf: Float32Array;
  conifer: Float32Array;
}

export interface BuildingLabel {
  x: number;
  z: number;
  y: number;
  name: string;
}

export interface RoadLabel3D {
  roadId?: string;
  name: string;
  parentRoad?: string;
  source?: string;
  confidence?: number;
  x: number;
  z: number;
  y?: number;
  dx: number;
  dz: number;
  tier: 'major' | 'secondary' | 'minor' | 'alley';
}

/**
 * Chuyển đổi đồng bộ mức Zoom 2D (MapLibre) <-> Khoảng cách Camera 3D (mét) (Section L)
 */
export function zoom2DToDistance3D(zoom: number): number {
  const clamped = Math.max(11.5, Math.min(19.5, zoom));
  return Math.round(Math.max(65, Math.min(7500, 620 * Math.pow(2, 15.35 - clamped))));
}

export function distance3DToZoom2D(distance: number): number {
  const clamped = Math.max(65, Math.min(7500, distance));
  const zoom = 15.35 - Math.log2(clamped / 620);
  return Number(Math.max(12.0, Math.min(19.0, zoom)).toFixed(2));
}

export interface LiveBuildingInput {
  wayId: number;
  ring: [number, number][]; // [lng, lat]
  tags: Record<string, string>;
}

export type WorkerInMessage =
  | { type: 'init'; baseUrl: string }
  | {
      type: 'live';
      requestId: number;
      buildings: LiveBuildingInput[];
      trees: [number, number][];
    };

export type WorkerOutMessage =
  | { type: 'progress'; label: string; pct: number }
  | { type: 'origin'; origin: City3DOrigin; wardBox: [number, number, number, number] }
  | {
      type: 'base';
      ground: MeshBuffers;
      skirt: MeshBuffers;
      landuse: MeshBuffers;
      water: MeshBuffers;
      roads: MeshBuffers;
      markings: MeshBuffers;
    }
  | { type: 'buildings'; chunks: BuildingChunk[]; replace?: boolean }
  | { type: 'trees'; chunks: TreeChunk[] }
  | { type: 'labels'; labels: BuildingLabel[]; roadLabels?: RoadLabel3D[] }
  | {
      type: 'ready';
      stats: { buildings: number; trees: number; osmBuildings: number; openBuildings: number };
    }
  | {
      type: 'liveDone';
      requestId: number;
      updated: number;
      added: number;
      withRealHeight: number;
      trees: number;
    }
  | { type: 'error'; message: string };
