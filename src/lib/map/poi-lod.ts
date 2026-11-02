import { PlaceLocation, MapCategoryKey } from './map-types';
import {
  POI_PRIORITY,
  evaluatePoiPriority,
  isSpecialIconicLandmark,
  isMajorCivicOrCampusPlace,
  isAreaLandmarkPlace,
} from './poi-priority';
import { doesPlaceMatchQuickFilter } from './map-category-registry';

/**
 * CẤU HÌNH NGƯỠNG HIỂN THỊ POI THEO MỨC ZOOM 2D & KHOẢNG CÁCH CAMERA 3D (PHẦN 43–46)
 */
export const POI_LOD_CONFIG = {
  /** Ngưỡng Zoom trên Bản đồ 2D (MapLibre) */
  map2D: {
    farMaxZoom: 13.8,
    midMaxZoom: 15.2,
    nearMaxZoom: 16.4,
    labelShowZoom: 16.4,
    detailShowZoom: 17.2,
    /** Khi đang lọc danh mục ở zoom xa (< 15.15), gom các quán gần nhau thành Cluster số gọn */
    clusterMaxZoom: 15.15,
  },

  /** Ngưỡng khoảng cách Camera (mét) trên Bản đồ 3D (Three.js) */
  map3D: {
    farMinDistance: 1200,
    midMinDistance: 650,
    nearMinDistance: 360,
    labelMaxDistance: 360,
    detailMaxDistance: 230,
    /** Khi đang lọc danh mục ở xa (> 620m), gom các quán gần nhau thành Cluster số gọn */
    clusterMinDistance: 620,
  },

  categoryThresholds: {
    public: { minZoom2D: 12.2, maxDist3D: 2600, labelMinZoom2D: 13.6, labelMaxDist3D: 1450 },
    school: { minZoom2D: 12.2, maxDist3D: 2600, labelMinZoom2D: 13.6, labelMaxDist3D: 1450 },
    medical: { minZoom2D: 12.5, maxDist3D: 2300, labelMinZoom2D: 14.0, labelMaxDist3D: 1250 },
    food: { minZoom2D: 13.0, maxDist3D: 1800, labelMinZoom2D: 16.2, labelMaxDist3D: 380 },
    pub: { minZoom2D: 13.0, maxDist3D: 1800, labelMinZoom2D: 16.2, labelMaxDist3D: 380 },
    cafe: { minZoom2D: 13.0, maxDist3D: 1800, labelMinZoom2D: 16.2, labelMaxDist3D: 380 },
    snack: { minZoom2D: 13.0, maxDist3D: 1800, labelMinZoom2D: 16.2, labelMaxDist3D: 380 },
    billiards: { minZoom2D: 13.0, maxDist3D: 1800, labelMinZoom2D: 16.2, labelMaxDist3D: 380 },
    game: { minZoom2D: 13.0, maxDist3D: 1800, labelMinZoom2D: 16.2, labelMaxDist3D: 380 },
    entertainment: { minZoom2D: 13.0, maxDist3D: 1800, labelMinZoom2D: 16.2, labelMaxDist3D: 380 },
    phone: { minZoom2D: 13.0, maxDist3D: 1800, labelMinZoom2D: 16.2, labelMaxDist3D: 380 },
    grocery: { minZoom2D: 13.0, maxDist3D: 1800, labelMinZoom2D: 16.2, labelMaxDist3D: 380 },
    supermarket: { minZoom2D: 13.0, maxDist3D: 1800, labelMinZoom2D: 16.2, labelMaxDist3D: 380 },
    service: { minZoom2D: 13.0, maxDist3D: 1800, labelMinZoom2D: 16.2, labelMaxDist3D: 380 },
  } as Record<
    Exclude<MapCategoryKey, 'all' | 'game_asset'>,
    { minZoom2D: number; maxDist3D: number; labelMinZoom2D: number; labelMaxDist3D: number }
  >,

  categoryClusterDominanceRatio: 0.7,
  cameraStopDebounceMs: 150,
} as const;

export interface GetPoiRenderStateInput {
  place: PlaceLocation;
  zoomOrCameraDistance: number;
  selectedPlaceId?: string | null;
  hoveredPlaceId?: string | null;
  routeTargetId?: string | null;
  mapMode: '2d' | '3d';
  /**
   * Bộ lọc danh mục đang bật:
   * - `null` / `'none'` / `[]`: Trạng thái mặc định khi mở bản đồ -> Chỉ hiện Core Landmarks (`showByDefault: true`), TẮT toàn bộ quán/business (Phần 5, 29–30, 33, 54).
   * - `string` (VD: `'food'`, `'cafe'`, `'billiards'`, `'fuel_station'`, `'shopping'`...): Chỉ hiện các địa điểm khớp bộ lọc đó (Phần 34).
   */
  activeCategoryFilter?: string | MapCategoryKey | MapCategoryKey[] | null;
  isCameraMoving?: boolean;
  searchMatchedIds?: Set<string> | null;
}

export interface PoiRenderState {
  visible: boolean;
  showIcon: boolean;
  showLabel: boolean;
  showDetails: boolean;
  priority: number;
  clusterable: boolean;
}

/**
 * HELPER THỐNG NHẤT QUYẾT ĐỊNH TRẠNG THÁI RENDER CỦA TỪNG POI TRÊN CẢ 2D & 3D (PHẦN 33–34, 43–46, 54)
 */
export function getPoiRenderState(input: GetPoiRenderStateInput): PoiRenderState {
  const {
    place,
    zoomOrCameraDistance,
    selectedPlaceId,
    hoveredPlaceId,
    routeTargetId,
    mapMode,
    activeCategoryFilter = null,
    isCameraMoving = false,
    searchMatchedIds = null,
  } = input;

  if (
    !place.coordinateVerified ||
    place.lat === null ||
    place.lng === null ||
    place.visibilityStatus === 'hidden' ||
    place.visibilityStatus === 'deleted' ||
    place.visibilityStatus === 'blocked'
  ) {
    return {
      visible: false,
      showIcon: false,
      showLabel: false,
      showDetails: false,
      priority: 0,
      clusterable: false,
    };
  }

  const evalResult = evaluatePoiPriority({
    place,
    selectedPlaceId,
    hoveredPlaceId,
    routeTargetId,
    searchMatchedIds,
  });

  const { priority } = evalResult;
  const isSelected = Boolean(selectedPlaceId && place.id === selectedPlaceId);
  const isRouteTarget = Boolean(routeTargetId && place.id === routeTargetId);
  const isHovered = Boolean(hoveredPlaceId && place.id === hoveredPlaceId);
  const isSearchMatch = Boolean(searchMatchedIds && searchMatchedIds.has(place.id));

  // 1. SELECTED PLACE, ROUTE TARGET, HOVERED, SEARCH MATCH: Luôn hiển thị độc lập (Phần 39, 43)
  if (isSelected || isRouteTarget || isHovered || isSearchMatch) {
    return {
      visible: true,
      showIcon: true,
      showLabel: true,
      showDetails: isSelected || isRouteTarget,
      priority,
      clusterable: false,
    };
  }

  const isSpecial = isSpecialIconicLandmark(place);
  const isMajor = isMajorCivicOrCampusPlace(place);
  const isCoreLandmark = isAreaLandmarkPlace(place);

  // Xác định bộ lọc danh mục đang bật
  let normalizedFilter: string | null = null;
  if (typeof activeCategoryFilter === 'string') {
    normalizedFilter =
      activeCategoryFilter === 'none' || activeCategoryFilter === ''
        ? null
        : activeCategoryFilter;
  } else if (Array.isArray(activeCategoryFilter)) {
    if (activeCategoryFilter.includes('all')) {
      normalizedFilter = 'all';
    } else if (activeCategoryFilter.length === 1) {
      normalizedFilter = activeCategoryFilter[0];
    } else if (activeCategoryFilter.length > 1) {
      // Tương thích mảng cũ
      const hasCommercial = activeCategoryFilter.some(
        (c) => c !== 'public' && c !== 'school'
      );
      normalizedFilter = hasCommercial ? 'all' : null;
    }
  }

  const isFilteringActive = normalizedFilter !== null;
  const matchesActiveFilter = isFilteringActive
    ? doesPlaceMatchQuickFilter(place, normalizedFilter)
    : false;

  // 2. QUY TẮC SỐ 1 (PHẦN 5, 29–30, 33, 54):
  // KHI CHƯA CHỌN DANH MỤC (`!isFilteringActive`):
  // - Business / Quán bình thường (`!isCoreLandmark`): `visible = false`, `clusterable = false`!
  // - Chỉ Core Landmarks (`showByDefault: true`) được hiển thị sạch sẽ trên bản đồ.
  if (!isFilteringActive) {
    if (!isCoreLandmark) {
      return {
        visible: false,
        showIcon: false,
        showLabel: false,
        showDetails: false,
        priority,
        clusterable: false,
      };
    }
  } else {
    // KHI NGƯỜI DÙNG ĐÃ BẤM CHỌN MỘT DANH MỤC (VD: [Ăn uống], [Cafe], [Bi-a], [Cây xăng]...):
    // - Nếu địa điểm khớp bộ lọc -> hiển thị theo LOD (cluster ở xa, icon ở gần, tên ở rất gần).
    // - Nếu là Core Landmark đặc biệt (850) -> vẫn giữ hiển thị nền để định hướng không gian, hoặc nếu lọc đúng nhóm của nó.
    if (!matchesActiveFilter && !isSpecial) {
      return {
        visible: false,
        showIcon: false,
        showLabel: false,
        showDetails: false,
        priority,
        clusterable: false,
      };
    }
  }

  // 3. XỬ LÝ THEO BẢN ĐỒ 2D (MapLibre Zoom)
  if (mapMode === '2d') {
    const zoom = zoomOrCameraDistance;

    // Địa danh biểu tượng cấp đặc biệt (850)
    if (isSpecial) {
      return {
        visible: true,
        showIcon: true,
        showLabel: zoom >= 13.8 && !isCameraMoving,
        showDetails: zoom >= 15.6,
        priority,
        clusterable: false,
      };
    }

    // Địa danh lõi / Cơ quan / Trường học / Y tế / Chợ (750) khi mở bản đồ mặc định hoặc khi lọc đúng nhóm
    if (isCoreLandmark && !matchesActiveFilter) {
      const minZ = isMajor ? 13.2 : 14.1;
      const visible = zoom >= minZ;
      return {
        visible,
        showIcon: visible,
        showLabel: visible && zoom >= 15.25 && !isCameraMoving,
        showDetails: zoom >= 16.2,
        priority,
        clusterable: false,
      };
    }

    // Địa điểm / Quán khớp bộ lọc danh mục đang chọn (Phần 34 & 43–46)
    const clusterable = zoom < POI_LOD_CONFIG.map2D.clusterMaxZoom;
    const visible = zoom >= 12.6;
    // Không hiện tên tất cả quán mặc định ở zoom trung; chỉ hiện tên ngắn khi zoom rất gần (>= 16.1)
    const showLabel = visible && !isCameraMoving && zoom >= 16.1;

    return {
      visible,
      showIcon: visible,
      showLabel,
      showDetails: zoom >= POI_LOD_CONFIG.map2D.detailShowZoom,
      priority,
      clusterable,
    };
  }

  // 4. XỬ LÝ THEO BẢN ĐỒ 3D (Three.js Camera Distance tính bằng mét)
  const dist = zoomOrCameraDistance;

  if (isSpecial) {
    return {
      visible: true,
      showIcon: true,
      showLabel: dist <= 1250 && !isCameraMoving,
      showDetails: dist <= 650,
      priority,
      clusterable: false,
    };
  }

  if (isCoreLandmark && !matchesActiveFilter) {
    const maxD = isMajor ? 1650 : 1100;
    const visible = dist <= maxD;
    return {
      visible,
      showIcon: visible,
      showLabel: visible && dist <= 520 && !isCameraMoving,
      showDetails: dist <= 420,
      priority,
      clusterable: false,
    };
  }

  const clusterable = dist > POI_LOD_CONFIG.map3D.clusterMinDistance;
  const visible = dist <= 2200;
  const showLabel = visible && !isCameraMoving && dist <= POI_LOD_CONFIG.map3D.labelMaxDistance;

  return {
    visible,
    showIcon: visible,
    showLabel,
    showDetails: dist <= POI_LOD_CONFIG.map3D.detailMaxDistance,
    priority,
    clusterable,
  };
}

export interface PoiClusterItem {
  id: string;
  lat: number;
  lng: number;
  count: number;
  memberIds: string[];
  sampleNames: string[];
  dominantCategory: Exclude<MapCategoryKey, 'all' | 'game_asset'> | null;
  emoji: string | null;
  categoryIcon: string | null;
  /** Chỉ hiển thị con số gọn gàng (VD: "10"), tuyệt đối không dùng emoji hay "10 địa điểm" (Phần 31–32) */
  badgeText: string;
  colorHex: string;
  bgHex: string;
  badgeBg: string;
  badgeBorder: string;
  targetZoom2D: number;
  targetDistance3D: number;
}

/**
 * Thuật toán gom cụm không gian (Spatial Grid Clustering) dùng chung cho cả 2D và 3D (Phần 31–32, 60).
 * - Khi không bật bộ lọc danh mục (`activeCategoryFilter === null`), không tạo bất kỳ cluster quán nào!
 * - Khi đang bật bộ lọc danh mục ở zoom xa, gom các quán gần nhau thành badge tròn/compact chỉ hiện số lượng (`10`),
 *   nền trắng trung tính (`#FFFFFF`), viền Emerald (`#059669`), chữ đậm (`#0F172A`), tuyệt đối không emoji!
 * - Đảm bảo không bao giờ vừa hiện cluster vừa hiện marker con của cùng nhóm (Phần 60).
 */
export function computeSpatialPoiClusters(options: {
  places: PlaceLocation[];
  mapMode: '2d' | '3d';
  zoomOrCameraDistance: number;
  selectedPlaceId?: string | null;
  hoveredPlaceId?: string | null;
  routeTargetId?: string | null;
  activeCategoryFilter?: string | MapCategoryKey | MapCategoryKey[] | null;
  isCameraMoving?: boolean;
  searchMatchedIds?: Set<string> | null;
}): {
  clusters: PoiClusterItem[];
  visiblePlaces: Array<{ place: PlaceLocation; state: PoiRenderState }>;
} {
  const {
    places,
    mapMode,
    zoomOrCameraDistance,
    selectedPlaceId,
    hoveredPlaceId,
    routeTargetId,
    activeCategoryFilter = null,
    isCameraMoving = false,
    searchMatchedIds = null,
  } = options;

  const shouldCluster =
    mapMode === '2d'
      ? zoomOrCameraDistance < POI_LOD_CONFIG.map2D.clusterMaxZoom
      : zoomOrCameraDistance > POI_LOD_CONFIG.map3D.clusterMinDistance;

  let cellSizeDeg = 0.0018;
  if (mapMode === '2d') {
    const z = zoomOrCameraDistance;
    if (z < 13.5) cellSizeDeg = 0.0042;
    else if (z < 14.3) cellSizeDeg = 0.0026;
    else if (z < 14.9) cellSizeDeg = 0.0017;
    else cellSizeDeg = 0.00115;
  } else {
    const d = zoomOrCameraDistance;
    if (d > 1400) cellSizeDeg = 0.004;
    else if (d > 950) cellSizeDeg = 0.0026;
    else if (d > 700) cellSizeDeg = 0.0017;
    else cellSizeDeg = 0.00115;
  }

  const nonClusteredCandidates: Array<{ place: PlaceLocation; state: PoiRenderState }> = [];
  const gridBuckets = new Map<string, Array<{ place: PlaceLocation; state: PoiRenderState }>>();

  for (let i = 0; i < places.length; i++) {
    const place = places[i];
    if (place.lat === null || place.lng === null || !place.coordinateVerified) continue;

    const state = getPoiRenderState({
      place,
      zoomOrCameraDistance,
      selectedPlaceId,
      hoveredPlaceId,
      routeTargetId,
      mapMode,
      activeCategoryFilter,
      isCameraMoving,
      searchMatchedIds,
    });

    if (!state.visible) continue;

    if (shouldCluster && state.clusterable) {
      const gx = Math.floor(place.lng / cellSizeDeg);
      const gy = Math.floor(place.lat / cellSizeDeg);
      const key = `${gx}_${gy}`;
      let bucket = gridBuckets.get(key);
      if (!bucket) {
        bucket = [];
        gridBuckets.set(key, bucket);
      }
      bucket.push({ place, state });
    } else {
      nonClusteredCandidates.push({ place, state });
    }
  }

  const clusters: PoiClusterItem[] = [];

  if (shouldCluster) {
    for (const [key, bucket] of gridBuckets.entries()) {
      if (bucket.length === 1) {
        const single = bucket[0];
        nonClusteredCandidates.push({
          place: single.place,
          state: {
            ...single.state,
            visible: true,
            showIcon: true,
          },
        });
        continue;
      }

      let sumLat = 0;
      let sumLng = 0;
      const memberIds: string[] = [];
      const sampleNames: string[] = [];

      for (let j = 0; j < bucket.length; j++) {
        const p = bucket[j].place;
        sumLat += p.lat!;
        sumLng += p.lng!;
        memberIds.push(p.id);
        if (sampleNames.length < 4) sampleNames.push(p.name);
      }

      const centerLat = sumLat / bucket.length;
      const centerLng = sumLng / bucket.length;

      const nextZoom2D =
        mapMode === '2d'
          ? Math.min(16.2, Math.max(zoomOrCameraDistance + 1.35, 15.4))
          : 15.6;
      const nextDist3D =
        mapMode === '3d'
          ? Math.max(320, Math.min(zoomOrCameraDistance * 0.48, 480))
          : 420;

      // Phần 31–32: Cluster chỉ hiển thị con số gọn gàng ("10"), monochrome trắng + viền Emerald (#059669), tuyệt đối không emoji
      clusters.push({
        id: `cluster_${key}`,
        lat: Number(centerLat.toFixed(6)),
        lng: Number(centerLng.toFixed(6)),
        count: bucket.length,
        memberIds,
        sampleNames,
        dominantCategory: null,
        emoji: null,
        categoryIcon: null,
        badgeText: `${bucket.length}`,
        colorHex: '#0F172A',
        bgHex: '#FFFFFF',
        badgeBg: '#FFFFFF',
        badgeBorder: '#059669',
        targetZoom2D: nextZoom2D,
        targetDistance3D: nextDist3D,
      });
    }
  }

  nonClusteredCandidates.sort((a, b) => {
    if (b.state.priority !== a.state.priority) {
      return b.state.priority - a.state.priority;
    }
    return a.place.id.localeCompare(b.place.id);
  });

  clusters.sort((a, b) => b.count - a.count);

  return {
    clusters,
    visiblePlaces: nonClusteredCandidates,
  };
}
