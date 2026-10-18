import type { StyleSpecification } from 'maplibre-gl';
import type { MapAreaPreset, MapLayerVisibility } from './map-types';

/**
 * Bảng màu chuẩn PREMIUM CUTE PASTEL CITY MAP (Phần 5)
 */
export const XUHO_PASTEL_THEME = {
  uiBg: '#F8F5EE',
  mint: '#39B980',
  mintHover: '#2FA36E',
  mintSoft: '#E6F7EF',
  deepPurple: '#403064',
  deepPurpleSoft: '#5A4687',
  parkGreen: '#E5F0DF',
  campusCream: '#EAF4E2',
  resortMint: '#DDF2E8',
  waterPastel: '#AEE0F4',
  waterStroke: '#7AB8D4',
  roadMajorFill: '#FFE89E',
  roadMajorCasing: '#D9B45B',
  roadSecondaryFill: '#FFF4C8',
  roadSecondaryCasing: '#D8C58E',
  roadMinorFill: '#FFFFFF',
  roadMinorCasing: '#D5CEC0',
  roadAlleyFill: '#FAF7F0',
  buildingFill: '#E2DDD2',
  buildingShadow: '#C9C1B2',
  buildingStroke: '#BFB6A4',
  boundaryStroke: '#39B980',
  boundaryGlow: '#403064',
  textPrimary: '#2D2246',
  textSecondary: '#65587F',
} as const;

/**
 * Tọa độ trung tâm đã xác minh từ OpenStreetMap (Khu ĐHSP Hà Nội 2 / Nguyễn Văn Linh - Lê Quang Đạo)
 */
export const XUANHOA_DEFAULT_CENTER = {
  lat: 21.2818,
  lng: 105.7262,
  zoom: 15.3,
} as const;

/**
 * Tọa độ bao quát toàn bộ Phường Xuân Hòa mới (Relation 19542980)
 */
export const XUANHOA_WARD_OVERVIEW = {
  lat: 21.322,
  lng: 105.728,
  zoom: 12.3,
} as const;

/**
 * Giới hạn điều hướng hợp lý (cho phép xem toàn bộ Xuân Hòa mới + vùng lân cận Phúc Yên, Bình Xuyên, Sóc Sơn)
 */
export const XUANHOA_MAX_BOUNDS: [[number, number], [number, number]] = [
  [105.60, 21.20], // Southwest [lng, lat]
  [105.86, 21.45], // Northeast [lng, lat]
];

export const DEFAULT_LAYER_VISIBILITY: MapLayerVisibility = {
  baseGeography: true,
  buildings: true,
  waterAndParks: true,
  realPois: true,
  gameAssets: false,
  userLocation: true,
  wardBoundary: true,
};

/**
 * Các vùng nhảy nhanh dựa trên tọa độ thật từ OpenStreetMap
 */
export const MAP_AREA_PRESETS: MapAreaPreset[] = [
  {
    id: 'dhsp2',
    label: 'Khu ĐH Sư Phạm 2',
    sublabel: 'Giảng đường, KTX S1–S4 & Lê Quang Đạo',
    lat: 21.2812,
    lng: 105.7268,
    zoom: 15.8,
  },
  {
    id: 'nguyen-van-linh',
    label: 'Trục Nguyễn Văn Linh',
    sublabel: 'CĐ Cơ Điện, CĐ Việt-Xô & Phố Hòa Bình',
    lat: 21.2875,
    lng: 105.7192,
    zoom: 15.6,
  },
  {
    id: 'dong-xuan',
    label: 'Khu Đồng Xuân & BIDV',
    sublabel: 'Cầu Xuân Hòa, Lê Xoay & Trường Chinh',
    lat: 21.2788,
    lng: 105.7295,
    zoom: 15.6,
  },
  {
    id: 'dai-lai',
    label: 'Hồ Đại Lải & Flamingo',
    sublabel: 'Ngọc Thanh, Bán đảo & Sân Golf Đại Lải',
    lat: 21.3317,
    lng: 105.7155,
    zoom: 13.8,
  },
  {
    id: 'lap-dinh',
    label: 'Bắc Ngọc Thanh',
    sublabel: 'Hồ Lập Đinh & vùng sinh thái rừng núi',
    lat: 21.3273,
    lng: 105.7609,
    zoom: 13.5,
  },
  {
    id: 'overview',
    label: 'Toàn Phường Xuân Hòa',
    sublabel: 'Ranh giới Relation #19542980',
    lat: XUANHOA_WARD_OVERVIEW.lat,
    lng: XUANHOA_WARD_OVERVIEW.lng,
    zoom: XUANHOA_WARD_OVERVIEW.zoom,
  },
];

export const MAP_DATA_SOURCE_CONFIG = {
  primaryGeoJsonBasePath: `${(import.meta.env.BASE_URL || '/').replace(/\/$/, '')}/geo`,
  optionalVectorTileJsonUrl:
    (import.meta.env.VITE_MAP_TILEJSON_URL as string | undefined) ||
    'https://tiles.openfreemap.org/planet',
  glyphsUrl:
    (import.meta.env.VITE_MAP_GLYPHS_URL as string | undefined) ||
    'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
  nominatimEndpoint:
    (import.meta.env.VITE_NOMINATIM_URL as string | undefined) ||
    'https://nominatim.openstreetmap.org/search',
  attributionHtml:
    '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors (ODbL) · XUHO CITY Geo Layer',
  termsSummary:
    'Dữ liệu địa lý nền thuộc OpenStreetMap contributors theo giấy phép ODbL 1.0. Yêu cầu giữ nguyên ghi nhận nguồn (Attribution) khi hiển thị công khai và thương mại.',
};

/**
 * Xây dựng MapLibre GL Style sử dụng URL tuyệt đối (tránh lỗi Blob Web Worker không resolve được relative path)
 */
export function buildXuhoPastelMapStyle(_basePath = ''): StyleSpecification {
  return {
    version: 8,
    name: 'XUHO CITY — Premium Cute Pastel',
    sources: {},
    layers: [
      {
        id: 'xuho-bg',
        type: 'background',
        paint: {
          'background-color': XUHO_PASTEL_THEME.uiBg,
          'background-opacity': 0,
        },
      },
    ],
  };
}
