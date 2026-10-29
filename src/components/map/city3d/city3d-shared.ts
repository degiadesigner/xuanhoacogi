/**
 * Bảng màu & hằng số dùng chung cho Bản đồ 3D Xuân Hòa (worker + giao diện).
 * Thứ tự màu PHẢI khớp với scripts/build-3d-city.mjs (WALL / ROOF).
 */

export const CITY3D_DATA_URL = 'geo/xuanhoa-city3d.bin';
export const CITY3D_META_URL = 'geo/xuanhoa-city3d-meta.json';

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
  /** mỗi cây 5 số: x, z, scale, rotY, colorIdx */
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
  name: string;
  x: number;
  z: number;
  dx: number;
  dz: number;
  tier: 'major' | 'secondary' | 'minor' | 'alley';
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
