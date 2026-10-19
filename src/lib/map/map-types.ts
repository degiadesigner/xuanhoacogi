import type { Place } from '@/lib/places-xuanhoa';

/**
 * 15 Danh mục chuẩn của XUHO CITY theo Phần 6.3
 */
export type MapCategoryKey =
  | 'all'
  | 'food'
  | 'cafe'
  | 'snack'
  | 'pub'
  | 'billiards'
  | 'game'
  | 'entertainment'
  | 'phone'
  | 'grocery'
  | 'supermarket'
  | 'service'
  | 'school'
  | 'public'
  | 'game_asset';

/**
 * Nguồn xác minh tọa độ theo Phần 3.2 & Phần 7
 */
export type CoordinateSource =
  | 'openstreetmap'
  | 'admin_verified'
  | 'merchant_verified'
  | 'nominatim_geocoded'
  | 'unverified';

/**
 * Nguồn dữ liệu gốc của địa điểm
 */
export type PlaceDataSource =
  | 'places_xuanhoa'
  | 'openstreetmap'
  | 'admin_custom';

/**
 * Model địa điểm chuẩn hóa theo Phần 7 (PlaceLocation)
 */
export interface PlaceLocation {
  id: string;
  name: string;
  category: Exclude<MapCategoryKey, 'all' | 'game_asset'>;
  address: string;
  lat: number | null;
  lng: number | null;
  coordinateSource: CoordinateSource;
  coordinateVerified: boolean;
  dataSource: PlaceDataSource;
  lastVerifiedAt: string | null;
  phone?: string;
  openHours?: string;
  imageUrl?: string;
  insideWard?: boolean;
  originalPlace?: Place;
  metadata: {
    osmId?: string;
    zone?: string;
    distance?: string;
    priceRange?: string;
    rating?: number;
    reviewCount?: number;
    signatureDishName?: string;
    signatureDishPrice?: number;
    tags?: string[];
    website?: string;
    subType?: string;
    quip?: string;
    mapsQuery?: string;
    mapsUrl?: string;
    merchantClaimCode?: string;
    claimedByEmail?: string;
    claimedByName?: string;
    liveStatus?: 'open_normal' | 'busy_hot' | 'closed_today';
    liveStatusNote?: string;
    hasPendingSubmission?: boolean;
  };
}

/**
 * Kết quả tìm kiếm tuyến đường thực tế từ OpenStreetMap
 */
export interface RoadSearchResult {
  id: string;
  name: string;
  highway: string;
  tier: 'major' | 'secondary' | 'minor' | 'alley';
  lat: number;
  lng: number;
  osmId: string;
  segmentsCount: number;
  insideWard: boolean;
}

/**
 * Lịch sử giao dịch ảo trong Game (Phần 9)
 */
export interface GameAssetTransaction {
  txId: string;
  action: 'mint_demo' | 'buy_virtual' | 'rent_virtual' | 'list_virtual';
  actorName: string;
  amountXu: number;
  timestamp: string;
  isDemo: true;
}

/**
 * Thực thể Tài sản Game (Entity C — Phần 9)
 * Tách biệt hoàn toàn với dữ liệu địa lý thật và gắn nhãn DEMO rõ ràng trong MVP.
 */
export interface GameAsset {
  id: string;
  name: string;
  assetType: 'land_lot' | 'virtual_house' | 'virtual_shop' | 'campus_hub';
  linkedGeoOsmId?: string;
  linkedPlaceId?: string;
  districtLabel: string;
  lat: number;
  lng: number;
  ownershipStatus: 'available' | 'owned' | 'for_rent' | 'system_landmark';
  rentalStatus: 'none' | 'renting' | 'seeking_tenant';
  ownerAccountId: string | null;
  ownerDisplayName: string | null;
  ownerAvatar?: string;
  virtualBuyPriceXu: number;
  virtualRentPriceXuPerDay: number;
  assetState: 'active_demo' | 'developing' | 'locked';
  description: string;
  perks: string[];
  transactionHistory: GameAssetTransaction[];
  isDemoData: true;
}

/**
 * Trạng thái bật/tắt độc lập 5 lớp bản đồ (Phần 4)
 */
export interface MapLayerVisibility {
  baseGeography: boolean;
  buildings: boolean;
  waterAndParks: boolean;
  realPois: boolean;
  gameAssets: boolean;
  userLocation: boolean;
  wardBoundary: boolean;
}

/**
 * Vùng nhảy nhanh (Camera Presets) đã xác minh tọa độ từ OpenStreetMap
 */
export interface MapAreaPreset {
  id: string;
  label: string;
  sublabel: string;
  lat: number;
  lng: number;
  zoom: number;
}

/**
 * Báo cáo chất lượng dữ liệu địa lý trung thực (Phần 3.3)
 */
export interface DataQualityReport {
  scopeName: string;
  osmRelationId: number;
  mergedUnits: string[];
  sources: Array<{
    name: string;
    license: string;
    updatedAt: string;
    usageNote: string;
  }>;
  stats: {
    osmRoadsCount: number;
    osmNamedRoadsCount: number;
    osmBuildingsCount: number;
    osmWaterPolygonsCount: number;
    osmWaterwaysCount: number;
    osmLanduseCount: number;
    osmVerifiedPoisCount: number;
    catalogTotalPlaces: number;
    catalogVerifiedCoordsCount: number;
    catalogPendingVerificationCount: number;
  };
  knownLimitations: string[];
}
