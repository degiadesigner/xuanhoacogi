import { PlaceLocation, MapCategoryKey } from './map-types';
import { isDefaultVisibleMapLandmark } from './map-category-registry';

/**
 * HỆ THỐNG ĐỘ ƯU TIÊN POI THỐNG NHẤT CHO BẢN ĐỒ 2D & 3D (PHẦN 42)
 * 1000 = selected
 * 950  = route target
 * 900  = user location
 * 850  = core landmark
 * 750  = government / health / education
 * 550  = active business featured
 * 450  = active business
 */
export const POI_PRIORITY = {
  SELECTED: 1000,
  ROUTE_TARGET: 950,
  USER_HOME: 900,
  LANDMARK_SPECIAL: 850,
  CIVIC_MAJOR: 750,
  LANDMARK_AREA: 750,
  SHOP_FEATURED: 550,
  SHOP_NORMAL: 450,
  SERVICE_SMALL: 450,
  POI_SECONDARY: 450,
} as const;

export type PoiPriorityTier =
  | 'selected'
  | 'route_target'
  | 'user_home'
  | 'landmark_special'
  | 'civic_major'
  | 'landmark_area'
  | 'shop_featured'
  | 'shop_normal'
  | 'service_small'
  | 'poi_secondary';

/**
 * Danh sách ID các địa danh biểu tượng cấp đặc biệt (850) của Phường Xuân Hòa
 */
export const SPECIAL_ICONIC_LANDMARK_IDS = new Set<string>([
  'osm_way_1079368029', // Trường ĐH Kiến trúc Hà Nội (CS Xuân Hòa)
  'osm_building_a1_dhsp2', // Khu Hiệu bộ A1–A3 ĐHSP Hà Nội 2
  'osm_landmark_dhsp2_gate', // Cổng chính ĐHSP Hà Nội 2
  'osm_landmark_nha_trang_xuan_hoa', // Nhà Trắng Xuân Hòa
  'osm_landmark_quang_truong_chim_xanh', // Quảng trường Con Chim Xanh
  'osm_landmark_nui_than_lan', // Núi Thằn Lằn & Di tích Bốt Pháp
  'osm_civic_ubnd_xuan_hoa', // Đảng ủy - HĐND - UBND Phường Xuân Hòa
  'osm_market_cho_xuan_hoa', // Chợ Xuân Hòa
  'osm_way_662917178', // Trường THPT Xuân Hòa
]);

/**
 * Kiểm tra xem một PlaceLocation có phải là Landmark đặc biệt (850) hay không
 */
export function isSpecialIconicLandmark(
  place: Pick<PlaceLocation, 'id' | 'name' | 'category' | 'showByDefault'>
): boolean {
  if (SPECIAL_ICONIC_LANDMARK_IDS.has(place.id)) return true;
  const lower = (place.name || '').toLowerCase();
  return (
    lower.includes('đại học sư phạm hà nội 2') ||
    lower.includes('đại học kiến trúc hà nội') ||
    lower.includes('nhà trắng xuân hòa') ||
    lower.includes('quảng trường con chim xanh') ||
    lower.includes('núi thằn lằn') ||
    lower.includes('ubnd phường xuân hòa') ||
    lower.includes('chợ xuân hòa')
  );
}

/**
 * Kiểm tra xem một PlaceLocation có phải là công trình Hành chính / Y tế / Giáo dục lớn (750) hay không
 */
export function isMajorCivicOrCampusPlace(
  place: Pick<
    PlaceLocation,
    'id' | 'name' | 'category' | 'parentCategoryId' | 'subcategoryId' | 'showByDefault'
  >
): boolean {
  if (isSpecialIconicLandmark(place)) return true;
  if (isDefaultVisibleMapLandmark(place)) return true;
  const cat = String(place.category);
  const lower = (place.name || '').toLowerCase();
  if (cat === 'public' || cat === 'school' || cat === 'medical') {
    if (
      lower.includes('đại học') ||
      lower.includes('cao đẳng') ||
      lower.includes('viện') ||
      lower.includes('thpt') ||
      lower.includes('thcs') ||
      lower.includes('tiểu học') ||
      lower.includes('ubnd') ||
      lower.includes('công an') ||
      lower.includes('trạm y tế') ||
      lower.includes('phòng khám đa khoa') ||
      lower.includes('bệnh viện') ||
      lower.includes('bưu điện') ||
      lower.includes('hội trường') ||
      lower.includes('thư viện')
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Kiểm tra xem một PlaceLocation có phải là địa danh mặc định trên bản đồ (Phần 5, 29–30, 51) hay không
 */
export function isAreaLandmarkPlace(
  place: Pick<
    PlaceLocation,
    | 'id'
    | 'name'
    | 'category'
    | 'dataSource'
    | 'parentCategoryId'
    | 'subcategoryId'
    | 'showByDefault'
  >
): boolean {
  if (typeof place.showByDefault === 'boolean') return place.showByDefault;
  if (isDefaultVisibleMapLandmark(place)) return true;
  const cat = String(place.category);
  if (cat === 'public' || cat === 'school' || cat === 'medical') return true;
  return false;
}

/**
 * Kiểm tra xem quán có phải quán nổi bật / ưu tiên (550) hay không
 */
export function isFeaturedShopPlace(place: PlaceLocation): boolean {
  if (isAreaLandmarkPlace(place)) return false;
  const rating = place.metadata?.rating ?? place.originalPlace?.rating ?? 0;
  const reviews = place.metadata?.reviewCount ?? place.originalPlace?.reviewCount ?? 0;
  const rarity = place.originalPlace?.rarity ?? 0;
  return rating >= 4.8 || reviews >= 45 || rarity >= 2;
}

export interface EvaluatePoiPriorityInput {
  place: PlaceLocation;
  selectedPlaceId?: string | null;
  hoveredPlaceId?: string | null;
  routeTargetId?: string | null;
  searchMatchedIds?: Set<string> | null;
}

export interface PoiPriorityEvaluation {
  priority: number;
  tier: PoiPriorityTier;
  isLandmark: boolean;
  isSpecialLandmark: boolean;
  isMajorCivic: boolean;
}

/**
 * Tính điểm ưu tiên chuẩn hóa (450 -> 1000) dùng chung cho cả Bản đồ 2D và Bản đồ 3D (Phần 42)
 */
export function evaluatePoiPriority(input: EvaluatePoiPriorityInput): PoiPriorityEvaluation {
  const { place, selectedPlaceId, hoveredPlaceId, routeTargetId, searchMatchedIds } = input;

  const isSpecial = isSpecialIconicLandmark(place);
  const isMajor = isMajorCivicOrCampusPlace(place);
  const isLandmark = isAreaLandmarkPlace(place);

  if (selectedPlaceId && place.id === selectedPlaceId) {
    return {
      priority: POI_PRIORITY.SELECTED,
      tier: 'selected',
      isLandmark,
      isSpecialLandmark: isSpecial,
      isMajorCivic: isMajor,
    };
  }

  if (routeTargetId && place.id === routeTargetId) {
    return {
      priority: POI_PRIORITY.ROUTE_TARGET,
      tier: 'route_target',
      isLandmark,
      isSpecialLandmark: isSpecial,
      isMajorCivic: isMajor,
    };
  }

  if (
    (hoveredPlaceId && place.id === hoveredPlaceId) ||
    (searchMatchedIds && searchMatchedIds.has(place.id))
  ) {
    return {
      priority: 920,
      tier: 'selected',
      isLandmark,
      isSpecialLandmark: isSpecial,
      isMajorCivic: isMajor,
    };
  }

  if (isSpecial) {
    return {
      priority: POI_PRIORITY.LANDMARK_SPECIAL,
      tier: 'landmark_special',
      isLandmark: true,
      isSpecialLandmark: true,
      isMajorCivic: true,
    };
  }

  if (isMajor || isLandmark) {
    return {
      priority: POI_PRIORITY.CIVIC_MAJOR,
      tier: 'civic_major',
      isLandmark: true,
      isSpecialLandmark: false,
      isMajorCivic: isMajor,
    };
  }

  if (isFeaturedShopPlace(place)) {
    return {
      priority: POI_PRIORITY.SHOP_FEATURED,
      tier: 'shop_featured',
      isLandmark: false,
      isSpecialLandmark: false,
      isMajorCivic: false,
    };
  }

  const _cat: MapCategoryKey = place.category;
  void _cat;

  return {
    priority: POI_PRIORITY.SHOP_NORMAL,
    tier: 'shop_normal',
    isLandmark: false,
    isSpecialLandmark: false,
    isMajorCivic: false,
  };
}
