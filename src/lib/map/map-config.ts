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
 * Giới hạn điều hướng hợp lý (cho phép xem toàn bộ Xuân Hòa mới + Phúc Yên, Bình Xuyên, Sóc Sơn, Mê Linh)
 */
export const XUANHOA_MAX_BOUNDS: [[number, number], [number, number]] = [
  [105.45, 21.05], // Southwest [lng, lat]
  [105.98, 21.52], // Northeast [lng, lat]
];

export const DEFAULT_LAYER_VISIBILITY: MapLayerVisibility = {
  baseGeography: true,
  buildings: true,
  waterAndParks: true,
  realPois: true,
  gameAssets: false,
  userLocation: true,
  wardBoundary: true,
  decorativeZones: false,
};

/**
 * Các vùng nhảy nhanh dựa trên tọa độ thật từ OpenStreetMap
 */
export const MAP_AREA_PRESETS: MapAreaPreset[] = [
  {
    id: 'dhsp2',
    label: '🎓 Khu ĐH Sư Phạm 2',
    sublabel: 'Hội trường 14-8, Giảng đường A–E & Tòa A1–A4',
    lat: 21.2806,
    lng: 105.7274,
    zoom: 16.4,
  },
  {
    id: 'nui-than-lan',
    label: '⛰️ Núi Thằn Lằn & Di tích Bốt Pháp',
    sublabel: 'Đỉnh đồi Thằn Lằn, Bốt Pháp cổ 1950 & Chùa Xuân Hòa',
    lat: 21.2948,
    lng: 105.7242,
    zoom: 15.8,
  },
  {
    id: 'ktx-sp2',
    label: '🏢 Khu KTX S1–S4 & THPT Xuân Hòa',
    sublabel: 'Võ Thị Sáu, Cây xăng Xuân Hòa & Nhà thể chất',
    lat: 21.2837,
    lng: 105.7226,
    zoom: 16.2,
  },
  {
    id: 'nguyen-van-linh',
    label: '🏫 Trục Nguyễn Văn Linh',
    sublabel: 'CĐ Cơ Điện, CĐ Việt-Xô số 1 & Phố Cù Chính Lan',
    lat: 21.2885,
    lng: 105.7195,
    zoom: 15.8,
  },
  {
    id: 'kdt-xuan-hoa',
    label: '🏙️ KĐT Mới Tây Xuân Hòa & Lê Quang Đạo',
    sublabel: 'KĐT Tây Lê Quang Đạo, KĐT Hồ Điều Hòa & Phố Nhà Chung',
    lat: 21.2788,
    lng: 105.7208,
    zoom: 16.0,
  },
  {
    id: 'kdt-nam-xuan-hoa',
    label: '🏘️ KĐT Ven Sông Cà Lồ & Nam Xuân Hòa',
    sublabel: 'KĐT Sinh thái Ven Sông, KĐT Phân lô Nam Lê Quang Đạo & Trường Chinh',
    lat: 21.2725,
    lng: 105.7262,
    zoom: 15.9,
  },
  {
    id: 'dong-xuan',
    label: '🌉 Khu Đồng Xuân & Cầu Xuân Hòa',
    sublabel: 'Chợ Xuân Hòa, BIDV, Đình Đồng Xuân & Cây xăng Trường Chinh',
    lat: 21.2788,
    lng: 105.7305,
    zoom: 16.0,
  },
  {
    id: 'cao-minh',
    label: '⛩️ Khu Cao Minh (Đình Cao Quang & Hiển Lễ)',
    sublabel: 'Di tích Quốc gia Đình Cao Quang, Đình cổ Hiển Lễ 300 năm',
    lat: 21.2682,
    lng: 105.7132,
    zoom: 15.4,
  },
  {
    id: 'dai-lai',
    label: '🦢 Hồ Đại Lải & Flamingo Resort',
    sublabel: 'Bán đảo Flamingo, Đảo Ngọc, Sân Golf & Cây xăng PVOIL',
    lat: 21.3317,
    lng: 105.7185,
    zoom: 14.2,
  },
  {
    id: 'thanh-xuan-valley',
    label: '🌲 Thung Lũng Thanh Xuân & Chiến Khu Ngọc Thanh',
    sublabel: 'Thanh Xuân Valley, Hồ Lập Đinh & Di tích Chiến khu Ngọc Thanh',
    lat: 21.3312,
    lng: 105.7665,
    zoom: 14.2,
  },
  {
    id: 'overview',
    label: '🗺️ Toàn Cảnh Phường Xuân Hòa Mới',
    sublabel: 'Gộp 4 xã/phường (Xuân Hòa, Đồng Xuân, Cao Minh, Ngọc Thanh)',
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
