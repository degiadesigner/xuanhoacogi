import { type Place, getPlaceStyleGroup, xuanHoaPlaces } from './places-xuanhoa';
import { getAdminState } from './admin-store';
import { VERIFIED_OSM_POIS } from './map/map-data';
import type { PlaceLocation } from './map/map-types';

const CATALOG_STREET_MATCHED_COORDS: Record<string, { lat: number; lng: number }> = {
  'lau-nuong-1968': { lat: 21.28046, lng: 105.72548 },
  'oc-2000-xuan-hoa': { lat: 21.27812, lng: 105.72268 },
  'thi-lan-tea': { lat: 21.28054, lng: 105.72588 },
  'thanh-hang-gateaux': { lat: 21.27858, lng: 105.72312 },
  'nhungs-corner': { lat: 21.27972, lng: 105.72434 },
  'bun-anh-toan': { lat: 21.27838, lng: 105.72288 },
  'quan-chim-lan-anh': { lat: 21.27825, lng: 105.72272 },
  'tiem-tra-thanh-thanh': { lat: 21.27992, lng: 105.72468 },
  'dau-oi-xuan-hoa': { lat: 21.27962, lng: 105.72422 },
  'chao-long-chi-hong': { lat: 21.28068, lng: 105.72604 },
  'nha-hang-binh-nam': { lat: 21.27805, lng: 105.72895 },
  'ruby-quan': { lat: 21.27835, lng: 105.72855 },
  'che-xuan-mai': { lat: 21.27895, lng: 105.72775 },
  'cuon-moc-xuan-hoa': { lat: 21.27942, lng: 105.72715 },
  'my-cay-seoul': { lat: 21.27958, lng: 105.72695 },
  'banh-trang-55-nguyen-van-linh': { lat: 21.27978, lng: 105.72672 },
  'lau-cuong-duong': { lat: 21.27995, lng: 105.72652 },
  'com-rang-nguyen-van-linh': { lat: 21.28015, lng: 105.72628 },
  'cat-tien-xuan-hoa': { lat: 21.28035, lng: 105.72605 },
  'com-tam-xuan-hoa': { lat: 21.28048, lng: 105.72592 },
  'banh-xeo-co-hien': { lat: 21.28072, lng: 105.72565 },
  'bun-bo-hue-102-nvl': { lat: 21.28102, lng: 105.72535 },
  'banh-mi-bo-u': { lat: 21.28122, lng: 105.72512 },
  'thuy-beo': { lat: 21.28148, lng: 105.72485 },
  'bm-nuong-muoi-ot-ngoc-quy': { lat: 21.28192, lng: 105.72435 },
  'xoi-com-185': { lat: 21.28208, lng: 105.72415 },
  'banh-trang-nha-boom': { lat: 21.28245, lng: 105.72368 },
  'tiem-tra-sua-tocotoco': { lat: 21.28262, lng: 105.72348 },
  'tiem-nha-me-beo': { lat: 21.28345, lng: 105.72245 },
  'zino-cafe': { lat: 21.28378, lng: 105.72202 },
  'hung-thu-bun-tron-com-rang': { lat: 21.28405, lng: 105.72168 },
  'quan-win-nguyen-van-linh': { lat: 21.27868, lng: 105.72812 },
  'tiem-com-nha-le-huyen': { lat: 21.28175, lng: 105.72455 },
  'canteen-ktx-noi-tru-sp2': { lat: 21.28335, lng: 105.72345 },
  'tiem-me-soc': { lat: 21.28285, lng: 105.72318 },
  'sui-cao-tieu-lau-quan': { lat: 21.28225, lng: 105.72392 },
  'lau-nuong-ba-muoi': { lat: 21.28095, lng: 105.72585 },
  'tho-coii': { lat: 21.28028, lng: 105.72638 },
  'soh-tea': { lat: 21.27918, lng: 105.72745 },
  'xoai-corner': { lat: 21.28022, lng: 105.72642 },
  'goky-xuan-hoa': { lat: 21.28312, lng: 105.72285 },
  'quan-co-loan': { lat: 21.27932, lng: 105.72728 },
  'bep-nha-cun': { lat: 21.27852, lng: 105.72832 },
  'nem-nuong-88': { lat: 21.28078, lng: 105.72598 },
  'hi-tea': { lat: 21.28168, lng: 105.72472 },
  'nha-hang-khanh-huong': { lat: 21.28112, lng: 105.72555 },
  'nem-nuong-nha-mo-chou-chou': { lat: 21.28082, lng: 105.72785 },
  'quan-ba-thu-xuan-hoa': { lat: 21.28465, lng: 105.72415 },
  'tao-pho-chi-beo': { lat: 21.28245, lng: 105.72452 },
  'mr-tea-xuan-hoa': { lat: 21.28285, lng: 105.72432 },
  'tra-chanh-zian': { lat: 21.28152, lng: 105.72518 },
  'vanh-dai-quan': { lat: 21.28025, lng: 105.72082 },
  'trau-phi-xuyen': { lat: 21.28265, lng: 105.71967 },
  'lon-ga-xuyen-phi': { lat: 21.27774, lng: 105.72211 },
  'nha-hang-468': { lat: 21.27815, lng: 105.72195 },
  'bun-cha-xuan-hoa': { lat: 21.27865, lng: 105.72165 },
  'beef88-xuan-hoa': { lat: 21.28079, lng: 105.72055 },
  'zun-food-tea': { lat: 21.28048, lng: 105.72072 },
  'my-ga-tan-linh-duong': { lat: 21.27925, lng: 105.72135 },
  'cocokana-tra-trai-cay': { lat: 21.27965, lng: 105.72115 },
  'quan-bap-1991': { lat: 21.28334, lng: 105.71978 },
  'trang-hai-san': { lat: 21.28618, lng: 105.72325 },
  'tram-du-de': { lat: 21.28115, lng: 105.72145 },
  'le-la-cafe': { lat: 21.28145, lng: 105.72185 },
  'happi-kid-coffee': { lat: 21.28095, lng: 105.72112 },
  'khu-vui-choi-happi-kid': { lat: 21.28092, lng: 105.72108 },
  'billiards-91-club': { lat: 21.28135, lng: 105.72505 },
  'clb-bia-cyber-xuan-hoa': { lat: 21.28140, lng: 105.72495 },
  'karaoke-xuan-hoa-vip': { lat: 21.28015, lng: 105.72125 },
  'pickleball-kdt-xuan-hoa': { lat: 21.28055, lng: 105.72130 },
  'dien-thoai-xuan-hoa-mobile': { lat: 21.27998, lng: 105.72648 },
  'salon-toc-beauty-xuan-hoa': { lat: 21.27982, lng: 105.72448 },
  'tap-hoa-sieu-thi-xuan-hoa': { lat: 21.28325, lng: 105.72410 },
  'tiem-banh-a-salty-name': { lat: 21.27788, lng: 105.72915 },
  'quan-oc-ngon': { lat: 21.27915, lng: 105.73005 },
  'nhat-ha': { lat: 21.27773, lng: 105.72826 },
  'bep-thanh': { lat: 21.27715, lng: 105.72738 },
  'bep-nha-bong': { lat: 21.28166, lng: 105.72895 },
  'bia-sai-gon-tuan-hien': { lat: 21.27845, lng: 105.73245 },
  'san-bia-247': { lat: 21.27858, lng: 105.73125 },
  'trau-gio-dong': { lat: 21.27795, lng: 105.72995 },
  'bun-rieu-ba-mai': { lat: 21.27822, lng: 105.73065 },
  'banh-cuon-ngoc-anh': { lat: 21.27838, lng: 105.73165 },
  'tiem-lan-phuong': { lat: 21.27868, lng: 105.73285 },
  'tra-chanh-bao-chau': { lat: 21.27878, lng: 105.73215 },
  'lau-ngua-tay-bac': { lat: 21.30485, lng: 105.72865 },
  'cafe-1975-xuan-hoa': { lat: 21.27585, lng: 105.72545 },
  'pho-bo-xuan-hoa': { lat: 21.27625, lng: 105.72585 },
  'xuho-bistro': { lat: 21.27945, lng: 105.72865 },
  'vu-quynh-chi': { lat: 21.28525, lng: 105.71985 },
  'matcha-house-xuan-hoa': { lat: 21.28058, lng: 105.72665 },
  'quan-dua-kha-do': { lat: 21.27385, lng: 105.72615 },
  'xien-nuong-trung-hoa': { lat: 21.27892, lng: 105.72692 },
  'lau-nuong-phong-viet': { lat: 21.27465, lng: 105.72485 },
  'lau-thai-ha-tinh': { lat: 21.27515, lng: 105.72515 },
  'umee-tea-food': { lat: 21.28184, lng: 105.73415 },
};

const CATALOG_EXPLICIT_MAPS_URLS: Record<string, string> = {
  'khu-vui-choi-happi-kid': 'https://maps.app.goo.gl/nT1hviRgRibEPUzU9?g_st=ic',
  'happi-kid-coffee': 'https://maps.app.goo.gl/nT1hviRgRibEPUzU9?g_st=ic',
  'lau-nuong-1968': 'https://maps.app.goo.gl/9FJ9U1JDij8FDgV17',
  'xien-nuong-trung-hoa': 'https://maps.app.goo.gl/KeefsfcCKvvYCuMZA',
  'bep-nha-bong': 'https://www.google.com/maps/search/?api=1&query=21.28166,105.72895',
  'billiards-91-club': 'https://www.google.com/maps/search/?api=1&query=21.28135,105.72505',
  'clb-bia-cyber-xuan-hoa': 'https://www.google.com/maps/search/?api=1&query=21.28140,105.72495',
  'karaoke-xuan-hoa-vip': 'https://www.google.com/maps/search/?api=1&query=21.28015,105.72125',
  'pickleball-kdt-xuan-hoa': 'https://www.google.com/maps/search/?api=1&query=21.28055,105.72130',
  'dien-thoai-xuan-hoa-mobile': 'https://www.google.com/maps/search/?api=1&query=21.27998,105.72648',
  'salon-toc-beauty-xuan-hoa': 'https://www.google.com/maps/search/?api=1&query=21.27982,105.72448',
  'tap-hoa-sieu-thi-xuan-hoa': 'https://www.google.com/maps/search/?api=1&query=21.28325,105.72410',
  'zino-cafe': 'https://www.google.com/maps/search/?api=1&query=21.28378,105.72202',
  'nem-nuong-nha-mo-chou-chou': 'https://www.google.com/maps/search/?api=1&query=21.28082,105.72785',
  'chao-long-chi-hong': 'https://www.google.com/maps/search/?api=1&query=21.28068,105.72604',
  'quan-bap-1991': 'https://www.google.com/maps/search/?api=1&query=21.28334,105.71978',
  'gamitra-xuan-hoa': 'https://maps.app.goo.gl/GamitraXuanHoaNVL',
};

export interface PlaceMapAvailability {
  internalMap: boolean;
  googleMaps: boolean;
  lat: number | null;
  lng: number | null;
  googleMapsUrl: string | null;
  googleUrlSource: 'explicit' | 'coordinates' | null;
  internalReason: string | null;
  googleReason: string | null;
}

export interface PlaceMapAvailabilityOptions {
  /**
   * Nếu true: khi không có mapsUrl gốc nhưng có lat/lng đã xác minh,
   * hệ thống tạo fallback URL Google Maps từ tọa độ và đánh dấu googleUrlSource = 'coordinates'.
   * Mặc định: false (chỉ hiện nút Google Maps khi có mapsUrl hợp lệ, đúng mục 10.E & TEST 2).
   */
  allowCoordinateGoogleFallback?: boolean;
}

function isValidVietnamCoordinate(lat?: number | null, lng?: number | null): boolean {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= 8 &&
    lat <= 24 &&
    lng >= 102 &&
    lng <= 110
  );
}

function isValidGoogleMapsUrl(raw?: string | null): boolean {
  if (!raw || typeof raw !== 'string') return false;
  const trimmed = raw.trim();
  if (!trimmed) return false;
  return (
    /^https?:\/\//i.test(trimmed) &&
    (trimmed.includes('google.com/maps') ||
      trimmed.includes('maps.app.goo.gl') ||
      trimmed.includes('goo.gl/maps') ||
      trimmed.includes('maps.google.'))
  );
}

/**
 * Hàm kiểm tra trạng thái Dual Map thống nhất cho mọi Quán / Địa điểm / Địa danh (Mục 9, 10, 11, 12, 20, 30)
 */
export function getPlaceMapAvailability(
  input?: Partial<Place> | Partial<PlaceLocation> | null,
  options?: PlaceMapAvailabilityOptions
): PlaceMapAvailability {
  if (!input) {
    return {
      internalMap: false,
      googleMaps: false,
      lat: null,
      lng: null,
      googleMapsUrl: null,
      googleUrlSource: null,
      internalReason: 'Chưa có dữ liệu địa điểm',
      googleReason: 'Chưa có link Google Maps',
    };
  }

  const placeId = (input.id || '').trim();
  const adminState = getAdminState();
  const override = placeId ? adminState.places?.[placeId] : undefined;

  // 1. Giải quyết tọa độ Bản đồ số nội bộ (lat / lng)
  let resolvedLat: number | null = null;
  let resolvedLng: number | null = null;

  const isExplicitlyUnlocatedByAdmin =
    override?.locationStatus === 'unlocated' && override?.coordinateVerified === false;

  if (
    override &&
    isValidVietnamCoordinate(override.lat, override.lng) &&
    override.coordinateVerified === true &&
    !override.pendingMapApproval &&
    !override.pendingWebApproval
  ) {
    resolvedLat = Number(override.lat);
    resolvedLng = Number(override.lng);
  } else if (!isExplicitlyUnlocatedByAdmin) {
    const directLat = (input as PlaceLocation).lat ?? (input as Place).lat;
    const directLng = (input as PlaceLocation).lng ?? (input as Place).lng;

    if (isValidVietnamCoordinate(directLat, directLng)) {
      resolvedLat = Number(directLat);
      resolvedLng = Number(directLng);
    } else if (placeId && CATALOG_STREET_MATCHED_COORDS[placeId]) {
      resolvedLat = CATALOG_STREET_MATCHED_COORDS[placeId].lat;
      resolvedLng = CATALOG_STREET_MATCHED_COORDS[placeId].lng;
    } else if (placeId) {
      const osmMatch = VERIFIED_OSM_POIS.find((p) => p.id === placeId);
      if (osmMatch && isValidVietnamCoordinate(osmMatch.lat, osmMatch.lng)) {
        resolvedLat = Number(osmMatch.lat);
        resolvedLng = Number(osmMatch.lng);
      }
    }
  }

  const hasInternalMap = isValidVietnamCoordinate(resolvedLat, resolvedLng);

  // 2. Giải quyết link Google Maps (Ưu tiên tuyệt đối mapsUrl đã lưu của Admin/chủ quán)
  const rawExplicitUrl =
    override?.mapsUrl ||
    (input as Place).mapsUrl ||
    (input as PlaceLocation).metadata?.mapsUrl ||
    (input as PlaceLocation).originalPlace?.mapsUrl ||
    (placeId ? CATALOG_EXPLICIT_MAPS_URLS[placeId] : undefined) ||
    (placeId ? VERIFIED_OSM_POIS.find((p) => p.id === placeId)?.metadata?.mapsUrl : undefined) ||
    null;

  let resolvedGoogleUrl: string | null = null;
  let googleUrlSource: 'explicit' | 'coordinates' | null = null;

  if (isValidGoogleMapsUrl(rawExplicitUrl)) {
    resolvedGoogleUrl = rawExplicitUrl!.trim();
    googleUrlSource = 'explicit';
  } else if (options?.allowCoordinateGoogleFallback && hasInternalMap) {
    resolvedGoogleUrl = `https://www.google.com/maps/search/?api=1&query=${resolvedLat},${resolvedLng}`;
    googleUrlSource = 'coordinates';
  }

  const hasGoogleMaps = Boolean(resolvedGoogleUrl);

  return {
    internalMap: hasInternalMap,
    googleMaps: hasGoogleMaps,
    lat: hasInternalMap ? resolvedLat : null,
    lng: hasInternalMap ? resolvedLng : null,
    googleMapsUrl: resolvedGoogleUrl,
    googleUrlSource,
    internalReason: hasInternalMap ? null : 'Chưa định vị trên Bản đồ số',
    googleReason: hasGoogleMaps ? null : 'Chưa có link Google Maps',
  };
}

/**
 * Mở Bản đồ số nội bộ XuanHoaCoGi, bay camera tới đúng lat/lng, chọn đúng place.id và mở popup (Mục 13)
 */
export function openInternalDigitalMap(
  placeId: string,
  lat?: number | null,
  lng?: number | null,
  placeName?: string | null
): void {
  if (typeof window === 'undefined' || !placeId) return;

  let resolvedLat = typeof lat === 'number' && Number.isFinite(lat) ? lat : null;
  let resolvedLng = typeof lng === 'number' && Number.isFinite(lng) ? lng : null;
  const catalogPlace = xuanHoaPlaces.find((p) => p.id === placeId);
  const osmPoi = VERIFIED_OSM_POIS.find((p) => p.id === placeId);

  if (resolvedLat === null || resolvedLng === null) {
    const avail = getPlaceMapAvailability(catalogPlace || { id: placeId });
    resolvedLat = avail.lat;
    resolvedLng = avail.lng;
  }

  const labelName =
    placeName ||
    catalogPlace?.name ||
    osmPoi?.name ||
    null;

  const params = new URLSearchParams();
  params.set('select', placeId);
  if (typeof resolvedLat === 'number' && typeof resolvedLng === 'number') {
    params.set('flyLat', String(resolvedLat));
    params.set('flyLng', String(resolvedLng));
  }
  if (labelName) {
    params.set('flyLabel', `📍 ${labelName}`);
  }
  const targetHash = `#/bandoso?${params.toString()}`;
  if (window.location.hash !== targetHash) {
    window.location.hash = targetHash;
  }
  window.dispatchEvent(
    new CustomEvent('xuanhoa_open_internal_map', {
      detail: {
        placeId,
        lat: resolvedLat,
        lng: resolvedLng,
        placeName: labelName,
      },
    })
  );
}

/**
 * Mở đúng URL Google Maps gốc trong tab mới mà không làm mất state của XuanHoaCoGi (Mục 11, 14)
 */
export function openGoogleMapsUrl(url?: string | null): void {
  if (typeof window === 'undefined' || !url) return;
  const trimmed = url.trim();
  if (!trimmed) return;
  window.open(trimmed, '_blank', 'noopener,noreferrer');
}

// ============================================================================
// HỆ THỐNG PHÂN LOẠI CATEGORY & SUBCATEGORY CHO TRUNG TÂM QUÁN XÁ (MỤC 6 & 7)
// ============================================================================

export type MainPlaceCategoryKey =
  | 'all'
  | 'an'
  | 'nhau'
  | 'uong'
  | 'vui-choi'
  | 'dich-vu'
  | 'dia-danh';

export interface MainPlaceCategoryDef {
  id: MainPlaceCategoryKey;
  label: string;
  shortLabel: string;
  icon: string;
  subcategories: string[];
}

export const MAIN_PLACE_CATEGORIES: MainPlaceCategoryDef[] = [
  {
    id: 'all',
    label: 'Tất cả',
    shortLabel: 'Tất cả',
    icon: '✨',
    subcategories: [],
  },
  {
    id: 'an',
    label: 'Ăn',
    shortLabel: 'Ăn',
    icon: '🍜',
    subcategories: ['Cơm', 'Phở / Bún', 'Bánh mì', 'Ăn vặt', 'Nướng', 'Lẩu'],
  },
  {
    id: 'nhau',
    label: 'Nhậu',
    shortLabel: 'Nhậu',
    icon: '🍻',
    subcategories: ['Quán nhậu', 'Bia', 'Nướng', 'Lẩu', 'Hải sản'],
  },
  {
    id: 'uong',
    label: 'Uống',
    shortLabel: 'Uống',
    icon: '🧋',
    subcategories: ['Cafe', 'Trà sữa', 'Nước ép', 'Đồ uống'],
  },
  {
    id: 'vui-choi',
    label: 'Vui chơi',
    shortLabel: 'Vui chơi',
    icon: '🎱',
    subcategories: ['Bi-a', 'Game', 'Karaoke', 'Giải trí'],
  },
  {
    id: 'dich-vu',
    label: 'Dịch vụ',
    shortLabel: 'Dịch vụ',
    icon: '🛍️',
    subcategories: ['Điện thoại', 'Làm đẹp', 'Tạp hóa', 'Dịch vụ khác'],
  },
  {
    id: 'dia-danh',
    label: 'Địa danh',
    shortLabel: 'Địa danh',
    icon: '🏛️',
    subcategories: ['Trường học', 'Hành chính', 'Hồ / Công viên', 'Y tế / Bưu điện'],
  },
];

/**
 * Kiểm tra địa điểm có phải là Vui chơi / Giải trí / Dịch vụ / Địa danh (không phải quán ăn truyền thống)
 * để hiển thị nhãn Dịch vụ / Giá phù hợp (Mục 27)
 */
export function isEntertainmentOrServicePlace(
  place?: Partial<Place> | null,
  sectorTag?: string
): boolean {
  if (!place) return false;
  if (place.id?.startsWith('osm_')) return true;
  if (
    sectorTag === 'bia-game' ||
    sectorTag === 'an-choi' ||
    sectorTag === 'dien-thoai' ||
    sectorTag === 'dich-vu' ||
    sectorTag === 'dia-danh'
  ) {
    return true;
  }
  const sub = (place.subcategory || '').toLowerCase();
  if (
    ['bi-a', 'game', 'karaoke', 'giải trí', 'điện thoại', 'làm đẹp', 'tạp hóa', 'dịch vụ khác'].includes(
      sub
    )
  ) {
    return true;
  }
  const style = place.name ? getPlaceStyleGroup(place as Place) : null;
  return style === 'vui-choi';
}

/**
 * Trả về nhãn loại hình hiển thị trên Card cho địa điểm (VD: "🎱 Bi-a", "🎮 Cyber Game", "🎤 Karaoke", "🎈 Khu vui chơi", "📱 Điện thoại"...)
 */
export function getPlaceDisplayTypeBadge(place: Place, sectorTag?: string): string {
  const combined = `${place.name || ''} ${place.tagline || ''} ${place.subcategory || ''} ${(place.tags || []).join(' ')}`.toLowerCase();
  if (place.id?.startsWith('osm_') || sectorTag === 'dia-danh') {
    if (combined.includes('đh ') || combined.includes('đại học') || combined.includes('cao đẳng') || combined.includes('trường') || combined.includes('ktx')) {
      return '🎓 Trường học & Giáo dục';
    }
    if (combined.includes('hồ ') || combined.includes('quảng trường') || combined.includes('núi') || combined.includes('công viên')) {
      return '🌳 Hồ & Địa danh';
    }
    if (combined.includes('y tế') || combined.includes('phòng khám') || combined.includes('bưu điện')) {
      return '🏥 Y tế & Bưu chính';
    }
    return '🏛️ Cơ quan & Địa danh';
  }
  if (place.subcategory === 'Bi-a' || (combined.includes('bi-a') || combined.includes('billiards'))) {
    if (combined.includes('cyber') || combined.includes('game')) return '🎱 Bi-a & Cyber Game';
    return '🎱 Bi-a';
  }
  if (place.subcategory === 'Game' || combined.includes('cyber') || combined.includes('quán game') || combined.includes('quán net')) {
    return '🎮 Cyber Game';
  }
  if (place.subcategory === 'Karaoke' || combined.includes('karaoke')) {
    return '🎤 Karaoke';
  }
  if (place.id === 'khu-vui-choi-happi-kid' || combined.includes('khu vui chơi')) {
    return '🎈 Khu vui chơi & Kids Cafe';
  }
  if (combined.includes('pickleball') || combined.includes('thể thao')) {
    return '🎾 Thể thao & Giải trí';
  }
  if (place.subcategory === 'Điện thoại' || sectorTag === 'dien-thoai' || combined.includes('điện thoại') || combined.includes('mobile')) {
    return '📱 Điện thoại & Phụ kiện';
  }
  if (place.subcategory === 'Làm đẹp' || combined.includes('hair') || combined.includes('nail') || combined.includes('spa') || combined.includes('làm đẹp')) {
    return '💇‍♀️ Làm đẹp & Spa';
  }
  if (place.subcategory === 'Tạp hóa' || combined.includes('tạp hóa') || combined.includes('siêu thị')) {
    return '🛒 Tạp hóa & Siêu thị';
  }
  const style = getPlaceStyleGroup(place);
  switch (style) {
    case 'nhau-lau':
      return '🍻 Nhậu & Lẩu Nướng';
    case 'uong':
      return '🧋 Cafe & Đồ Uống';
    case 'an-vat':
      return '🍢 Quán Ăn Vặt';
    case 'vui-choi':
      return '🎡 Vui Chơi & Giải Trí';
    default:
      return '🍜 Cơm & Bún Phở';
  }
}

/**
 * Xác định các Category chính mà một địa điểm thuộc về (Mục 6)
 */
export function getPlaceMainCategories(
  place: Place,
  sectorTag?: string
): Exclude<MainPlaceCategoryKey, 'all'>[] {
  const result = new Set<Exclude<MainPlaceCategoryKey, 'all'>>();
  const combined = `${place.name || ''} ${place.tagline || ''} ${place.subcategory || ''} ${(place.tags || []).join(' ')}`.toLowerCase();

  if (place.id.startsWith('osm_') || sectorTag === 'dia-danh') {
    result.add('dia-danh');
    if (combined.includes('chợ') || combined.includes('ngân hàng') || combined.includes('xăng')) {
      result.add('dich-vu');
    }
    if (combined.includes('flamingo') || combined.includes('golf') || combined.includes('đại lải') || combined.includes('quảng trường') || combined.includes('hồ điều hòa')) {
      result.add('vui-choi');
    }
    return Array.from(result);
  }

  // Dịch vụ
  if (
    sectorTag === 'dien-thoai' ||
    sectorTag === 'dich-vu' ||
    ['Điện thoại', 'Làm đẹp', 'Tạp hóa', 'Dịch vụ khác'].includes(place.subcategory || '') ||
    combined.includes('điện thoại') ||
    combined.includes('làm đẹp') ||
    combined.includes('hair') ||
    combined.includes('nail') ||
    combined.includes('tạp hóa') ||
    combined.includes('siêu thị mini')
  ) {
    result.add('dich-vu');
  }

  // Vui chơi
  if (
    sectorTag === 'bia-game' ||
    sectorTag === 'an-choi' ||
    ['Bi-a', 'Game', 'Karaoke', 'Giải trí'].includes(place.subcategory || '') ||
    getPlaceStyleGroup(place) === 'vui-choi'
  ) {
    result.add('vui-choi');
  }

  if (result.size > 0 && !combined.includes('kids cafe')) {
    return Array.from(result);
  }

  const style = getPlaceStyleGroup(place);
  if (style === 'nhau-lau') {
    result.add('nhau');
    // Các quán lẩu nướng / nhà hàng cũng phục vụ ăn chính
    result.add('an');
  } else if (style === 'uong') {
    result.add('uong');
  } else if (style === 'an-vat') {
    result.add('an');
    if (combined.includes('trà') || combined.includes('cafe') || combined.includes('sữa') || combined.includes('chè')) {
      result.add('uong');
    }
  } else if (style === 'an-chinh') {
    result.add('an');
  }

  return Array.from(result);
}

/**
 * Xác định các Subcategory (Mục 7) của một địa điểm trong Category chính tương ứng
 */
export function getPlaceSubcategories(
  place: Place,
  mainCategory: MainPlaceCategoryKey,
  sectorTag?: string
): string[] {
  const subs = new Set<string>();
  const menuText = (place.menu || []).map((m) => m.name).join(' ');
  const combined = `${place.name || ''} ${place.tagline || ''} ${place.subcategory || ''} ${(place.tags || []).join(' ')} ${menuText}`.toLowerCase();

  if (mainCategory === 'an' || mainCategory === 'all') {
    if (combined.includes('cơm')) subs.add('Cơm');
    if (
      combined.includes('phở') ||
      combined.includes('bún') ||
      combined.includes('miến') ||
      combined.includes('bánh đa') ||
      combined.includes('cháo') ||
      combined.includes('mỳ gà tần') ||
      combined.includes('sủi cảo')
    ) {
      subs.add('Phở / Bún');
    }
    if (combined.includes('bánh mì') || combined.includes('bánh mỳ') || combined.includes('bánh cuốn')) {
      subs.add('Bánh mì');
    }
    if (
      getPlaceStyleGroup(place) === 'an-vat' ||
      combined.includes('ăn vặt') ||
      combined.includes('bánh tráng') ||
      combined.includes('nem nướng') ||
      combined.includes('nem chua') ||
      combined.includes('mì cay') ||
      combined.includes('mỳ cay') ||
      combined.includes('mì trộn') ||
      combined.includes('tokbokki') ||
      combined.includes('kimbap') ||
      combined.includes('bánh gà')
    ) {
      subs.add('Ăn vặt');
    }
    if (combined.includes('nướng') || combined.includes('chảo gang') || combined.includes('bbq')) {
      subs.add('Nướng');
    }
    if (combined.includes('lẩu')) {
      subs.add('Lẩu');
    }
  }

  if (mainCategory === 'nhau' || mainCategory === 'all') {
    if (getPlaceStyleGroup(place) === 'nhau-lau' || combined.includes('nhậu') || combined.includes('quán nhậu') || combined.includes('đặc sản')) {
      subs.add('Quán nhậu');
    }
    if (combined.includes('bia') || combined.includes('beer')) {
      subs.add('Bia');
    }
    if (combined.includes('nướng') || combined.includes('chảo gang') || combined.includes('xiên nướng')) {
      subs.add('Nướng');
    }
    if (combined.includes('lẩu')) {
      subs.add('Lẩu');
    }
    if (combined.includes('hải sản') || combined.includes('ốc')) {
      subs.add('Hải sản');
    }
  }

  if (mainCategory === 'uong' || mainCategory === 'all') {
    if (combined.includes('cafe') || combined.includes('cà phê') || combined.includes('phê ') || combined.includes('bạc xỉu')) {
      subs.add('Cafe');
    }
    if (combined.includes('trà sữa') || combined.includes('ô long') || combined.includes('olong') || combined.includes('matcha') || combined.includes('kem trứng')) {
      subs.add('Trà sữa');
    }
    if (combined.includes('nước ép') || combined.includes('sinh tố') || combined.includes('trà trái cây') || combined.includes('trà hoa quả') || combined.includes('sữa chua')) {
      subs.add('Nước ép');
    }
    if (getPlaceStyleGroup(place) === 'uong' || combined.includes('trà chanh') || combined.includes('chè') || combined.includes('tào phớ') || combined.includes('đồ uống')) {
      subs.add('Đồ uống');
    }
  }

  if (mainCategory === 'vui-choi' || mainCategory === 'all') {
    if (place.subcategory === 'Bi-a' || combined.includes('bi-a') || combined.includes('billiards') || combined.includes('bida')) {
      subs.add('Bi-a');
    }
    if (place.subcategory === 'Game' || combined.includes('cyber') || combined.includes('quán game') || combined.includes('quán net') || combined.includes('esport')) {
      subs.add('Game');
    }
    if (place.subcategory === 'Karaoke' || combined.includes('karaoke') || combined.includes('phòng hát')) {
      subs.add('Karaoke');
    }
    if (
      place.subcategory === 'Giải trí' ||
      combined.includes('khu vui chơi') ||
      combined.includes('happi kid') ||
      combined.includes('pickleball') ||
      combined.includes('đạp vịt') ||
      combined.includes('boardgame') ||
      combined.includes('giải trí')
    ) {
      subs.add('Giải trí');
    }
  }

  if (mainCategory === 'dich-vu' || mainCategory === 'all') {
    if (place.subcategory === 'Điện thoại' || sectorTag === 'dien-thoai' || combined.includes('điện thoại') || combined.includes('mobile') || combined.includes('phụ kiện')) {
      subs.add('Điện thoại');
    }
    if (place.subcategory === 'Làm đẹp' || combined.includes('làm đẹp') || combined.includes('salon') || combined.includes('hair') || combined.includes('nail') || combined.includes('spa') || combined.includes('dưỡng sinh')) {
      subs.add('Làm đẹp');
    }
    if (place.subcategory === 'Tạp hóa' || combined.includes('tạp hóa') || combined.includes('siêu thị') || combined.includes('mart') || combined.includes('chợ')) {
      subs.add('Tạp hóa');
    }
    if (place.subcategory === 'Dịch vụ khác' || sectorTag === 'dich-vu' || combined.includes('ngân hàng') || combined.includes('xăng') || combined.includes('dịch vụ')) {
      subs.add('Dịch vụ khác');
    }
  }

  if (mainCategory === 'dia-danh' || mainCategory === 'all') {
    if (place.id.startsWith('osm_') || sectorTag === 'dia-danh') {
      if (combined.includes('đh ') || combined.includes('đại học') || combined.includes('cao đẳng') || combined.includes('trường') || combined.includes('ktx')) {
        subs.add('Trường học');
      } else if (combined.includes('ubnd') || combined.includes('đảng ủy') || combined.includes('công an') || combined.includes('hành chính') || combined.includes('lữ đoàn')) {
        subs.add('Hành chính');
      } else if (combined.includes('hồ') || combined.includes('quảng trường') || combined.includes('núi') || combined.includes('vòng tròn') || combined.includes('cầu')) {
        subs.add('Hồ / Công viên');
      } else {
        subs.add('Y tế / Bưu điện');
      }
    }
  }

  return Array.from(subs);
}
