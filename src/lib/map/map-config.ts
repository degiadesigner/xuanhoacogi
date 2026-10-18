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
  campusCream: '#F3EFE2',
  resortMint: '#DDF2E8',
  waterPastel: '#BCE3F2',
  waterStroke: '#8EC5DC',
  roadMajorFill: '#FFF5D6',
  roadMajorCasing: '#E2C992',
  roadSecondaryFill: '#FFFDF7',
  roadSecondaryCasing: '#DED6C6',
  roadMinorFill: '#FFFFFF',
  roadMinorCasing: '#E6E0D3',
  roadAlleyFill: '#FAF7F0',
  buildingFill: '#EAE3D5',
  buildingShadow: '#D8CFC0',
  buildingStroke: '#CFC5B3',
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
  zoom: 15.2,
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
  gameAssets: false, // Tắt mặc định trong MVP hoặc bật theo công tắc rõ ràng (Phần 9)
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
    zoom: 15.5,
  },
  {
    id: 'dong-xuan',
    label: 'Khu Đồng Xuân & BIDV',
    sublabel: 'Cầu Xuân Hòa, Lê Xoay & Trường Chinh',
    lat: 21.2788,
    lng: 105.7295,
    zoom: 15.5,
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

/**
 * Cấu hình nguồn dữ liệu bản đồ và điều khoản sử dụng (Phần 3.1 & Phần 8)
 */
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
 * Xây dựng MapLibre GL Style chuẩn Premium Cute Pastel từ nguồn dữ liệu địa lý thật
 */
export function buildXuhoPastelMapStyle(basePath = ''): StyleSpecification {
  const cleanBase = basePath.replace(/\/$/, '');
  const geoPath = `${cleanBase}/geo`;

  return {
    version: 8,
    name: 'XUHO CITY — Premium Cute Pastel',
    glyphs: MAP_DATA_SOURCE_CONFIG.glyphsUrl,
    sources: {
      'openfreemap-planet': {
        type: 'vector',
        url: MAP_DATA_SOURCE_CONFIG.optionalVectorTileJsonUrl,
      },
      'xuanhoa-boundary': {
        type: 'geojson',
        data: `${geoPath}/xuanhoa-boundary.geojson`,
      },
      'xuanhoa-landuse': {
        type: 'geojson',
        data: `${geoPath}/xuanhoa-landuse.geojson`,
      },
      'xuanhoa-water': {
        type: 'geojson',
        data: `${geoPath}/xuanhoa-water.geojson`,
      },
      'xuanhoa-waterways': {
        type: 'geojson',
        data: `${geoPath}/xuanhoa-waterways.geojson`,
      },
      'xuanhoa-buildings': {
        type: 'geojson',
        data: `${geoPath}/xuanhoa-buildings.geojson`,
      },
      'xuanhoa-roads': {
        type: 'geojson',
        data: `${geoPath}/xuanhoa-roads.geojson`,
      },
      'xuanhoa-places-labels': {
        type: 'geojson',
        data: `${geoPath}/xuanhoa-places-labels.geojson`,
      },
    },
    layers: [
      // 1. Nền bản đồ kem ấm (#F8F5EE)
      {
        id: 'xuho-bg',
        type: 'background',
        paint: {
          'background-color': XUHO_PASTEL_THEME.uiBg,
        },
      },

      // 2. Lớp nền Vector Tile (OpenFreeMap) cho vùng lân cận ngoài ranh giới
      {
        id: 'ofm-landcover-grass',
        type: 'fill',
        source: 'openfreemap-planet',
        'source-layer': 'landcover',
        paint: {
          'fill-color': XUHO_PASTEL_THEME.parkGreen,
          'fill-opacity': 0.55,
        },
      },
      {
        id: 'ofm-water',
        type: 'fill',
        source: 'openfreemap-planet',
        'source-layer': 'water',
        paint: {
          'fill-color': XUHO_PASTEL_THEME.waterPastel,
          'fill-opacity': 0.85,
        },
      },
      {
        id: 'ofm-roads-context',
        type: 'line',
        source: 'openfreemap-planet',
        'source-layer': 'transportation',
        paint: {
          'line-color': '#EAE4D8',
          'line-width': ['interpolate', ['linear'], ['zoom'], 11, 0.8, 15, 2.5, 18, 6],
        },
      },

      // 3. Lớp Công viên, Khuôn viên Trường học & Sinh thái (OSM Verified GeoJSON)
      {
        id: 'xuho-landuse-fill',
        type: 'fill',
        source: 'xuanhoa-landuse',
        paint: {
          'fill-color': [
            'match',
            ['get', 'kind'],
            'green',
            XUHO_PASTEL_THEME.parkGreen,
            'campus',
            XUHO_PASTEL_THEME.campusCream,
            'resort',
            XUHO_PASTEL_THEME.resortMint,
            '#F2EEE4',
          ],
          'fill-opacity': 0.85,
        },
      },
      {
        id: 'xuho-landuse-outline',
        type: 'line',
        source: 'xuanhoa-landuse',
        paint: {
          'line-color': [
            'match',
            ['get', 'kind'],
            'campus',
            '#D8CEB8',
            'green',
            '#C8DEC0',
            '#E2DDD0',
          ],
          'line-width': 1,
        },
      },

      // 4. Lớp Sông suối & Mặt hồ thực tế (Hồ Đại Lải, Sông Cà Lồ, Hồ Lập Đinh...)
      {
        id: 'xuho-waterways-line',
        type: 'line',
        source: 'xuanhoa-waterways',
        layout: {
          'line-cap': 'round',
          'line-join': 'round',
        },
        paint: {
          'line-color': XUHO_PASTEL_THEME.waterPastel,
          'line-width': ['interpolate', ['linear'], ['zoom'], 11, 1.5, 15, 4, 18, 8],
        },
      },
      {
        id: 'xuho-water-fill',
        type: 'fill',
        source: 'xuanhoa-water',
        paint: {
          'fill-color': XUHO_PASTEL_THEME.waterPastel,
          'fill-opacity': 0.95,
        },
      },
      {
        id: 'xuho-water-outline',
        type: 'line',
        source: 'xuanhoa-water',
        paint: {
          'line-color': XUHO_PASTEL_THEME.waterStroke,
          'line-width': 1.4,
        },
      },

      // 5. Lớp Đường ngõ, Đường nhánh & Đường chính (Casing trước, Fill sau để khớp nối liền mạch)
      {
        id: 'xuho-roads-alley-casing',
        type: 'line',
        source: 'xuanhoa-roads',
        filter: ['==', ['get', 'tier'], 'alley'],
        minzoom: 13.5,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': XUHO_PASTEL_THEME.roadMinorCasing,
          'line-width': ['interpolate', ['linear'], ['zoom'], 13.5, 1.8, 16, 4.5, 18.5, 9],
        },
      },
      {
        id: 'xuho-roads-minor-casing',
        type: 'line',
        source: 'xuanhoa-roads',
        filter: ['==', ['get', 'tier'], 'minor'],
        minzoom: 12,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': XUHO_PASTEL_THEME.roadMinorCasing,
          'line-width': ['interpolate', ['linear'], ['zoom'], 12, 1.8, 15, 5.5, 18, 14],
        },
      },
      {
        id: 'xuho-roads-secondary-casing',
        type: 'line',
        source: 'xuanhoa-roads',
        filter: ['==', ['get', 'tier'], 'secondary'],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': XUHO_PASTEL_THEME.roadMajorCasing,
          'line-width': ['interpolate', ['linear'], ['zoom'], 11, 2.5, 15, 8.5, 18, 20],
        },
      },
      {
        id: 'xuho-roads-major-casing',
        type: 'line',
        source: 'xuanhoa-roads',
        filter: ['==', ['get', 'tier'], 'major'],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': XUHO_PASTEL_THEME.roadMajorCasing,
          'line-width': ['interpolate', ['linear'], ['zoom'], 11, 3.2, 15, 10.5, 18, 24],
        },
      },

      // Road Fills
      {
        id: 'xuho-roads-alley-fill',
        type: 'line',
        source: 'xuanhoa-roads',
        filter: ['==', ['get', 'tier'], 'alley'],
        minzoom: 13.5,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': XUHO_PASTEL_THEME.roadAlleyFill,
          'line-width': ['interpolate', ['linear'], ['zoom'], 13.5, 1.0, 16, 2.8, 18.5, 6.5],
        },
      },
      {
        id: 'xuho-roads-minor-fill',
        type: 'line',
        source: 'xuanhoa-roads',
        filter: ['==', ['get', 'tier'], 'minor'],
        minzoom: 12,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': XUHO_PASTEL_THEME.roadMinorFill,
          'line-width': ['interpolate', ['linear'], ['zoom'], 12, 1.0, 15, 3.8, 18, 11],
        },
      },
      {
        id: 'xuho-roads-secondary-fill',
        type: 'line',
        source: 'xuanhoa-roads',
        filter: ['==', ['get', 'tier'], 'secondary'],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': XUHO_PASTEL_THEME.roadMajorFill,
          'line-width': ['interpolate', ['linear'], ['zoom'], 11, 1.6, 15, 6.2, 18, 16],
        },
      },
      {
        id: 'xuho-roads-major-fill',
        type: 'line',
        source: 'xuanhoa-roads',
        filter: ['==', ['get', 'tier'], 'major'],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': XUHO_PASTEL_THEME.roadMajorFill,
          'line-width': ['interpolate', ['linear'], ['zoom'], 11, 2.0, 15, 8.0, 18, 19],
        },
      },
      {
        id: 'xuho-roads-centerline',
        type: 'line',
        source: 'xuanhoa-roads',
        filter: ['in', ['get', 'tier'], ['literal', ['major', 'secondary']]],
        minzoom: 14.2,
        paint: {
          'line-color': '#E5B968',
          'line-width': 1.2,
          'line-dasharray': [3, 3],
          'line-opacity': 0.75,
        },
      },

      // 6. Lớp Công trình & Khối nhà thực tế từ OpenStreetMap (5.083 tòa nhà)
      {
        id: 'xuho-buildings-shadow',
        type: 'fill',
        source: 'xuanhoa-buildings',
        minzoom: 13.5,
        paint: {
          'fill-color': XUHO_PASTEL_THEME.buildingShadow,
          'fill-translate': [2.5, 2.5],
          'fill-opacity': 0.55,
        },
      },
      {
        id: 'xuho-buildings-fill',
        type: 'fill',
        source: 'xuanhoa-buildings',
        minzoom: 13,
        paint: {
          'fill-color': XUHO_PASTEL_THEME.buildingFill,
          'fill-opacity': 0.92,
        },
      },
      {
        id: 'xuho-buildings-outline',
        type: 'line',
        source: 'xuanhoa-buildings',
        minzoom: 14,
        paint: {
          'line-color': XUHO_PASTEL_THEME.buildingStroke,
          'line-width': 0.9,
        },
      },

      // 7. Đường ranh giới hành chính Phường Xuân Hòa mới (Relation 19542980)
      {
        id: 'xuho-boundary-glow',
        type: 'line',
        source: 'xuanhoa-boundary',
        paint: {
          'line-color': XUHO_PASTEL_THEME.mint,
          'line-width': 6,
          'line-opacity': 0.22,
        },
      },
      {
        id: 'xuho-boundary-line',
        type: 'line',
        source: 'xuanhoa-boundary',
        paint: {
          'line-color': XUHO_PASTEL_THEME.deepPurple,
          'line-width': 2.2,
          'line-dasharray': [4, 2],
          'line-opacity': 0.75,
        },
      },

      // 8. Nhãn tên đường (Tự động xoay dọc theo đường, tương phản cao)
      {
        id: 'xuho-road-labels',
        type: 'symbol',
        source: 'xuanhoa-roads',
        filter: ['!=', ['get', 'name'], ''],
        minzoom: 13.2,
        layout: {
          'symbol-placement': 'line',
          'text-field': ['get', 'name'],
          'text-font': ['Noto Sans Bold', 'Noto Sans Regular'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 13.2, 10.5, 16, 12.5, 18, 14],
          'text-max-angle': 30,
          'symbol-spacing': 260,
        },
        paint: {
          'text-color': XUHO_PASTEL_THEME.deepPurple,
          'text-halo-color': '#FFFDF9',
          'text-halo-width': 2.2,
        },
      },

      // 9. Nhãn mặt hồ & khuôn viên
      {
        id: 'xuho-water-labels',
        type: 'symbol',
        source: 'xuanhoa-water',
        filter: ['!=', ['get', 'name'], ''],
        minzoom: 12,
        layout: {
          'text-field': ['get', 'name'],
          'text-font': ['Noto Sans Bold', 'Noto Sans Regular'],
          'text-size': 12,
        },
        paint: {
          'text-color': '#2B6CB0',
          'text-halo-color': '#FFFFFF',
          'text-halo-width': 2,
        },
      },
      {
        id: 'xuho-place-labels',
        type: 'symbol',
        source: 'xuanhoa-places-labels',
        minzoom: 11.5,
        layout: {
          'text-field': ['get', 'name'],
          'text-font': ['Noto Sans Bold', 'Noto Sans Regular'],
          'text-size': 13,
        },
        paint: {
          'text-color': XUHO_PASTEL_THEME.deepPurple,
          'text-halo-color': '#FFFDF9',
          'text-halo-width': 2.4,
        },
      },
    ],
  };
}
