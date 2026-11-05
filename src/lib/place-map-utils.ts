import {
  type Place,
  getPlaceStyleGroup,
  xuanHoaPlaces,
  VERIFIED_CATALOG_PLACE_COORDS,
} from './places-xuanhoa';
import { getAdminState } from './admin-store';
import { VERIFIED_OSM_POIS } from './map/map-data';
import type { PlaceLocation } from './map/map-types';
import {
  MAP_CATEGORY_REGISTRY,
  resolvePlaceTaxonomy,
  resolvePlaceContentProfile,
  formatPlaceTaxonomyLine,
  type MapSubcategoryId,
} from './map/map-category-registry';

const CATALOG_STREET_MATCHED_COORDS: Record<string, { lat: number; lng: number }> =
  VERIFIED_CATALOG_PLACE_COORDS;

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
  if (place.contentProfile && place.contentProfile !== 'food') return true;
  const ov = place.id ? getAdminState().places?.[place.id] : undefined;
  const effSubId = ov?.subcategoryId || ov?.categoryId || place.subcategoryId;
  if (effSubId && effSubId in MAP_CATEGORY_REGISTRY) {
    const subMeta = MAP_CATEGORY_REGISTRY[effSubId as MapSubcategoryId];
    return subMeta.contentProfile !== 'food';
  }
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
 * Trả về nhãn loại hình hiển thị trên Card & Modal đồng bộ 100% với Taxonomy 3 cấp (Phần 2.2)
 * Ví dụ: Chọn Nhóm Ăn uống, Loại Ăn vặt, Tag: Ăn đêm, Có giao hàng
 * -> Hiển thị: "Ăn vặt · Ăn đêm · Có giao hàng"
 */
export function getPlaceDisplayTypeBadge(place: Place, sectorTag?: string): string {
  const ov = place.id ? getAdminState().places?.[place.id] : undefined;
  const taxonomy = resolvePlaceTaxonomy({
    id: place.id,
    name: ov?.name || place.name,
    subType: ov?.tagline || place.tagline,
    tags: ov?.tags || place.tags,
    sectorTag: ov?.sectorTag || sectorTag,
    mapCategory: ov?.mapCategory,
    category: ov?.category || place.category,
    explicitParentId: ov?.parentCategoryId || place.parentCategoryId,
    explicitSubcategoryId: ov?.subcategoryId || ov?.categoryId || place.subcategoryId,
  });
  const extraTags = Array.isArray(ov?.extraTags)
    ? ov!.extraTags
    : Array.isArray(place.extraTags)
    ? place.extraTags
    : [];
  return formatPlaceTaxonomyLine(taxonomy.subcategoryId, extraTags, 3);
}

/**
 * Xác định các Category chính mà một địa điểm thuộc về (Mục 6 & Phần 2)
 */
export function getPlaceMainCategories(
  place: Place,
  sectorTag?: string
): Exclude<MainPlaceCategoryKey, 'all'>[] {
  const result = new Set<Exclude<MainPlaceCategoryKey, 'all'>>();
  const ov = place.id ? getAdminState().places?.[place.id] : undefined;
  const effSector = ov?.sectorTag || sectorTag;
  const taxonomy = resolvePlaceTaxonomy({
    id: place.id,
    name: ov?.name || place.name,
    subType: ov?.tagline || place.tagline,
    tags: ov?.tags || place.tags,
    sectorTag: effSector,
    mapCategory: ov?.mapCategory,
    category: ov?.category || place.category,
    explicitParentId: ov?.parentCategoryId || place.parentCategoryId,
    explicitSubcategoryId: ov?.subcategoryId || ov?.categoryId || place.subcategoryId,
  });

  if (
    place.id.startsWith('osm_') ||
    effSector === 'dia-danh' ||
    taxonomy.parentCategoryId === 'public' ||
    taxonomy.parentCategoryId === 'education' ||
    taxonomy.parentCategoryId === 'health' ||
    taxonomy.parentCategoryId === 'landmark'
  ) {
    result.add('dia-danh');
    if (taxonomy.parentCategoryId === 'health' && taxonomy.subcategoryId === 'pharmacy') {
      result.add('dich-vu');
    }
    return Array.from(result);
  }

  if (
    taxonomy.parentCategoryId === 'shopping' ||
    taxonomy.parentCategoryId === 'service' ||
    taxonomy.parentCategoryId === 'transport' ||
    effSector === 'dien-thoai' ||
    effSector === 'dich-vu'
  ) {
    result.add('dich-vu');
    return Array.from(result);
  }

  if (
    taxonomy.parentCategoryId === 'entertainment' ||
    taxonomy.parentCategoryId === 'sports' ||
    effSector === 'bia-game' ||
    effSector === 'an-choi'
  ) {
    result.add('vui-choi');
    return Array.from(result);
  }

  if (taxonomy.parentCategoryId === 'night_food') {
    result.add('nhau');
    result.add('an');
    return Array.from(result);
  }

  if (taxonomy.parentCategoryId === 'drink') {
    result.add('uong');
    return Array.from(result);
  }

  if (taxonomy.parentCategoryId === 'food') {
    result.add('an');
    const combined = `${place.name || ''} ${place.tagline || ''} ${(place.tags || []).join(' ')}`.toLowerCase();
    if (taxonomy.subcategoryId === 'street_food' && (combined.includes('trà') || combined.includes('cafe') || combined.includes('sữa') || combined.includes('chè'))) {
      result.add('uong');
    }
    if (taxonomy.subcategoryId === 'hotpot' || taxonomy.subcategoryId === 'grill' || taxonomy.subcategoryId === 'seafood') {
      result.add('nhau');
    }
    return Array.from(result);
  }

  const style = getPlaceStyleGroup(place);
  if (style === 'nhau-lau') {
    result.add('nhau');
    result.add('an');
  } else if (style === 'uong') {
    result.add('uong');
  } else {
    result.add('an');
  }

  return Array.from(result);
}

/**
 * Xác định các Subcategory (Mục 7 & Phần 2) của một địa điểm trong Category chính tương ứng
 */
export function getPlaceSubcategories(
  place: Place,
  mainCategory: MainPlaceCategoryKey,
  sectorTag?: string
): string[] {
  const subs = new Set<string>();
  const ov = place.id ? getAdminState().places?.[place.id] : undefined;
  const effSector = ov?.sectorTag || sectorTag;
  const taxonomy = resolvePlaceTaxonomy({
    id: place.id,
    name: ov?.name || place.name,
    subType: ov?.tagline || place.tagline,
    tags: ov?.tags || place.tags,
    sectorTag: effSector,
    mapCategory: ov?.mapCategory,
    category: ov?.category || place.category,
    explicitParentId: ov?.parentCategoryId || place.parentCategoryId,
    explicitSubcategoryId: ov?.subcategoryId || ov?.categoryId || place.subcategoryId,
  });
  const subId = taxonomy.subcategoryId;
  const menuText = (place.menu || []).map((m) => m.name).join(' ');
  const combined = `${place.name || ''} ${place.tagline || ''} ${place.subcategory || ''} ${(place.tags || []).join(' ')} ${menuText}`.toLowerCase();

  if (mainCategory === 'an' || mainCategory === 'all') {
    if (subId === 'rice' || combined.includes('cơm')) subs.add('Cơm');
    if (
      subId === 'noodle' ||
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
    if (subId === 'banh_mi' || combined.includes('bánh mì') || combined.includes('bánh mỳ') || combined.includes('bánh cuốn')) {
      subs.add('Bánh mì');
    }
    if (
      subId === 'street_food' ||
      subId === 'fast_food' ||
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
    if (subId === 'grill' || subId === 'grill_pub' || combined.includes('nướng') || combined.includes('chảo gang') || combined.includes('bbq')) {
      subs.add('Nướng');
    }
    if (subId === 'hotpot' || subId === 'hotpot_pub' || combined.includes('lẩu')) {
      subs.add('Lẩu');
    }
  }

  if (mainCategory === 'nhau' || mainCategory === 'all') {
    if (subId === 'pub' || getPlaceStyleGroup(place) === 'nhau-lau' || combined.includes('nhậu') || combined.includes('quán nhậu') || combined.includes('đặc sản')) {
      subs.add('Quán nhậu');
    }
    if (subId === 'beer' || subId === 'beer_garden' || combined.includes('bia') || combined.includes('beer')) {
      subs.add('Bia');
    }
    if (subId === 'grill' || subId === 'grill_pub' || combined.includes('nướng') || combined.includes('chảo gang') || combined.includes('xiên nướng')) {
      subs.add('Nướng');
    }
    if (subId === 'hotpot' || subId === 'hotpot_pub' || combined.includes('lẩu')) {
      subs.add('Lẩu');
    }
    if (subId === 'seafood' || combined.includes('hải sản') || combined.includes('ốc')) {
      subs.add('Hải sản');
    }
  }

  if (mainCategory === 'uong' || mainCategory === 'all') {
    if (subId === 'cafe' || combined.includes('cafe') || combined.includes('cà phê') || combined.includes('phê ') || combined.includes('bạc xỉu')) {
      subs.add('Cafe');
    }
    if (subId === 'milk_tea' || combined.includes('trà sữa') || combined.includes('ô long') || combined.includes('olong') || combined.includes('matcha') || combined.includes('kem trứng')) {
      subs.add('Trà sữa');
    }
    if (subId === 'juice' || combined.includes('nước ép') || combined.includes('sinh tố') || combined.includes('trà trái cây') || combined.includes('trà hoa quả') || combined.includes('sữa chua')) {
      subs.add('Nước ép');
    }
    if (subId === 'tea' || subId === 'beverage' || getPlaceStyleGroup(place) === 'uong' || combined.includes('trà chanh') || combined.includes('chè') || combined.includes('tào phớ') || combined.includes('đồ uống')) {
      subs.add('Đồ uống');
    }
  }

  if (mainCategory === 'vui-choi' || mainCategory === 'all') {
    if (subId === 'billiards' || place.subcategory === 'Bi-a' || combined.includes('bi-a') || combined.includes('billiards') || combined.includes('bida')) {
      subs.add('Bi-a');
    }
    if (subId === 'gaming' || place.subcategory === 'Game' || combined.includes('cyber') || combined.includes('quán game') || combined.includes('quán net') || combined.includes('esport')) {
      subs.add('Game');
    }
    if (subId === 'karaoke' || place.subcategory === 'Karaoke' || combined.includes('karaoke') || combined.includes('phòng hát')) {
      subs.add('Karaoke');
    }
    if (
      subId === 'sports' ||
      subId === 'kids_playground' ||
      subId === 'entertainment_center' ||
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
    if (subId === 'phone_shop' || subId === 'electronics' || place.subcategory === 'Điện thoại' || effSector === 'dien-thoai' || combined.includes('điện thoại') || combined.includes('mobile') || combined.includes('phụ kiện')) {
      subs.add('Điện thoại');
    }
    if (subId === 'beauty' || subId === 'barber' || place.subcategory === 'Làm đẹp' || combined.includes('làm đẹp') || combined.includes('salon') || combined.includes('hair') || combined.includes('nail') || combined.includes('spa') || combined.includes('dưỡng sinh')) {
      subs.add('Làm đẹp');
    }
    if (subId === 'grocery' || subId === 'supermarket' || subId === 'convenience_store' || subId === 'market' || place.subcategory === 'Tạp hóa' || combined.includes('tạp hóa') || combined.includes('siêu thị') || combined.includes('mart') || combined.includes('chợ')) {
      subs.add('Tạp hóa');
    }
    if (
      taxonomy.parentCategoryId === 'transport' ||
      taxonomy.parentCategoryId === 'service' ||
      subId === 'fashion' ||
      place.subcategory === 'Dịch vụ khác' ||
      effSector === 'dich-vu' ||
      combined.includes('ngân hàng') ||
      combined.includes('xăng') ||
      combined.includes('dịch vụ')
    ) {
      subs.add('Dịch vụ khác');
    }
  }

  if (mainCategory === 'dia-danh' || mainCategory === 'all') {
    if (
      place.id.startsWith('osm_') ||
      effSector === 'dia-danh' ||
      taxonomy.parentCategoryId === 'education' ||
      taxonomy.parentCategoryId === 'public' ||
      taxonomy.parentCategoryId === 'landmark' ||
      taxonomy.parentCategoryId === 'health'
    ) {
      if (taxonomy.parentCategoryId === 'education' || combined.includes('đh ') || combined.includes('đại học') || combined.includes('cao đẳng') || combined.includes('trường') || combined.includes('ktx')) {
        subs.add('Trường học');
      } else if (taxonomy.parentCategoryId === 'public' || combined.includes('ubnd') || combined.includes('đảng ủy') || combined.includes('công an') || combined.includes('hành chính') || combined.includes('lữ đoàn')) {
        subs.add('Hành chính');
      } else if (taxonomy.parentCategoryId === 'landmark' || combined.includes('hồ') || combined.includes('quảng trường') || combined.includes('núi') || combined.includes('vòng tròn') || combined.includes('cầu')) {
        subs.add('Hồ / Công viên');
      } else {
        subs.add('Y tế / Bưu điện');
      }
    }
  }

  return Array.from(subs);
}
